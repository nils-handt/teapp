export * from './types/ble.types';
export * from './types/scale.types';
export { BluetoothScale } from './base/BluetoothScale';
export { DecentScale } from './devices/decent/DecentScale';
export { FelicitaScale } from './devices/felicita/FelicitaScale';
export { BlackCoffeeScale } from './devices/blackcoffee/BlackCoffeeScale';
export { BokooScale } from './devices/bokoo/BokooScale';
export { EspressiScale } from './devices/espressi/EspressiScale';
export { EurekaPrecisaScale } from './devices/eureka/EurekaPrecisaScale';
export { JimmyScale } from './devices/jimmy/JimmyScale';
export { LunarScale } from './devices/lunar/LunarScale';
export { Skale } from './devices/skale/Skale';
export { SmartChefScale } from './devices/smartchef/SmartChefScale';
export { TimemoreScale } from './devices/timemore/TimemoreScale';
export { WeighMyBruScale } from './devices/weighmybru/WeighMyBruScale';
export { bleAdapter } from './adapters/BleAdapter';
export { Logger } from './utils/Logger';

import { DecentScale } from './devices/decent/DecentScale';
import { FelicitaScale } from './devices/felicita/FelicitaScale';
import { BlackCoffeeScale } from './devices/blackcoffee/BlackCoffeeScale';
import { BokooScale } from './devices/bokoo/BokooScale';
import { EspressiScale } from './devices/espressi/EspressiScale';
import { EurekaPrecisaScale } from './devices/eureka/EurekaPrecisaScale';
import { JimmyScale } from './devices/jimmy/JimmyScale';
import { LunarScale } from './devices/lunar/LunarScale';
import { Skale } from './devices/skale/Skale';
import { SmartChefScale } from './devices/smartchef/SmartChefScale';
import { TimemoreScale } from './devices/timemore/TimemoreScale';
import { WeighMyBruScale } from './devices/weighmybru/WeighMyBruScale';
import { ScaleType } from './types/scale.types';

export const AVAILABLE_SCALES = [
  { scaleType: ScaleType.DECENT, class: DecentScale },
  { scaleType: ScaleType.FELICITA, class: FelicitaScale },
  { scaleType: ScaleType.BLACKCOFFEE, class: BlackCoffeeScale },
  { scaleType: ScaleType.BOKOO, class: BokooScale },
  { scaleType: ScaleType.ESPRESSI, class: EspressiScale },
  { scaleType: ScaleType.EUREKA_PRECISA, class: EurekaPrecisaScale },
  { scaleType: ScaleType.JIMMY, class: JimmyScale },
  { scaleType: ScaleType.LUNAR, class: LunarScale },
  { scaleType: ScaleType.SKALE, class: Skale },
  { scaleType: ScaleType.SMARTCHEF, class: SmartChefScale },
  { scaleType: ScaleType.TIMEMORE, class: TimemoreScale },
  { scaleType: ScaleType.WEIGHMYBRU, class: WeighMyBruScale },
];
