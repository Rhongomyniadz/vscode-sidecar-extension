import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { StudyLogger } from './logger';
import { detectSensitiveContent, generateRubricFeedback, generateStructuredResponse, getMockDelay } from './mockEngine';
import { buildLatexExport } from './scenarioData';
import type { CompletionStatus, SelectionContext, SensitiveFlag, SessionLog } from './utils';
import { createNonce, delay, formatLineRange, removeFlaggedLines, sanitizeParticipantId } from './utils';

const PANEL_VIEW_TYPE = 'ambientAI.sidecar';
const PANEL_TITLE = 'Ambient AI Sidecar';

interface RuntimeSession {
  log: SessionLog;
  selection?: SelectionContext;
  originalSelectionText: string;
  previewText: string;
  sensitiveFlags: SensitiveFlag[];
  editCount: number;
  removedLineCount: number;
  exportPath?: string;
  isFinalized: boolean;
}

interface WebviewMessage {
  type: string;
  text?: string;
}

let logger: StudyLogger | undefined;
let activePanel: vscode.WebviewPanel | undefined;
let activeSession: RuntimeSession | undefined;
let isWebviewReady = false;

export function activate(context: vscode.ExtensionContext): void {
  logger = new StudyLogger(vscode.Uri.joinPath(context.extensionUri, 'logs').fsPath);

  const openSidecarCommand = vscode.commands.registerCommand('ambientAI.openSidecar', async () => {
    await openSidecar(context);
  });

  context.subscriptions.push(openSidecarCommand);
}

export async function deactivate(): Promise<void> {
  await finalizeSession('abandoned');
}

async function openSidecar(context: vscode.ExtensionContext): Promise<void> {
  const session = await ensureSession();

  if (!session) {
    return;
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    await recordInvokeFailure(session, 'no_active_editor');
    void vscode.window.showWarningMessage('Open a file and select code before invoking Ambient AI Sidecar.');
    return;
  }

  const selectedText = editor.document.getText(editor.selection);
  if (editor.selection.isEmpty || selectedText.length === 0) {
    await recordInvokeFailure(session, 'empty_selection');
    void vscode.window.showWarningMessage('Select a block of code before invoking Ambient AI Sidecar.');
    return;
  }

  const selection = buildSelectionContext(editor.document, editor.selection);
  session.selection = selection;
  session.originalSelectionText = selectedText;
  session.previewText = selectedText;
  session.sensitiveFlags = detectSensitiveContent(selectedText);
  session.editCount = 0;
  session.removedLineCount = 0;
  session.exportPath = undefined;
  session.isFinalized = false;
  session.log.completionStatus = 'in_progress';

  logger?.updateDocument(session.log, {
    path: selection.filePath,
    fileName: selection.fileName,
    lineStart: selection.lineStart,
    lineEnd: selection.lineEnd,
  });

  logger?.logEvent(session.log, 'invoke_sidecar', {
    fileName: selection.fileName,
    lineRange: formatLineRange(selection.lineStart, selection.lineEnd),
    sensitiveFlagCount: session.sensitiveFlags.length,
  });

  const panel = await getOrCreatePanel(context);
  panel.reveal(vscode.ViewColumn.Beside);

  if (isWebviewReady) {
    await panel.webview.postMessage(buildInitPayload(session));
  }
}

async function ensureSession(): Promise<RuntimeSession | undefined> {
  if (activeSession && !activeSession.isFinalized) {
    return activeSession;
  }

  const participantInput = await vscode.window.showInputBox({
    prompt: 'Enter participant ID for this Ambient AI Sidecar session',
    placeHolder: 'participant-01',
    ignoreFocusOut: true,
  });

  if (participantInput === undefined) {
    return undefined;
  }

  const participantId = sanitizeParticipantId(participantInput);
  if (!participantId) {
    void vscode.window.showErrorMessage('Participant ID cannot be empty.');
    return undefined;
  }

  if (!logger) {
    throw new Error('Logger is not initialized.');
  }

  activeSession = {
    log: logger.createSession(participantId),
    originalSelectionText: '',
    previewText: '',
    sensitiveFlags: [],
    editCount: 0,
    removedLineCount: 0,
    isFinalized: false,
  };

  return activeSession;
}

async function recordInvokeFailure(session: RuntimeSession, reason: string): Promise<void> {
  logger?.logEvent(session.log, 'invoke_sidecar_failed', { reason });
  await logger?.writeSessionLog(session.log);
}

