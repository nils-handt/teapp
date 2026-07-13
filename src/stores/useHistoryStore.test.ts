import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../repositories/SessionRepository', () => ({
  sessionRepository: {
    getAllSessions: vi.fn(),
    getHistoryPage: vi.fn(),
    getAllHistorySessions: vi.fn(),
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

const deferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => { resolve = nextResolve; });
  return { promise, resolve };
};

describe('useHistoryStore', () => {
  const firstSession = Object.assign(new BrewingSession(), { sessionId: 'one' });
  const secondSession = Object.assign(new BrewingSession(), { sessionId: 'two' });
  const mockSession = Object.assign(new BrewingSession(), { sessionId: 'selected' });

  beforeEach(() => {
    historyStore.setState(initialHistoryStoreState);
    vi.clearAllMocks();
  });

  it('loads the initial history page and records whether more history exists', async () => {
    vi.mocked(sessionRepository.getHistoryPage).mockResolvedValue({
      sessions: [firstSession],
      hasMore: true,
    });

    await historyStore.getState().reloadHistory({ teaIds: ['tea-1'] });

    expect(sessionRepository.getHistoryPage).toHaveBeenCalledWith({ teaIds: ['tea-1'] });
    expect(historyStore.getState()).toMatchObject({
      sessionList: [firstSession],
      currentHistoryQuery: { teaIds: ['tea-1'] },
      hasMoreHistory: true,
      isHistoryLoading: false,
    });
  });

  it('appends the next page using the number of already loaded sessions as the offset', async () => {
    historyStore.setState({
      sessionList: [firstSession],
      currentHistoryQuery: { teaIds: ['tea-1'] },
      hasMoreHistory: true,
    });
    vi.mocked(sessionRepository.getHistoryPage).mockResolvedValue({
      sessions: [secondSession],
      hasMore: false,
    });

    await historyStore.getState().loadMoreHistory();

    expect(sessionRepository.getHistoryPage).toHaveBeenCalledWith({
      offset: 1,
      teaIds: ['tea-1'],
    });
    expect(historyStore.getState().sessionList).toEqual([firstSession, secondSession]);
    expect(historyStore.getState().hasMoreHistory).toBe(false);
  });

  it('does not request another page after the final page has loaded', async () => {
    historyStore.setState({ hasMoreHistory: false });

    await historyStore.getState().loadMoreHistory();

    expect(sessionRepository.getHistoryPage).not.toHaveBeenCalled();
  });

  it('keeps the newest query when earlier page requests resolve late', async () => {
    const firstLoad = deferred<{ sessions: BrewingSession[]; hasMore: boolean }>();
    const secondLoad = deferred<{ sessions: BrewingSession[]; hasMore: boolean }>();
    vi.mocked(sessionRepository.getHistoryPage)
      .mockImplementationOnce(() => firstLoad.promise)
      .mockImplementationOnce(() => secondLoad.promise);

    const staleRequest = historyStore.getState().reloadHistory({ teaIds: ['old-tea'] });
    const currentRequest = historyStore.getState().reloadHistory({ teaIds: ['current-tea'] });
    secondLoad.resolve({ sessions: [secondSession], hasMore: false });
    await currentRequest;
    firstLoad.resolve({ sessions: [firstSession], hasMore: true });
    await staleRequest;

    expect(historyStore.getState()).toMatchObject({
      sessionList: [secondSession],
      currentHistoryQuery: { teaIds: ['current-tea'] },
      hasMoreHistory: false,
    });
  });

  it('loads complete filtered history without replacing the paged list', async () => {
    historyStore.setState({ sessionList: [firstSession] });
    vi.mocked(sessionRepository.getAllHistorySessions).mockResolvedValue([firstSession, secondSession]);

    const sessions = await historyStore.getState().loadAllHistory({ teaIds: ['tea-1'] });

    expect(sessionRepository.getAllHistorySessions).toHaveBeenCalledWith({ teaIds: ['tea-1'] });
    expect(sessions).toEqual([firstSession, secondSession]);
    expect(historyStore.getState().sessionList).toEqual([firstSession]);
  });

  it('reloads the active first page after deleting, restoring, or updating a session', async () => {
    historyStore.setState({ currentHistoryQuery: { teaIds: ['tea-1'] } });
    vi.mocked(sessionRepository.getHistoryPage).mockResolvedValue({ sessions: [firstSession], hasMore: false });

    await historyStore.getState().deleteSession('123');
    await historyStore.getState().restoreSession(mockSession);
    await historyStore.getState().updateSession(mockSession);

    expect(sessionRepository.deleteSession).toHaveBeenCalledWith('123');
    expect(sessionRepository.saveSession).toHaveBeenCalledWith(mockSession);
    expect(sessionRepository.getHistoryPage).toHaveBeenCalledTimes(3);
    expect(historyStore.getState().selectedSession).toBe(mockSession);
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

  it('selects a session by id', async () => {
    vi.mocked(sessionRepository.getSessionById).mockResolvedValue(mockSession);

    await historyStore.getState().selectSession('123');

    expect(sessionRepository.getSessionById).toHaveBeenCalledWith('123');
    expect(historyStore.getState().selectedSession).toBe(mockSession);
  });
});
