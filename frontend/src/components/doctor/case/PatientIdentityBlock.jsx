import React from 'react';
import { computeAgeDisplay, formatDateOnlyDisplay } from '../../../utils/patientAge';

function PatientIdentityBlock({ patient }) {
    if (!patient) return null;

    const firstName = patient.first_name || patient.firstName || '';
    const lastName = patient.last_name || patient.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim() || '—';
    const dob = patient.date_of_birth || patient.dateOfBirth || '';
    const age = computeAgeDisplay(dob);
    const address = patient.address || '—';
    const phone = patient.phone || '—';
    const siblingsAlive = patient.siblings_alive ?? patient.siblingsAlive;
    const siblingsDeceased = patient.siblings_deceased ?? patient.siblingsDeceased;

    return (
        <div className="card mb-6">
            <div className="card-header border-b" style={{ paddingBottom: 'var(--space-sm)' }}>
                <h2 className="card-title">👤 Identité Patient</h2>
            </div>
            <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Nom & Prénom</span>
                        <span style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-primary)' }}>{fullName}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Téléphone</span>
                        <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>{phone}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Sexe</span>
                        <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>{patient.gender === 'male' ? 'Homme' : patient.gender === 'female' ? 'Femme' : 'Non précisé'}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Date de naissance</span>
                        <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>{formatDateOnlyDisplay(dob)}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Âge</span>
                        <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>{age.label}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Adresse</span>
                        <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>{address || '—'}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Frères/sœurs vivants</span>
                        <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>{Number.isFinite(Number(siblingsAlive)) ? Number(siblingsAlive) : '—'}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Frères/sœurs décédés</span>
                        <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>{Number.isFinite(Number(siblingsDeceased)) ? Number(siblingsDeceased) : '—'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PatientIdentityBlock;
