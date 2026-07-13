import React, { useEffect, useMemo, useState } from 'react';
import { Tea } from '../entities/Tea.entity';
import {
    formatTeaLabel,
    getTeaAttributeSuggestions,
    getTeaSuggestions,
    type TeaTextAttribute,
} from '../utils/teaSearch';
import AppButton from './ui/AppButton';
import ModalFrame from './ui/ModalFrame';
import SuggestedInput from './ui/SuggestedInput';
import { cn, zenInputClass } from '../styles/zen';

type TeaEditorModalProps = {
    isOpen: boolean;
    selectedTea: Tea | null;
    teas: Tea[];
    title?: string;
    onCancel: () => void;
    onSave: (tea: Tea) => void;
};

type TeaDraft = Record<TeaTextAttribute, string> & {
    year: string;
};

const EMPTY_DRAFT: TeaDraft = {
    name: '',
    brand: '',
    type: '',
    subtype: '',
    region: '',
    subregion: '',
    season: '',
    year: '',
};

const NEW_TEA_PRIMARY_FIELDS: Array<{ key: TeaTextAttribute; label: string }> = [
    { key: 'name', label: 'Name' },
    { key: 'brand', label: 'Brand' },
];

const NEW_TEA_FIELD_ROWS: Array<Array<{ key: keyof TeaDraft; label: string }>> = [
    [
        { key: 'type', label: 'Type' },
        { key: 'subtype', label: 'Subtype' },
    ],
    [
        { key: 'region', label: 'Region' },
        { key: 'subregion', label: 'Subregion' },
    ],
    [
        { key: 'season', label: 'Season' },
        { key: 'year', label: 'Year' },
    ],
];

const trimToNullable = (value: string) => {
    const trimmedValue = value.trim();
    return trimmedValue || null;
};

