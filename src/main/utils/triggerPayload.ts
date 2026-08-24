/**
 * Shared trigger payload mapping for the IPC and HTTP config handlers.
 *
 * Both transports receive loosely typed trigger payloads from clients and must
 * validate them, coerce them into a NotificationTrigger, and shape trigger test
 * results for the renderer.
 */

import {
  type NotificationTrigger,
  type TriggerContentType,
  type TriggerMatchField,
  type TriggerMode,
  type TriggerTokenType,
} from '../services';

import type { DetectedError } from '../services/error/ErrorMessageBuilder';
import type { TriggerColor } from '@shared/constants/triggerColors';

/** Loosely typed trigger payload as received from a client. */
export interface TriggerPayload {
  id: string;
  name: string;
  enabled: boolean;
  contentType: string;
  mode?: TriggerMode;
  requireError?: boolean;
  toolName?: string;
  matchField?: string;
  matchPattern?: string;
  ignorePatterns?: string[];
  tokenThreshold?: number;
  tokenType?: TriggerTokenType;
  repositoryIds?: string[];
  color?: string;
}

/** Trigger test result shaped for the renderer. */
export interface TriggerTestResult {
  totalCount: number;
  errors: {
    id: string;
    sessionId: string;
    projectId: string;
    message: string;
    timestamp: number;
    source: string;
    toolUseId?: string;
    subagentId?: string;
    lineNumber?: number;
    context: { projectName: string };
  }[];
  /** True if results were truncated due to safety limits */
  truncated?: boolean;
}

/** Error message used when a payload is missing required fields. */
export const TRIGGER_PAYLOAD_ERROR = 'Trigger must have id, name, and contentType';

/** Checks that a payload carries the fields required to create a trigger. */
export function isValidTriggerPayload(payload: TriggerPayload): boolean {
  return Boolean(payload.id && payload.name && payload.contentType);
}

/** Coerces a client payload into a user-defined NotificationTrigger. */
export function toNotificationTrigger(payload: TriggerPayload): NotificationTrigger {
  return {
    id: payload.id,
    name: payload.name,
    enabled: payload.enabled,
    contentType: payload.contentType as TriggerContentType,
    mode: payload.mode ?? (payload.requireError ? 'error_status' : 'content_match'),
    requireError: payload.requireError,
    toolName: payload.toolName,
    matchField: payload.matchField as TriggerMatchField | undefined,
    matchPattern: payload.matchPattern,
    ignorePatterns: payload.ignorePatterns,
    tokenThreshold: payload.tokenThreshold,
    tokenType: payload.tokenType,
    repositoryIds: payload.repositoryIds,
    color: payload.color as TriggerColor | undefined,
    isBuiltin: false,
  };
}

/**
 * Maps trigger test output to the renderer-facing shape.
 * Keeps toolUseId, subagentId, and lineNumber for deep linking to the exact
 * error location.
 */
export function toTriggerTestResult(result: {
  totalCount: number;
  errors: DetectedError[];
  truncated?: boolean;
}): TriggerTestResult {
  return {
    totalCount: result.totalCount,
    errors: result.errors.map((error) => ({
      id: error.id,
      sessionId: error.sessionId,
      projectId: error.projectId,
      message: error.message,
      timestamp: error.timestamp,
      source: error.source,
      toolUseId: error.toolUseId,
      subagentId: error.subagentId,
      lineNumber: error.lineNumber,
      context: { projectName: error.context.projectName },
    })),
    truncated: result.truncated,
  };
}
