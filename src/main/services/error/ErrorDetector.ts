/**
 * ErrorDetector service - Detects errors from parsed JSONL messages.
 *
 * This is the main orchestrator that coordinates between specialized modules:
 * - ToolSummaryFormatter: Formats tool information for display
 * - TriggerMatcher: Pattern matching utilities
 * - ToolResultExtractor: Extracts tool results from messages
 * - ErrorMessageBuilder: Builds error messages and DetectedError objects
 * - ErrorTriggerChecker: Checks messages against triggers
 * - ErrorTriggerTester: Testing functionality for trigger preview
 *
 * Detection criteria:
 * - Uses configurable triggers from ConfigManager
 * - Supports tool_result triggers with requireError, toolName, and matchPattern
 * - Supports tool_use triggers for future expansion
 * - Supports token_threshold triggers for monitoring context usage
 */

import { type ParsedMessage } from '@main/types';

import { ConfigManager, type NotificationTrigger } from '../infrastructure/ConfigManager';

import { type DetectedError } from './ErrorMessageBuilder';
import { detectErrorsForTriggers, preResolveRepositoryIds } from './ErrorTriggerChecker';
import { testTrigger as testTriggerImpl } from './ErrorTriggerTester';

// =============================================================================
// Error Detector Class
// =============================================================================

class ErrorDetector {
  // ===========================================================================
  // Main Detection Method
  // ===========================================================================

  /**
   * Detects errors from an array of parsed messages using configurable triggers.
   *
   * @param messages - Array of ParsedMessage objects from a session
   * @param sessionId - The session ID
   * @param projectId - The project ID (encoded directory name)
   * @param filePath - Path to the JSONL file
   * @returns Array of DetectedError objects
   */
  async detectErrors(
    messages: ParsedMessage[],
    sessionId: string,
    projectId: string,
    filePath: string
  ): Promise<DetectedError[]> {
    // Get enabled triggers from config
    const configManager = ConfigManager.getInstance();
    const triggers = configManager.getEnabledTriggers();

    if (triggers.length === 0) {
      return [];
    }

    // Pre-resolve repository ID for this project to populate cache.
    const cwdHint =
      messages.find((message) => typeof message.cwd === 'string' && message.cwd.trim().length > 0)
        ?.cwd ?? undefined;
    await preResolveRepositoryIds([{ projectId, cwdHint }]);

    return detectErrorsForTriggers(messages, triggers, sessionId, projectId, filePath);
  }

  // ===========================================================================
  // Trigger Testing (Preview Feature)
  // ===========================================================================

  /**
   * Tests a trigger configuration against historical session data.
   * Returns a list of errors that would have been detected.
   *
   * Safety features (handled by ErrorTriggerTester):
   * - Limits returned errors to 50
   * - Caps totalCount at 10,000 to prevent indefinite counting
   * - Stops scanning after 100 sessions
   * - Aborts after 30 seconds
   *
   * @param trigger - The trigger configuration to test
   * @param limit - Maximum number of results to return (default 50)
   */
  public async testTrigger(
    trigger: NotificationTrigger,
    limit: number = 50
  ): Promise<{
    totalCount: number;
    errors: DetectedError[];
    /** True if results were truncated due to safety limits */
    truncated?: boolean;
  }> {
    return testTriggerImpl(trigger, limit);
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const errorDetector = new ErrorDetector();
