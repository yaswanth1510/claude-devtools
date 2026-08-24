/**
 * HTTP-based implementation of ElectronAPI for browser mode.
 *
 * Replaces Electron IPC with fetch() for request/response and
 * EventSource (SSE) for real-time events. Allows the renderer
 * to run in a regular browser connected to an HTTP server.
 */

import { wrapError } from '@shared/utils/errorHandling';
import { createLogger } from '@shared/utils/logger';

import type {
  AppConfig,
  ClaudeMdFileInfo,
  ConfigAPI,
  ContextInfo,
  ConversationGroup,
  ElectronAPI,
  FileChangeEvent,
  HttpServerAPI,
  HttpServerStatus,
  NotificationsAPI,
  NotificationTrigger,
  PaginatedSessionsResult,
  Project,
  RepositoryGroup,
  SearchSessionsResult,
  Session,
  SessionAPI,
  SessionDetail,
  SessionMetrics,
  SessionsByIdsOptions,
  SessionsPaginationOptions,
  SshAPI,
  SshConfigHostEntry,
  SshConnectionConfig,
  SshConnectionStatus,
  SshLastConnection,
  SubagentDetail,
  TriggerTestResult,
  UpdaterAPI,
  WaterfallData,
} from '@shared/types';

const logger = createLogger('API:httpClient');

export class HttpAPIClient implements ElectronAPI {
  private baseUrl: string;
  private eventSource: EventSource | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- event callbacks have varying signatures
  private eventListeners = new Map<string, Set<(...args: any[]) => void>>();

  constructor(port: number) {
    this.baseUrl = `http://127.0.0.1:${port}`;
    this.initEventSource();
  }

  // ---------------------------------------------------------------------------
  // SSE event infrastructure
  // ---------------------------------------------------------------------------

  private initEventSource(): void {
    this.eventSource = new EventSource(`${this.baseUrl}/api/events`);
    this.eventSource.onopen = () => console.log('[HttpAPIClient] SSE connected');
    this.eventSource.onerror = () => {
      // Auto-reconnect is built into EventSource
      console.warn('[HttpAPIClient] SSE connection error, will reconnect...');
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- event callbacks have varying signatures
  private addEventListener(channel: string, callback: (...args: any[]) => void): () => void {
    if (!this.eventListeners.has(channel)) {
      this.eventListeners.set(channel, new Set());
      // Register SSE listener for this channel once
      this.eventSource?.addEventListener(channel, ((event: MessageEvent) => {
        let data: unknown;
        try {
          data = JSON.parse(event.data as string);
        } catch (error) {
          logger.error(`Discarding malformed SSE payload on channel "${channel}":`, error);
          return;
        }
        const listeners = this.eventListeners.get(channel);
        // One failing listener must not prevent the others from running.
        listeners?.forEach((cb) => {
          try {
            cb(data);
          } catch (error) {
            logger.error(`SSE listener for channel "${channel}" threw:`, error);
          }
        });
      }) as EventListener);
    }
    this.eventListeners.get(channel)!.add(callback);

    return () => {
      this.eventListeners.get(channel)?.delete(callback);
    };
  }

  // ---------------------------------------------------------------------------
  // HTTP helpers
  // ---------------------------------------------------------------------------

  /**
   * JSON reviver that converts ISO 8601 date strings back to Date objects.
   * Electron IPC preserves Date instances via structured clone, but HTTP JSON
   * serialization turns them into strings. This restores them so that
   * `.getTime()` and other Date methods work in the renderer.
   */
  // eslint-disable-next-line security/detect-unsafe-regex -- anchored pattern with bounded quantifier; no backtracking risk
  private static readonly ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z?$/;

  private static reviveDates(_key: string, value: unknown): unknown {
    if (typeof value === 'string' && HttpAPIClient.ISO_DATE_RE.test(value)) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d;
    }
    return value;
  }

  /**
   * Extracts the server-provided error message from a failed response body.
   * Falls back to the status line when the body is not JSON (HTML error pages,
   * proxy responses, empty bodies) so the HTTP status is never hidden behind a
   * JSON syntax error.
   */
  private static buildHttpError(res: Response, text: string): Error {
    const statusText = res.statusText ? ` ${res.statusText}` : '';
    const status = `HTTP ${res.status}${statusText}`;
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (typeof parsed.error === 'string' && parsed.error.length > 0) {
        return new Error(parsed.error);
      }
    } catch {
      // Body is not JSON - fall through to the status-based message below.
    }

    const snippet = text.trim().slice(0, 200);
    return new Error(snippet.length > 0 ? `${status}: ${snippet}` : status);
  }

