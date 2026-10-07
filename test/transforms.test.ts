import { describe, it, expect } from 'vitest';
import { screenToImage } from '../src/lib/geometry';

describe('screenToImage', () => {
  it('converts screen → image by dividing by scale', () => {
    expect(screenToImage(10, 20, 2)).toEqual({ x: 5, y: 10 });
    expect(screenToImage(15, 30, 3)).toEqual({ x: 5, y: 10 });
    expect(screenToImage(5, 10, 0.5)).toEqual({ x: 10, y: 20 });
  });
});
