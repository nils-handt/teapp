export const BREWING_SCREEN_OPTIONS = [
  { id: 1, name: 'Zen' },
  { id: 2, name: 'Lab' },
  { id: 3, name: 'Flow' },
  { id: 4, name: 'Card' },
  { id: 5, name: 'Focus' },
  { id: 6, name: 'Old' },
] as const;

export type BrewingScreenId = (typeof BREWING_SCREEN_OPTIONS)[number]['id'];

export const DEFAULT_BREWING_SCREEN_ID: BrewingScreenId = 1;

export const getBrewingScreenPath = (screenId: BrewingScreenId) => `/tabs/brewing/${screenId}`;

export const isBrewingScreenId = (value: number): value is BrewingScreenId =>
  BREWING_SCREEN_OPTIONS.some((screen) => screen.id === value);
