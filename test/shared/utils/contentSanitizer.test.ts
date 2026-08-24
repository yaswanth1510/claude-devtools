import { describe, expect, it } from 'vitest';

import {
  extractSlashInfo,
  isCommandContent,
  isCommandOutputContent,
  sanitizeDisplayContent,
} from '@shared/utils/contentSanitizer';

describe('isCommandContent', () => {
  it('detects built-in command messages starting with <command-name>', () => {
    expect(isCommandContent('<command-name>/model</command-name>')).toBe(true);
  });

  it('detects skill command messages starting with <command-message>', () => {
    expect(isCommandContent('<command-message>run skill</command-message>')).toBe(true);
  });

  it('rejects content where the tag is not at the start', () => {
    expect(isCommandContent('hello <command-name>/model</command-name>')).toBe(false);
  });

  it('rejects plain text', () => {
    expect(isCommandContent('please fix the build')).toBe(false);
  });
});

describe('isCommandOutputContent', () => {
  it('detects stdout output', () => {
    expect(isCommandOutputContent('<local-command-stdout>ok</local-command-stdout>')).toBe(true);
  });

  it('detects stderr output', () => {
    expect(isCommandOutputContent('<local-command-stderr>bad</local-command-stderr>')).toBe(true);
  });

  it('rejects plain text', () => {
    expect(isCommandOutputContent('ok')).toBe(false);
  });
});

describe('sanitizeDisplayContent', () => {
  it('extracts stdout content', () => {
    expect(sanitizeDisplayContent('<local-command-stdout>\n  done\n</local-command-stdout>')).toBe(
      'done'
    );
  });

  it('extracts stderr content', () => {
    expect(sanitizeDisplayContent('<local-command-stderr> failed </local-command-stderr>')).toBe(
      'failed'
    );
  });

  it('falls back to tag stripping for empty stdout', () => {
    expect(sanitizeDisplayContent('<local-command-stdout></local-command-stdout>')).toBe(
      '<local-command-stdout></local-command-stdout>'
    );
  });

  it('renders a command with arguments in readable form', () => {
    const content = '<command-name>/model</command-name>\n<command-args>sonnet</command-args>';
    expect(sanitizeDisplayContent(content)).toBe('/model sonnet');
  });

  it('renders a command without arguments', () => {
    const content = '<command-name>/context</command-name>\n<command-args></command-args>';
    expect(sanitizeDisplayContent(content)).toBe('/context');
  });

  it('trims whitespace inside the command name', () => {
    expect(sanitizeDisplayContent('<command-name>/ clear </command-name>')).toBe('/clear');
  });

  it('strips command tags when the message tag comes first', () => {
    const content =
      '<command-message>isolate-context is running</command-message>\n' +
      '<command-name>/isolate-context</command-name>';
    expect(sanitizeDisplayContent(content)).toBe('/isolate-context');
  });

  it('removes system-reminder noise tags', () => {
    const content = 'real content<system-reminder>ignore me</system-reminder>';
    expect(sanitizeDisplayContent(content)).toBe('real content');
  });

  it('removes local-command-caveat noise tags', () => {
    const content = '<local-command-caveat>caveat</local-command-caveat>\nreal content';
    expect(sanitizeDisplayContent(content)).toBe('real content');
  });

  it('removes trailing command tags from mixed content', () => {
    const content = 'do the thing\n<command-args>--fast</command-args>';
    expect(sanitizeDisplayContent(content)).toBe('do the thing');
  });

  it('returns regular content unchanged', () => {
    expect(sanitizeDisplayContent('just a message')).toBe('just a message');
  });
});

describe('extractSlashInfo', () => {
  it('returns null for non-command content', () => {
    expect(extractSlashInfo('hello')).toBeNull();
  });

  it('extracts name, message and args', () => {
    const content =
      '<command-name>/claude-hud:setup</command-name>\n' +
      '<command-message>setting up</command-message>\n' +
      '<command-args>--force</command-args>';
    expect(extractSlashInfo(content)).toEqual({
      name: 'claude-hud:setup',
      message: 'setting up',
      args: '--force',
    });
  });

  it('returns undefined message and args when tags are absent', () => {
    expect(extractSlashInfo('<command-name>/model</command-name>')).toEqual({
      name: 'model',
      message: undefined,
      args: undefined,
    });
  });

  it('trims surrounding whitespace from all fields', () => {
    const content =
      '<command-name>/ model </command-name><command-message> msg </command-message>' +
      '<command-args> opus </command-args>';
    expect(extractSlashInfo(content)).toEqual({ name: 'model', message: 'msg', args: 'opus' });
  });

  it('extracts empty message and args as empty strings', () => {
    const content =
      '<command-name>/model</command-name><command-message></command-message>' +
      '<command-args></command-args>';
    expect(extractSlashInfo(content)).toEqual({ name: 'model', message: '', args: '' });
  });
});
