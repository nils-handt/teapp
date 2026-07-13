import type { ChangeEvent, PropsWithChildren } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrewingSession } from '../entities/BrewingSession.entity';
import { Infusion } from '../entities/Infusion.entity';
import { Tea } from '../entities/Tea.entity';
import { settingsRepository } from '../repositories/SettingsRepository';
import { historyFiltersStore, initialHistoryFiltersState } from '../stores/useHistoryFiltersStore';
import { historyStore, initialHistoryStoreState } from '../stores/useHistoryStore';
import { initialSettingsStoreValues, settingsStore } from '../stores/useSettingsStore';
import HistoryStatisticsScreen from './HistoryStatisticsScreen';

const refresherMocks = vi.hoisted(() => ({
  onIonRefresh: undefined as ((event: CustomEvent) => Promise<void>) | undefined,
}));
const viewMocks = vi.hoisted(() => ({ entered: false }));
const logger = vi.hoisted(() => ({ error: vi.fn(), info: vi.fn() }));
const loadAllHistory = vi.fn();
const loadKnownTeas = vi.fn().mockResolvedValue(undefined);

type DivProps = PropsWithChildren<{ className?: string }>;
const deferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
};

vi.mock('../services/logging', async (importOriginal) => ({
  ...await importOriginal<typeof import('../services/logging')>(),
  createLogger: () => logger,
}));
vi.mock('@ionic/react', () => ({
  IonBackButton: () => <a href="/tabs/history">Back</a>,
  IonButtons: ({ children }: PropsWithChildren) => <div>{children}</div>,
  IonContent: ({ children, className }: DivProps) => <div className={className}>{children}</div>,
  IonHeader: ({ children }: PropsWithChildren) => <div>{children}</div>,
  IonIcon: () => null,
  IonPage: ({ children }: PropsWithChildren) => <div>{children}</div>,
  IonRefresher: ({ children, onIonRefresh }: PropsWithChildren<{ onIonRefresh?: (event: CustomEvent) => Promise<void> }>) => {
    refresherMocks.onIonRefresh = onIonRefresh;
    return <div data-testid="statistics-refresher">{children}</div>;
  },
  IonRefresherContent: () => null,
  IonSearchbar: ({ value, onIonInput, placeholder }: { value?: string; placeholder?: string; onIonInput?: (event: { detail: { value?: string } }) => void }) => (
    <input aria-label={placeholder} value={value} onChange={(event: ChangeEvent<HTMLInputElement>) => onIonInput?.({ detail: { value: event.target.value } })} />
  ),
  IonTitle: ({ children }: PropsWithChildren) => <div>{children}</div>,
  IonToolbar: ({ children, className }: DivProps) => <div className={className}>{children}</div>,
  useIonViewWillEnter: (callback: () => void) => {
    if (!viewMocks.entered) {
      viewMocks.entered = true;
      callback();
    }
  },
}));

const createTea = (teaId = 'tea-1', name = 'Gao Jia Shan'): Tea => Object.assign(new Tea(), {
  teaId, name, brand: 'Farmer Leaf', type: 'Oolong', subtype: null,
  region: 'Hunan', subregion: 'Anhua', year: 2015, season: null, sessions: [],
});

const createInfusion = (waterWeight: number): Infusion => Object.assign(new Infusion(), {
  infusionId: crypto.randomUUID(), infusionNumber: 1, waterWeight,
  startTime: '2026-07-10T12:00:00.000Z', duration: 60, restDuration: 0,
  wetTeaLeavesWeight: 0, note: null, temperature: null, sessionId: 'session',
});

const createSession = (sessionId: string, tea: Tea, status: 'completed' | 'active' = 'completed'): BrewingSession => Object.assign(new BrewingSession(), {
  sessionId, teaId: tea.teaId, tea, teaName: tea.name, startTime: '2026-07-10T12:00:00.000Z', endTime: '',
  vesselWeight: 0, lidWeight: 0, dryTeaLeavesWeight: 5, currentWasteWater: 0,
  notes: '', status, waterTemperature: 0, brewingVesselId: null, brewingVessel: null,
  infusions: [createInfusion(250)],
});

