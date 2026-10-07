export type Effect = 'blur' | 'pixelate' | 'black' | 'white' | 'frosted';

export interface Region {
  id: number;
  /** All geometry is stored in IMAGE pixel space. */
  x: number;
  y: number;
  w: number;
  h: number;
  effect: Effect;
  strength: number;
}

export type Rect = Pick<Region, 'x' | 'y' | 'w' | 'h'>;

/** Deep-ish clone of a region array (regions carry no nested objects). */
export function cloneRegions(regions: Region[]): Region[] {
  return regions.map((r) => ({ ...r }));
}
