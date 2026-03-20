import { describe, expect, it } from 'vitest';
import { BrewingSession } from '../entities/BrewingSession.entity';
import { filterSessionsByTeaName, getTeaNameSuggestions, normalizeTeaName } from './teaNameSearch';

describe('teaNameSearch', () => {
    it('normalizes tea names for fuzzy matching', () => {
        expect(normalizeTeaName(' ORT 2015 / Gao-Jia Shan ')).toBe('ort 2015 gao jia shan');
    });

    it('matches tea names case-insensitively', () => {
        expect(getTeaNameSuggestions(['ORT 2015 Gao Jia Shan'], 'ort')).toEqual(['ORT 2015 Gao Jia Shan']);
    });

    it('matches multi-word queries across tea names', () => {
        expect(getTeaNameSuggestions(['ORT 2015 Gao Jia Shan'], 'gao shan')).toEqual(['ORT 2015 Gao Jia Shan']);
    });

    it('matches partial tokens inside tea names', () => {
        expect(getTeaNameSuggestions(['ORT 2015 Gao Jia Shan'], 'jia')).toEqual(['ORT 2015 Gao Jia Shan']);
    });

    it('keeps recent tea names first when rankings tie', () => {
        expect(getTeaNameSuggestions(['Recent Rougui', 'Earlier Rougui'], 'rougui')).toEqual(['Recent Rougui', 'Earlier Rougui']);
    });

    it('returns recent tea names when query is empty', () => {
        expect(getTeaNameSuggestions(['Recent Rougui', 'Earlier Rougui'], '')).toEqual(['Recent Rougui', 'Earlier Rougui']);
    });

    it('filters sessions using matched tea names', () => {
        const matchingSession = new BrewingSession();
        matchingSession.teaName = 'ORT 2015 Gao Jia Shan';

        const otherSession = new BrewingSession();
        otherSession.teaName = 'Morning Sencha';

        expect(
            filterSessionsByTeaName(
                [matchingSession, otherSession],
                ['ORT 2015 Gao Jia Shan', 'Morning Sencha'],
                'gao shan',
            ),
        ).toEqual([matchingSession]);
    });
});
