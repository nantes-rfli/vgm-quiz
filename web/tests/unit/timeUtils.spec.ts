import { describe, it, expect } from 'vitest';
import { msToSeconds } from '@/src/lib/timeUtils';

describe('msToSeconds', () => {
  describe('with roundUp=false (default)', () => {
    it('converts positive milliseconds to seconds with floor rounding', () => {
      expect(msToSeconds(0)).toBe(0);
      expect(msToSeconds(999)).toBe(0);
      expect(msToSeconds(1000)).toBe(1);
      expect(msToSeconds(1500)).toBe(1);
      expect(msToSeconds(1999)).toBe(1);
      expect(msToSeconds(2000)).toBe(2);
      expect(msToSeconds(15000)).toBe(15);
    });

    it('handles negative values by returning 0', () => {
      expect(msToSeconds(-1)).toBe(0);
      expect(msToSeconds(-100)).toBe(0);
      expect(msToSeconds(-1000)).toBe(0);
    });

    it('handles edge cases', () => {
      expect(msToSeconds(0)).toBe(0);
      expect(msToSeconds(1)).toBe(0);
      expect(msToSeconds(Number.MAX_SAFE_INTEGER)).toBe(Math.floor(Number.MAX_SAFE_INTEGER / 1000));
    });
  });

  describe('with roundUp=true', () => {
    it('converts positive milliseconds to seconds with ceil rounding', () => {
      expect(msToSeconds(0, true)).toBe(0);
      expect(msToSeconds(1, true)).toBe(1);
      expect(msToSeconds(999, true)).toBe(1);
      expect(msToSeconds(1000, true)).toBe(1);
      expect(msToSeconds(1001, true)).toBe(2);
      expect(msToSeconds(1500, true)).toBe(2);
      expect(msToSeconds(1999, true)).toBe(2);
      expect(msToSeconds(2000, true)).toBe(2);
      expect(msToSeconds(15000, true)).toBe(15);
    });

    it('handles negative values by returning 0', () => {
      expect(msToSeconds(-1, true)).toBe(0);
      expect(msToSeconds(-100, true)).toBe(0);
      expect(msToSeconds(-1000, true)).toBe(0);
    });

    it('handles edge cases', () => {
      expect(msToSeconds(0, true)).toBe(0);
      expect(msToSeconds(1, true)).toBe(1);
      expect(msToSeconds(Number.MAX_SAFE_INTEGER, true)).toBe(Math.ceil(Number.MAX_SAFE_INTEGER / 1000));
    });
  });

  describe('explicit roundUp=false', () => {
    it('behaves the same as default', () => {
      expect(msToSeconds(1500, false)).toBe(msToSeconds(1500));
      expect(msToSeconds(999, false)).toBe(msToSeconds(999));
      expect(msToSeconds(-100, false)).toBe(msToSeconds(-100));
    });
  });
});