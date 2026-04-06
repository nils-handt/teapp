import React, { useMemo } from 'react';
import AppButton from './ui/AppButton';
import ModalFrame from './ui/ModalFrame';
import SuggestionList from './ui/SuggestionList';
import { zenInputClass } from '../styles/zen';
import { getTeaNameSuggestions } from '../utils/teaNameSearch';

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
        <ModalFrame
            isOpen={isOpen}
            title={title}
            actions={(
                <>
                    <AppButton variant="soft" onClick={onCancel}>
                        Cancel
                    </AppButton>
                    <AppButton onClick={onSave}>
                        {saveLabel}
                    </AppButton>
                </>
            )}
        >
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
                className={`${zenInputClass} ${suggestions.length > 0 ? 'mb-3' : 'mb-4'}`}
            />

            <SuggestionList
                items={suggestions}
                onSelect={onChange}
                label="Previously used tea names"
                className="mb-4"
            />
        </ModalFrame>
    );
};

export default TeaNameEditorModal;
