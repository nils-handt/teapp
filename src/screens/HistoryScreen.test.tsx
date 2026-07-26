import { forwardRef, useImperativeHandle, useRef, type ChangeEvent, type HTMLAttributes, type KeyboardEventHandler, type MouseEventHandler, type PropsWithChildren } from 'react';
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
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  routerLink?: string;
  'aria-label'?: string;
}>;

type BackButtonProps = {
  defaultHref?: string;
  'aria-label'?: string;
};

type DivProps = PropsWithChildren<{
  className?: string;
  'data-testid'?: string;
  onClick?: MouseEventHandler<HTMLDivElement>;
}>;

type SearchbarInputEvent = { detail: { value?: string } };
type SearchbarProps = {
  'aria-activedescendant'?: string;
  'aria-controls'?: string;
  'aria-expanded'?: boolean;
  'aria-autocomplete'?: 'list';
  enterkeyhint?: HTMLAttributes<HTMLInputElement>['enterKeyHint'];
  onIonBlur?: () => void;
  onIonFocus?: () => void;
  onIonInput?: (event: SearchbarInputEvent) => void;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  placeholder?: string;
  role?: HTMLAttributes<HTMLInputElement>['role'];
  value?: string;
};
type RefresherProps = PropsWithChildren<{ onIonRefresh?: (event: CustomEvent) => Promise<void> }>;
type InfiniteScrollProps = PropsWithChildren<{
  disabled?: boolean;
  onIonInfinite?: (event: CustomEvent) => Promise<void>;
}>;
type ToastOptions = { buttons: Array<{ handler: () => void; text: string }>; duration: number; message: string };