function buildSelectionContext(
  document: vscode.TextDocument,
  selection: vscode.Selection,
): SelectionContext {
  const filePath = document.uri.scheme === 'file' ? document.uri.fsPath : document.uri.toString();
  const fileName = path.basename(filePath) || document.fileName;
  const lineStart = selection.start.line + 1;
  const lineEnd =
    selection.end.character === 0 && selection.end.line > selection.start.line
      ? selection.end.line
      : selection.end.line + 1;

  return {
    filePath,
    fileName,
    lineStart,
    lineEnd,
  };
}

function buildInitPayload(session: RuntimeSession): Record<string, unknown> {
  return {
    type: 'init',
    selection: {
      fileName: session.selection?.fileName ?? 'Unknown file',
      lineStart: session.selection?.lineStart ?? 0,
      lineEnd: session.selection?.lineEnd ?? 0,
      lineLabel: session.selection
        ? formatLineRange(session.selection.lineStart, session.selection.lineEnd)
        : 'No selection',
    },
    previewText: session.previewText,
    flags: session.sensitiveFlags,
  };
}

async function getOrCreatePanel(context: vscode.ExtensionContext): Promise<vscode.WebviewPanel> {
  if (activePanel) {
    return activePanel;
  }

  activePanel = vscode.window.createWebviewPanel(PANEL_VIEW_TYPE, PANEL_TITLE, vscode.ViewColumn.Beside, {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
  });
  isWebviewReady = false;

  activePanel.webview.html = await buildWebviewHtml(activePanel.webview, context.extensionUri);

  activePanel.onDidDispose(
    () => {
      void handlePanelDisposed();
    },
    null,
    context.subscriptions,
  );

  activePanel.webview.onDidReceiveMessage(
    (message) => {
      void handleWebviewMessage(message as WebviewMessage);
    },
    null,
    context.subscriptions,
  );

  return activePanel;
}

async function buildWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): Promise<string> {
  const templatePath = vscode.Uri.joinPath(extensionUri, 'media', 'sidecar.html');
  const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'sidecar.css'));
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'sidecar.js'));
  const nonce = createNonce();

  const html = await fs.readFile(templatePath.fsPath, 'utf8');

  return html
    .replaceAll('{{cspSource}}', webview.cspSource)
    .replaceAll('{{nonce}}', nonce)
    .replaceAll('{{stylesUri}}', stylesUri.toString())
    .replaceAll('{{scriptUri}}', scriptUri.toString());
}

async function handlePanelDisposed(): Promise<void> {
  activePanel = undefined;
  isWebviewReady = false;

  if (activeSession && !activeSession.isFinalized) {
    await finalizeSession('abandoned');
  }
}

async function handleWebviewMessage(message: WebviewMessage): Promise<void> {
  if (message.type === 'webviewReady') {
    isWebviewReady = true;

    if (activePanel && activeSession && !activeSession.isFinalized) {
      await activePanel.webview.postMessage(buildInitPayload(activeSession));
    }

    return;
  }

  if (!activePanel) {
    return;
  }

  if (!activeSession || activeSession.isFinalized) {
    await activePanel.webview.postMessage({
      type: 'error',
      message: 'No active session is available. Invoke Ambient AI Sidecar again to begin a new session.',
    });
    return;
  }

  switch (message.type) {
    case 'previewViewed':
      logger?.logEvent(activeSession.log, 'preview_viewed', {
        sensitiveFlagCount: activeSession.sensitiveFlags.length,
      });
      break;

    case 'editPreview':
      if (applyIncomingPreviewText(activeSession, message.text, true)) {
        await activePanel.webview.postMessage(buildPreviewUpdatedPayload(activeSession));
      }
      break;

    case 'removeSensitive':
      applyIncomingPreviewText(activeSession, message.text, true);
      await handleRemoveSensitive(activeSession);
      break;

    case 'sendRequest':
      applyIncomingPreviewText(activeSession, message.text, true);
      await handleSendRequest(activeSession);
      break;

    case 'checkRubric':
      applyIncomingPreviewText(activeSession, message.text, true);
      await handleRubricRequest(activeSession);
      break;

    case 'exportLatex':
      applyIncomingPreviewText(activeSession, message.text, true);
      await handleExport(activeSession);
      break;

    case 'markReady':
      applyIncomingPreviewText(activeSession, message.text, true);
      await handleMarkReady(activeSession);
      break;

    default:
      await activePanel.webview.postMessage({
        type: 'error',
        message: `Unsupported webview message: ${message.type}`,
      });
  }
}

