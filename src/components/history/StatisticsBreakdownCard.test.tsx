import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StatisticsBreakdownCard from './StatisticsBreakdownCard';

const groups = (prefix: string, count: number) => Array.from({ length: count }, (_, index) => ({
    key: `${prefix}-${index}`,
    label: `${prefix} ${index + 1}`,
    sessionCount: count - index,
}));

describe('StatisticsBreakdownCard', () => {
    it('keeps every tab in the native keyboard tab order', () => {
        render(<StatisticsBreakdownCard rankings={{
            types: groups('Type', 1), teas: groups('Tea', 1), brands: groups('Brand', 1),
        }} />);

        const tabs = screen.getAllByRole('tab');
        expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, 0, 0]);
        expect(tabs.every((tab) => tab.className.includes('tea-mode-tab'))).toBe(true);
        expect(screen.getByRole('tablist').className).toContain('grid-cols-3');
        expect(screen.getByRole('tablist').className).toContain('-mt-[22px]');
    });

    it('switches accessible tabs and limits each ranking to five rows', () => {
        render(<StatisticsBreakdownCard rankings={{
            types: groups('Type', 6), teas: groups('Tea', 7), brands: groups('Brand', 2),
        }} />);

        expect(screen.getByRole('tab', { name: 'Tea types' }).getAttribute('aria-selected')).toBe('true');
        expect(screen.getAllByTestId('statistics-ranking-row')).toHaveLength(5);

        fireEvent.click(screen.getByRole('button', { name: 'Show all' }));
        expect(screen.getAllByTestId('statistics-ranking-row')).toHaveLength(6);
        expect(screen.getByRole('button', { name: 'Show less' })).toBeDefined();

        fireEvent.click(screen.getByRole('tab', { name: 'Tea names' }));
        expect(screen.getByRole('tab', { name: 'Tea names' }).getAttribute('aria-selected')).toBe('true');
        expect(screen.getAllByTestId('statistics-ranking-row')).toHaveLength(5);
        expect(screen.getByRole('button', { name: 'Show all' })).toBeDefined();
    });

    it('renders exact counts and proportional bars', () => {
        render(<StatisticsBreakdownCard rankings={{
            types: [
                { key: 'green', label: 'Green', sessionCount: 4 },
                { key: 'black', label: 'Black', sessionCount: 1 },
            ],
            teas: [],
            brands: [],
        }} />);

        expect(screen.getByText('4 sessions')).toBeDefined();
        expect(screen.getByText('1 session')).toBeDefined();
        expect(screen.getByTestId('statistics-ranking-bar-green').getAttribute('style')).toContain('width: 100%');
        expect(screen.getByTestId('statistics-ranking-bar-black').getAttribute('style')).toContain('width: 25%');
    });

    it('renders an empty active tab and omits expansion for short rankings', () => {
        render(<StatisticsBreakdownCard rankings={{ types: [], teas: groups('Tea', 1), brands: [] }} />);

        expect(screen.getByText('No Tea types to display.')).toBeDefined();
        fireEvent.click(screen.getByRole('tab', { name: 'Tea names' }));
        expect(screen.queryByRole('button', { name: 'Show all' })).toBeNull();
    });
});
