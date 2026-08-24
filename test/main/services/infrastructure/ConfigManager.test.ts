import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfigManager } from '../../../../src/main/services/infrastructure/ConfigManager';

const writeState = vi.hoisted(() => ({ error: null as Error | null }));

vi.mock('@shared/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    writeFileSync: (...args: Parameters<typeof actual.writeFileSync>) => {
      if (writeState.error) {
        throw writeState.error;
      }
      return actual.writeFileSync(...args);
    },
  };
});

describe('ConfigManager persistence failures', () => {
  let tmpDir: string;
  let configPath: string;

  beforeEach(() => {
    writeState.error = null;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-manager-test-'));
    configPath = path.join(tmpDir, 'config.json');
  });

  afterEach(() => {
    writeState.error = null;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('persists updates to disk', () => {
    const manager = new ConfigManager(configPath);

    manager.updateConfig('display', { syntaxHighlighting: false });

    const persisted = JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
      display: { syntaxHighlighting: boolean };
    };
    expect(persisted.display.syntaxHighlighting).toBe(false);
  });

  it('propagates write failures from updateConfig instead of reporting success', () => {
    const manager = new ConfigManager(configPath);
    writeState.error = new Error('EACCES: permission denied');

    expect(() => manager.updateConfig('display', { syntaxHighlighting: false })).toThrow(
      /Failed to save config .*EACCES/
    );
  });

  it('propagates write failures from pinSession', () => {
    const manager = new ConfigManager(configPath);
    writeState.error = new Error('ENOSPC: no space left on device');

    expect(() => manager.pinSession('project-1', 'session-1')).toThrow(/ENOSPC/);
  });

  it('rejects invalid ignore regex patterns', () => {
    const manager = new ConfigManager(configPath);
    const before = manager.getConfig().notifications.ignoredRegex;

    expect(() => manager.addIgnoreRegex('([')).toThrow(/Invalid regex pattern/);
    expect(manager.getConfig().notifications.ignoredRegex).toEqual(before);
  });

  it('does not throw from the snooze-expiry path when the write fails', () => {
    const manager = new ConfigManager(configPath);
    // Move the snooze deadline into the past so isSnoozed() auto-clears it.
    manager.updateConfig('notifications', { snoozedUntil: Date.now() - 1000 });
    writeState.error = new Error('EACCES: permission denied');

    expect(manager.isSnoozed()).toBe(false);
  });
});