function applyIncomingPreviewText(
  session: RuntimeSession,
  nextText: string | undefined,
  shouldLogEdit: boolean,
): boolean {
  if (typeof nextText !== 'string' || nextText === session.previewText) {
    return false;
  }

  session.previewText = nextText;
  session.sensitiveFlags = detectSensitiveContent(session.previewText);

  if (shouldLogEdit) {
    session.editCount += 1;
    logger?.logEvent(session.log, 'edit_preview', {
      previewLength: session.previewText.length,
      sensitiveFlagCount: session.sensitiveFlags.length,
    });
  }

  return true;
}

function buildPreviewUpdatedPayload(session: RuntimeSession): Record<string, unknown> {
  return {
    type: 'previewUpdated',
    previewText: session.previewText,
    flags: session.sensitiveFlags,
  };
}

async function handleRemoveSensitive(session: RuntimeSession): Promise<void> {
  if (!activePanel) {
    return;
  }

  const removal = removeFlaggedLines(session.previewText, session.sensitiveFlags);
  if (removal.removedCount > 0) {
    session.previewText = removal.text;
    session.sensitiveFlags = detectSensitiveContent(session.previewText);
    session.removedLineCount += removal.removedCount;

    logger?.logEvent(session.log, 'remove_sensitive', {
      removedLineCount: removal.removedCount,
      remainingSensitiveFlags: session.sensitiveFlags.length,
    });
  }

  await activePanel.webview.postMessage(buildPreviewUpdatedPayload(session));
}

async function handleSendRequest(session: RuntimeSession): Promise<void> {
  if (!activePanel) {
    return;
  }

  logger?.logEvent(session.log, 'send_request', {
    previewLength: session.previewText.length,
    sensitiveFlagCount: session.sensitiveFlags.length,
  });

  await activePanel.webview.postMessage({
    type: 'loading',
    stage: 'reasoning',
    message: 'Generating structured reasoning...',
  });

  await delay(getMockDelay());

  const response = generateStructuredResponse(session.previewText);
  await activePanel.webview.postMessage({
    type: 'structuredResponse',
    response,
  });

  logger?.logEvent(session.log, 'response_viewed', {
    stepCount: response.steps.length,
  });
}

async function handleRubricRequest(session: RuntimeSession): Promise<void> {
  if (!activePanel) {
    return;
  }

  logger?.logEvent(session.log, 'rubric_checked', {
    previewLength: session.previewText.length,
  });

  await activePanel.webview.postMessage({
    type: 'loading',
    stage: 'rubric',
    message: 'Checking course alignment...',
  });

  await delay(getMockDelay());

  const response = generateRubricFeedback(session.previewText);
  await activePanel.webview.postMessage({
    type: 'rubricResponse',
    response,
  });
}

async function handleExport(session: RuntimeSession): Promise<void> {
  if (!activePanel || !logger) {
    return;
  }

  const latexDocument = buildLatexExport({
    participantId: session.log.participantId,
    sessionId: session.log.sessionId,
    selection: session.selection,
    previewText: session.previewText,
  });

  const exportPath = await logger.writeLatexExport(session.log, latexDocument);
  session.exportPath = exportPath;

  logger.logEvent(session.log, 'export_clicked', {
    exportPath,
  });

  await logger.writeSessionLog(session.log);

  await activePanel.webview.postMessage({
    type: 'exportComplete',
    exportPath,
  });
}

async function handleMarkReady(session: RuntimeSession): Promise<void> {
  if (!activePanel) {
    return;
  }

  await finalizeSession('ready', session);

  await activePanel.webview.postMessage({
    type: 'finished',
    completionStatus: 'ready',
    exportPath: session.exportPath ?? null,
  });

  void vscode.window.showInformationMessage('Ambient AI Sidecar session saved.');
}

async function finalizeSession(
  status: CompletionStatus,
  session = activeSession,
): Promise<void> {
  if (!session || session.isFinalized || !logger) {
    return;
  }

  session.isFinalized = true;
  session.log.completionStatus = status;

  logger.logEvent(session.log, 'session_end', {
    status,
    editCount: session.editCount,
    removedLineCount: session.removedLineCount,
    exportPath: session.exportPath ?? null,
  });

  await logger.writeSessionLog(session.log);

  if (activeSession?.log.sessionId === session.log.sessionId) {
    activeSession = undefined;
  }
}
