import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  SessionDocumentInfo,
  SessionEvent,
  SessionEventType,
  SessionLog,
  SessionMetrics,
} from './utils';
import { buildExportBaseName } from './utils';

function findFirstEvent(events: SessionEvent[], type: SessionEventType): SessionEvent | undefined {
  return events.find((event) => event.type === type);
}

function findLastEvent(events: SessionEvent[], type: SessionEventType): SessionEvent | undefined {
  const matchingEvents = events.filter((event) => event.type === type);
  return matchingEvents.at(-1);
}

function toTimestamp(value?: string): number | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function elapsedMs(start?: string, end?: string): number | null {
  const startMs = toTimestamp(start);
  const endMs = toTimestamp(end);

  if (startMs === null || endMs === null) {
    return null;
  }

  return Math.max(0, endMs - startMs);
}

export class StudyLogger {
  constructor(private readonly outputDir: string) {}

  createSession(participantId: string, startedAt = new Date().toISOString()): SessionLog {
    return {
      sessionId: randomUUID(),
      participantId,
      startedAt,
      document: {},
      events: [
        {
          type: 'session_start',
          at: startedAt,
        },
      ],
      completionStatus: 'in_progress',
    };
  }

  updateDocument(session: SessionLog, document: SessionDocumentInfo): void {
    session.document = { ...document };
  }

  logEvent(
    session: SessionLog,
    type: SessionEventType,
    data?: Record<string, unknown>,
    at = new Date().toISOString(),
  ): SessionEvent {
    const event: SessionEvent = {
      type,
      at,
      ...(data ? { data } : {}),
    };

    session.events.push(event);
    return event;
  }

  buildMetrics(session: SessionLog): SessionMetrics {
    const firstInvoke = findFirstEvent(session.events, 'invoke_sidecar');
    const firstPreview = findFirstEvent(session.events, 'preview_viewed');
    const firstSend = findFirstEvent(session.events, 'send_request');
    const firstResponse = findFirstEvent(session.events, 'response_viewed');
    const firstRubric = findFirstEvent(session.events, 'rubric_checked');
    const sessionEnd = findLastEvent(session.events, 'session_end') ?? session.events.at(-1);

    return {
      timeToFirstInvokeMs: elapsedMs(session.startedAt, firstInvoke?.at),
      failedInvokeCount: session.events.filter((event) => event.type === 'invoke_sidecar_failed').length,
      previewDurationMs: elapsedMs(firstPreview?.at, firstSend?.at),
      responseLatencyMs: elapsedMs(firstSend?.at, firstResponse?.at),
      timeToRubricMs: elapsedMs(firstSend?.at, firstRubric?.at),
      totalDurationMs: elapsedMs(session.startedAt, sessionEnd?.at),
      editedPreview: session.events.some((event) => event.type === 'edit_preview'),
      removedSensitive: session.events.some((event) => event.type === 'remove_sensitive'),
      completionStatus: session.completionStatus,
    };
  }

  async writeLatexExport(session: SessionLog, latexContent: string): Promise<string> {
    await this.ensureOutputDir();

    const exportPath = path.join(
      this.outputDir,
      `${buildExportBaseName(session.participantId, session.sessionId)}.tex`,
    );

    await fs.writeFile(exportPath, latexContent, 'utf8');
    session.exportPath = exportPath;
    return exportPath;
  }

  async writeSessionLog(session: SessionLog): Promise<string> {
    await this.ensureOutputDir();
    session.metrics = this.buildMetrics(session);

    const outputPath = path.join(
      this.outputDir,
      `${buildExportBaseName(session.participantId, session.sessionId)}.json`,
    );

    await fs.writeFile(outputPath, JSON.stringify(session, null, 2), 'utf8');
    return outputPath;
  }

  private async ensureOutputDir(): Promise<void> {
    await fs.mkdir(this.outputDir, { recursive: true });
  }
}