vi.mock('@ionic/react', () => ({
  IonBackButton: ({ defaultHref, 'aria-label': ariaLabel }: BackButtonProps) => <a href={defaultHref} aria-label={ariaLabel}>Back</a>,
  IonButtons: ({ children }: PropsWithChildren) => <div>{children}</div>,
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
  IonButton: ({ children, className, routerLink, onClick, 'aria-label': ariaLabel }: ButtonProps) => routerLink
    ? <a href={routerLink} className={className} aria-label={ariaLabel}>{children}</a>
    : <button onClick={onClick} className={className} aria-label={ariaLabel}>{children}</button>,
  IonIcon: () => null,
  IonSearchbar: forwardRef<HTMLIonSearchbarElement, SearchbarProps>(function MockIonSearchbar({
    value,
    onIonInput,
    onIonFocus,
    onIonBlur,
    onKeyDown,
    placeholder,
    enterkeyhint,
    role,
    'aria-autocomplete': ariaAutocomplete,
    'aria-expanded': ariaExpanded,
    'aria-controls': ariaControls,
    'aria-activedescendant': ariaActiveDescendant,
  }: SearchbarProps, ref) {
    const inputRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => ({
      getInputElement: async () => inputRef.current as HTMLInputElement,
    }) as HTMLIonSearchbarElement);

    return (
    <input
      ref={inputRef}
      aria-label={placeholder}
      aria-activedescendant={ariaActiveDescendant}
      aria-autocomplete={ariaAutocomplete}
      aria-controls={ariaControls}
      aria-expanded={ariaExpanded}
      enterKeyHint={enterkeyhint}
      role={role}
      value={value}
      onChange={(event: ChangeEvent<HTMLInputElement>) => onIonInput?.({ detail: { value: event.target.value } })}
      onFocus={onIonFocus}
      onBlur={onIonBlur}
      onKeyDown={onKeyDown}
    />
    );
  }),
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

  it('uses the shared floating header surface', () => {
    render(<HistoryScreen />);

    const controlRow = screen.getByTestId('history-filter-row');
    expect(screen.getByTestId('history-header-surface').classList.contains('zen-history-header-surface')).toBe(true);
    expect(controlRow.contains(screen.getByLabelText('Search teas'))).toBe(true);
    const filterButton = screen.getByRole('button', { name: 'Show history filters' });
    const statisticsButton = screen.getByRole('link', { name: 'Open tea statistics' });
    expect(controlRow.contains(filterButton)).toBe(true);
    expect(controlRow.contains(statisticsButton)).toBe(true);
    expect(filterButton.classList.contains('zen-history-header-button')).toBe(true);
    expect(statisticsButton.classList.contains('zen-history-header-button')).toBe(true);
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
    const listbox = screen.getByRole('listbox');
    const option = screen.getByRole('option', { name: 'ORT 2015 Gao Jia Shan' });
    expect(listbox.className).toContain('rounded-2xl');
    expect(listbox.className).toContain('zen-autocomplete-menu');
    expect(option.className).toContain('zen-autocomplete-option');
    fireEvent.click(option);

    expect((screen.getByLabelText('Search teas') as HTMLInputElement).value).toBe('ORT 2015 Gao Jia Shan');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('navigates and selects search suggestions with the arrow keys', async () => {
    render(<HistoryScreen />);
    const searchInput = screen.getByLabelText('Search teas');

    fireEvent.change(searchInput, { target: { value: 'a' } });
    fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
    const firstOption = screen.getAllByRole('option')[0];
    await waitFor(() => expect(searchInput.getAttribute('aria-activedescendant')).toBe(firstOption.id));

    fireEvent.keyDown(searchInput, { key: 'Enter' });

    expect((searchInput as HTMLInputElement).value).toBe(firstOption.textContent);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('expands filters only from the explicit Filters control', () => {
    render(<HistoryScreen />);

    expect(screen.queryByLabelText('Filter Name')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show history filters' }));
    expect(screen.getByLabelText('Filter Name')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Hide history filters' }));
    expect(screen.queryByLabelText('Filter Name')).toBeNull();
  });

  it('moves Enter through expanded search filters and finishes on the last filter', () => {
    render(<HistoryScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Show history filters' }));

    const searchInput = screen.getByLabelText('Search teas');
    const nameFilter = screen.getByLabelText('Filter Name');
    const brandFilter = screen.getByLabelText('Filter Brand');
    const yearFilter = screen.getByLabelText('Filter Year');

    fireEvent.keyDown(searchInput, { key: 'Enter' });
    expect(document.activeElement).toBe(nameFilter);

    fireEvent.keyDown(nameFilter, { key: 'Escape' });
    fireEvent.keyDown(nameFilter, { key: 'Enter' });
    expect(document.activeElement).toBe(brandFilter);

    yearFilter.focus();
    fireEvent.keyDown(yearFilter, { key: 'Enter' });
    expect(document.activeElement).not.toBe(yearFilter);
  });

  it('selects an active filter suggestion before moving to the next filter', () => {
    render(<HistoryScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Show history filters' }));

    const nameFilter = screen.getByLabelText('Filter Name');
    const brandFilter = screen.getByLabelText('Filter Brand');
    nameFilter.focus();

    fireEvent.keyDown(nameFilter, { key: 'ArrowDown' });
    fireEvent.keyDown(nameFilter, { key: 'Enter' });

    expect((nameFilter as HTMLInputElement).value).toBe('ORT 2015 Gao Jia Shan');
    expect(document.activeElement).toBe(nameFilter);
    expect(document.activeElement).not.toBe(brandFilter);
  });

  it('shows active filter state and can clear all filters', () => {
    render(<HistoryScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Show history filters' }));
    fireEvent.change(screen.getByLabelText('Filter Name'), { target: { value: 'sencha' } });
    expect(screen.getByRole('button', { name: 'Hide history filters (1 active)' })).toBeDefined();
    expect(screen.getByTestId('history-active-filter-count').textContent).toBe('1');
    expect(screen.getByRole('button', { name: 'Clear filters' }).classList.contains('zen-history-header-button')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Hide history filters (1 active)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByRole('button', { name: 'Show history filters' })).toBeDefined();
  });
});