const TeaEditorModal: React.FC<TeaEditorModalProps> = ({
    isOpen,
    selectedTea,
    teas,
    onCancel,
    onSave,
}) => {
    const [draft, setDraft] = useState<TeaDraft>(EMPTY_DRAFT);
    const [editingTea, setEditingTea] = useState<Tea | null>(null);
    const [activeTab, setActiveTab] = useState<'existing' | 'new'>('existing');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        setActiveTab('existing');
        setEditingTea(selectedTea);
        setDraft(EMPTY_DRAFT);
        setSearchQuery('');
    }, [isOpen, selectedTea]);

    const teaSuggestions = useMemo(
        () => getTeaSuggestions(teas, searchQuery),
        [searchQuery, teas],
    );
    const yearSuggestions = useMemo(
        () => getTeaAttributeSuggestions(teas, 'year', draft.year, 24),
        [draft.year, teas],
    );

    if (!isOpen) {
        return null;
    }

    const updateDraft = (key: keyof TeaDraft, value: string) => {
        setDraft((currentDraft) => ({ ...currentDraft, [key]: value }));
    };

    const openNewTeaTab = () => {
        setActiveTab('new');
        setEditingTea(null);
        setDraft(EMPTY_DRAFT);
    };

    const openExistingTeaTab = () => {
        setActiveTab('existing');
    };

    const applyTea = (label: string) => {
        const tea = teas.find((candidate) => formatTeaLabel(candidate) === label);
        if (!tea) {
            return;
        }

        setEditingTea(tea);
        setSearchQuery(formatTeaLabel(tea));
    };

    const handleSave = () => {
        if (activeTab === 'existing') {
            if (editingTea) {
                onSave(editingTea);
            }
            return;
        }

        const name = draft.name.trim();
        if (!name) {
            return;
        }

        const year = draft.year.trim() ? Number.parseInt(draft.year.trim(), 10) : null;
        if (draft.year.trim() && Number.isNaN(year)) {
            return;
        }

        const tea = Object.assign(new Tea(), {
            teaId: crypto.randomUUID(),
            name,
            brand: trimToNullable(draft.brand),
            type: trimToNullable(draft.type),
            subtype: trimToNullable(draft.subtype),
            region: trimToNullable(draft.region),
            subregion: trimToNullable(draft.subregion),
            season: trimToNullable(draft.season),
            year,
        });

        onSave(tea);
    };

    const header = (
        <div
            role="tablist"
            aria-label="Tea mode"
            className="grid grid-cols-2 bg-[#f4f4f1]"
        >
            <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'existing'}
                onClick={openExistingTeaTab}
                className={cn(
                    'tea-mode-tab border-r-4 border-black text-sm transition',
                    activeTab === 'existing'
                        ? 'bg-[#fffdf8] font-medium text-zen-text'
                        : 'text-zen-muted',
                )}
            >
                Existing Tea
            </button>
            <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'new'}
                onClick={openNewTeaTab}
                className={cn(
                    'tea-mode-tab text-sm transition',
                    activeTab === 'new'
                        ? 'bg-[#fffdf8] font-medium text-zen-text'
                        : 'text-zen-muted',
                )}
            >
                New Tea
            </button>
        </div>
    );

    return (
        <ModalFrame
            isOpen={isOpen}
            header={header}
            headerClassName="-mx-[22px] -mt-[22px] shrink-0"
            panelClassName="h-[520px]"
            expandToAvailableHeightOnKeyboard
            ariaLabel="Tea"
            actions={(
                <>
                    <AppButton variant="soft" onClick={onCancel}>
                        Cancel
                    </AppButton>
                    <AppButton onClick={handleSave}>
                        Save
                    </AppButton>
                </>
            )}
        >
            {activeTab === 'existing' ? (
                <div role="tabpanel" className="flex min-h-0 flex-1 flex-col gap-3">
                    <SuggestedInput
                        ariaLabel="Search existing teas"
                        value={searchQuery}
                        placeholder="Search existing teas"
                        suggestions={teaSuggestions.map(formatTeaLabel)}
                        onChange={setSearchQuery}
                        onSelectSuggestion={applyTea}
                        inlineSuggestions
                        inlineSuggestionsFill
                        className="flex min-h-0 flex-1 flex-col"
                        inputClassName={zenInputClass}
                    />
                </div>
            ) : (
                <div role="tabpanel" className="grid gap-3">
                    {NEW_TEA_PRIMARY_FIELDS.map((field) => (
                        <label key={field.key} className="grid min-w-0 gap-1">
                            <span className="text-[0.76rem] uppercase text-zen-muted">{field.label}</span>
                            <SuggestedInput
                                ariaLabel={field.label}
                                value={draft[field.key]}
                                suggestions={getTeaAttributeSuggestions(teas, field.key, draft[field.key], 8)}
                                onChange={(value) => updateDraft(field.key, value)}
                                inputClassName={cn(zenInputClass, 'px-3 py-3')}
                            />
                        </label>
                    ))}
                    {NEW_TEA_FIELD_ROWS.map((row) => (
                        <div key={row.map((field) => field.key).join('-')} className="grid grid-cols-2 gap-3">
                            {row.map((field) => {
                                const isYear = field.key === 'year';
                                const suggestions = isYear
                                    ? yearSuggestions
                                    : getTeaAttributeSuggestions(teas, field.key as TeaTextAttribute, draft[field.key], 8);

                                return (
                                    <label key={field.key} className="grid min-w-0 gap-1">
                                        <span className="text-[0.76rem] uppercase text-zen-muted">{field.label}</span>
                                        <SuggestedInput
                                            ariaLabel={field.label}
                                            type={isYear ? 'number' : 'text'}
                                            inputMode={isYear ? 'numeric' : undefined}
                                            min={isYear ? '0' : undefined}
                                            step={isYear ? '1' : undefined}
                                            value={draft[field.key]}
                                            suggestions={suggestions}
                                            onChange={(value) => updateDraft(field.key, value)}
                                            inputClassName={cn(zenInputClass, 'px-3 py-3')}
                                        />
                                    </label>
                                );
                            })}
                        </div>
                    ))}
                </div>
            )}
        </ModalFrame>
    );
};

export default TeaEditorModal;
