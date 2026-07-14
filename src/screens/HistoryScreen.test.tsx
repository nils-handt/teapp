import type { ChangeEvent, MouseEventHandler, PropsWithChildren } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HistoryScreen from './HistoryScreen';
import { APP_TAB_BAR_ID } from '../constants/ui';
import type { BrewingSession } from '../entities/BrewingSession.entity';
import { BrewingSession as BrewingSessionEntity } from '../entities/BrewingSession.entity';
import { historyStore, initialHistoryStoreState } from '../stores/useHistoryStore';
import { historyFiltersStore, initialHistoryFiltersState } from '../stores/useHistoryFiltersStore';
import { Tea } from '../entities/Tea.entity';

const refresherMocks = vi.hoisted(() => ({
  onIonRefresh: undefined as ((event: CustomEvent) => Promise<void>) | undefined,
}));
const infiniteMocks = vi.hoisted(() => ({
  onIonInfinite: undefined as ((event: CustomEvent) => Promise<void>) | undefined,
}));
const viewMocks = vi.hoisted(() => ({ entered: false }));

const reloadHistory = vi.fn().mockResolvedValue(undefined);
const loadMoreHistory = vi.fn().mockResolvedValue(undefined);
const loadKnownTeas = vi.fn().mockResolvedValue(undefined);
const deleteSession = vi.fn().mockResolvedValue(undefined);
const restoreSession = vi.fn().mockResolvedValue(undefined);
const presentToast = vi.fn();

type HistoryScreenStoreSeed = {
  deleteSession: (sessionId: string) => Promise<void>;
  hasMoreHistory: boolean;
  isHistoryLoading: boolean;
  loadKnownTeas: (force?: boolean) => Promise<void>;
  loadMoreHistory: () => Promise<void>;
  reloadHistory: (query: { teaIds?: string[] }) => Promise<void>;
  restoreSession: (session: BrewingSession) => Promise<void>;
  knownTeas: Tea[];
  sessionList: BrewingSession[];
};

type ButtonProps = PropsWithChildren<{
  onClick?: MouseEventHandler<HTMLButtonElement>;
  routerLink?: string;
  'aria-label'?: string;
}>;

type DivProps = PropsWithChildren<{
  className?: string;
  'data-testid'?: string;
  onClick?: MouseEventHandler<HTMLDivElement>;
}>;

type SearchbarInputEvent = { detail: { value?: string } };
type SearchbarProps = { onIonInput?: (event: SearchbarInputEvent) => void; placeholder?: string; value?: string };
type RefresherProps = PropsWithChildren<{ onIonRefresh?: (event: CustomEvent) => Promise<void> }>;
type InfiniteScrollProps = PropsWithChildren<{
  disabled?: boolean;
  onIonInfinite?: (event: CustomEvent) => Promise<void>;
}>;
type ToastOptions = { buttons: Array<{ handler: () => void; text: string }>; duration: number; message: string };

vi.mock('@ionic/react', () => ({
  IonContent: ({ children, className, 'data-testid': testId }: DivProps) => <div className={className} data-testid={testId}>{children}</div>,
  IonHeader: ({ children }: PropsWithChildren) => <div>{children}</div>,
  IonPage: ({ children }: PropsWithChildren) => <div>{children}</div>,
  IonList: ({ children, className, onClick }: DivProps) => <div className={className} data-testid="history-list" onClick={onClick}>{children}</div>,
  IonItem: ({ children }: PropsWithChildren) => <div>{children}</div>,
  IonLabel: ({ children, className }: DivProps) => <div className={className}>{children}</div>,
  IonNote: ({ children, className }: DivProps) => <div className={className}>{children}</div>,
  IonRefresher: ({ children, onIonRefresh }: RefresherProps) => {
    refresherMocks.onIonRefresh = onIonRefresh;
    return <div data-testid="history-refresher">{children}</div>;
  },
  IonRefresherContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
  IonInfiniteScroll: ({ children, disabled, onIonInfinite }: InfiniteScrollProps) => {
    infiniteMocks.onIonInfinite = onIonInfinite;
    return <div data-testid="history-infinite-scroll" data-disabled={String(disabled)}>{children}</div>;
  },
  IonInfiniteScrollContent: () => <div>Loading more history…</div>,
  IonItemSliding: ({ children }: PropsWithChildren) => <div>{children}</div>,
  IonItemOptions: ({ children }: PropsWithChildren) => <div>{children}</div>,
  IonItemOption: ({ children, onClick }: ButtonProps) => <button aria-label="Delete session" onClick={onClick}>{children}</button>,
  IonButton: ({ children, routerLink, onClick, 'aria-label': ariaLabel }: ButtonProps) => routerLink
    ? <a href={routerLink} aria-label={ariaLabel}>{children}</a>
    : <button onClick={onClick} aria-label={ariaLabel}>{children}</button>,
  IonIcon: () => null,
  IonSearchbar: ({ value, onIonInput, placeholder }: SearchbarProps) => (
    <input
      aria-label={placeholder}
      value={value}
      onChange={(event: ChangeEvent<HTMLInputElement>) => onIonInput?.({ detail: { value: event.target.value } })}
    />
  ),
  IonToolbar: ({ children }: PropsWithChildren) => <div>{children}</div>,
  useIonToast: () => [presentToast],
  useIonViewWillEnter: (callback: () => void) => {
    if (!viewMocks.entered) {
      viewMocks.entered = true;
      callback();
    }
  },
}));

