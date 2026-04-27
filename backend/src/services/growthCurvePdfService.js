const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { v4: uuidv4 } = require('uuid');

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function getPdfImages(filePath) {
    const buffer = fs.readFileSync(filePath);
    const text = buffer.toString('latin1');
    const images = [];
    let index = -1;

    while ((index = text.indexOf('/Subtype/Image', index + 1)) !== -1) {
        const dictStart = text.lastIndexOf('<<', index);
        const streamKeyword = text.indexOf('stream', index);
        const dict = text.slice(dictStart, streamKeyword);
        const width = Number(dict.match(/\/Width\s+(\d+)/)?.[1]);
        const height = Number(dict.match(/\/Height\s+(\d+)/)?.[1]);
        const bitsPerComponent = Number(dict.match(/\/BitsPerComponent\s+(\d+)/)?.[1]);
        const colorSpace = dict.match(/\/ColorSpace\/([A-Za-z0-9]+)/)?.[1] || 'unknown';

        if (!width || !height || bitsPerComponent !== 8) continue;

        let dataStart = streamKeyword + 'stream'.length;
        if (buffer[dataStart] === 0x0d && buffer[dataStart + 1] === 0x0a) dataStart += 2;
        else if (buffer[dataStart] === 0x0a) dataStart += 1;

        const endKeyword = text.indexOf('endstream', dataStart);
        let dataEnd = endKeyword;
        if (buffer[dataEnd - 2] === 0x0d && buffer[dataEnd - 1] === 0x0a) dataEnd -= 2;
        else if (buffer[dataEnd - 1] === 0x0a) dataEnd -= 1;

        const compressed = buffer.slice(dataStart, dataEnd);
        const raw = zlib.inflateSync(compressed);
        const channels = colorSpace === 'DeviceGray' ? 1 : 3;

        if (raw.length < width * height * channels) continue;

        images.push({
            width,
            height,
            colorSpace,
            channels,
            raw: raw.slice(0, width * height * channels)
        });
    }

    return images;
}

function compositeOnWhite(rgbImage, maskImage) {
    const out = Buffer.alloc(rgbImage.width * rgbImage.height * 3);
    const canApplyMask = maskImage &&
        maskImage.colorSpace === 'DeviceGray' &&
        maskImage.width === rgbImage.width &&
        maskImage.height === rgbImage.height;

    for (let i = 0; i < rgbImage.width * rgbImage.height; i += 1) {
        const alpha = canApplyMask ? maskImage.raw[i] / 255 : 1;
        out[i * 3] = Math.round(rgbImage.raw[i * 3] * alpha + 255 * (1 - alpha));
        out[i * 3 + 1] = Math.round(rgbImage.raw[i * 3 + 1] * alpha + 255 * (1 - alpha));
        out[i * 3 + 2] = Math.round(rgbImage.raw[i * 3 + 2] * alpha + 255 * (1 - alpha));
    }

    return {
        width: rgbImage.width,
        height: rgbImage.height,
        raw: out
    };
}

function rotateClockwise(image) {
    const out = Buffer.alloc(image.width * image.height * 3);
    const newWidth = image.height;
    const newHeight = image.width;

    for (let y = 0; y < image.height; y += 1) {
        for (let x = 0; x < image.width; x += 1) {
            const src = (y * image.width + x) * 3;
            const nx = image.height - 1 - y;
            const ny = x;
            const dst = (ny * newWidth + nx) * 3;
            out[dst] = image.raw[src];
            out[dst + 1] = image.raw[src + 1];
            out[dst + 2] = image.raw[src + 2];
        }
    }

    return { width: newWidth, height: newHeight, raw: out };
}

function shouldRotateClockwise(originalName, image, measureKey) {
    const name = normalizeText(originalName);
    if (name.includes('perimetre') || name.includes('cranien') || name.includes('-pc-') || name.includes('courbes-pc')) {
        return true;
    }
    if (name.includes('1-mois-3-ans') || name.includes('1 mois 3 ans')) return true;
    if (measureKey === 'head' && image.height > image.width) return true;
    return image.width > image.height * 1.25 && name.includes('1-18') === false;
}

function isDarkPixel(raw, offset) {
    const r = raw[offset];
    const g = raw[offset + 1];
    const b = raw[offset + 2];
    return r < 225 || g < 225 || b < 225;
}

