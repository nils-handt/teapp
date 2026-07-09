import { useStore as useZustandStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { BrewingSession } from '../entities/BrewingSession.entity';
import { sessionRepository } from '../repositories/SessionRepository';
import { Tea } from '../entities/Tea.entity';
import { teaRepository } from '../repositories/TeaRepository';

export interface HistoryStoreState {
  sessionList: BrewingSession[];
  selectedSession: BrewingSession | null;
  knownTeaNames: string[];
  knownTeas: Tea[];
}

export interface HistoryStoreActions {
  loadHistory: () => Promise<void>;
  loadKnownTeaNames: (force?: boolean) => Promise<void>;
  loadKnownTeas: (force?: boolean) => Promise<void>;
  upsertKnownTeaName: (teaName: string) => void;
  upsertKnownTea: (tea: Tea) => void;
  selectSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  filterHistoryByTea: (teaName: string) => Promise<void>;
  updateSession: (session: BrewingSession) => Promise<void>;
  saveTea: (tea: Tea) => Promise<Tea>;
}

export type HistoryStore = HistoryStoreState & HistoryStoreActions;

export const initialHistoryStoreState: HistoryStoreState = {
  sessionList: [],
  selectedSession: null,
  knownTeaNames: [],
  knownTeas: [],
};

export const historyStore = createStore<HistoryStore>()((set, get) => ({
  ...initialHistoryStoreState,
  loadHistory: async () => {
    const sessions = await sessionRepository.getAllSessions();
    set({ sessionList: sessions });
  },
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
    const sessions = await sessionRepository.getAllSessions();
    set({ sessionList: sessions, selectedSession: null });
  },
  filterHistoryByTea: async (teaName) => {
    const sessions = await sessionRepository.getSessionsByTeaName(teaName);
    set({ sessionList: sessions });
  },
  updateSession: async (session) => {
    await sessionRepository.saveSession(session);
    const sessions = await sessionRepository.getAllSessions();
    set({ sessionList: sessions, selectedSession: session });
  },
  saveTea: async (tea) => {
    const savedTea = await teaRepository.saveTea(tea);
    get().upsertKnownTea(savedTea);
    return savedTea;
  },
}));

export const useHistoryStore = <T>(selector: (state: HistoryStore) => T): T =>
  useZustandStore(historyStore, selector);
