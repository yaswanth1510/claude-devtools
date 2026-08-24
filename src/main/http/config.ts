/**
 * HTTP route handlers for App Configuration.
 *
 * Routes:
 * - GET /api/config - Get full config
 * - POST /api/config/update - Update config section
 * - POST /api/config/ignore-regex - Add ignore pattern
 * - DELETE /api/config/ignore-regex - Remove ignore pattern
 * - POST /api/config/ignore-repository - Add ignored repository
 * - DELETE /api/config/ignore-repository - Remove ignored repository
 * - POST /api/config/snooze - Set snooze
 * - POST /api/config/clear-snooze - Clear snooze
 * - POST /api/config/triggers - Add trigger
 * - PUT /api/config/triggers/:triggerId - Update trigger
 * - DELETE /api/config/triggers/:triggerId - Remove trigger
 * - GET /api/config/triggers - Get all triggers
 * - POST /api/config/triggers/:triggerId/test - Test trigger
 * - POST /api/config/pin-session - Pin session
 * - POST /api/config/unpin-session - Unpin session
 * - POST /api/config/select-folders - No-op in browser
 * - POST /api/config/open-in-editor - No-op in browser
 */

import { getErrorMessage } from '@shared/utils/errorHandling';
import { createLogger } from '@shared/utils/logger';

import { validateConfigUpdatePayload } from '../ipc/configValidation';
import { validateTriggerId } from '../ipc/guards';
import {
  ConfigManager,
  type NotificationTrigger,
  type TriggerMode,
  type TriggerTokenType,
} from '../services';
import {
  isValidTriggerPayload,
  toNotificationTrigger,
  toTriggerTestResult,
  TRIGGER_PAYLOAD_ERROR,
  type TriggerPayload,
} from '../utils/triggerPayload';

import type { FastifyInstance } from 'fastify';

const logger = createLogger('HTTP:config');

interface ConfigResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export function registerConfigRoutes(app: FastifyInstance): void {
  const configManager = ConfigManager.getInstance();

