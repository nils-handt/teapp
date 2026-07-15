import { useStore as useZustandStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { BrewingSession } from '../entities/BrewingSession.entity';
import { sessionRepository } from '../repositories/SessionRepository';
import { Tea } from '../entities/Tea.entity';
import { teaRepository } from '../repositories/TeaRepository';
import type { HistoryQuery } from '../utils/historyFilters';

export interface HistoryStoreState {
  sessionList: BrewingSession[];
  currentHistoryQuery: HistoryQuery;
  hasMoreHistory: boolean;
  isHistoryLoading: boolean;
  selectedSession: BrewingSession | null;
  knownTeaNames: string[];
  knownTeas: Tea[];
}

export interface HistoryStoreActions {
  loadHistory: () => Promise<void>;
  reloadHistory: (query: HistoryQuery) => Promise<void>;
  loadMoreHistory: () => Promise<void>;
  loadAllHistory: (query: HistoryQuery) => Promise<BrewingSession[]>;
  loadKnownTeaNames: (force?: boolean) => Promise<void>;
  loadKnownTeas: (force?: boolean) => Promise<void>;
  upsertKnownTeaName: (teaName: string) => void;
  upsertKnownTea: (tea: Tea) => void;
  selectSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  restoreSession: (session: BrewingSession) => Promise<void>;
  filterHistoryByTea: (teaName: string) => Promise<void>;
  updateSession: (session: BrewingSession) => Promise<void>;
  saveTea: (tea: Tea) => Promise<Tea>;
  updateSharedTea: (tea: Tea) => Promise<Tea>;
}

export type HistoryStore = HistoryStoreState & HistoryStoreActions;

export const initialHistoryStoreState: HistoryStoreState = {
  sessionList: [],
  currentHistoryQuery: {},
  hasMoreHistory: false,
  isHistoryLoading: false,
  selectedSession: null,
  knownTeaNames: [],
  knownTeas: [],
};

let historyLoadSequence = 0;

export const historyStore = createStore<HistoryStore>()((set, get) => ({
  ...initialHistoryStoreState,
  loadHistory: async () => get().reloadHistory({}),
  reloadHistory: async (query) => {
    const sequence = ++historyLoadSequence;
    set({
      sessionList: [],
      currentHistoryQuery: query,
      hasMoreHistory: false,
      isHistoryLoading: true,
    });

    try {
      const page = await sessionRepository.getHistoryPage({ teaIds: query.teaIds });
      if (sequence !== historyLoadSequence) {
        return;
      }

      set({
        sessionList: page.sessions,
        hasMoreHistory: page.hasMore,
        isHistoryLoading: false,
      });
    } catch {
      if (sequence === historyLoadSequence) {
        set({ isHistoryLoading: false });
      }
    }
  },
  loadMoreHistory: async () => {
    const { currentHistoryQuery, hasMoreHistory, isHistoryLoading, sessionList } = get();
    if (!hasMoreHistory || isHistoryLoading) {
      return;
    }

    const sequence = historyLoadSequence;
    set({ isHistoryLoading: true });
    try {
      const page = await sessionRepository.getHistoryPage({
        offset: sessionList.length,
        teaIds: currentHistoryQuery.teaIds,
      });
      if (sequence !== historyLoadSequence) {
        return;
      }

      set((state) => ({
        sessionList: [...state.sessionList, ...page.sessions],
        hasMoreHistory: page.hasMore,
        isHistoryLoading: false,
      }));
    } catch {
      if (sequence === historyLoadSequence) {
        set({ isHistoryLoading: false });
      }
    }
  },
  loadAllHistory: async (query) => sessionRepository.getAllHistorySessions({ teaIds: query.teaIds }),
  loadKnownTeaNames: async (force = false) => {
    if (!force && get().knownTeaNames.length > 0) {
      return;
    }

    const knownTeaNames = await sessionRepository.getKnownTeaNames();
    set({ knownTeaNames });
  },
  loadKnownTeas: async (force = false) => {
    if (!force && get().knownTeas.length > 0) {
      return;
    }

    const knownTeas = await teaRepository.getAllTeas();
    set({ knownTeas });
  },
  upsertKnownTeaName: (teaName) => {
    const trimmedTeaName = teaName.trim();
    if (!trimmedTeaName) {
      return;
    }

    set((state) => {
      const remainingTeaNames = state.knownTeaNames.filter(
        (knownTeaName) => knownTeaName.toLowerCase() !== trimmedTeaName.toLowerCase()
      );

      return {
        knownTeaNames: [trimmedTeaName, ...remainingTeaNames],
      };
    });
  },
  upsertKnownTea: (tea) => {
    set((state) => {
      const remainingTeas = state.knownTeas.filter((knownTea) => knownTea.teaId !== tea.teaId);

      return {
        knownTeas: [tea, ...remainingTeas],
      };
    });
  },
  selectSession: async (sessionId) => {
    const session = await sessionRepository.getSessionById(sessionId);
    set({ selectedSession: session });
  },
  deleteSession: async (sessionId) => {
    await sessionRepository.deleteSession(sessionId);
    set({ selectedSession: null });
    await get().reloadHistory(get().currentHistoryQuery);
  },
  restoreSession: async (session) => {
    await sessionRepository.saveSession(session);
    set({ selectedSession: null });
    await get().reloadHistory(get().currentHistoryQuery);
  },
  filterHistoryByTea: async (teaName) => {
    const sessions = await sessionRepository.getSessionsByTeaName(teaName);
    set({ sessionList: sessions });
  },
  updateSession: async (session) => {
    await sessionRepository.saveSession(session);
    await get().reloadHistory(get().currentHistoryQuery);
    set({ selectedSession: session });
  },
  saveTea: async (tea) => {
    const savedTea = await teaRepository.saveTea(tea);
    get().upsertKnownTea(savedTea);
    return savedTea;
  },
  updateSharedTea: async (tea) => {
    const savedTea = await teaRepository.updateSharedTea(tea);
    get().upsertKnownTea(savedTea);
    return savedTea;
  },
}));

export const useHistoryStore = <T>(selector: (state: HistoryStore) => T): T =>
  useZustandStore(historyStore, selector);