describe('HistoryScreen', () => {
  const createTea = (teaId: string, name: string): Tea => Object.assign(new Tea(), {
    teaId,
    name,
    brand: null,
    type: null,
    subtype: null,
    region: null,
    subregion: null,
    year: null,
    season: null,
    sessions: [],
  });

  const createSession = (sessionId: string, tea: Tea, startTime: string): BrewingSession => {
    const session = new BrewingSessionEntity();
    session.sessionId = sessionId;
    session.teaName = tea.name;
    session.teaId = tea.teaId;
    session.tea = tea;
    session.startTime = startTime;
    session.endTime = '';
    session.vesselWeight = 0;
    session.lidWeight = 0;
    session.dryTeaLeavesWeight = 0;
    session.currentWasteWater = 0;
    session.notes = '';
    session.status = 'completed';
    session.waterTemperature = 0;
    session.brewingVesselId = null;
    session.brewingVessel = null;
    session.infusions = [];
    return session;
  };

  const seedHistoryStore = (overrides: Partial<HistoryScreenStoreSeed> = {}) => {
    const ortTea = createTea('tea-1', 'ORT 2015 Gao Jia Shan');
    const senchaTea = createTea('tea-2', 'Morning Sencha');

    historyStore.setState(initialHistoryStoreState);
    historyStore.setState({
      sessionList: [
        createSession('1', ortTea, '2026-03-14T10:00:00.000Z'),
        createSession('2', senchaTea, '2026-03-15T10:00:00.000Z'),
      ],
      knownTeas: [ortTea, senchaTea],
      hasMoreHistory: true,
      isHistoryLoading: false,
      reloadHistory,
      loadMoreHistory,
      loadKnownTeas,
      deleteSession,
      restoreSession,
      ...overrides,
    });
  };

  beforeEach(() => {
    historyFiltersStore.setState(initialHistoryFiltersState);
    vi.clearAllMocks();
    refresherMocks.onIonRefresh = undefined;
    infiniteMocks.onIonInfinite = undefined;
    viewMocks.entered = false;
    seedHistoryStore();
  });

  it('loads the first matching page and cached teas when entering', async () => {
    render(<HistoryScreen />);

    await waitFor(() => expect(reloadHistory).toHaveBeenCalledWith({}));
    expect(loadKnownTeas).toHaveBeenCalled();
  });

  it('links the pie-chart action to the dedicated statistics page', () => {
    render(<HistoryScreen />);
    expect(screen.getByRole('link', { name: 'Open tea statistics' }).getAttribute('href'))
      .toBe('/tabs/history/statistics');
  });

  it('keeps shared Tea filters when history refreshes', async () => {
    render(<HistoryScreen />);
    fireEvent.change(screen.getByLabelText('Search teas'), { target: { value: 'sencha' } });
    fireEvent.click(screen.getByRole('button', { name: 'Show history filters' }));
    fireEvent.change(screen.getByLabelText('Filter Brand'), { target: { value: 'Ippodo' } });

    const complete = vi.fn();
    await act(async () => {
      await refresherMocks.onIonRefresh?.({ detail: { complete } } as CustomEvent);
    });

    expect(loadKnownTeas).toHaveBeenCalledWith(true);
    expect(historyFiltersStore.getState()).toMatchObject({
      searchText: 'sencha',
      filters: expect.objectContaining({ brand: 'Ippodo' }),
    });
    expect(complete).toHaveBeenCalled();
  });

  it('requests fuzzy search matches from the full history instead of filtering loaded rows only', async () => {
    render(<HistoryScreen />);

    fireEvent.change(screen.getByLabelText('Search teas'), { target: { value: 'gao shan' } });

    await waitFor(() => expect(reloadHistory).toHaveBeenCalledWith({ teaIds: ['tea-1'] }));
  });

  it('requests another page when infinite scrolling reaches the bottom and disables at the end', async () => {
    render(<HistoryScreen />);
    const complete = vi.fn();

    await act(async () => {
      await infiniteMocks.onIonInfinite?.({ target: { complete } } as unknown as CustomEvent);
    });

    expect(loadMoreHistory).toHaveBeenCalled();
    expect(complete).toHaveBeenCalled();
    expect(screen.getByTestId('history-infinite-scroll').getAttribute('data-disabled')).toBe('false');

    await act(async () => {
      historyStore.setState({ isHistoryLoading: true });
    });
    expect(screen.getByTestId('history-infinite-scroll').getAttribute('data-disabled')).toBe('false');

    await act(async () => {
      historyStore.setState({ hasMoreHistory: false, isHistoryLoading: false });
    });
    expect(screen.getByTestId('history-infinite-scroll').getAttribute('data-disabled')).toBe('true');
  });

  it('uses the shared Zen list treatment without changing the session structure', () => {
    render(<HistoryScreen />);

    expect(screen.getByTestId('history-page').classList.contains('zen-list-page')).toBe(true);
    expect(screen.getByTestId('history-list').classList.contains('zen-list-surface')).toBe(true);
    expect(screen.getByText('Morning Sencha').classList.contains('text-zen-text')).toBe(true);
  });

  it('labels sessions without tea in muted text', () => {
    const unnamedSession = createSession('unnamed', createTea('tea-3', 'Placeholder Tea'), '2026-03-16T10:00:00.000Z');
    unnamedSession.tea = null;
    unnamedSession.teaId = null;
    unnamedSession.teaName = '  ';
    seedHistoryStore({ sessionList: [unnamedSession] });

    render(<HistoryScreen />);

    expect(screen.getByRole('heading', { name: 'No tea selected' }).className).toContain('text-zen-muted');
  });

  it('offers Undo after deleting a session from the history list', async () => {
    render(<HistoryScreen />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete session' })[0]);

    await waitFor(() => {
      expect(deleteSession).toHaveBeenCalledWith('1');
      expect(presentToast).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Session deleted',
        duration: 5000,
        position: 'bottom',
        positionAnchor: APP_TAB_BAR_ID,
      }));
    });

    const toastOptions = presentToast.mock.calls[0][0] as ToastOptions;
    toastOptions.buttons[0].handler();

    expect(restoreSession).toHaveBeenCalledWith(expect.objectContaining({ sessionId: '1' }));
  });

  it('lets users apply a suggestion to the search field', () => {
    render(<HistoryScreen />);

    fireEvent.change(screen.getByLabelText('Search teas'), { target: { value: 'ort' } });
    fireEvent.click(screen.getByRole('button', { name: 'ORT 2015 Gao Jia Shan' }));

    expect((screen.getByLabelText('Search teas') as HTMLInputElement).value).toBe('ORT 2015 Gao Jia Shan');
  });

  it('expands filters only from the explicit Filters control', () => {
    render(<HistoryScreen />);

    expect(screen.queryByLabelText('Filter Name')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show history filters' }));
    expect(screen.getByLabelText('Filter Name')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Hide history filters' }));
    expect(screen.queryByLabelText('Filter Name')).toBeNull();
  });

  it('shows active filter state and can clear all filters', () => {
    render(<HistoryScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Show history filters' }));
    fireEvent.change(screen.getByLabelText('Filter Name'), { target: { value: 'sencha' } });
    expect(screen.getByRole('button', { name: 'Hide history filters (1 active)' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Hide history filters (1 active)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByRole('button', { name: 'Show history filters' })).toBeDefined();
  });
});
