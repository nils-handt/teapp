import type { PropsWithChildren } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Tabs from './Tabs';

vi.mock('@ionic/react', async () => {
  const { Switch } = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  const Wrap = ({ children }: PropsWithChildren) => <div>{children}</div>;
  return {
    IonTabs: Wrap,
    IonRouterOutlet: ({ children }: PropsWithChildren) => <Switch>{children}</Switch>,
    IonTabBar: Wrap,
    IonTabButton: Wrap,
    IonIcon: () => null,
    IonLabel: Wrap,
  };
});
vi.mock('./brewing/BrewingZen', () => ({ default: () => <div>Brewing route</div> }));
vi.mock('./HistoryScreen', () => ({ default: () => <div>History route</div> }));
vi.mock('./HistoryStatisticsScreen', () => ({ default: () => <div>Tea statistics route</div> }));
vi.mock('./SessionDetailScreen', () => ({ default: () => <div>Session detail route</div> }));
vi.mock('./SettingsScreen', () => ({ default: () => <div>Settings route</div> }));

describe('Tabs routing', () => {
  it('routes statistics before the dynamic session detail route', () => {
    render(<MemoryRouter initialEntries={['/tabs/history/statistics']}><Tabs /></MemoryRouter>);
    expect(screen.getByText('Tea statistics route')).toBeDefined();
    expect(screen.queryByText('Session detail route')).toBeNull();
  });
});
