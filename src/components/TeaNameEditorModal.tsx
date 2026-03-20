import React, { useMemo } from 'react';
import { IonButton } from '@ionic/react';
import { getTeaNameSuggestions } from '../utils/teaNameSearch';

const PALETTE = {
    border: 'rgba(93, 113, 90, 0.16)',
    text: '#243126',
    muted: '#68756a',
    panel: '#fffdf8',
    suggestion: 'rgba(255, 255, 255, 0.72)',
    accent: 'linear-gradient(180deg, #f7f3eb 0%, #eef3ea 100%)',
};

type TeaNameEditorModalProps = {
    isOpen: boolean;
    title?: string;
    value: string;
    knownTeaNames: string[];
    onChange: (value: string) => void;
    onCancel: () => void;
    onSave: () => void;
    placeholder?: string;
    saveLabel?: string;
};

const TeaNameEditorModal: React.FC<TeaNameEditorModalProps> = ({
    isOpen,
    title = 'Tea Name',
    value,
    knownTeaNames,
    onChange,
    onCancel,
    onSave,
    placeholder = 'Tea name',
    saveLabel = 'Save',
}) => {
    const suggestions = useMemo(
        () => getTeaNameSuggestions(knownTeaNames, value).filter((teaName) => teaName.toLowerCase() !== value.trim().toLowerCase()),
        [knownTeaNames, value],
    );

    if (!isOpen) {
        return null;
    }

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(20, 28, 22, 0.24)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                zIndex: 1000,
            }}
        >
            <div
                style={{
                    width: 'min(420px, 100%)',
                    borderRadius: '24px',
                    background: PALETTE.panel,
                    border: `1px solid ${PALETTE.border}`,
                    boxShadow: '0 18px 36px rgba(40, 52, 40, 0.18)',
                    padding: '22px',
                }}
            >
                <h3 style={{ margin: '0 0 14px', fontSize: '1.1rem', fontWeight: 500 }}>{title}</h3>
                <input
                    autoFocus
                    type="text"
                    value={value}
                    placeholder={placeholder}
                    onChange={(event) => onChange(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            onSave();
                        }
                    }}
                    style={{
                        width: '100%',
                        padding: '14px 16px',
                        borderRadius: '16px',
                        border: `1px solid ${PALETTE.border}`,
                        fontSize: '1rem',
                        outline: 'none',
                        marginBottom: suggestions.length > 0 ? '12px' : '16px',
                    }}
                />

                {suggestions.length > 0 && (
                    <div style={{ display: 'grid', gap: '8px', marginBottom: '16px' }}>
                        <div style={{ color: PALETTE.muted, fontSize: '0.85rem' }}>Previously used tea names</div>
                        {suggestions.map((teaName) => (
                            <button
                                key={teaName}
                                type="button"
                                onClick={() => onChange(teaName)}
                                style={{
                                    padding: '12px 14px',
                                    borderRadius: '14px',
                                    border: `1px solid ${PALETTE.border}`,
                                    background: PALETTE.suggestion,
                                    color: PALETTE.text,
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                }}
                            >
                                {teaName}
                            </button>
                        ))}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                    <IonButton
                        shape="round"
                        onClick={onCancel}
                        style={{ '--background': '#ece8df', '--color': '#000000' }}
                    >
                        Cancel
                    </IonButton>
                    <IonButton
                        shape="round"
                        onClick={onSave}
                        style={{ '--background': PALETTE.accent, '--color': '#000000' }}
                    >
                        {saveLabel}
                    </IonButton>
                </div>
            </div>
        </div>
    );
};

export default TeaNameEditorModal;
