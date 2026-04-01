import assert from 'node:assert/strict';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import test from 'node:test';
import { StudyLogger } from '../logger';

test('logger writes session JSON with derived metrics', async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ambient-ai-sidecar-'));
  const studyLogger = new StudyLogger(outputDir);
  const session = studyLogger.createSession('participant-01', '2026-03-31T12:00:00.000Z');

  studyLogger.updateDocument(session, {
    path: '/tmp/stats_hw3.py',
    fileName: 'stats_hw3.py',
    lineStart: 12,
    lineEnd: 28,
  });

  studyLogger.logEvent(session, 'invoke_sidecar', { ok: true }, '2026-03-31T12:00:05.000Z');
  studyLogger.logEvent(session, 'invoke_sidecar_failed', { reason: 'empty_selection' }, '2026-03-31T12:00:06.000Z');
  studyLogger.logEvent(session, 'preview_viewed', undefined, '2026-03-31T12:00:07.000Z');
  studyLogger.logEvent(session, 'edit_preview', { charsChanged: 8 }, '2026-03-31T12:00:09.000Z');
  studyLogger.logEvent(session, 'remove_sensitive', { removedLineCount: 1 }, '2026-03-31T12:00:10.000Z');
  studyLogger.logEvent(session, 'send_request', undefined, '2026-03-31T12:00:12.000Z');
  studyLogger.logEvent(session, 'response_viewed', undefined, '2026-03-31T12:00:13.200Z');
  studyLogger.logEvent(session, 'rubric_checked', undefined, '2026-03-31T12:00:18.000Z');
  session.completionStatus = 'ready';
  studyLogger.logEvent(session, 'session_end', { status: 'ready' }, '2026-03-31T12:00:30.000Z');

  const outputPath = await studyLogger.writeSessionLog(session);
  const rawLog = await fs.readFile(outputPath, 'utf8');
  const savedLog = JSON.parse(rawLog) as {
    metrics: {
      timeToFirstInvokeMs: number;
      failedInvokeCount: number;
      previewDurationMs: number;
      responseLatencyMs: number;
      timeToRubricMs: number;
      totalDurationMs: number;
      editedPreview: boolean;
      removedSensitive: boolean;
      completionStatus: string;
    };
  };

  assert.equal(savedLog.metrics.timeToFirstInvokeMs, 5000);
  assert.equal(savedLog.metrics.failedInvokeCount, 1);
  assert.equal(savedLog.metrics.previewDurationMs, 5000);
  assert.equal(savedLog.metrics.responseLatencyMs, 1200);
  assert.equal(savedLog.metrics.timeToRubricMs, 6000);
  assert.equal(savedLog.metrics.totalDurationMs, 30000);
  assert.equal(savedLog.metrics.editedPreview, true);
  assert.equal(savedLog.metrics.removedSensitive, true);
  assert.equal(savedLog.metrics.completionStatus, 'ready');
});

test('logger writes a latex export file', async () => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ambient-ai-sidecar-'));
  const studyLogger = new StudyLogger(outputDir);
  const session = studyLogger.createSession('participant-02', '2026-03-31T12:30:00.000Z');

  const exportPath = await studyLogger.writeLatexExport(session, 'latex-body');
  const latexBody = await fs.readFile(exportPath, 'utf8');

  assert.match(path.basename(exportPath), /^participant-02-/);
  assert.equal(latexBody, 'latex-body');
});