describe('HistoryStatisticsScreen', () => {
  let fullHistory: BrewingSession[];

  beforeEach(() => {
    vi.clearAllMocks();
    refresherMocks.onIonRefresh = undefined;
    viewMocks.entered = false;
    historyFiltersStore.setState(initialHistoryFiltersState);
    settingsStore.setState(initialSettingsStoreValues);
    settingsStore.setState({ settingsLoaded: true });

    const gao = createTea('tea-1', 'Gao Jia Shan');
    const sencha = createTea('tea-2', 'Morning Sencha');
    sencha.type = 'Green';
    fullHistory = [
      createSession('one', gao),
      createSession('two', sencha),
      createSession('active', gao, 'active'),
    ];
    loadAllHistory.mockResolvedValue(fullHistory);
    loadKnownTeas.mockResolvedValue(undefined);

    historyStore.setState(initialHistoryStoreState);
    historyStore.setState({
      // This represents the first 50-row History page; Statistics must not use it as its source.
      sessionList: [fullHistory[0]],
      knownTeas: [gao, sencha],
      loadAllHistory,
      loadKnownTeas,
    });
    vi.spyOn(settingsRepository, 'saveSettingsState').mockResolvedValue(undefined);
  });

  it('calculates totals from the complete filtered history, not the current History page', async () => {
    render(<HistoryStatisticsScreen />);

    expect(await screen.findByText('2 sessions')).toBeDefined();
    expect(screen.getByText('10 g')).toBeDefined();
    expect(screen.getByText('500 ml')).toBeDefined();
    expect(loadAllHistory).toHaveBeenCalledWith({});

    fireEvent.click(screen.getByRole('button', { name: 'Last month' }));
    expect(settingsStore.getState().statisticsPeriod).toBe('lastMonth');
    expect(settingsRepository.saveSettingsState).toHaveBeenCalledWith({ statisticsPeriod: 'lastMonth' });
  });

  it('keeps the loading state until the complete history query resolves', async () => {
    const historyLoad = deferred<BrewingSession[]>();
    loadAllHistory.mockImplementationOnce(() => historyLoad.promise);

    render(<HistoryStatisticsScreen />);

    expect(screen.getByText('Loading tea statistics…')).toBeDefined();
    historyLoad.resolve(fullHistory);
    await act(async () => { await historyLoad.promise; });

    expect(await screen.findByText('2 sessions')).toBeDefined();
    expect(screen.queryByText('Loading tea statistics…')).toBeNull();
  });

  it('passes shared fuzzy filters to the complete-history query', async () => {
    historyFiltersStore.getState().setSearchText('gao');
    historyFiltersStore.getState().setFilter('brand', 'Farmer Leaf');

    render(<HistoryStatisticsScreen />);

    await waitFor(() => expect(loadAllHistory).toHaveBeenCalledWith({ teaIds: ['tea-1'] }));
  });

  it('reloads complete history after a failed pull-to-refresh and completes the refresher', async () => {
    loadAllHistory.mockRejectedValueOnce(new Error('database unavailable'));
    render(<HistoryStatisticsScreen />);
    expect(await screen.findByText('Statistics could not be loaded. Pull to refresh and try again.')).toBeDefined();

    loadAllHistory.mockResolvedValueOnce(fullHistory);
    const complete = vi.fn();
    await act(async () => {
      await refresherMocks.onIonRefresh?.({ detail: { complete } } as CustomEvent);
    });

    expect(loadKnownTeas).toHaveBeenCalledWith(true);
    expect(complete).toHaveBeenCalled();
    expect(screen.queryByText('Statistics could not be loaded. Pull to refresh and try again.')).toBeNull();
    expect(await screen.findByText('2 sessions')).toBeDefined();
  });

  it('requeries complete history when shared filters change while Statistics is open', async () => {
    render(<HistoryStatisticsScreen />);
    await screen.findByText('2 sessions');

    historyFiltersStore.getState().setFilter('type', 'Green');

    await waitFor(() => expect(loadAllHistory).toHaveBeenLastCalledWith({ teaIds: ['tea-2'] }));
  });
});
