import type { ChangeEvent, PropsWithChildren } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrewingSession } from '../entities/BrewingSession.entity';
import { Infusion } from '../entities/Infusion.entity';
import { Tea } from '../entities/Tea.entity';
import { settingsRepository } from '../repositories/SettingsRepository';
import { historyFiltersStore, initialHistoryFiltersState } from '../stores/useHistoryFiltersStore';
import { historyStore, initialHistoryStoreState } from '../stores/useHistoryStore';
import { initialSettingsStoreValues, settingsStore } from '../stores/useSettingsStore';
import HistoryScreen from './HistoryScreen';
import HistoryStatisticsScreen from './HistoryStatisticsScreen';

const refresherMocks = vi.hoisted(() => ({
  onIonRefresh: undefined as ((event: CustomEvent) => Promise<void>) | undefined,
}));
const viewMocks = vi.hoisted(() => ({ entered: false }));
const logger = vi.hoisted(() => ({ error: vi.fn(), info: vi.fn() }));
const loadHistory = vi.fn().mockResolvedValue(undefined);
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
  IonButton: ({ children, routerLink, 'aria-label': ariaLabel }: PropsWithChildren<{ routerLink?: string; 'aria-label'?: string }>) => routerLink
    ? <a href={routerLink} aria-label={ariaLabel}>{children}</a>
    : <button aria-label={ariaLabel}>{children}</button>,
  IonIcon: () => null,
  IonItem: ({ children }: PropsWithChildren) => <div>{children}</div>,
  IonItemOption: ({ children, onClick }: PropsWithChildren<{ onClick?: () => void }>) => <button onClick={onClick}>{children}</button>,
  IonItemOptions: ({ children }: PropsWithChildren) => <div>{children}</div>,
  IonItemSliding: ({ children }: PropsWithChildren) => <div>{children}</div>,
  IonLabel: ({ children }: PropsWithChildren) => <div>{children}</div>,
  IonList: ({ children }: PropsWithChildren) => <div>{children}</div>,
  IonNote: ({ children }: PropsWithChildren) => <div>{children}</div>,
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
  useIonToast: () => [vi.fn()],
}));

const createTea = (): Tea => Object.assign(new Tea(), {
  teaId: 'tea-1', name: 'Gao Jia Shan', brand: 'Farmer Leaf', type: 'Oolong', subtype: null,
  region: 'Hunan', subregion: 'Anhua', year: 2015, season: null, sessions: [],
});

const createInfusion = (waterWeight: number): Infusion => Object.assign(new Infusion(), {
  infusionId: crypto.randomUUID(), infusionNumber: 1, waterWeight,
  startTime: '2026-07-10T12:00:00.000Z', duration: 60, restDuration: 0,
  wetTeaLeavesWeight: 0, note: null, temperature: null, sessionId: 'session',
});

const createSession = (sessionId: string, status: 'completed' | 'active'): BrewingSession => {
  const tea = createTea();
  if (sessionId === 'two') {
    tea.teaId = 'tea-2';
    tea.name = 'Morning Sencha';
    tea.type = 'Green';
  }
  return Object.assign(new BrewingSession(), {
    sessionId, teaId: tea.teaId, tea, teaName: tea.name, startTime: '2026-07-10T12:00:00.000Z', endTime: '',
    vesselWeight: 0, lidWeight: 0, dryTeaLeavesWeight: 5, currentWasteWater: 0,
    notes: '', status, waterTemperature: 0, brewingVesselId: null, brewingVessel: null,
    infusions: [createInfusion(250)],
  });
};