function clustersFromScores(scores, threshold, minGap = 3) {
    const clusters = [];
    let start = null;
    let last = null;

    scores.forEach((score, index) => {
        if (score >= threshold) {
            if (start === null) start = index;
            last = index;
        } else if (start !== null && index - last > minGap) {
            clusters.push({ start, end: last, center: Math.round((start + last) / 2) });
            start = null;
            last = null;
        }
    });

    if (start !== null) {
        clusters.push({ start, end: last, center: Math.round((start + last) / 2) });
    }

    return clusters;
}

function detectPlotArea(image) {
    const columnScores = Array(image.width).fill(0);
    const rowScores = Array(image.height).fill(0);

    for (let y = 0; y < image.height; y += 1) {
        for (let x = 0; x < image.width; x += 1) {
            const offset = (y * image.width + x) * 3;
            if (isDarkPixel(image.raw, offset)) {
                columnScores[x] += 1;
                rowScores[y] += 1;
            }
        }
    }

    const verticalClusters = clustersFromScores(columnScores, image.height * 0.28);
    const horizontalClusters = clustersFromScores(rowScores, image.width * 0.28);

    if (verticalClusters.length < 3 || horizontalClusters.length < 3) {
        return { left: 8, top: 8, right: 92, bottom: 92, confidence: 0.2 };
    }

    const left = verticalClusters[0].center;
    const right = verticalClusters[verticalClusters.length - 1].center;
    const top = horizontalClusters[0].center;
    const bottom = horizontalClusters[horizontalClusters.length - 1].center;

    return {
        left: Number(((left / image.width) * 100).toFixed(3)),
        top: Number(((top / image.height) * 100).toFixed(3)),
        right: Number(((right / image.width) * 100).toFixed(3)),
        bottom: Number(((bottom / image.height) * 100).toFixed(3)),
        confidence: Math.min(0.95, (verticalClusters.length + horizontalClusters.length) / 80)
    };
}

function writeBmp(image, outputPath) {
    const rowSize = Math.ceil((image.width * 3) / 4) * 4;
    const pixelSize = rowSize * image.height;
    const fileSize = 54 + pixelSize;
    const bmp = Buffer.alloc(fileSize);

    bmp.write('BM', 0);
    bmp.writeUInt32LE(fileSize, 2);
    bmp.writeUInt32LE(54, 10);
    bmp.writeUInt32LE(40, 14);
    bmp.writeInt32LE(image.width, 18);
    bmp.writeInt32LE(image.height, 22);
    bmp.writeUInt16LE(1, 26);
    bmp.writeUInt16LE(24, 28);
    bmp.writeUInt32LE(pixelSize, 34);

    for (let y = 0; y < image.height; y += 1) {
        const srcY = image.height - 1 - y;
        for (let x = 0; x < image.width; x += 1) {
            const src = (srcY * image.width + x) * 3;
            const dst = 54 + y * rowSize + x * 3;
            bmp[dst] = image.raw[src + 2];
            bmp[dst + 1] = image.raw[src + 1];
            bmp[dst + 2] = image.raw[src];
        }
    }

    fs.writeFileSync(outputPath, bmp);
}

function inferGender(originalName, fallbackGender) {
    const name = normalizeText(originalName);
    if (name.includes('garcon') || name.includes('boys')) return 'male';
    if (name.includes('fille') || name.includes('girls')) return 'female';
    return fallbackGender || 'both';
}

function inferAgeDomainMonths(originalName) {
    const name = normalizeText(originalName);
    if (name.includes('1-18') || name.includes('1 a 18') || name.includes('1 18')) return [0, 216];
    if (name.includes('1-mois-3-ans') || name.includes('1 mois 3 ans')) return [0, 36];
    if (name.includes('5-ans') || name.includes('5 ans')) return [0, 60];
    if (name.includes('3-ans') || name.includes('3 ans')) return [0, 36];
    return [0, 60];
}

