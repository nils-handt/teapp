import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../repositories/SessionRepository', () => ({
  sessionRepository: {
    getAllSessions: vi.fn(),
    getSessionById: vi.fn(),
    getKnownTeaNames: vi.fn(),
    deleteSession: vi.fn(),
    getSessionsByTeaName: vi.fn(),
    saveSession: vi.fn(),
  },
}));

import { BrewingSession } from '../entities/BrewingSession.entity';
import { sessionRepository } from '../repositories/SessionRepository';
import { historyStore, initialHistoryStoreState } from './useHistoryStore';

describe('useHistoryStore', () => {
  const mockSessions = [new BrewingSession(), new BrewingSession()];
  const mockSession = new BrewingSession();

  beforeEach(() => {
    historyStore.setState(initialHistoryStoreState);
    vi.clearAllMocks();
  });

  it('loads history', async () => {
    vi.mocked(sessionRepository.getAllSessions).mockResolvedValue(mockSessions);

    await historyStore.getState().loadHistory();

    expect(sessionRepository.getAllSessions).toHaveBeenCalled();
    expect(historyStore.getState().sessionList).toBe(mockSessions);
  });

  it('loads known tea names once by default and refreshes when forced', async () => {
    vi.mocked(sessionRepository.getKnownTeaNames)
      .mockResolvedValueOnce(['ORT 2015 Gao Jia Shan'])
      .mockResolvedValueOnce(['Morning Sencha']);

    await historyStore.getState().loadKnownTeaNames();
    await historyStore.getState().loadKnownTeaNames();
    await historyStore.getState().loadKnownTeaNames(true);

    expect(sessionRepository.getKnownTeaNames).toHaveBeenCalledTimes(2);
    expect(historyStore.getState().knownTeaNames).toEqual(['Morning Sencha']);
  });

  it('upserts tea names into the known tea name cache', () => {
    historyStore.setState({ knownTeaNames: ['Morning Sencha'] });

    historyStore.getState().upsertKnownTeaName('ORT 2015 Gao Jia Shan');
    historyStore.getState().upsertKnownTeaName('morning sencha');

    expect(historyStore.getState().knownTeaNames).toEqual([
      'morning sencha',
      'ORT 2015 Gao Jia Shan',
    ]);
  });

  it('selects a session by id', async () => {
    vi.mocked(sessionRepository.getSessionById).mockResolvedValue(mockSession);

    await historyStore.getState().selectSession('123');

    expect(sessionRepository.getSessionById).toHaveBeenCalledWith('123');
    expect(historyStore.getState().selectedSession).toBe(mockSession);
  });

  it('deletes a session and refreshes the history list', async () => {
    vi.mocked(sessionRepository.getAllSessions).mockResolvedValue(mockSessions);

    await historyStore.getState().deleteSession('123');

    expect(sessionRepository.deleteSession).toHaveBeenCalledWith('123');
    expect(sessionRepository.getAllSessions).toHaveBeenCalled();
    expect(historyStore.getState().sessionList).toBe(mockSessions);
    expect(historyStore.getState().selectedSession).toBeNull();
  });

  it('filters history by tea name', async () => {
    vi.mocked(sessionRepository.getSessionsByTeaName).mockResolvedValue(mockSessions);

    await historyStore.getState().filterHistoryByTea('Oolong');

    expect(sessionRepository.getSessionsByTeaName).toHaveBeenCalledWith('Oolong');
    expect(historyStore.getState().sessionList).toBe(mockSessions);
  });

  it('updates a session and refreshes the selected session snapshot', async () => {
    vi.mocked(sessionRepository.getAllSessions).mockResolvedValue(mockSessions);

    await historyStore.getState().updateSession(mockSession);

    expect(sessionRepository.saveSession).toHaveBeenCalledWith(mockSession);
    expect(historyStore.getState().sessionList).toBe(mockSessions);
    expect(historyStore.getState().selectedSession).toBe(mockSession);
  });
});