describe('HistoryStatisticsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refresherMocks.onIonRefresh = undefined;
    viewMocks.entered = false;
    historyFiltersStore.setState(initialHistoryFiltersState);
    settingsStore.setState(initialSettingsStoreValues);
    settingsStore.setState({ settingsLoaded: true });
    const tea = createTea();
    historyStore.setState(initialHistoryStoreState);
    historyStore.setState({
      sessionList: [createSession('one', 'completed'), createSession('two', 'completed'), createSession('active', 'active')],
      knownTeas: [tea], loadHistory, loadKnownTeas,
    });
    vi.spyOn(settingsRepository, 'saveSettingsState').mockResolvedValue(undefined);
  });

  it('shows completed filtered totals and updates the persisted rolling period', async () => {
    render(<HistoryStatisticsScreen />);
    expect(await screen.findByText('Tea statistics')).toBeDefined();
    expect(screen.getByText('2 sessions')).toBeDefined();
    expect(screen.getByText('10 g')).toBeDefined();
    expect(screen.getByText('500 ml')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Last month' }));
    expect(settingsStore.getState().statisticsPeriod).toBe('lastMonth');
    expect(settingsRepository.saveSettingsState).toHaveBeenCalledWith({ statisticsPeriod: 'lastMonth' });
  });

  it('shows only loading state until history and Tea metadata finish loading', async () => {
    const historyLoad = deferred<void>();
    const teaLoad = deferred<void>();
    loadHistory.mockImplementationOnce(() => historyLoad.promise);
    loadKnownTeas.mockImplementationOnce(() => teaLoad.promise);

    render(<HistoryStatisticsScreen />);

    expect(screen.getByText('Loading tea statistics…')).toBeDefined();
    expect(screen.queryByText('2 sessions')).toBeNull();
    expect(screen.queryByText('10 g')).toBeNull();
    expect(screen.queryByText('500 ml')).toBeNull();

    await act(async () => {
      historyLoad.resolve();
      teaLoad.resolve();
      await Promise.all([historyLoad.promise, teaLoad.promise]);
    });

    expect(await screen.findByText('2 sessions')).toBeDefined();
    expect(screen.queryByText('Loading tea statistics…')).toBeNull();
  });

  it('waits for deferred settings hydration before enabling periods or calculating statistics', async () => {
    const settingsLoad = deferred<Record<string, string>>();
    vi.spyOn(settingsRepository, 'getAllSettings').mockReturnValueOnce(settingsLoad.promise);
    historyStore.setState({
      sessionList: [
        createSession('recent', 'completed'),
        Object.assign(createSession('old', 'completed'), { startTime: '2020-01-01T12:00:00.000Z' }),
      ],
    });
    settingsStore.setState({ settingsLoaded: false });
    const hydration = settingsStore.getState().loadSettings();

    render(<HistoryStatisticsScreen />);

    expect(await screen.findByText('Loading tea statistics…')).toBeDefined();
    const totalButton = screen.getByRole('button', { name: 'Total' });
    expect((totalButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(totalButton);
    expect(settingsRepository.saveSettingsState).not.toHaveBeenCalled();
    expect(screen.queryByText('2 sessions')).toBeNull();

    await act(async () => {
      settingsLoad.resolve({ statisticsPeriod: 'lastWeek' });
      await hydration;
    });

    expect((await screen.findByText('Sessions')).parentElement?.textContent).toContain('1 session');
    expect(screen.getByRole('button', { name: 'Last week' }).getAttribute('aria-pressed')).toBe('true');
    expect((screen.getByRole('button', { name: 'Total' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('ignores an older overlapping load after a newer refresh succeeds', async () => {
    const staleHistoryLoad = deferred<void>();
    loadHistory.mockImplementationOnce(() => staleHistoryLoad.promise);

    render(<HistoryStatisticsScreen />);
    expect(await screen.findByText('Loading tea statistics…')).toBeDefined();

    const complete = vi.fn();
    await act(async () => {
      await refresherMocks.onIonRefresh?.({ detail: { complete } } as CustomEvent);
    });
    expect(await screen.findByText('2 sessions')).toBeDefined();

    await act(async () => {
      staleHistoryLoad.reject(new Error('stale load failed'));
      await staleHistoryLoad.promise.catch(() => undefined);
    });

    expect(screen.getByText('2 sessions')).toBeDefined();
    expect(screen.queryByText('Loading tea statistics…')).toBeNull();
    expect(screen.queryByText('Statistics could not be loaded. Pull to refresh and try again.')).toBeNull();
  });

  it('shares editable Tea filters with History and reports an empty result', async () => {
    historyFiltersStore.getState().setFilter('brand', 'No Match');
    render(<HistoryStatisticsScreen />);
    expect(await screen.findByText('No completed sessions match these filters.')).toBeDefined();
    expect(screen.getByText('Sessions').parentElement?.textContent).toContain('0 sessions');
    expect(screen.getByText('Dry leaf').parentElement?.textContent).toContain('0 g');
    expect(screen.getByText('Liquid').parentElement?.textContent).toContain('0 ml');
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(historyFiltersStore.getState().filters.brand).toBe('');
  });

  it('shows a retryable load error and completes refresh', async () => {
    historyFiltersStore.getState().setSearchText('gao');
    historyFiltersStore.getState().setFilter('brand', 'Farmer Leaf');
    settingsStore.getState().updateSettings({ statisticsPeriod: 'lastMonth' });
    loadHistory.mockRejectedValueOnce(new Error('database unavailable'));
    render(<HistoryStatisticsScreen />);
    expect(await screen.findByText('Statistics could not be loaded. Pull to refresh and try again.')).toBeDefined();
    loadHistory.mockResolvedValueOnce(undefined);
    const complete = vi.fn();
    await act(async () => {
      await refresherMocks.onIonRefresh?.({ detail: { complete } } as CustomEvent);
    });
    expect(loadKnownTeas).toHaveBeenCalledWith(true);
    expect(complete).toHaveBeenCalled();
    expect(screen.queryByText('Statistics could not be loaded. Pull to refresh and try again.')).toBeNull();
    expect(historyFiltersStore.getState()).toMatchObject({
      searchText: 'gao',
      filters: expect.objectContaining({ brand: 'Farmer Leaf' }),
    });
    expect(settingsStore.getState().statisticsPeriod).toBe('lastMonth');
    expect((screen.getByLabelText('Search teas') as HTMLInputElement).value).toBe('gao');
    expect(screen.getByRole('button', { name: 'Last month' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('shares search and Tea filters bidirectionally with History', async () => {
    const historyView = render(<HistoryScreen />);
    fireEvent.change(screen.getByLabelText('Search teas'), { target: { value: 'gao' } });
    fireEvent.click(screen.getByRole('button', { name: 'Show history filters' }));
    fireEvent.change(screen.getByLabelText('Filter Brand'), { target: { value: 'Farmer Leaf' } });
    expect(historyFiltersStore.getState()).toMatchObject({
      searchText: 'gao',
      filters: expect.objectContaining({ brand: 'Farmer Leaf' }),
    });
    historyView.unmount();

    viewMocks.entered = false;
    const statisticsView = render(<HistoryStatisticsScreen />);
    expect((await screen.findByText('Sessions')).parentElement?.textContent).toContain('1 session');
    expect((screen.getByLabelText('Search teas') as HTMLInputElement).value).toBe('gao');
    fireEvent.click(screen.getByRole('button', { name: 'Show history filters (1 active)' }));
    expect((screen.getByLabelText('Filter Brand') as HTMLInputElement).value).toBe('Farmer Leaf');
    fireEvent.change(screen.getByLabelText('Search teas'), { target: { value: 'sencha' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(historyFiltersStore.getState()).toMatchObject({
      searchText: '',
      filters: expect.objectContaining({ brand: '' }),
    });
    statisticsView.unmount();

    viewMocks.entered = false;
    render(<HistoryScreen />);
    expect((screen.getByLabelText('Search teas') as HTMLInputElement).value).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Show history filters' }));
    expect((screen.getByLabelText('Filter Brand') as HTMLInputElement).value).toBe('');
  });
});