  private async parseJson<T>(res: Response): Promise<T> {
    const text = await res.text();
    if (!res.ok) {
      throw HttpAPIClient.buildHttpError(res, text);
    }
    try {
      return JSON.parse(text, (key, value) => HttpAPIClient.reviveDates(key, value)) as T;
    } catch (error) {
      throw wrapError(`Invalid JSON response from ${res.url || this.baseUrl}`, error);
    }
  }

  private async get<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, { signal: controller.signal });
      return this.parseJson<T>(res);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async post<T>(path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      return this.parseJson<T>(res);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async del<T>(path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      return this.parseJson<T>(res);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async put<T>(path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      return this.parseJson<T>(res);
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Throws when a route replied with `{ success: false }`.
   * Browser mode mirrors the Electron preload, which rejects on failed results,
   * so a failed mutation must not look like a successful one.
   */
  private static assertResultOk(result: unknown, fallbackMessage: string): void {
    if (result && typeof result === 'object' && 'success' in result) {
      const { success, error } = result as { success?: unknown; error?: unknown };
      if (success === false) {
        throw new Error(typeof error === 'string' && error ? error : fallbackMessage);
      }
    }
  }

  /** POST that rejects when the route reports a failed result. */
  private async postChecked(
    path: string,
    body?: unknown,
    fallbackMessage = `POST ${path} failed`
  ): Promise<void> {
    HttpAPIClient.assertResultOk(await this.post<unknown>(path, body), fallbackMessage);
  }

  /** DELETE that rejects when the route reports a failed result. */
  private async delChecked(
    path: string,
    body?: unknown,
    fallbackMessage = `DELETE ${path} failed`
  ): Promise<void> {
    HttpAPIClient.assertResultOk(await this.del<unknown>(path, body), fallbackMessage);
  }

  /** PUT that rejects when the route reports a failed result. */
  private async putChecked(
    path: string,
    body?: unknown,
    fallbackMessage = `PUT ${path} failed`
  ): Promise<void> {
    HttpAPIClient.assertResultOk(await this.put<unknown>(path, body), fallbackMessage);
  }

  // ---------------------------------------------------------------------------
  // Core session/project APIs
  // ---------------------------------------------------------------------------

  getAppVersion = (): Promise<string> => this.get<string>('/api/version');

  getProjects = (): Promise<Project[]> => this.get<Project[]>('/api/projects');

  getSessions = (projectId: string): Promise<Session[]> =>
    this.get<Session[]>(`/api/projects/${encodeURIComponent(projectId)}/sessions`);

  getSessionsPaginated = (
    projectId: string,
    cursor: string | null,
    limit?: number,
    options?: SessionsPaginationOptions
  ): Promise<PaginatedSessionsResult> => {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    if (limit) params.set('limit', String(limit));
    if (options?.includeTotalCount === false) params.set('includeTotalCount', 'false');
    if (options?.prefilterAll === false) params.set('prefilterAll', 'false');
    if (options?.metadataLevel) params.set('metadataLevel', options.metadataLevel);
    const qs = params.toString();
    const encodedId = encodeURIComponent(projectId);
    const path = `/api/projects/${encodedId}/sessions-paginated`;
    return this.get<PaginatedSessionsResult>(qs ? `${path}?${qs}` : path);
  };

  searchSessions = (
    projectId: string,
    query: string,
    maxResults?: number
  ): Promise<SearchSessionsResult> => {
    const params = new URLSearchParams({ q: query });
    if (maxResults) params.set('maxResults', String(maxResults));
    return this.get<SearchSessionsResult>(
      `/api/projects/${encodeURIComponent(projectId)}/search?${params}`
    );
  };

  getSessionDetail = (projectId: string, sessionId: string): Promise<SessionDetail | null> =>
    this.get<SessionDetail | null>(
      `/api/projects/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}`
    );

  getSessionMetrics = (projectId: string, sessionId: string): Promise<SessionMetrics | null> =>
    this.get<SessionMetrics | null>(
      `/api/projects/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}/metrics`
    );

  getWaterfallData = (projectId: string, sessionId: string): Promise<WaterfallData | null> =>
    this.get<WaterfallData | null>(
      `/api/projects/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}/waterfall`
    );

  getSubagentDetail = (
    projectId: string,
    sessionId: string,
    subagentId: string
  ): Promise<SubagentDetail | null> =>
    this.get<SubagentDetail | null>(
      `/api/projects/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}/subagents/${encodeURIComponent(subagentId)}`
    );

  getSessionGroups = (projectId: string, sessionId: string): Promise<ConversationGroup[]> =>
    this.get<ConversationGroup[]>(
      `/api/projects/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}/groups`
    );

  getSessionsByIds = (
    projectId: string,
    sessionIds: string[],
    options?: SessionsByIdsOptions
  ): Promise<Session[]> =>
    this.post<Session[]>(`/api/projects/${encodeURIComponent(projectId)}/sessions-by-ids`, {
      sessionIds,
      metadataLevel: options?.metadataLevel,
    });

  // ---------------------------------------------------------------------------
  // Repository grouping
  // ---------------------------------------------------------------------------

  getRepositoryGroups = (): Promise<RepositoryGroup[]> =>
    this.get<RepositoryGroup[]>('/api/repository-groups');

  getWorktreeSessions = (worktreeId: string): Promise<Session[]> =>
    this.get<Session[]>(`/api/worktrees/${encodeURIComponent(worktreeId)}/sessions`);

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  validatePath = (
    relativePath: string,
    projectPath: string
  ): Promise<{ exists: boolean; isDirectory?: boolean }> =>
    this.post<{ exists: boolean; isDirectory?: boolean }>('/api/validate/path', {
      relativePath,
      projectPath,
    });

  validateMentions = (
    mentions: { type: 'path'; value: string }[],
    projectPath: string
  ): Promise<Record<string, boolean>> =>
    this.post<Record<string, boolean>>('/api/validate/mentions', { mentions, projectPath });

  // ---------------------------------------------------------------------------
  // CLAUDE.md reading
  // ---------------------------------------------------------------------------

  readClaudeMdFiles = (projectRoot: string): Promise<Record<string, ClaudeMdFileInfo>> =>
    this.post<Record<string, ClaudeMdFileInfo>>('/api/read-claude-md', { projectRoot });

  readDirectoryClaudeMd = (dirPath: string): Promise<ClaudeMdFileInfo> =>
    this.post<ClaudeMdFileInfo>('/api/read-directory-claude-md', { dirPath });

  readMentionedFile = (
    absolutePath: string,
    projectRoot: string,
    maxTokens?: number
  ): Promise<ClaudeMdFileInfo | null> =>
    this.post<ClaudeMdFileInfo | null>('/api/read-mentioned-file', {
      absolutePath,
      projectRoot,
      maxTokens,
    });

  // ---------------------------------------------------------------------------
  // Notifications (nested API)
  // ---------------------------------------------------------------------------

  notifications: NotificationsAPI = {
    get: (options) =>
      this.get(
        `/api/notifications?${new URLSearchParams(
          options
            ? {
                limit: String(options.limit ?? 20),
                offset: String(options.offset ?? 0),
              }
            : {}
        )}`
      ),
    markRead: (id) => this.post(`/api/notifications/${encodeURIComponent(id)}/read`),
    markAllRead: () => this.post('/api/notifications/read-all'),
    delete: (id) => this.del(`/api/notifications/${encodeURIComponent(id)}`),
    clear: () => this.del('/api/notifications'),
    getUnreadCount: () => this.get('/api/notifications/unread-count'),
    // IPC signature: (event: unknown, error: unknown) => void
    onNew: (callback) =>
      this.addEventListener('notification:new', (data: unknown) => callback(null, data)),
    // IPC signature: (event: unknown, payload: { total; unreadCount }) => void
    onUpdated: (callback) =>
      this.addEventListener('notification:updated', (data: unknown) =>
        callback(null, data as { total: number; unreadCount: number })
      ),
    // IPC signature: (event: unknown, data: unknown) => void
    onClicked: (callback) =>
      this.addEventListener('notification:clicked', (data: unknown) => callback(null, data)),
  };

  // ---------------------------------------------------------------------------
  // Config (nested API)
  // ---------------------------------------------------------------------------

  config: ConfigAPI = {
    get: async (): Promise<AppConfig> => {
      const result = await this.get<{ success: boolean; data?: AppConfig; error?: string }>(
        '/api/config'
      );
      if (!result.success) throw new Error(result.error ?? 'Failed to get config');
      return result.data!;
    },
    update: async (section: string, data: object): Promise<AppConfig> => {
      const result = await this.post<{ success: boolean; data?: AppConfig; error?: string }>(
        '/api/config/update',
        { section, data }
      );
      if (!result.success) throw new Error(result.error ?? 'Failed to update config');
      return result.data!;
    },
    addIgnoreRegex: async (pattern: string): Promise<AppConfig> => {
      await this.postChecked('/api/config/ignore-regex', { pattern }, 'Failed to add ignore regex');
      return this.config.get();
    },
    removeIgnoreRegex: async (pattern: string): Promise<AppConfig> => {
      await this.delChecked(
        '/api/config/ignore-regex',
        { pattern },
        'Failed to remove ignore regex'
      );
      return this.config.get();
    },
    addIgnoreRepository: async (repositoryId: string): Promise<AppConfig> => {
      await this.postChecked(
        '/api/config/ignore-repository',
        { repositoryId },
        'Failed to add ignored repository'
      );
      return this.config.get();
    },
    removeIgnoreRepository: async (repositoryId: string): Promise<AppConfig> => {
      await this.delChecked(
        '/api/config/ignore-repository',
        { repositoryId },
        'Failed to remove ignored repository'
      );
      return this.config.get();
    },
    snooze: async (minutes: number): Promise<AppConfig> => {
      await this.postChecked('/api/config/snooze', { minutes }, 'Failed to snooze notifications');
      return this.config.get();
    },
    clearSnooze: async (): Promise<AppConfig> => {
      await this.postChecked('/api/config/clear-snooze', undefined, 'Failed to clear snooze');
      return this.config.get();
    },
    addTrigger: async (trigger): Promise<AppConfig> => {
      await this.postChecked('/api/config/triggers', trigger, 'Failed to add trigger');
      return this.config.get();
    },
    updateTrigger: async (triggerId: string, updates): Promise<AppConfig> => {
      await this.putChecked(
        `/api/config/triggers/${encodeURIComponent(triggerId)}`,
        updates,
        'Failed to update trigger'
      );
      return this.config.get();
    },
    removeTrigger: async (triggerId: string): Promise<AppConfig> => {
      await this.delChecked(
        `/api/config/triggers/${encodeURIComponent(triggerId)}`,
        undefined,
        'Failed to remove trigger'
      );
      return this.config.get();
    },
    getTriggers: async (): Promise<NotificationTrigger[]> => {
      const result = await this.get<{
        success: boolean;
        data?: NotificationTrigger[];
        error?: string;
      }>('/api/config/triggers');
      HttpAPIClient.assertResultOk(result, 'Failed to get triggers');
      return result.data ?? [];
    },
    testTrigger: async (trigger: NotificationTrigger): Promise<TriggerTestResult> => {
      const result = await this.post<{
        success: boolean;
        data?: TriggerTestResult;
        error?: string;
      }>(`/api/config/triggers/${encodeURIComponent(trigger.id)}/test`, trigger);
      if (!result.success) throw new Error(result.error ?? 'Failed to test trigger');
      return result.data!;
    },
    selectFolders: async (): Promise<string[]> => {
      console.warn('[HttpAPIClient] selectFolders is not available in browser mode');
      return [];
    },
    openInEditor: async (): Promise<void> => {
      console.warn('[HttpAPIClient] openInEditor is not available in browser mode');
    },
    pinSession: (projectId: string, sessionId: string): Promise<void> =>
      this.postChecked(
        '/api/config/pin-session',
        { projectId, sessionId },
        'Failed to pin session'
      ),
    unpinSession: (projectId: string, sessionId: string): Promise<void> =>
      this.postChecked(
        '/api/config/unpin-session',
        { projectId, sessionId },
        'Failed to unpin session'
      ),
  };

  // ---------------------------------------------------------------------------
  // Session navigation
  // ---------------------------------------------------------------------------

  session: SessionAPI = {
    scrollToLine: (sessionId: string, lineNumber: number): Promise<void> =>
      this.post('/api/session/scroll-to-line', { sessionId, lineNumber }),
  };

  // ---------------------------------------------------------------------------
  // Zoom (browser fallbacks)
  // ---------------------------------------------------------------------------

  getZoomFactor = async (): Promise<number> => 1.0;

  onZoomFactorChanged = (_callback: (zoomFactor: number) => void): (() => void) => {
    // No-op in browser mode — zoom is managed by the browser itself
    return () => {};
  };

  // ---------------------------------------------------------------------------
  // File change events (via SSE)
  // ---------------------------------------------------------------------------

  onFileChange = (callback: (event: FileChangeEvent) => void): (() => void) =>
    this.addEventListener('file-change', callback);

  onTodoChange = (callback: (event: FileChangeEvent) => void): (() => void) =>
    this.addEventListener('todo-change', callback);

  // ---------------------------------------------------------------------------
  // Shell operations (browser fallbacks)
  // ---------------------------------------------------------------------------

  openPath = async (
    _targetPath: string,
    _projectRoot?: string
  ): Promise<{ success: boolean; error?: string }> => {
    console.warn('[HttpAPIClient] openPath is not available in browser mode');
    return { success: false, error: 'Not available in browser mode' };
  };

  openExternal = async (url: string): Promise<{ success: boolean; error?: string }> => {
    window.open(url, '_blank');
    return { success: true };
  };

  windowControls = {
    minimize: async (): Promise<void> => {},
    maximize: async (): Promise<void> => {},
    close: async (): Promise<void> => {},
    isMaximized: async (): Promise<boolean> => false,
  };

  // ---------------------------------------------------------------------------
  // Updater (browser no-ops)
  // ---------------------------------------------------------------------------

  updater: UpdaterAPI = {
    check: async (): Promise<void> => {
      console.warn('[HttpAPIClient] updater not available in browser mode');
    },
    download: async (): Promise<void> => {
      console.warn('[HttpAPIClient] updater not available in browser mode');
    },
    install: async (): Promise<void> => {
      console.warn('[HttpAPIClient] updater not available in browser mode');
    },
    onStatus: (_callback): (() => void) => {
      return () => {};
    },
  };

  // ---------------------------------------------------------------------------
  // SSH
  // ---------------------------------------------------------------------------

  ssh: SshAPI = {
    connect: (config: SshConnectionConfig): Promise<SshConnectionStatus> =>
      this.post('/api/ssh/connect', config),
    disconnect: (): Promise<SshConnectionStatus> => this.post('/api/ssh/disconnect'),
    getState: (): Promise<SshConnectionStatus> => this.get('/api/ssh/state'),
    test: (config: SshConnectionConfig): Promise<{ success: boolean; error?: string }> =>
      this.post('/api/ssh/test', config),
    getConfigHosts: async (): Promise<SshConfigHostEntry[]> => {
      const result = await this.get<{ success: boolean; data?: SshConfigHostEntry[] }>(
        '/api/ssh/config-hosts'
      );
      return result.data ?? [];
    },
    resolveHost: async (alias: string): Promise<SshConfigHostEntry | null> => {
      const result = await this.post<{
        success: boolean;
        data?: SshConfigHostEntry | null;
      }>('/api/ssh/resolve-host', { alias });
      return result.data ?? null;
    },
    saveLastConnection: (config: SshLastConnection): Promise<void> =>
      this.post('/api/ssh/save-last-connection', config),
    getLastConnection: async (): Promise<SshLastConnection | null> => {
      const result = await this.get<{ success: boolean; data?: SshLastConnection | null }>(
        '/api/ssh/last-connection'
      );
      return result.data ?? null;
    },
    // IPC signature: (event: unknown, status: SshConnectionStatus) => void
    onStatus: (callback): (() => void) =>
      this.addEventListener('ssh:status', (data: unknown) =>
        callback(null, data as SshConnectionStatus)
      ),
  };

  // ---------------------------------------------------------------------------
  // Context API
  // ---------------------------------------------------------------------------

  context = {
    list: (): Promise<ContextInfo[]> => this.get<ContextInfo[]>('/api/contexts'),
    getActive: (): Promise<string> => this.get<string>('/api/contexts/active'),
    switch: (contextId: string): Promise<{ contextId: string }> =>
      this.post<{ contextId: string }>('/api/contexts/switch', { contextId }),
    onChanged: (callback: (event: unknown, data: ContextInfo) => void): (() => void) =>
      this.addEventListener('context:changed', (data: unknown) =>
        callback(null, data as ContextInfo)
      ),
  };

  // HTTP Server API — in browser mode, server is already running (we're using it)
  httpServer: HttpServerAPI = {
    start: (): Promise<HttpServerStatus> =>
      Promise.resolve({ running: true, port: parseInt(new URL(this.baseUrl).port, 10) }),
    stop: (): Promise<HttpServerStatus> => {
      console.warn('[HttpAPIClient] Cannot stop HTTP server from browser mode');
      return Promise.resolve({ running: true, port: parseInt(new URL(this.baseUrl).port, 10) });
    },
    getStatus: (): Promise<HttpServerStatus> =>
      Promise.resolve({ running: true, port: parseInt(new URL(this.baseUrl).port, 10) }),
  };
}
