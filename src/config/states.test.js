import { describe, it, expect } from 'vitest';
import { STATES, DEFAULT_STATE_CODE, getStateConfig } from './states.js';

describe('STATES registry', () => {
  it('includes NC by default', () => {
    expect(STATES.nc).toBeDefined();
    expect(STATES.nc.code).toBe('nc');
    expect(STATES.nc.fips).toBe('37');
    expect(STATES.nc.dataDir).toBe('NC');
  });

  it('every entry has the required fields', () => {
    for (const [code, cfg] of Object.entries(STATES)) {
      expect(cfg.code).toBe(code);
      expect(cfg.name).toBeTruthy();
      expect(cfg.fullName).toBeTruthy();
      expect(cfg.dataDir).toBeTruthy();
      expect(cfg.fips).toMatch(/^\d{2}$/);
      expect(cfg.sourceUrl).toMatch(/^https?:\/\//);
      expect(cfg.sourceLabel).toBeTruthy();
    }
  });
});

describe('DEFAULT_STATE_CODE', () => {
  it('defaults to NC for backward compatibility', () => {
    expect(DEFAULT_STATE_CODE).toBe('nc');
  });
});

describe('getStateConfig', () => {
  it('returns the NC config when given "nc"', () => {
    expect(getStateConfig('nc')).toBe(STATES.nc);
  });

  it('is case-insensitive', () => {
    expect(getStateConfig('NC')).toBe(STATES.nc);
    expect(getStateConfig('Nc')).toBe(STATES.nc);
  });

  it('falls back to the default state for unknown codes', () => {
    expect(getStateConfig('zz')).toBe(STATES[DEFAULT_STATE_CODE]);
  });

  it('falls back to the default state for missing args', () => {
    expect(getStateConfig()).toBe(STATES[DEFAULT_STATE_CODE]);
    expect(getStateConfig(null)).toBe(STATES[DEFAULT_STATE_CODE]);
    expect(getStateConfig('')).toBe(STATES[DEFAULT_STATE_CODE]);
  });
});