  // Get full config
  app.get('/api/config', async () => {
    try {
      const config = configManager.getConfig();
      return { success: true, data: config };
    } catch (error) {
      logger.error('Error in GET /api/config:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  });

  // Update config section
  app.post<{ Body: { section: unknown; data: unknown } }>('/api/config/update', async (request) => {
    try {
      const { section, data } = request.body;
      const validation = validateConfigUpdatePayload(section, data);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      configManager.updateConfig(validation.section, validation.data);
      const updatedConfig = configManager.getConfig();
      return { success: true, data: updatedConfig };
    } catch (error) {
      logger.error('Error in POST /api/config/update:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  });

  // Add ignore regex
  app.post<{ Body: { pattern: string } }>('/api/config/ignore-regex', async (request) => {
    try {
      const { pattern } = request.body;
      if (!pattern || typeof pattern !== 'string') {
        return { success: false, error: 'Pattern is required and must be a string' };
      }

      try {
        new RegExp(pattern);
      } catch {
        return { success: false, error: 'Invalid regex pattern' };
      }

      configManager.addIgnoreRegex(pattern);
      return { success: true };
    } catch (error) {
      logger.error('Error in POST /api/config/ignore-regex:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  });

  // Remove ignore regex
  app.delete<{ Body: { pattern: string } }>('/api/config/ignore-regex', async (request) => {
    try {
      const { pattern } = request.body;
      if (!pattern || typeof pattern !== 'string') {
        return { success: false, error: 'Pattern is required and must be a string' };
      }

      configManager.removeIgnoreRegex(pattern);
      return { success: true };
    } catch (error) {
      logger.error('Error in DELETE /api/config/ignore-regex:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  });

  // Add ignore repository
  app.post<{ Body: { repositoryId: string } }>('/api/config/ignore-repository', async (request) => {
    try {
      const { repositoryId } = request.body;
      if (!repositoryId || typeof repositoryId !== 'string') {
        return { success: false, error: 'Repository ID is required and must be a string' };
      }

      configManager.addIgnoreRepository(repositoryId);
      return { success: true };
    } catch (error) {
      logger.error('Error in POST /api/config/ignore-repository:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  });

  // Remove ignore repository
  app.delete<{ Body: { repositoryId: string } }>(
    '/api/config/ignore-repository',
    async (request) => {
      try {
        const { repositoryId } = request.body;
        if (!repositoryId || typeof repositoryId !== 'string') {
          return { success: false, error: 'Repository ID is required and must be a string' };
        }

        configManager.removeIgnoreRepository(repositoryId);
        return { success: true };
      } catch (error) {
        logger.error('Error in DELETE /api/config/ignore-repository:', error);
        return { success: false, error: getErrorMessage(error) };
      }
    }
  );

  // Set snooze
  app.post<{ Body: { minutes: number } }>('/api/config/snooze', async (request) => {
    try {
      const { minutes } = request.body;
      if (typeof minutes !== 'number' || minutes <= 0 || minutes > 24 * 60) {
        return { success: false, error: 'Minutes must be a positive number' };
      }

      configManager.setSnooze(minutes);
      return { success: true };
    } catch (error) {
      logger.error('Error in POST /api/config/snooze:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  });

  // Clear snooze
  app.post('/api/config/clear-snooze', async () => {
    try {
      configManager.clearSnooze();
      return { success: true };
    } catch (error) {
      logger.error('Error in POST /api/config/clear-snooze:', error);
      return { success: false, error: getErrorMessage(error) };
    }
  });

  // Add trigger
  app.post<{ Body: TriggerPayload }>('/api/config/triggers', async (request) => {
    try {
      const trigger = request.body;
      if (!isValidTriggerPayload(trigger)) {
        return { success: false, error: TRIGGER_PAYLOAD_ERROR };
      }

      configManager.addTrigger(toNotificationTrigger(trigger));

      return { success: true };
    } catch (error) {
      logger.error('Error in POST /api/config/triggers:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add trigger',
      };
    }
  });

  // Update trigger
  app.put<{
    Params: { triggerId: string };
    Body: Partial<{
      name: string;
      enabled: boolean;
      contentType: string;
      requireError: boolean;
      toolName: string;
      matchField: string;
      matchPattern: string;
      ignorePatterns: string[];
      mode: TriggerMode;
      tokenThreshold: number;
      tokenType: TriggerTokenType;
      repositoryIds: string[];
      color: string;
    }>;
  }>('/api/config/triggers/:triggerId', async (request) => {
    try {
      const validated = validateTriggerId(request.params.triggerId);
      if (!validated.valid) {
        return { success: false, error: validated.error ?? 'Trigger ID is required' };
      }

      configManager.updateTrigger(validated.value!, request.body as Partial<NotificationTrigger>);
      return { success: true };
    } catch (error) {
      logger.error('Error in PUT /api/config/triggers:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update trigger',
      };
    }
  });

  // Remove trigger
  app.delete<{ Params: { triggerId: string } }>(
    '/api/config/triggers/:triggerId',
    async (request) => {
      try {
        const validated = validateTriggerId(request.params.triggerId);
        if (!validated.valid) {
          return { success: false, error: validated.error ?? 'Trigger ID is required' };
        }

        configManager.removeTrigger(validated.value!);
        return { success: true };
      } catch (error) {
        logger.error('Error in DELETE /api/config/triggers:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to remove trigger',
        };
      }
    }
  );

  // Get triggers
  app.get('/api/config/triggers', async () => {
    try {
      const triggers = configManager.getTriggers();
      return { success: true, data: triggers };
    } catch (error) {
      logger.error('Error in GET /api/config/triggers:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get triggers',
      };
    }
  });

  // Test trigger
  app.post<{ Params: { triggerId: string }; Body: NotificationTrigger }>(
    '/api/config/triggers/:triggerId/test',
    async (request) => {
      try {
        const { errorDetector } = await import('../services');
        const result = await errorDetector.testTrigger(request.body, 50);

        return { success: true, data: toTriggerTestResult(result) };
      } catch (error) {
        logger.error('Error in POST /api/config/triggers/test:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to test trigger',
        };
      }
    }
  );

  // Pin session
  app.post<{ Body: { projectId: string; sessionId: string } }>(
    '/api/config/pin-session',
    async (request) => {
      try {
        const { projectId, sessionId } = request.body;
        if (!projectId || typeof projectId !== 'string') {
          return { success: false, error: 'Project ID is required and must be a string' };
        }
        if (!sessionId || typeof sessionId !== 'string') {
          return { success: false, error: 'Session ID is required and must be a string' };
        }

        configManager.pinSession(projectId, sessionId);
        return { success: true };
      } catch (error) {
        logger.error('Error in POST /api/config/pin-session:', error);
        return { success: false, error: getErrorMessage(error) };
      }
    }
  );

  // Unpin session
  app.post<{ Body: { projectId: string; sessionId: string } }>(
    '/api/config/unpin-session',
    async (request) => {
      try {
        const { projectId, sessionId } = request.body;
        if (!projectId || typeof projectId !== 'string') {
          return { success: false, error: 'Project ID is required and must be a string' };
        }
        if (!sessionId || typeof sessionId !== 'string') {
          return { success: false, error: 'Session ID is required and must be a string' };
        }

        configManager.unpinSession(projectId, sessionId);
        return { success: true };
      } catch (error) {
        logger.error('Error in POST /api/config/unpin-session:', error);
        return { success: false, error: getErrorMessage(error) };
      }
    }
  );

  // Select folders - no-op in browser mode
  app.post('/api/config/select-folders', async (): Promise<ConfigResult<string[]>> => {
    return { success: true, data: [] };
  });

  // Open in editor - no-op in browser mode
  app.post('/api/config/open-in-editor', async (): Promise<ConfigResult> => {
    return { success: true };
  });
}
