/**
 * ChartCalibrationModal
 *
 * Workflow:
 *   1. Doctor uploaded a chart image (PDF rendered to PNG by GrowthCurveManager).
 *   2. This modal opens with the image visible.
 *   3. Doctor selects the chart kind (taille / poids / taille_poids / pc / imc).
 *   4. Doctor enters the two reference values for the X axis (e.g. age 1y and 18y)
 *      and clicks the corresponding pixels on the image. Same for the Y axis.
 *      For composite charts (taille + poids on the same image) doctor calibrates
 *      a secondary Y axis as well.
 *   5. The calibration is sent to the backend, which validates the math and
 *      marks the curve as 'doctor_approved' so it can be used for plotting
 *      patient measurements.
 *
 * Pixel coordinates captured here are in the image's NATIVE pixel space, not
 * in the displayed CSS space. We do this by reading the click position relative
 * to the rendered <img>, then scaling by naturalWidth/naturalHeight.
 */
import { useMemo, useState } from 'react';
import Modal from '../../common/Modal';
import Button from '../../common/Button';
import doctorService from '../../../services/doctorService';
import { showSuccess, showError } from '../../../utils/toast';

const CHART_KINDS = [
    { value: 'taille', label: 'Taille seule', secondary: false, primary: { axis: 'taille', unit: 'cm' } },
    { value: 'poids', label: 'Poids seul', secondary: false, primary: { axis: 'poids', unit: 'kg' } },
    { value: 'pc', label: 'Périmètre crânien', secondary: false, primary: { axis: 'pc', unit: 'cm' } },
    { value: 'imc', label: 'IMC', secondary: false, primary: { axis: 'imc', unit: 'kg/m²' } },
    {
        value: 'taille_poids',
        label: 'Taille + Poids (composite AFPA)',
        secondary: true,
        primary: { axis: 'taille', unit: 'cm' },
        secondaryAxis: { axis: 'poids', unit: 'kg' },
    },
];

const X_UNITS = [
    { value: 'years', label: 'années' },
    { value: 'months', label: 'mois' },
];

function getNativePixel(event, imgEl) {
    if (!imgEl) return null;
    const rect = imgEl.getBoundingClientRect();
    const cssX = event.clientX - rect.left;
    const cssY = event.clientY - rect.top;
    const px = (cssX / rect.width) * imgEl.naturalWidth;
    const py = (cssY / rect.height) * imgEl.naturalHeight;
    return { px, py };
}

function CalibrationStep({ index, label, instructions, captured, isActive, onCapture, color = '#2563eb' }) {
    return (
        <div style={{
            padding: 8,
            borderRadius: 8,
            border: `2px solid ${isActive ? '#f59e0b' : (captured ? color : '#cbd5e1')}`,
            background: isActive ? '#fffbeb' : (captured ? '#ecfdf5' : '#fff'),
            transition: 'all 0.2s ease'
        }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? '#d97706' : 'inherit' }}>
                Étape {index} : {label} {isActive && '(En cours...)'}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                {instructions}
            </div>
            {captured ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                    <div style={{ fontSize: 11, color, fontWeight: 500 }}>
                        ✓ pixel ({captured.px.toFixed(0)}, {captured.py.toFixed(0)})
                    </div>
                    {!isActive && (
                        <button 
                            onClick={onCapture} 
                            style={{ background: 'transparent', border: `1px solid ${color}`, color: color, borderRadius: 4, padding: '2px 8px', fontSize: 10, cursor: 'pointer' }}
                        >
                            Modifier
                        </button>
                    )}
                </div>
            ) : (
                !isActive && (
                    <button 
                        onClick={onCapture} 
                        style={{ marginTop: 6, background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}
                    >
                        Cliquer pour activer
                    </button>
                )
            )}
        </div>
    );
}