function inferYDomain(measureKey, originalName) {
    const name = normalizeText(originalName);

    if (measureKey === 'height') {
        if (name.includes('1-18') || name.includes('1 a 18')) return [60, 210];
        if (name.includes('1-mois-3-ans') || name.includes('1 mois 3 ans')) return [40, 110];
        return [40, 130];
    }

    if (measureKey === 'weight') {
        if (name.includes('1-18') || name.includes('1 a 18')) return [0, 110];
        if (name.includes('1-mois-3-ans') || name.includes('1 mois 3 ans')) return [0, 22];
        return [1, 35];
    }

    if (measureKey === 'head') return [30, 60];
    if (measureKey === 'bmi') return [8, 35];
    return [0, 100];
}

function getKnownPlotArea(originalName, measureKey) {
    const name = normalizeText(originalName);

    if (name.includes('1-mois-3-ans') || name.includes('1 mois 3 ans')) {
        if (measureKey === 'height') {
            return { left: 4.952, top: 4.98, right: 95.27, bottom: 87.093, confidence: 0.98 };
        }

        if (measureKey === 'weight') {
            return { left: 4.952, top: 4.98, right: 95.27, bottom: 87.093, confidence: 0.98 };
        }
    }

    if (name.includes('1-18') || name.includes('1 a 18')) {
        if (measureKey === 'height') {
            return { left: 7.692, top: 3.776, right: 92.65, bottom: 90.885, confidence: 0.98 };
        }

        if (measureKey === 'weight') {
            return { left: 7.692, top: 26.953, right: 92.65, bottom: 90.234, confidence: 0.98 };
        }
    }

    return null;
}

function inferMeasureKeys(originalName, fallbackMeasure, imageCount) {
    const name = normalizeText(originalName);

    if ((name.includes('taille-et-poids') || name.includes('taille et poids')) && imageCount >= 2) {
        return ['height', 'weight'];
    }

    if (name.includes('taille')) return ['height'];
    if (name.includes('poids')) return ['weight'];
    if (name.includes('perimetre') || name.includes('cranien') || name.includes('pc')) return ['head'];
    if (name.includes('imc') || name.includes('corpulence')) return ['bmi'];

    return [fallbackMeasure || 'weight'];
}

function buildExtractedCharts(file, options = {}) {
    const pdfImages = getPdfImages(file.path);
    const rgbImages = [];

    for (let index = 0; index < pdfImages.length; index += 1) {
        const image = pdfImages[index];
        if (image.colorSpace !== 'DeviceRGB') continue;

        const previous = pdfImages[index - 1];
        rgbImages.push(compositeOnWhite(image, previous));
    }

    const meaningfulImages = rgbImages
        .filter((image) => image.width >= 300 && image.height >= 300)
        .slice(0, 4);

    const measureKeys = inferMeasureKeys(file.originalname, options.measureKey, meaningfulImages.length);
    const gender = inferGender(file.originalname, options.gender);
    const ageDomain = inferAgeDomainMonths(file.originalname);

    return meaningfulImages.map((rawImage, index) => {
        const measureKey = measureKeys[index] || measureKeys[0] || options.measureKey || 'weight';
        const image = shouldRotateClockwise(file.originalname, rawImage, measureKey) ? rotateClockwise(rawImage) : rawImage;
        const plotArea = getKnownPlotArea(file.originalname, measureKey) || detectPlotArea(image);
        const yDomain = inferYDomain(measureKey, file.originalname);

        return {
            image,
            measureKey,
            gender,
            templateConfig: {
                source: 'pdf_extracted',
                label: `${measureKey} ${gender}`,
                x_min: ageDomain[0],
                x_max: ageDomain[1],
                y_min: yDomain[0],
                y_max: yDomain[1],
                x_unit: 'months',
                y_unit: measureKey === 'weight' ? 'kg' : measureKey === 'height' || measureKey === 'head' ? 'cm' : '',
                plot_area: {
                    left: plotArea.left,
                    top: plotArea.top,
                    right: plotArea.right,
                    bottom: plotArea.bottom
                },
                auto_confidence: plotArea.confidence
            }
        };
    });
}

function saveExtractedChartImage(image) {
    const uploadDir = path.join(__dirname, '../../uploads/curves/extracted');
    fs.mkdirSync(uploadDir, { recursive: true });

    const filename = `${uuidv4()}.bmp`;
    const outputPath = path.join(uploadDir, filename);
    writeBmp(image, outputPath);

    return `uploads/curves/extracted/${filename}`;
}

module.exports = {
    buildExtractedCharts,
    saveExtractedChartImage
};
