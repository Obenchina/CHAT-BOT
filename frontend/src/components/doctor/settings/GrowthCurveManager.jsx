import React, { useState, useEffect, useRef } from 'react';
import doctorService from '../../../services/doctorService';
import { getAuthUploadUrl } from '../../../constants/config';
import { showSuccess, showError } from '../../../utils/toast';

function GrowthCurveManager() {
    const [curves, setCurves] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [measureKey, setMeasureKey] = useState('weight');
    const [gender, setGender] = useState('both');
    
    // Template Calibration State
    const [calibratingCurve, setCalibratingCurve] = useState(null);
    const [calibrationStep, setCalibrationStep] = useState(0); // 0: idle, 1: P1 (origin), 2: P2 (end)
    const [tempP1, setTempP1] = useState(null); // pixel %
    const [tempP2, setTempP2] = useState(null); // pixel %
    const [templateValues, setTemplateValues] = useState({
        min_age: 0,
        max_age: 36,
        min_y: 0,
        max_y: 20
    });
    
    const imgRef = useRef(null);

    useEffect(() => {
        loadCurves();
    }, []);

    async function loadCurves() {
        setLoading(true);
        try {
            const res = await doctorService.getGrowthCurves();
            if (res.success) setCurves(res.data);
        } catch (e) { console.error(e); }
        setLoading(false);
    }

    async function handleUpload() {
        if (!selectedFile) return showError("Sélectionnez un fichier");
        setUploading(true);
        const fd = new FormData();
        fd.append('curve', selectedFile);
        fd.append('measureKey', measureKey);
        fd.append('gender', gender);
        
        try {
            const res = await doctorService.uploadGrowthCurve(fd);
            if (res.success) {
                setSelectedFile(null);
                loadCurves();
                // Start calibration automatically for the new curve
                setCalibratingCurve(res.data);
                setCalibrationStep(1);
                setTempP1(null);
                setTempP2(null);
                showSuccess("Image uploadée. Veuillez la calibrer maintenant.");
            }
        } catch (e) { showError(e.message); }
        setUploading(false);
    }

    const handleImageClick = (e) => {
        if (calibrationStep === 0) return;
        
        const rect = imgRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100; // Percentage
        const y = ((e.clientY - rect.top) / rect.height) * 100; // Percentage
        
        if (calibrationStep === 1) {
            setTempP1({ x, y });
        } else if (calibrationStep === 2) {
            setTempP2({ x, y });
        }
    };

    async function saveCalibration() {
        if (!tempP1 || !tempP2) return showError("Veuillez marquer les deux points sur l'image");
        
        const template_config = {
            min_age: parseFloat(templateValues.min_age),
            max_age: parseFloat(templateValues.max_age),
            min_y: parseFloat(templateValues.min_y),
            max_y: parseFloat(templateValues.max_y),
            plot_area: {
                left: Math.min(tempP1.x, tempP2.x),
                top: Math.min(tempP1.y, tempP2.y),
                right: Math.max(tempP1.x, tempP2.x),
                bottom: Math.max(tempP1.y, tempP2.y)
            }
        };
        
        try {
            const res = await doctorService.calibrateGrowthCurve(calibratingCurve.id, { template_config });
            if (res.success) {
                setCalibratingCurve(null);
                setCalibrationStep(0);
                setTempP1(null);
                setTempP2(null);
                loadCurves();
                showSuccess("Calibration enregistrée avec succès. La précision est maintenant garantie.");
            }
        } catch (e) { showError(e.message); }
    }

    function openCalibration(curve) {
        setCalibratingCurve(curve);
        setCalibrationStep(1);
        setTempP1(null);
        setTempP2(null);
        // Pre-fill template values from existing config if available
        if (curve.template_config) {
            setTemplateValues({
                min_age: curve.template_config.min_age ?? 0,
                max_age: curve.template_config.max_age ?? 36,
                min_y: curve.template_config.min_y ?? 0,
                max_y: curve.template_config.max_y ?? 20
            });
        } else {
            setTemplateValues({ min_age: 0, max_age: 36, min_y: 0, max_y: 20 });
        }
    }

    const MEASURE_LABELS = {
        weight: 'Poids (kg)',
        height: 'Taille (cm)',
        head: 'PC (cm)',
        bmi: 'IMC'
    };

    return (
        <div className="growth-curve-manager">
            {/* Upload Section */}
            <div className="profile-section-card" style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="section-header">
                    <div className="section-title">📈 Ajouter une courbe de référence</div>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
                    <b>Instructions :</b> Uploadez <b>une image</b> de votre courbe de référence (PNG, JPEG). Si vous avez un PDF, prenez-en une capture d'écran.
                    Ensuite, calibrez-la en indiquant les <b>coins de la zone de tracé</b> et les valeurs min/max des axes.
                </p>
                
                <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-md)' }}>
                    <div className="input-group">
                        <label>Type de mesure</label>
                        <select className="input-field" value={measureKey} onChange={e => setMeasureKey(e.target.value)}>
                            <option value="weight">Poids</option>
                            <option value="height">Taille</option>
                            <option value="head">Périmètre Crânien</option>
                            <option value="bmi">IMC</option>
                        </select>
                    </div>
                    <div className="input-group">
                        <label>Sexe</label>
                        <select className="input-field" value={gender} onChange={e => setGender(e.target.value)}>
                            <option value="both">Mixte</option>
                            <option value="male">Garçon</option>
                            <option value="female">Fille</option>
                        </select>
                    </div>
                    <div className="input-group">
                        <label>Fichier Image (JPG/PNG)</label>
                        <input type="file" className="input-field" accept="image/*" onChange={e => setSelectedFile(e.target.files[0])} />
                    </div>
                </div>
                
                <button 
                    className="btn-save" 
                    style={{ marginTop: 'var(--space-md)', width: '100%' }}
                    onClick={handleUpload}
                    disabled={uploading}
                >
                    {uploading ? 'Upload...' : 'Uploader et Calibrer'}
                </button>
            </div>

            {/* List Section */}
            <div className="curves-list">
                <h4 style={{ marginBottom: 'var(--space-md)' }}>Mes courbes de référence</h4>
                {curves.length === 0 && !loading && (
                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 'var(--space-xl)' }}>
                        Aucune courbe uploadée. Commencez par uploader une image de courbe.
                    </p>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 'var(--space-md)' }}>
                    {curves.map(c => (
                        <div key={c.id} className="profile-section-card" style={{ padding: 'var(--space-md)', border: c.is_calibrated ? '1px solid var(--success)' : '1px solid var(--error)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{MEASURE_LABELS[c.measure_key] || c.measure_key} — {c.gender === 'male' ? 'Garçon' : c.gender === 'female' ? 'Fille' : 'Mixte'}</div>
                                    <div style={{ fontSize: '0.75rem', color: c.is_calibrated ? 'var(--success)' : 'var(--error)' }}>
                                        {c.is_calibrated ? '✓ Calibrée (Précise)' : '⚠ Non calibrée (Inutilisable)'}
                                    </div>
                                    {c.is_calibrated && c.template_config && (
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                            Âge: {c.template_config.min_age}–{c.template_config.max_age} mois | 
                                            {' '}{MEASURE_LABELS[c.measure_key]?.split(' ')[0]}: {c.template_config.min_y}–{c.template_config.max_y}
                                        </div>
                                    )}
                                </div>
                                <button onClick={() => { if(window.confirm("Supprimer?")) doctorService.deleteGrowthCurve(c.id).then(loadCurves) }} style={{ border: 'none', background: 'none', color: 'red', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
                            </div>
                            <div style={{ marginTop: 'var(--space-sm)', display: 'flex', gap: 'var(--space-sm)' }}>
                                <button className="btn-secondary" style={{ fontSize: '0.7rem', padding: '4px 8px' }} onClick={() => openCalibration(c)}>
                                    {c.is_calibrated ? 'Recalibrer' : 'Calibrer maintenant'}
                                </button>
                                <a href={getAuthUploadUrl(c.file_path)} target="_blank" rel="noreferrer" style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center' }}>Voir fichier</a>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Calibration Modal — Template-based */}
            {calibratingCurve && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', flexDirection: 'column', padding: 'var(--space-xl)' }}>
                    <div style={{ color: 'white', marginBottom: 'var(--space-md)', display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                            <h3 style={{ margin: 0 }}>Calibration par Template</h3>
                            <p style={{ fontSize: '0.9rem', color: '#ccc' }}>
                                {calibrationStep === 1
                                    ? "Étape 1 : Cliquez sur le COIN BAS-GAUCHE de la zone de tracé (origine du graphique)"
                                    : "Étape 2 : Cliquez sur le COIN HAUT-DROIT de la zone de tracé (fin du graphique)"}
                            </p>
                        </div>
                        <button className="btn-secondary" onClick={() => { setCalibratingCurve(null); setCalibrationStep(0); }}>Fermer</button>
                    </div>

                    <div style={{ flex: 1, position: 'relative', overflow: 'auto', backgroundColor: '#111', borderRadius: 'var(--radius-lg)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                            <img 
                                ref={imgRef}
                                src={getAuthUploadUrl(calibratingCurve.file_path)} 
                                alt="Calibration" 
                                style={{ maxWidth: '90vw', maxHeight: '65vh', cursor: 'crosshair', display: 'block' }}
                                onClick={handleImageClick}
                            />
                            {/* P1 marker — bottom-left origin */}
                            {tempP1 && <div style={{ position: 'absolute', left: `${tempP1.x}%`, top: `${tempP1.y}%`, width: '14px', height: '14px', background: '#ff4444', borderRadius: '50%', transform: 'translate(-50%, -50%)', border: '2px solid white', boxShadow: '0 0 8px rgba(255,0,0,0.6)' }} title="Coin bas-gauche" />}
                            {/* P2 marker — top-right end */}
                            {tempP2 && <div style={{ position: 'absolute', left: `${tempP2.x}%`, top: `${tempP2.y}%`, width: '14px', height: '14px', background: '#4488ff', borderRadius: '50%', transform: 'translate(-50%, -50%)', border: '2px solid white', boxShadow: '0 0 8px rgba(0,100,255,0.6)' }} title="Coin haut-droit" />}
                            {/* Show selection rectangle if both points exist */}
                            {tempP1 && tempP2 && (
                                <div style={{
                                    position: 'absolute',
                                    left: `${Math.min(tempP1.x, tempP2.x)}%`,
                                    top: `${Math.min(tempP1.y, tempP2.y)}%`,
                                    width: `${Math.abs(tempP2.x - tempP1.x)}%`,
                                    height: `${Math.abs(tempP2.y - tempP1.y)}%`,
                                    border: '2px dashed rgba(255,255,255,0.6)',
                                    backgroundColor: 'rgba(67,199,216,0.1)',
                                    pointerEvents: 'none'
                                }} />
                            )}
                        </div>
                    </div>

                    <div style={{ backgroundColor: 'white', padding: 'var(--space-lg)', marginTop: 'var(--space-md)', borderRadius: 'var(--radius-lg)' }}>
                        <div style={{ display: 'flex', gap: 'var(--space-xl)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <div className="input-group" style={{ flex: 1, minWidth: '200px' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Axe horizontal (Âge en mois)</label>
                                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                    <input type="number" placeholder="Min" className="input-field" value={templateValues.min_age} onChange={e => setTemplateValues({...templateValues, min_age: e.target.value})} />
                                    <span style={{ alignSelf: 'center' }}>→</span>
                                    <input type="number" placeholder="Max" className="input-field" value={templateValues.max_age} onChange={e => setTemplateValues({...templateValues, max_age: e.target.value})} />
                                </div>
                            </div>
                            <div className="input-group" style={{ flex: 1, minWidth: '200px' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Axe vertical ({MEASURE_LABELS[calibratingCurve.measure_key] || 'Valeur'})</label>
                                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                    <input type="number" placeholder="Min" className="input-field" value={templateValues.min_y} onChange={e => setTemplateValues({...templateValues, min_y: e.target.value})} />
                                    <span style={{ alignSelf: 'center' }}>→</span>
                                    <input type="number" placeholder="Max" className="input-field" value={templateValues.max_y} onChange={e => setTemplateValues({...templateValues, max_y: e.target.value})} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                                <button 
                                    className="btn-secondary" 
                                    onClick={() => setCalibrationStep(calibrationStep === 1 ? 2 : 1)}
                                    disabled={calibrationStep === 1 && !tempP1}
                                >
                                    {calibrationStep === 1 ? "Passer au Point 2 →" : "← Revenir au Point 1"}
                                </button>
                                <button className="btn-save" onClick={saveCalibration} disabled={!tempP1 || !tempP2}>
                                    ✓ Valider la calibration
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default GrowthCurveManager;
