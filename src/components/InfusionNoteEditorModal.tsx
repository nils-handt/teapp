import React from 'react';
import AppButton from './ui/AppButton';
import ModalFrame from './ui/ModalFrame';
import { zenTextareaClass } from '../styles/zen';

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
        <ModalFrame
            isOpen={isOpen}
            title={title}
            actions={(
                <>
                    <AppButton variant="soft" onClick={onCancel}>
                        Cancel
                    </AppButton>
                    <AppButton onClick={onSave}>
                        Save
                    </AppButton>
                </>
            )}
        >
            <textarea
                autoFocus
                value={value}
                onChange={(event) => onChange(event.target.value)}
                rows={4}
                className={`${zenTextareaClass} mb-4`}
            />
        </ModalFrame>
    );
};

export default InfusionNoteEditorModal;
