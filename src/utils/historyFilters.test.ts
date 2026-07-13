import { describe, expect, it } from 'vitest';
import { BrewingSession } from '../entities/BrewingSession.entity';
import { Tea } from '../entities/Tea.entity';
import {
  createHistoryQuery,
  EMPTY_HISTORY_TEA_FILTERS,
  filterHistorySessions,
  getHistoryQueryKey,
} from './historyFilters';

const tea = (teaId: string, name: string, brand: string, year: number): Tea => Object.assign(new Tea(), {
  teaId, name, brand, year, type: null, subtype: null, region: null,
  subregion: null, season: null, sessions: [],
});

const session = (sessionId: string, value: Tea): BrewingSession => Object.assign(new BrewingSession(), {
  sessionId, teaId: value.teaId, tea: value, teaName: value.name,
  startTime: '2026-07-01T10:00:00.000Z', endTime: '', status: 'completed',
  vesselWeight: 0, lidWeight: 0, dryTeaLeavesWeight: 0, currentWasteWater: 0,
  notes: '', waterTemperature: 0, brewingVesselId: null, brewingVessel: null, infusions: [],
});

describe('filterHistorySessions', () => {
  it('combines fuzzy Tea search with attribute filters', () => {
    const gao = tea('tea-1', 'Gao Jia Shan', 'Farmer Leaf', 2015);
    const sencha = tea('tea-2', 'Morning Sencha', 'Ippodo', 2024);
    const sessions = [session('s1', gao), session('s2', sencha)];

    expect(filterHistorySessions(sessions, [gao, sencha], 'gao shan', {
      ...EMPTY_HISTORY_TEA_FILTERS,
      brand: 'farmer',
    })).toEqual([sessions[0]]);
  });

  it('returns every session when search and filters are empty', () => {
    const gao = tea('tea-1', 'Gao Jia Shan', 'Farmer Leaf', 2015);
    const sessions = [session('s1', gao)];
    expect(filterHistorySessions(sessions, [gao], '', EMPTY_HISTORY_TEA_FILTERS)).toEqual(sessions);
  });

  it('builds a stable full-history query from fuzzy and attribute filters', () => {
    const gao = tea('tea-1', 'Gao Jia Shan', 'Farmer Leaf', 2015);
    const sencha = tea('tea-2', 'Morning Sencha', 'Ippodo', 2024);

    const query = createHistoryQuery([gao, sencha], 'gao shan', {
      ...EMPTY_HISTORY_TEA_FILTERS,
      brand: 'farmer',
    });

    expect(query).toEqual({ teaIds: ['tea-1'] });
    expect(getHistoryQueryKey(query)).toBe('teas:tea-1');
    expect(createHistoryQuery([gao, sencha], '', EMPTY_HISTORY_TEA_FILTERS)).toEqual({});
  });
});
