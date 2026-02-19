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
