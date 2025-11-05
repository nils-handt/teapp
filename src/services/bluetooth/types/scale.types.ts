export enum ScaleType {
  DECENT = 'DECENT',
  FELICITA = 'FELICITA',
  ACAIA = 'ACAIA',
  BLACKCOFFEE = 'BLACKCOFFEE',
  BOKOO = 'BOKOO',
  ESPRESSI = 'ESPRESSI',
  EUREKA_PRECISA = 'EUREKA_PRECISA',
  JIMMY = 'JIMMY',
  LUNAR = 'LUNAR',
  SKALE = 'SKALE',
  SMARTCHEF = 'SMARTCHEF',
  TIMEMORE = 'TIMEMORE',
  WEIGHMYBRU = 'WEIGHMYBRU',
}

export enum SCALE_TIMER_COMMAND {
  START = 'START',
  STOP = 'STOP',
  RESET = 'RESET',
}

export interface Weight {
  actual: number;
  old: number;
  smoothed: number;
  oldSmoothed: number;
}

export interface WeightChangeEvent {
  weight: Weight;
  stable: boolean;
  timestamp: number;
}

export interface FlowChangeEvent {
  timestamp: number;
}

export interface TimerEvent {
  command: SCALE_TIMER_COMMAND;
  timestamp: number;
}

export interface TareEvent {
  timestamp: number;
}
