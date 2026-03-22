import React from 'react';
import { IonButton } from '@ionic/react';
import { ZEN_PALETTE, zenPrimaryButtonStyle } from '../screens/brewing/zenBrewingShared';

type InfusionNoteEditorModalProps = {
    isOpen: boolean;
    title?: string;
    value: string;
    onChange: (value: string) => void;
    onCancel: () => void;
    onSave: () => void;
};

const InfusionNoteEditorModal: React.FC<InfusionNoteEditorModalProps> = ({
    isOpen,
    title = 'Edit Infusion Note',
    value,
    onChange,
    onCancel,
    onSave,
}) => {
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
                    background: '#fffdf8',
                    border: `1px solid ${ZEN_PALETTE.border}`,
                    boxShadow: '0 18px 36px rgba(40, 52, 40, 0.18)',
                    padding: '22px',
                }}
            >
                <h3 style={{ margin: '0 0 14px', fontSize: '1.1rem', fontWeight: 500 }}>{title}</h3>
                <textarea
                    autoFocus
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    rows={4}
                    style={{
                        width: '100%',
                        padding: '14px 16px',
                        borderRadius: '16px',
                        border: `1px solid ${ZEN_PALETTE.border}`,
                        fontSize: '1rem',
                        outline: 'none',
                        marginBottom: '16px',
                        resize: 'vertical',
                        fontFamily: 'inherit',
                    }}
                />
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
                        style={zenPrimaryButtonStyle}
                    >
                        Save
                    </IonButton>
                </div>
            </div>
        </div>
    );
};

export default InfusionNoteEditorModal;
