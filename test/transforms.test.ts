import { describe, it, expect } from 'vitest';
import { screenToImage, imageToScreen } from '../src/lib/geometry';

describe('screenToImage / imageToScreen', () => {
  it('converts screen → image by dividing by scale', () => {
    expect(screenToImage(10, 20, 2)).toEqual({ x: 5, y: 10 });
    expect(screenToImage(15, 30, 3)).toEqual({ x: 5, y: 10 });
  });

  it('converts image → screen by multiplying by scale', () => {
    expect(imageToScreen(5, 10, 2)).toEqual({ x: 10, y: 20 });
    expect(imageToScreen(5, 10, 0.5)).toEqual({ x: 2.5, y: 5 });
  });

  it('round-trips through both transforms', () => {
    for (const s of [0.25, 0.5, 1, 2, 3]) {
      const screen = imageToScreen(7, 13, s);
      expect(screenToImage(screen.x, screen.y, s)).toEqual({ x: 7, y: 13 });
    }
  });
});
