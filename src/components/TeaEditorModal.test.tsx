import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TeaEditorModal from './TeaEditorModal';
import { Tea } from '../entities/Tea.entity';

const createTea = (teaId: string, name: string, overrides: Partial<Tea> = {}): Tea => Object.assign(new Tea(), {
    teaId,
    name,
    brand: null,
    type: null,
    subtype: null,
    region: null,
    subregion: null,
    year: null,
    season: null,
    sessions: [],
    ...overrides,
});

describe('TeaEditorModal', () => {
    it('uses header tabs instead of the old Tea title and splits existing tea from the form', () => {
        render(
            <TeaEditorModal
                isOpen
                selectedTea={null}
                teas={[createTea('tea-1', 'Longjing', { year: 2020, type: 'Green Tea' })]}
                onCancel={vi.fn()}
                onSave={vi.fn()}
            />,
        );

        expect(screen.getByRole('tab', { name: 'Existing Tea' }).className).toContain('tea-mode-tab');
        expect(screen.getByRole('tab', { name: 'New Tea' }).className).toContain('tea-mode-tab');
        expect(screen.getByRole('tab', { name: 'Existing Tea' }).className).toContain('bg-[#fffdf8]');
        expect(screen.getByRole('tablist', { name: 'Tea mode' }).className).not.toContain('border-b-4');
        expect(screen.queryByRole('heading', { name: 'Tea' })).toBeNull();
        expect(screen.getByLabelText('Search existing teas')).toBeDefined();
        expect(screen.queryByLabelText('Name')).toBeNull();
        const panel = screen.getByRole('dialog').firstElementChild as HTMLElement;
        expect(panel.className).toContain('h-[510px]');

        fireEvent.click(screen.getByRole('button', { name: 'Show Search existing teas suggestions' }));
        expect(screen.getByRole('listbox').className).toContain('flex-1');

        fireEvent.click(screen.getByRole('tab', { name: 'New Tea' }));

        expect(screen.getByLabelText('Name')).toBeDefined();
        expect(screen.getByLabelText('Type')).toBeDefined();
        expect(screen.getByLabelText('Subtype')).toBeDefined();
        expect(screen.getByLabelText('Season')).toBeDefined();
        expect(screen.getByLabelText('Year')).toBeDefined();
    });

    it('saves a selected existing tea without forcing it through the new tea fields', () => {
        const onSave = vi.fn();
        render(
            <TeaEditorModal
                isOpen
                selectedTea={null}
                teas={[createTea('tea-1', 'Longjing', { year: 2020, type: 'Green Tea' })]}
                onCancel={vi.fn()}
                onSave={onSave}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Show Search existing teas suggestions' }));
        fireEvent.click(screen.getByRole('option', { name: '2020 Longjing Green Tea' }));
        fireEvent.click(screen.getByText('Save'));

        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ teaId: 'tea-1', name: 'Longjing' }));
    });

    it('shows existing teas only in the search dropdown', () => {
        render(
            <TeaEditorModal
                isOpen
                selectedTea={null}
                teas={[createTea('tea-1', 'Longjing', { year: 2020, type: 'Green Tea' })]}
                onCancel={vi.fn()}
                onSave={vi.fn()}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Show Search existing teas suggestions' }));

        expect(screen.getAllByText('2020 Longjing Green Tea')).toHaveLength(1);
        expect(screen.queryByText('Existing teas')).toBeNull();
        expect(screen.getByRole('listbox').className).toContain('relative');
        expect(screen.getByRole('listbox').className).not.toContain('absolute');
    });
});
