import { useStore as useZustandStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { sessionRepository } from '../repositories/SessionRepository';
import { BrewingSession } from '../entities/BrewingSession.entity';
import { Infusion } from '../entities/Infusion.entity';
import {
  BrewingPhase,
  type EditableInfusionMetadata,
  type InfusionMetadataDraft,
} from '../services/interfaces/brewing.types';
import { brewingSessionService } from '../services/brewing/BrewingSessionService';
import { createLogger } from '../services/logging';

const logger = createLogger('BrewingStore');

type ValueSubject<T> = {
  value: T;
};

const DEFAULT_FIRST_INFUSION_DRAFT: InfusionMetadataDraft = {
  note: '',
  temperature: null,
};

const DEFAULT_EDITABLE_INFUSION_METADATA: EditableInfusionMetadata = {
  ...DEFAULT_FIRST_INFUSION_DRAFT,
  infusionId: null,
  source: 'none',
};

const readSubjectValue = <T>(subject: ValueSubject<T> | undefined, fallback: T): T =>
  subject?.value ?? fallback;

const getBrewingServiceSnapshot = () => {
  const service = brewingSessionService as typeof brewingSessionService & {
    editableInfusionMetadata$?: ValueSubject<EditableInfusionMetadata>;
    firstInfusionDraft$?: ValueSubject<InfusionMetadataDraft>;
  };

  return {
    activeSession: readSubjectValue(brewingSessionService.session$, null),
    currentInfusion: readSubjectValue(brewingSessionService.currentInfusion$, null),
    editableInfusionMetadata: readSubjectValue(
      service.editableInfusionMetadata$,
      DEFAULT_EDITABLE_INFUSION_METADATA
    ),
    firstInfusionDraft: readSubjectValue(
      service.firstInfusionDraft$,
      DEFAULT_FIRST_INFUSION_DRAFT
    ),
    brewingPhase: readSubjectValue(brewingSessionService.state$, BrewingPhase.IDLE),
    timerValue: readSubjectValue(brewingSessionService.timer$, 0),
  };
};

export interface BrewingStoreState {
  activeSession: BrewingSession | null;
  currentInfusion: Infusion | null;
  editableInfusionMetadata: EditableInfusionMetadata;
  firstInfusionDraft: InfusionMetadataDraft;
  brewingPhase: BrewingPhase;
  timerValue: number;
}

export interface BrewingStoreActions {
  setActiveSession: (session: BrewingSession | null) => void;
  setCurrentInfusion: (infusion: Infusion | null) => void;
  setEditableInfusionMetadata: (metadata: EditableInfusionMetadata) => void;
  setFirstInfusionDraft: (draft: InfusionMetadataDraft) => void;
  setBrewingPhase: (phase: BrewingPhase) => void;
  setTimerValue: (value: number) => void;
  restoreActiveSession: () => Promise<void>;
}

export type BrewingStore = BrewingStoreState & BrewingStoreActions;

export const initialBrewingStoreState: BrewingStoreState = {
  activeSession: null,
  currentInfusion: null,
  editableInfusionMetadata: DEFAULT_EDITABLE_INFUSION_METADATA,
  firstInfusionDraft: DEFAULT_FIRST_INFUSION_DRAFT,
  brewingPhase: BrewingPhase.IDLE,
  timerValue: 0,
};

export const brewingStore = createStore<BrewingStore>()((set) => ({
  ...initialBrewingStoreState,
  setActiveSession: (activeSession) => set({ activeSession }),
  setCurrentInfusion: (currentInfusion) => set({ currentInfusion }),
  setEditableInfusionMetadata: (editableInfusionMetadata) => set({ editableInfusionMetadata }),
  setFirstInfusionDraft: (firstInfusionDraft) => set({ firstInfusionDraft }),
  setBrewingPhase: (brewingPhase) => set({ brewingPhase }),
  setTimerValue: (timerValue) => set({ timerValue }),
  restoreActiveSession: async () => {
    logger.info('Restoring active brewing session from persistence');
    const activeSession = await sessionRepository.getActiveSession();

    if (activeSession) {
      logger.info('Found active brewing session', { sessionId: activeSession.sessionId });
      brewingSessionService.restoreSession(activeSession);
      set(getBrewingServiceSnapshot());
      return;
    }

    logger.info('No active brewing session found. Clearing in-memory session state');
    brewingSessionService.clearSession();
    set(getBrewingServiceSnapshot());
  },
}));

export const useBrewingStore = <T>(selector: (state: BrewingStore) => T): T =>
  useZustandStore(brewingStore, selector);
