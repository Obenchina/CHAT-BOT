import React, { useState, useEffect, useRef } from 'react';
import doctorService from '../../../services/doctorService';
import { getAuthUploadUrl } from '../../../constants/config';

function GrowthCurveManager() {
    const [curves, setCurves] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [measureKey, setMeasureKey] = useState('weight');
    const [gender, setGender] = useState('both');
    
    // Calibration State
    const [calibratingCurve, setCalibratingCurve] = useState(null);
    const [calibrationStep, setCalibrationStep] = useState(0); // 0: idle, 1: P1, 2: P2
    const [tempP1, setTempP1] = useState(null);
    const [tempP2, setTempP2] = useState(null);
    const [valP1, setValP1] = useState({ x: 0, y: 0 });
    const [valP2, setValP2] = useState({ x: 60, y: 30 });
    
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
        if (!selectedFile) return alert("Sélectionnez un fichier");
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
            }
        } catch (e) { alert(e.message); }
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
        if (!tempP1 || !tempP2) return alert("Veuillez marquer les deux points sur l'image");
        
        const data = {
            p1_x: tempP1.x,
            p1_y: tempP1.y,
            p1_val_x: parseFloat(valP1.x),
            p1_val_y: parseFloat(valP1.y),
            p2_x: tempP2.x,
            p2_y: tempP2.y,
            p2_val_x: parseFloat(valP2.x),
            p2_val_y: parseFloat(valP2.y)
        };
        
        try {
            const res = await doctorService.calibrateGrowthCurve(calibratingCurve.id, data);
            if (res.success) {
                setCalibratingCurve(null);
                setCalibrationStep(0);
                loadCurves();
                alert("Calibration enregistrée avec succès. La précision est maintenant garantie.");
            }
        } catch (e) { alert(e.message); }
    }

    return (
        <div className="growth-curve-manager">
            {/* Upload Section */}
            <div className="profile-section-card" style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="section-header">
                    <div className="section-title">📈 Ajouter une courbe de référence</div>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
                    <b>Important :</b> Pour garantir une précision absolue, vous devrez "calibrer" l'image après l'upload en indiquant deux points de référence sur la grille.
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
                        <label>Fichier (PDF ou Image)</label>
                        <input type="file" className="input-field" accept="image/*,application/pdf" onChange={e => setSelectedFile(e.target.files[0])} />
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 'var(--space-md)' }}>
                    {curves.map(c => (
                        <div key={c.id} className="profile-section-card" style={{ padding: 'var(--space-md)', border: c.is_calibrated ? '1px solid var(--success)' : '1px solid var(--error)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{c.measure_key} - {c.gender}</div>
                                    <div style={{ fontSize: '0.75rem', color: c.is_calibrated ? 'var(--success)' : 'var(--error)' }}>
                                        {c.is_calibrated ? '✓ Calibrée (Précise)' : '⚠ Non calibrée (Inutilisable)'}
                                    </div>
                                </div>
                                <button onClick={() => { if(window.confirm("Supprimer?")) doctorService.deleteGrowthCurve(c.id).then(loadCurves) }} style={{ border: 'none', background: 'none', color: 'red', cursor: 'pointer' }}>×</button>
                            </div>
                            <div style={{ marginTop: 'var(--space-sm)', display: 'flex', gap: 'var(--space-sm)' }}>
                                <button className="btn-secondary" style={{ fontSize: '0.7rem', padding: '4px 8px' }} onClick={() => { setCalibratingCurve(c); setCalibrationStep(1); }}>
                                    {c.is_calibrated ? 'Recalibrer' : 'Calibrer maintenant'}
                                </button>
                                <a href={getAuthUploadUrl(c.file_path)} target="_blank" rel="noreferrer" style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center' }}>Voir fichier</a>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Calibration Modal */}
            {calibratingCurve && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', flexDirection: 'column', padding: 'var(--space-xl)' }}>
                    <div style={{ color: 'white', marginBottom: 'var(--space-md)', display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                            <h3 style={{ margin: 0 }}>Outil de Calibration de Précision</h3>
                            <p style={{ fontSize: '0.9rem', color: '#ccc' }}>
                                {calibrationStep === 1 ? "Étape 1 : Cliquez sur l'Origine (0,0) sur le graphique" : "Étape 2 : Cliquez sur un point de référence éloigné (ex: Age Max, Valeur Max)"}
                            </p>
                        </div>
                        <button className="btn-secondary" onClick={() => setCalibratingCurve(null)}>Fermer</button>
                    </div>

                    <div style={{ flex: 1, position: 'relative', overflow: 'auto', backgroundColor: '#111', borderRadius: 'var(--radius-lg)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                            <img 
                                ref={imgRef}
                                src={getAuthUploadUrl(calibratingCurve.file_path)} 
                                alt="Calibration" 
                                style={{ maxWidth: '90vw', maxHeight: '70vh', cursor: 'crosshair', display: 'block' }}
                                onClick={handleImageClick}
                            />
                            {tempP1 && <div style={{ position: 'absolute', left: `${tempP1.x}%`, top: `${tempP1.y}%`, width: '12px', height: '12px', background: 'red', borderRadius: '50%', transform: 'translate(-50%, -50%)', border: '2px solid white', boxShadow: '0 0 5px rgba(0,0,0,0.5)' }} title="P1" />}
                            {tempP2 && <div style={{ position: 'absolute', left: `${tempP2.x}%`, top: `${tempP2.y}%`, width: '12px', height: '12px', background: 'blue', borderRadius: '50%', transform: 'translate(-50%, -50%)', border: '2px solid white', boxShadow: '0 0 5px rgba(0,0,0,0.5)' }} title="P2" />}
                        </div>
                    </div>

                    <div style={{ backgroundColor: 'white', padding: 'var(--space-lg)', marginTop: 'var(--space-md)', borderRadius: 'var(--radius-lg)', display: 'flex', gap: 'var(--space-xl)', alignItems: 'flex-end' }}>
                        <div className="input-group">
                            <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Valeurs réelles du Point 1 (Rouge)</label>
                            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                <input type="number" placeholder="Âge (mois)" className="input-field" value={valP1.x} onChange={e => setValP1({...valP1, x: e.target.value})} />
                                <input type="number" placeholder="Valeur" className="input-field" value={valP1.y} onChange={e => setValP1({...valP1, y: e.target.value})} />
                            </div>
                        </div>
                        <div className="input-group">
                            <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Valeurs réelles du Point 2 (Bleu)</label>
                            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                <input type="number" placeholder="Âge (mois)" className="input-field" value={valP2.x} onChange={e => setValP2({...valP2, x: e.target.value})} />
                                <input type="number" placeholder="Valeur" className="input-field" value={valP2.y} onChange={e => setValP2({...valP2, y: e.target.value})} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                            <button className="btn-secondary" onClick={() => setCalibrationStep(calibrationStep === 1 ? 2 : 1)}>
                                {calibrationStep === 1 ? "Passer au Point 2" : "Revenir au Point 1"}
                            </button>
                            <button className="btn-save" onClick={saveCalibration} disabled={!tempP1 || !tempP2}>
                                Valider et Garantir la précision
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default GrowthCurveManager;
