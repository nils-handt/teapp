import { act, fireEvent, render, screen } from '@testing-library/react';
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
        expect(panel.className).toContain('h-[520px]');

        act(() => window.dispatchEvent(new CustomEvent('ionKeyboardDidShow', {
            detail: { keyboardHeight: 286 },
        })));
        expect(panel.style.height).toBe('100%');
        act(() => window.dispatchEvent(new Event('ionKeyboardDidHide')));

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

        expect(onSave).toHaveBeenCalledWith({
            action: 'select',
            tea: expect.objectContaining({ teaId: 'tea-1', name: 'Longjing' }),
        });
    });

    it('keeps New Tea empty without an assigned tea and emits create', () => {
        const onSave = vi.fn();
        render(
            <TeaEditorModal
                isOpen
                selectedTea={null}
                teas={[]}
                onCancel={vi.fn()}
                onSave={onSave}
            />,
        );

        fireEvent.click(screen.getByRole('tab', { name: 'New Tea' }));
        expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('');
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Silver Needle' } });
        fireEvent.click(screen.getByText('Save'));

        expect(onSave).toHaveBeenCalledWith({
            action: 'create',
            tea: expect.objectContaining({ teaId: expect.any(String), name: 'Silver Needle' }),
        });
    });

    it('prefills Edit Tea for the assigned shared tea and preserves its id', () => {
        const onSave = vi.fn();
        const assignedTea = createTea('tea-1', 'Longjing', {
            brand: 'Tea House',
            type: 'Green',
            subtype: 'Dragon Well',
            region: 'Zhejiang',
            subregion: 'Hangzhou',
            season: 'Spring',
            year: 2024,
        });
        render(
            <TeaEditorModal
                isOpen
                selectedTea={assignedTea}
                teas={[assignedTea]}
                onCancel={vi.fn()}
                onSave={onSave}
            />,
        );

        expect(screen.queryByRole('tab', { name: 'New Tea' })).toBeNull();
        fireEvent.click(screen.getByRole('tab', { name: 'Edit Tea' }));

        expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Longjing');
        expect((screen.getByLabelText('Brand') as HTMLInputElement).value).toBe('Tea House');
        expect((screen.getByLabelText('Type') as HTMLInputElement).value).toBe('Green');
        expect((screen.getByLabelText('Subtype') as HTMLInputElement).value).toBe('Dragon Well');
        expect((screen.getByLabelText('Region') as HTMLInputElement).value).toBe('Zhejiang');
        expect((screen.getByLabelText('Subregion') as HTMLInputElement).value).toBe('Hangzhou');
        expect((screen.getByLabelText('Season') as HTMLInputElement).value).toBe('Spring');
        expect((screen.getByLabelText('Year') as HTMLInputElement).value).toBe('2024');

        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Edited Longjing' } });
        fireEvent.click(screen.getByText('Save'));

        expect(onSave).toHaveBeenCalledWith({
            action: 'edit',
            tea: expect.objectContaining({ teaId: 'tea-1', name: 'Edited Longjing' }),
        });
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
