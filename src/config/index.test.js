import { describe, it, expect } from 'vitest';
import { covTier, uvTier, TIER_COLORS, TIER_LABELS, GRADES, LEGEND, SHAPES } from './index.js';

describe('covTier', () => {
  it('returns H for values >= 95', () => {
    expect(covTier(100)).toBe('H');
    expect(covTier(95)).toBe('H');
  });

  it('returns M for values >= 90 and < 95', () => {
    expect(covTier(94.9)).toBe('M');
    expect(covTier(90)).toBe('M');
  });

  it('returns L for values < 90', () => {
    expect(covTier(89.9)).toBe('L');
    expect(covTier(50)).toBe('L');
    expect(covTier(0)).toBe('L');
  });
});

describe('uvTier', () => {
  it('returns H for values < 20', () => {
    expect(uvTier(0)).toBe('H');
    expect(uvTier(19.9)).toBe('H');
  });

  it('returns M for values >= 20 and < 40', () => {
    expect(uvTier(20)).toBe('M');
    expect(uvTier(39.9)).toBe('M');
  });

  it('returns L for values >= 40', () => {
    expect(uvTier(40)).toBe('L');
    expect(uvTier(100)).toBe('L');
  });
});

describe('constants', () => {
  it('TIER_COLORS has H, M, L with hex colors', () => {
    expect(TIER_COLORS.H).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(TIER_COLORS.M).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(TIER_COLORS.L).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('TIER_LABELS maps to readable names', () => {
    expect(TIER_LABELS).toEqual({ H: 'High', M: 'Medium', L: 'Low' });
  });

  it('GRADES has 6 entries K through 5th', () => {
    expect(GRADES).toEqual(['K', '1st', '2nd', '3rd', '4th', '5th']);
  });

  it('LEGEND has coverage and undervax views', () => {
    expect(LEGEND.coverage).toHaveProperty('title');
    expect(LEGEND.coverage).toHaveProperty('h');
    expect(LEGEND.coverage).toHaveProperty('m');
    expect(LEGEND.coverage).toHaveProperty('l');
    expect(LEGEND.undervax).toHaveProperty('title');
  });

  it('SHAPES has SVG markup for each tier', () => {
    expect(SHAPES.H).toContain('<circle');
    expect(SHAPES.M).toContain('<rect');
    expect(SHAPES.L).toContain('<polygon');
  });
});