export default function ChartCalibrationModal({ isOpen, onClose, curveId, imageUrl, imageWidth, imageHeight, onSaved }) {
    const [chartKind, setChartKind] = useState('taille_poids');
    const [xUnit, setXUnit] = useState('years');
    const [xA, setXA] = useState('1');
    const [xB, setXB] = useState('18');
    const [yPA, setYPA] = useState('60');
    const [yPB, setYPB] = useState('200');
    const [ySA, setYSA] = useState('0');
    const [ySB, setYSB] = useState('110');

    // Captured pixels for each step
    const [pxXA, setPxXA] = useState(null);
    const [pxXB, setPxXB] = useState(null);
    const [pyYPA, setPyYPA] = useState(null);
    const [pyYPB, setPyYPB] = useState(null);
    const [pyYSA, setPyYSA] = useState(null);
    const [pyYSB, setPyYSB] = useState(null);

    // Which step is currently capturing the next click
    const [activeStep, setActiveStep] = useState(null);
    const [imgEl, setImgEl] = useState(null);
    const [saving, setSaving] = useState(false);
    
    // For rotation
    const [currentImageUrl, setCurrentImageUrl] = useState(imageUrl);
    const [currentWidth, setCurrentWidth] = useState(imageWidth);
    const [currentHeight, setCurrentHeight] = useState(imageHeight);
    const [rotatedImageDataUrl, setRotatedImageDataUrl] = useState(null);

    const chartCfg = useMemo(() => CHART_KINDS.find((k) => k.value === chartKind), [chartKind]);
    const isComposite = Boolean(chartCfg?.secondary);

    function handleChartKindChange(next) {
        setChartKind(next);
        const cfg = CHART_KINDS.find((k) => k.value === next);
        if (!cfg) return;
        if (cfg.primary.axis === 'taille') { setYPA('60'); setYPB('200'); }
        else if (cfg.primary.axis === 'poids') { setYPA('0'); setYPB('110'); }
        else if (cfg.primary.axis === 'pc') { setYPA('30'); setYPB('60'); }
        else if (cfg.primary.axis === 'imc') { setYPA('10'); setYPB('30'); }
        if (cfg.secondary) { setYSA('0'); setYSB('110'); }
    }

    function handleImageClick(event) {
        if (!activeStep || !imgEl) return;
        const pos = getNativePixel(event, imgEl);
        if (!pos) return;
        switch (activeStep) {
            case 'xA': setPxXA(pos); break;
            case 'xB': setPxXB(pos); break;
            case 'yPA': setPyYPA(pos); break;
            case 'yPB': setPyYPB(pos); break;
            case 'ySA': setPyYSA(pos); break;
            case 'ySB': setPyYSB(pos); break;
            default: break;
        }
        // auto-advance to next missing step
        const order = isComposite
            ? ['xA', 'xB', 'yPA', 'yPB', 'ySA', 'ySB']
            : ['xA', 'xB', 'yPA', 'yPB'];
        const captured = {
            xA: activeStep === 'xA' ? pos : pxXA,
            xB: activeStep === 'xB' ? pos : pxXB,
            yPA: activeStep === 'yPA' ? pos : pyYPA,
            yPB: activeStep === 'yPB' ? pos : pyYPB,
            ySA: activeStep === 'ySA' ? pos : pyYSA,
            ySB: activeStep === 'ySB' ? pos : pyYSB,
        };
        const next = order.find((k) => !captured[k]);
        setActiveStep(next || null);
    }

    function handleRotate() {
        if (!imgEl) return;
        const canvas = document.createElement('canvas');
        canvas.width = currentHeight;
        canvas.height = currentWidth;
        const ctx = canvas.getContext('2d');
        // Rotate 90 degrees clockwise
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((90 * Math.PI) / 180);
        ctx.drawImage(imgEl, -currentWidth / 2, -currentHeight / 2, currentWidth, currentHeight);
        
        const newDataUrl = canvas.toDataURL('image/png');
        setCurrentImageUrl(newDataUrl);
        setRotatedImageDataUrl(newDataUrl);
        setCurrentWidth(currentHeight);
        setCurrentHeight(currentWidth);
        
        // Clear captured points because they are invalid on the rotated image
        setPxXA(null); setPxXB(null);
        setPyYPA(null); setPyYPB(null);
        setPyYSA(null); setPyYSB(null);
        setActiveStep('xA');
    }

    const allCaptured = useMemo(() => {
        const base = pxXA && pxXB && pyYPA && pyYPB;
        if (!isComposite) return base;
        return base && pyYSA && pyYSB;
    }, [pxXA, pxXB, pyYPA, pyYPB, pyYSA, pyYSB, isComposite]);

    async function handleSave() {
        if (!allCaptured || !curveId) return;
        const calibration = {
            imageWidth: currentWidth,
            imageHeight: currentHeight,
            x: {
                aA: Number(xA),
                aB: Number(xB),
                pxA: pxXA.px,
                pxB: pxXB.px,
                unit: xUnit,
            },
            yPrimary: {
                axis: chartCfg.primary.axis,
                unit: chartCfg.primary.unit,
                vA: Number(yPA),
                vB: Number(yPB),
                pyA: pyYPA.py,
                pyB: pyYPB.py,
            },
            ySecondary: isComposite
                ? {
                    axis: chartCfg.secondaryAxis.axis,
                    unit: chartCfg.secondaryAxis.unit,
                    vA: Number(ySA),
                    vB: Number(ySB),
                    pyA: pyYSA.py,
                    pyB: pyYSB.py,
                }
                : null,
        };

        setSaving(true);
        try {
            const res = await doctorService.saveCurveCalibration(curveId, {
                chartKind,
                calibration,
                rotatedImageDataUrl,
            });
            if (res?.success) {
                showSuccess('Calibration enregistrée');
                onSaved && onSaved(res.data);
                onClose && onClose();
            } else {
                const errs = (res?.errors || []).join(' • ');
                showError([res?.message, errs].filter(Boolean).join(' — ') || 'Échec');
            }
        } catch (e) {
            const errs = (e?.response?.data?.errors || []).join(' • ');
            showError([e?.response?.data?.message, errs].filter(Boolean).join(' — ')
                || e?.message || 'Erreur réseau');
        }
        setSaving(false);
    }

    if (!isOpen) return null;

    const stepDefs = [
        {
            key: 'xA', label: `Premier point X (${xA} ${xUnit === 'years' ? 'an(s)' : 'mois'})`,
            instructions: `Cliquez sur l'image à l'intersection avec l'axe X correspondant à ${xA} ${xUnit === 'years' ? 'an(s)' : 'mois'}.`,
            captured: pxXA, color: '#2563eb',
        },
        {
            key: 'xB', label: `Second point X (${xB} ${xUnit === 'years' ? 'an(s)' : 'mois'})`,
            instructions: `Cliquez sur l'image à ${xB} ${xUnit === 'years' ? 'an(s)' : 'mois'}.`,
            captured: pxXB, color: '#2563eb',
        },
        {
            key: 'yPA', label: `Premier point Y (${chartCfg?.primary.axis} = ${yPA} ${chartCfg?.primary.unit})`,
            instructions: `Cliquez sur la ligne horizontale à ${yPA} ${chartCfg?.primary.unit}.`,
            captured: pyYPA, color: '#9333ea',
        },
        {
            key: 'yPB', label: `Second point Y (${chartCfg?.primary.axis} = ${yPB} ${chartCfg?.primary.unit})`,
            instructions: `Cliquez sur la ligne horizontale à ${yPB} ${chartCfg?.primary.unit}.`,
            captured: pyYPB, color: '#9333ea',
        },
    ];
    if (isComposite) {
        stepDefs.push(
            {
                key: 'ySA', label: `Y secondaire (${chartCfg.secondaryAxis.axis} = ${ySA} ${chartCfg.secondaryAxis.unit})`,
                instructions: `Cliquez sur la valeur ${ySA} ${chartCfg.secondaryAxis.unit} de l'axe Y secondaire (souvent à droite).`,
                captured: pyYSA, color: '#16a34a',
            },
            {
                key: 'ySB', label: `Y secondaire (${chartCfg.secondaryAxis.axis} = ${ySB} ${chartCfg.secondaryAxis.unit})`,
                instructions: `Cliquez sur ${ySB} ${chartCfg.secondaryAxis.unit} de l'axe Y secondaire.`,
                captured: pyYSB, color: '#16a34a',
            },
        );
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Calibrer la courbe" maxWidth="1200px" modalStyle={{ width: '95vw', maxWidth: '1200px' }} bodyStyle={{ overflowY: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
                <div style={{ border: '1px solid #cbd5e1', borderRadius: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#f8fafc', justifyContent: 'center' }}>
                    <div style={{ padding: 8, borderBottom: '1px solid #cbd5e1', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                        <Button size="sm" variant="outline" onClick={handleRotate} disabled={saving}>
                            ↻ Faire pivoter (90°)
                        </Button>
                    </div>
                    <div style={{ position: 'relative', width: 'fit-content', margin: '0 auto' }}>
                        <img
                            ref={setImgEl}
                            crossOrigin="anonymous"
                            src={currentImageUrl}
                            alt="Chart"
                            onClick={handleImageClick}
                            style={{
                                width: 'auto',
                                height: 'auto',
                                maxWidth: '100%',
                                maxHeight: '60vh',
                                display: 'block',
                                cursor: activeStep ? 'crosshair' : 'default',
                                userSelect: 'none',
                            }}
                            draggable={false}
                        />
                        {/* visual markers for captured points */}
                        {imgEl && [
                            { p: pxXA, color: '#2563eb', label: 'X1' },
                            { p: pxXB, color: '#2563eb', label: 'X2' },
                            { p: pyYPA, color: '#9333ea', label: 'Y1' },
                            { p: pyYPB, color: '#9333ea', label: 'Y2' },
                            { p: pyYSA, color: '#16a34a', label: 'Y1\'' },
                            { p: pyYSB, color: '#16a34a', label: 'Y2\'' },
                        ].map((m, i) => m.p && (
                            <div key={i} style={{
                                position: 'absolute',
                                left: `${(m.p.px / currentWidth) * 100}%`,
                                top: `${(m.p.py / currentHeight) * 100}%`,
                                width: 24, height: 24,
                                background: 'transparent',
                                borderRadius: '50%',
                                border: `2px solid ${m.color}`,
                                transform: 'translate(-50%, -50%)',
                                pointerEvents: 'none',
                                opacity: 0.85,
                            }}>
                                {/* Tiny center dot */}
                                <div style={{
                                    position: 'absolute', left: '50%', top: '50%',
                                    width: 4, height: 4, background: m.color,
                                    borderRadius: '50%', transform: 'translate(-50%, -50%)'
                                }} />
                                <div style={{
                                    position: 'absolute', left: 24, top: 0,
                                    fontSize: 10, color: '#fff', background: m.color,
                                    padding: '0 4px', borderRadius: 4, whiteSpace: 'nowrap',
                                    textShadow: '0px 0px 2px rgba(0,0,0,0.5)',
                                }}>{m.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '68vh', overflowY: 'auto' }}>
                    <div>
                        <label style={{ fontSize: 12, fontWeight: 600 }}>Type de courbe</label>
                        <select className="input-field" value={chartKind} onChange={(e) => handleChartKindChange(e.target.value)}>
                            {CHART_KINDS.map((k) => (
                                <option key={k.value} value={k.value}>{k.label}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div>
                            <label style={{ fontSize: 12 }}>Unité X</label>
                            <select className="input-field" value={xUnit} onChange={(e) => setXUnit(e.target.value)}>
                                {X_UNITS.map((u) => (<option key={u.value} value={u.value}>{u.label}</option>))}
                            </select>
                        </div>
                        <div />
                        <div>
                            <label style={{ fontSize: 12 }}>X point 1</label>
                            <input className="input-field" type="number" value={xA} onChange={(e) => setXA(e.target.value)} />
                        </div>
                        <div>
                            <label style={{ fontSize: 12 }}>X point 2</label>
                            <input className="input-field" type="number" value={xB} onChange={(e) => setXB(e.target.value)} />
                        </div>
                        <div>
                            <label style={{ fontSize: 12 }}>Y primaire 1 ({chartCfg?.primary.unit})</label>
                            <input className="input-field" type="number" value={yPA} onChange={(e) => setYPA(e.target.value)} />
                        </div>
                        <div>
                            <label style={{ fontSize: 12 }}>Y primaire 2 ({chartCfg?.primary.unit})</label>
                            <input className="input-field" type="number" value={yPB} onChange={(e) => setYPB(e.target.value)} />
                        </div>
                        {isComposite && (
                            <>
                                <div>
                                    <label style={{ fontSize: 12 }}>Y secondaire 1 ({chartCfg.secondaryAxis.unit})</label>
                                    <input className="input-field" type="number" value={ySA} onChange={(e) => setYSA(e.target.value)} />
                                </div>
                                <div>
                                    <label style={{ fontSize: 12 }}>Y secondaire 2 ({chartCfg.secondaryAxis.unit})</label>
                                    <input className="input-field" type="number" value={ySB} onChange={(e) => setYSB(e.target.value)} />
                                </div>
                            </>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {stepDefs.map((s, i) => (
                            <CalibrationStep
                                key={s.key}
                                index={i + 1}
                                label={s.label}
                                instructions={s.instructions}
                                captured={s.captured}
                                isActive={activeStep === s.key}
                                color={s.color}
                                onCapture={() => setActiveStep(s.key)}
                            />
                        ))}
                    </div>

                    {activeStep && (
                        <div style={{
                            padding: 8, borderRadius: 6, background: '#dbeafe', color: '#1e3a8a', fontSize: 12,
                        }}>
                            👆 Cliquez sur l'image au point demandé. Cliquez une autre étape pour annuler.
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <Button variant="ghost" onClick={onClose} disabled={saving}>Annuler</Button>
                        <Button onClick={handleSave} disabled={!allCaptured || saving} style={{ marginLeft: 'auto' }}>
                            {saving ? 'Enregistrement…' : 'Enregistrer la calibration'}
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
