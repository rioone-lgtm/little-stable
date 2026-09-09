export type Coat =
  | 'bay'
  | 'dark_bay'
  | 'brown'
  | 'black'
  | 'chestnut'
  | 'dark_chestnut'
  | 'gray'
  | 'white'
  | 'unknown';
export type FarmLocation = {
  latitude: number;
  longitude: number;
  timezone: string;
  label?: string;
};
export type Stall = {
  index: number;
  row: 'west' | 'east';
  order: number;
  label: string;
  horseRef: string | null;
};
export type HorseConfig = {
  ref: string;
  stallIndex: number;
  coat: Coat;
  coatLabel?: string;
  coatHex?: string;
};
/** Public stable-ops v1 response. No API client or server framework is required. */
export type StableConfig = {
  version: 1;
  generatedAt: string;
  farm: { name: string; location: FarmLocation };
  stalls: { capacity: number; occupied: number; layout: Stall[] };
  horses: HorseConfig[];
};
export const DEFAULT_LOCATION: FarmLocation = {
  latitude: 36.3167,
  longitude: 139.2,
  timezone: 'Asia/Tokyo',
  label: '群馬県伊勢崎市',
};
export const COAT_COLORS: Record<Coat, string> = {
  bay: '#7a4a2b',
  dark_bay: '#51392c',
  brown: '#6c4534',
  black: '#403b39',
  chestnut: '#ad6739',
  dark_chestnut: '#975133',
  gray: '#d6cabb',
  white: '#e3dece',
  unknown: '#bb956c',
};
const demoCoats = [
  '#7f4830',
  '#c2a17a',
  '#e3dece',
  '#51392c',
  '#ad6739',
  '#bb956c',
  '#403b39',
  '#975133',
  '#d6cabb',
  '#6c4534',
];
export const DEFAULT_CONFIG: StableConfig = {
  version: 1,
  generatedAt: '2026-09-09T04:00:00Z',
  farm: { name: 'Little Stable', location: DEFAULT_LOCATION },
  stalls: {
    capacity: 15,
    occupied: 10,
    layout: Array.from({ length: 15 }, (_, index) => ({
      index,
      row: index < 8 ? 'west' : 'east',
      order: index < 8 ? index : index - 8,
      label: String(index + 1).padStart(2, '0'),
      horseRef: index < 10 ? `h_${index}` : null,
    })),
  },
  horses: demoCoats.map((coatHex, stallIndex) => ({
    ref: `h_${stallIndex}`,
    stallIndex,
    coat: 'unknown',
    coatHex,
  })),
};
export function coatColor(
  horse: Pick<HorseConfig, 'coat' | 'coatHex'>,
): string {
  return horse.coatHex && /^#[\da-f]{6}$/i.test(horse.coatHex)
    ? horse.coatHex
    : (COAT_COLORS[horse.coat] ?? COAT_COLORS.unknown);
}
/** Validate untrusted JSON before allocating geometry; inconsistent assignments fail closed. */
export function fromStableOps(value: unknown): StableConfig {
  const c = value as StableConfig;
  const fail = () => {
    throw new TypeError('Invalid stable-ops v1 configuration');
  };
  if (
    !c ||
    c.version !== 1 ||
    typeof c.generatedAt !== 'string' ||
    !Number.isFinite(Date.parse(c.generatedAt)) ||
    typeof c.farm?.name !== 'string' ||
    !c.farm.location ||
    !c.stalls ||
    !Array.isArray(c.stalls.layout) ||
    !Array.isArray(c.horses)
  )
    return fail();
  const { latitude, longitude, timezone } = c.farm.location;
  if (
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > 90 ||
    !Number.isFinite(longitude) ||
    Math.abs(longitude) > 180 ||
    typeof timezone !== 'string'
  )
    return fail();
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone }).format(0);
  } catch {
    return fail();
  }
  if (
    !Number.isSafeInteger(c.stalls.capacity) ||
    c.stalls.capacity < 0 ||
    c.stalls.capacity > 256 ||
    c.stalls.layout.length !== c.stalls.capacity ||
    c.stalls.occupied !== c.horses.length ||
    c.horses.length > c.stalls.capacity
  )
    return fail();
  const indices = new Set<number>(),
    slots = new Set<string>(),
    refs = new Set<string>();
  for (const s of c.stalls.layout) {
    if (
      !s ||
      !Number.isSafeInteger(s.index) ||
      s.index < 0 ||
      indices.has(s.index) ||
      !['west', 'east'].includes(s.row) ||
      !Number.isSafeInteger(s.order) ||
      s.order < 0 ||
      s.order >= 256 ||
      slots.has(`${s.row}:${s.order}`) ||
      typeof s.label !== 'string' ||
      (s.horseRef !== null && typeof s.horseRef !== 'string')
    )
      return fail();
    indices.add(s.index);
    slots.add(`${s.row}:${s.order}`);
  }
  for (const h of c.horses) {
    if (
      !h ||
      typeof h.ref !== 'string' ||
      !h.ref ||
      refs.has(h.ref) ||
      typeof h.coat !== 'string' ||
      c.stalls.layout.find((s) => s.index === h.stallIndex)?.horseRef !== h.ref
    )
      return fail();
    refs.add(h.ref);
  }
  if (
    c.stalls.layout.some(
      (s) =>
        s.horseRef !== null &&
        !c.horses.some((h) => h.ref === s.horseRef && h.stallIndex === s.index),
    )
  )
    return fail();
  return {
    ...c,
    farm: { ...c.farm, location: { ...c.farm.location } },
    stalls: { ...c.stalls, layout: c.stalls.layout.map((s) => ({ ...s })) },
    horses: c.horses.map((h) => ({
      ...h,
      coat: Object.hasOwn(COAT_COLORS, h.coat) ? h.coat : 'unknown',
    })),
  };
}
export function stableGeometry(config: StableConfig = DEFAULT_CONFIG) {
  const rows = Math.max(1, ...config.stalls.layout.map((s) => s.order + 1));
  const length = rows * 2.6;
  return {
    rows,
    length,
    startZ: -(rows - 1) * 1.3,
    entranceZ: length / 2 + 1.6,
    groundHalfDepth: Math.max(13.5, length / 2 + 3.1),
  };
}
export function stallPosition(
  index: number,
  config: StableConfig = DEFAULT_CONFIG,
) {
  const s = config.stalls.layout.find((s) => s.index === index);
  if (!s) throw new RangeError('Unknown stall');
  return {
    x: s.row === 'west' ? -11.575 : -6.425,
    z: stableGeometry(config).startZ + s.order * 2.6,
  };
}
