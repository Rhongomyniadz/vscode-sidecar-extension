import { randomBytes } from 'crypto';

export type StructuredStepStatus = 'ok' | 'warning' | 'pending';
export type RubricItemStatus = 'met' | 'unmet' | 'partial';
export type CompletionStatus = 'in_progress' | 'ready' | 'abandoned';
export type SessionEventType =
  | 'session_start'
  | 'invoke_sidecar'
  | 'invoke_sidecar_failed'
  | 'preview_viewed'
  | 'edit_preview'
  | 'remove_sensitive'
  | 'send_request'
  | 'response_viewed'
  | 'rubric_checked'
  | 'export_clicked'
  | 'session_end';

export interface SensitiveFlag {
  lineNumber: number;
  match: string;
  pattern: string;
  lineText: string;
}

export interface StructuredStep {
  id: number;
  label: string;
  status: StructuredStepStatus;
  detail: string;
}

export interface StructuredResponse {
  title: string;
  steps: StructuredStep[];
  verify: string[];
}

export interface RubricItem {
  id: number;
  label: string;
  status: RubricItemStatus;
  explanation: string;
}

export interface RubricFeedback {
  rubricName: string;
  items: RubricItem[];
  summary: string;
}

export interface SelectionContext {
  filePath: string;
  fileName: string;
  lineStart: number;
  lineEnd: number;
}

export interface SessionDocumentInfo {
  path?: string;
  fileName?: string;
  lineStart?: number;
  lineEnd?: number;
}

export interface SessionEvent {
  type: SessionEventType;
  at: string;
  data?: Record<string, unknown>;
}

export interface SessionMetrics {
  timeToFirstInvokeMs: number | null;
  failedInvokeCount: number;
  previewDurationMs: number | null;
  responseLatencyMs: number | null;
  timeToRubricMs: number | null;
  totalDurationMs: number | null;
  editedPreview: boolean;
  removedSensitive: boolean;
  completionStatus: CompletionStatus;
}

export interface SessionLog {
  sessionId: string;
  participantId: string;
  startedAt: string;
  document: SessionDocumentInfo;
  events: SessionEvent[];
  completionStatus: CompletionStatus;
  metrics?: SessionMetrics;
  exportPath?: string;
}

export function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createNonce(): string {
  return randomBytes(16).toString('hex');
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function sanitizeParticipantId(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function formatLineRange(lineStart: number, lineEnd: number): string {
  return lineStart === lineEnd ? `Line ${lineStart}` : `Lines ${lineStart}-${lineEnd}`;
}

export function removeFlaggedLines(
  text: string,
  flags: SensitiveFlag[],
): { text: string; removedCount: number } {
  if (flags.length === 0) {
    return { text, removedCount: 0 };
  }

  const flaggedLines = new Set(flags.map((flag) => flag.lineNumber));
  const lines = text.split(/\r?\n/);
  const keptLines = lines.filter((_, index) => !flaggedLines.has(index + 1));

  return {
    text: keptLines.join('\n'),
    removedCount: lines.length - keptLines.length,
  };
}

export function buildExportBaseName(participantId: string, sessionId: string): string {
  return `${participantId}-${sessionId}`;
}

export function escapeLatex(value: string): string {
  const replacements: Record<string, string> = {
    '\\': '\\textbackslash{}',
    '{': '\\{',
    '}': '\\}',
    '$': '\\$',
    '&': '\\&',
    '#': '\\#',
    '%': '\\%',
    '_': '\\_',
    '^': '\\textasciicircum{}',
    '~': '\\textasciitilde{}',
  };

  return value.replace(/[\\{}$&#%^_~]/g, (character) => replacements[character]);
}
