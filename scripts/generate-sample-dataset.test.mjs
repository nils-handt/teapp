import { describe, expect, it } from 'vitest';
import { generateSampleDataset, parseArgs } from './generate-sample-dataset.mjs';

const tableValues = (dataset, name) => dataset.tables.find((table) => table.name === name).values;

describe('generateSampleDataset', () => {
    it('creates requested restore-compatible tables and relationships', () => {
        const dataset = generateSampleDataset({ sessions: 12, teas: 4, vessels: 2, seed: 'fixture', now: '2026-07-12T00:00:00.000Z' });
        const teas = tableValues(dataset, 'teas');
        const sessions = tableValues(dataset, 'brewing_sessions');
        const vessels = tableValues(dataset, 'brewing_vessels');
        const infusions = tableValues(dataset, 'infusions');
        const teaIds = new Set(teas.map((tea) => tea[0]));
        const vesselIds = new Set(vessels.map((vessel) => vessel[0]));

        expect(dataset.database).toBe('teapp');
        expect(dataset.mode).toBe('full');
        expect(teas).toHaveLength(4);
        expect(sessions).toHaveLength(12);
        expect(vessels).toHaveLength(2);
        expect(infusions.length).toBeGreaterThan(sessions.length);
        expect(sessions.every((session) => teaIds.has(session[13]))).toBe(true);
        expect(sessions.every((session) => vesselIds.has(session[12]))).toBe(true);
        expect(new Set(sessions.map((session) => session[13])).size).toBe(4);
        expect(dataset.tables.find((table) => table.name === 'brewing_sessions').schema.at(-2)).toEqual({
            column: '"teaId"',
            value: 'text',
        });
    });

    it('allows sessions without vessels and rejects sessions without teas', () => {
        const dataset = generateSampleDataset({ sessions: 2, teas: 1, vessels: 0, seed: 'no-vessel' });
        const sessions = tableValues(dataset, 'brewing_sessions');
        expect(sessions.every((session) => session[12] === null)).toBe(true);

        expect(() => generateSampleDataset({ sessions: 1, teas: 0 })).toThrow('--teas must be at least 1');
    });

    it('keeps infusion IDs unique in large seeded datasets', () => {
        const dataset = generateSampleDataset({ sessions: 1000, teas: 100, vessels: 10, seed: 'large-fixture' });
        const infusionIds = tableValues(dataset, 'infusions').map((infusion) => infusion[0]);

        expect(new Set(infusionIds).size).toBe(infusionIds.length);
    });
});

describe('parseArgs', () => {
    it('supports inline and separated option values', () => {
        expect(parseArgs(['--sessions=10', '--teas', '3', '--vessels', '1', '--seed', 'demo', '--output', 'sample.json'])).toEqual({
            sessions: 10,
            teas: 3,
            vessels: 1,
            seed: 'demo',
            output: 'sample.json',
        });
    });
});
