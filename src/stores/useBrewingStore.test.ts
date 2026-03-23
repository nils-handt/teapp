import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrewingSession } from '../entities/BrewingSession.entity';
import { Infusion } from '../entities/Infusion.entity';
import { BrewingPhase } from '../services/interfaces/brewing.types';

const mockBrewingSessionService = vi.hoisted(() => ({
  state$: { value: 'idle' },
  session$: { value: null as BrewingSession | null },
  currentInfusion$: { value: null as Infusion | null },
  firstInfusionDraft$: { value: { note: '', temperature: null } },
  editableInfusionMetadata$: {
    value: { note: '', temperature: null, infusionId: null, source: 'none' as const },
  },
  timer$: { value: 0 },
  restoreSession: vi.fn(),
  clearSession: vi.fn(),
}));

vi.mock('../repositories/SessionRepository', () => ({
  sessionRepository: {
    getActiveSession: vi.fn(),
  },
}));

vi.mock('../services/brewing/BrewingSessionService', () => ({
  brewingSessionService: mockBrewingSessionService,
}));

import { sessionRepository } from '../repositories/SessionRepository';
import { brewingSessionService } from '../services/brewing/BrewingSessionService';
import { brewingStore, initialBrewingStoreState } from './useBrewingStore';

type MutableSubject<T> = {
  value: T;
};

const sessionSubject = brewingSessionService.session$ as unknown as MutableSubject<BrewingSession | null>;
const stateSubject = brewingSessionService.state$ as unknown as MutableSubject<BrewingPhase>;
const currentInfusionSubject = brewingSessionService.currentInfusion$ as unknown as MutableSubject<Infusion | null>;
const firstInfusionDraftSubject = brewingSessionService.firstInfusionDraft$ as unknown as MutableSubject<{
  note: string;
  temperature: number | null;
}>;
const editableInfusionMetadataSubject = brewingSessionService.editableInfusionMetadata$ as unknown as MutableSubject<{
  note: string;
  temperature: number | null;
  infusionId: string | null;
  source: 'none' | 'draft' | 'current' | 'resting';
}>;
const timerSubject = brewingSessionService.timer$ as unknown as MutableSubject<number>;

describe('useBrewingStore', () => {
  beforeEach(() => {
    brewingStore.setState(initialBrewingStoreState);
    vi.clearAllMocks();
    sessionSubject.value = null;
    stateSubject.value = BrewingPhase.IDLE;
    currentInfusionSubject.value = null;
    firstInfusionDraftSubject.value = { note: '', temperature: null };
    editableInfusionMetadataSubject.value = {
      note: '',
      temperature: null,
      infusionId: null,
      source: 'none',
    };
    timerSubject.value = 0;
    vi.mocked(brewingSessionService.restoreSession).mockImplementation((session: BrewingSession) => {
      sessionSubject.value = session;
      stateSubject.value = BrewingPhase.READY;
      currentInfusionSubject.value = null;
      firstInfusionDraftSubject.value = { note: '', temperature: null };
      editableInfusionMetadataSubject.value = {
        note: '',
        temperature: null,
        infusionId: null,
        source: 'draft',
      };
      timerSubject.value = 0;
    });
    vi.mocked(brewingSessionService.clearSession).mockImplementation(() => {
      sessionSubject.value = null;
      stateSubject.value = BrewingPhase.IDLE;
      currentInfusionSubject.value = null;
      firstInfusionDraftSubject.value = { note: '', temperature: null };
      editableInfusionMetadataSubject.value = {
        note: '',
        temperature: null,
        infusionId: null,
        source: 'none',
      };
      timerSubject.value = 0;
    });
  });

  it('updates live brewing fields through explicit setter actions', () => {
    brewingStore.getState().setBrewingPhase(BrewingPhase.INFUSION);
    brewingStore.getState().setTimerValue(1200);

    expect(brewingStore.getState().brewingPhase).toBe(BrewingPhase.INFUSION);
    expect(brewingStore.getState().timerValue).toBe(1200);
  });

  it('restores an active session through the brewing service', async () => {
    const activeSession = new BrewingSession();
    activeSession.sessionId = 'active-1';
    vi.mocked(sessionRepository.getActiveSession).mockResolvedValue(activeSession);

    await brewingStore.getState().restoreActiveSession();

    expect(sessionRepository.getActiveSession).toHaveBeenCalled();
    expect(brewingSessionService.restoreSession).toHaveBeenCalledWith(activeSession);
    expect(brewingSessionService.clearSession).not.toHaveBeenCalled();
    expect(brewingStore.getState().activeSession).toBe(activeSession);
    expect(brewingStore.getState().brewingPhase).toBe(BrewingPhase.READY);
  });

  it('clears stale brewing state when no active session exists', async () => {
    const staleInfusion = new Infusion();
    staleInfusion.infusionId = 'stale-inf';
    staleInfusion.infusionNumber = 1;
    staleInfusion.waterWeight = 85;
    staleInfusion.startTime = new Date().toISOString();
    staleInfusion.duration = 12;
    staleInfusion.restDuration = 0;
    staleInfusion.wetTeaLeavesWeight = 16;
    staleInfusion.sessionId = 'stale-session';

    brewingStore.setState({
      activeSession: new BrewingSession(),
      currentInfusion: staleInfusion,
      brewingPhase: BrewingPhase.REST,
      timerValue: 1234,
    });
    vi.mocked(sessionRepository.getActiveSession).mockResolvedValue(null);

    await brewingStore.getState().restoreActiveSession();

    expect(brewingSessionService.clearSession).toHaveBeenCalled();
    expect(brewingStore.getState().activeSession).toBeNull();
    expect(brewingStore.getState().currentInfusion).toBeNull();
    expect(brewingStore.getState().timerValue).toBe(0);
  });
});
