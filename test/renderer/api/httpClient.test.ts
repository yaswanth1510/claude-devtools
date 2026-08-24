import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpAPIClient } from '../../../src/renderer/api/httpClient';

vi.mock('@shared/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

type SseHandler = (event: { data: string }) => void;

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private handlers = new Map<string, SseHandler[]>();

  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(channel: string, handler: SseHandler): void {
    const existing = this.handlers.get(channel) ?? [];
    existing.push(handler);
    this.handlers.set(channel, existing);
  }

  emit(channel: string, data: string): void {
    this.handlers.get(channel)?.forEach((handler) => handler({ data }));
  }
}

function respond(body: string, init: { status?: number; statusText?: string } = {}): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: (init.status ?? 200) < 400,
      status: init.status ?? 200,
      statusText: init.statusText ?? '',
      url: 'http://127.0.0.1:3456/api/projects',
      text: () => Promise.resolve(body),
    })
  );
}

describe('HttpAPIClient error propagation', () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the server-provided error message for JSON error bodies', async () => {
    respond(JSON.stringify({ error: 'Project not found' }), { status: 404 });
    const client = new HttpAPIClient(3456);

    await expect(client.getProjects()).rejects.toThrow('Project not found');
  });

  it('keeps status and body context when the error body is not JSON', async () => {
    respond('<html>Bad Gateway</html>', { status: 502, statusText: 'Bad Gateway' });
    const client = new HttpAPIClient(3456);

    await expect(client.getProjects()).rejects.toThrow(/HTTP 502 Bad Gateway: <html>Bad Gateway/);
  });

  it('reports invalid JSON in a successful response instead of throwing a bare SyntaxError', async () => {
    respond('not json');
    const client = new HttpAPIClient(3456);

    await expect(client.getProjects()).rejects.toThrow(/Invalid JSON response/);
  });

  it('rejects config mutations that return a failed result wrapper', async () => {
    respond(JSON.stringify({ success: false, error: 'Failed to save config' }));
    const client = new HttpAPIClient(3456);

    await expect(client.config.pinSession('project-1', 'session-1')).rejects.toThrow(
      'Failed to save config'
    );
  });

  it('resolves config mutations that succeed', async () => {
    respond(JSON.stringify({ success: true }));
    const client = new HttpAPIClient(3456);

    await expect(client.config.pinSession('project-1', 'session-1')).resolves.toBeUndefined();
  });

  it('discards malformed SSE payloads without notifying listeners', () => {
    respond('{}');
    const client = new HttpAPIClient(3456);
    const callback = vi.fn();
    client.onFileChange(callback);

    expect(() => FakeEventSource.instances[0].emit('file-change', 'not json')).not.toThrow();
    expect(callback).not.toHaveBeenCalled();
  });

  it('still notifies remaining listeners when one listener throws', () => {
    respond('{}');
    const client = new HttpAPIClient(3456);
    const failing = vi.fn(() => {
      throw new Error('listener boom');
    });
    const healthy = vi.fn();
    client.onFileChange(failing);
    client.onFileChange(healthy);

    FakeEventSource.instances[0].emit('file-change', JSON.stringify({ type: 'change' }));

    expect(failing).toHaveBeenCalledTimes(1);
    expect(healthy).toHaveBeenCalledTimes(1);
  });
});
