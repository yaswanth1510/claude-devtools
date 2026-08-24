import { describe, expect, it } from 'vitest';

import {
  getHighlightProps,
  getToolHighlightProps,
  getTriggerColorDef,
  HIGHLIGHT_CLASSES,
  isPresetColorKey,
  resolveColorHex,
  TOOL_HIGHLIGHT_CLASSES,
  TRIGGER_COLORS,
} from '@shared/constants/triggerColors';

describe('isPresetColorKey', () => {
  it('accepts every preset key', () => {
    for (const color of TRIGGER_COLORS) {
      expect(isPresetColorKey(color.key)).toBe(true);
    }
  });

  it('rejects hex values and unknown keys', () => {
    expect(isPresetColorKey('#ff6600')).toBe(false);
    expect(isPresetColorKey('magenta')).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isPresetColorKey(undefined)).toBe(false);
  });
});

describe('getTriggerColorDef', () => {
  it('resolves a preset key to its definition', () => {
    expect(getTriggerColorDef('blue')).toEqual({ key: 'blue', label: 'Blue', hex: '#3b82f6' });
  });

  it('defaults to red when no color is given', () => {
    expect(getTriggerColorDef(undefined).key).toBe('red');
  });

  it('builds a synthetic definition for custom hex values', () => {
    expect(getTriggerColorDef('#ff6600')).toEqual({
      key: '#ff6600',
      label: '#ff6600',
      hex: '#ff6600',
    });
  });

  it('accepts shorthand hex values', () => {
    expect(getTriggerColorDef('#fff').hex).toBe('#fff');
  });

  it('falls back to the default for malformed hex values', () => {
    expect(getTriggerColorDef('#zzzzzz').key).toBe('red');
  });
});

describe('resolveColorHex', () => {
  it('resolves presets to hex', () => {
    expect(resolveColorHex('cyan')).toBe('#06b6d4');
  });

  it('passes custom hex through', () => {
    expect(resolveColorHex('#123456')).toBe('#123456');
  });

  it('resolves undefined to the default red hex', () => {
    expect(resolveColorHex(undefined)).toBe('#ef4444');
  });
});

describe('getHighlightProps', () => {
  it('returns the tailwind class for presets without inline style', () => {
    expect(getHighlightProps('green')).toEqual({ className: HIGHLIGHT_CLASSES.green });
  });

  it('defaults to the red preset classes', () => {
    expect(getHighlightProps(undefined)).toEqual({ className: HIGHLIGHT_CLASSES.red });
  });

  it('returns inline styles derived from custom hex values', () => {
    expect(getHighlightProps('#ff6600')).toEqual({
      className: 'ring-2',
      style: { boxShadow: '0 0 0 2px #ff66004D', backgroundColor: '#ff66000D' },
    });
  });
});

describe('getToolHighlightProps', () => {
  it('returns the pulsing tailwind class for presets', () => {
    expect(getToolHighlightProps('purple')).toEqual({
      className: TOOL_HIGHLIGHT_CLASSES.purple,
    });
  });

  it('defaults to the red preset classes', () => {
    expect(getToolHighlightProps(undefined)).toEqual({ className: TOOL_HIGHLIGHT_CLASSES.red });
  });

  it('returns inline styles derived from custom hex values', () => {
    expect(getToolHighlightProps('#00ff00')).toEqual({
      className: 'ring-2 animate-pulse',
      style: { boxShadow: '0 0 0 2px #00ff00', backgroundColor: '#00ff001A' },
    });
  });
});
