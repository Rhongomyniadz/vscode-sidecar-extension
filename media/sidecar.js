(function () {
  const vscode = acquireVsCodeApi();

  const state = {
    previewText: '',
    lastSyncedText: '',
    dirty: false,
    locked: false,
    flags: [],
  };

  const elements = {};

  window.addEventListener('DOMContentLoaded', () => {
    elements.statusBanner = document.getElementById('status-banner');
    elements.fileName = document.getElementById('file-name');
    elements.lineRange = document.getElementById('line-range');
    elements.warningBanner = document.getElementById('warning-banner');
    elements.warningCopy = document.getElementById('warning-copy');
    elements.previewText = document.getElementById('preview-text');
    elements.removeSensitiveButton = document.getElementById('remove-sensitive-button');
    elements.sendButton = document.getElementById('send-button');
    elements.reasoningSection = document.getElementById('reasoning-section');
    elements.reasoningContent = document.getElementById('reasoning-content');
    elements.reasoningSteps = document.getElementById('reasoning-steps');
    elements.verifyList = document.getElementById('verify-list');
    elements.loadingCard = document.getElementById('loading-card');
    elements.loadingCopy = document.getElementById('loading-copy');
    elements.checkRubricButton = document.getElementById('check-rubric-button');
    elements.rubricSection = document.getElementById('rubric-section');
    elements.rubricName = document.getElementById('rubric-name');
    elements.rubricItems = document.getElementById('rubric-items');
    elements.rubricSummary = document.getElementById('rubric-summary');
    elements.finalSection = document.getElementById('final-section');
    elements.exportButton = document.getElementById('export-button');
    elements.markReadyButton = document.getElementById('mark-ready-button');
    elements.exportPath = document.getElementById('export-path');

    bindEvents();
    vscode.postMessage({
      type: 'webviewReady',
    });
  });

  window.addEventListener('message', (event) => {
    const message = event.data;

    switch (message.type) {
      case 'init':
        renderInit(message);
        break;
      case 'previewUpdated':
        renderPreviewUpdate(message);
        break;
      case 'loading':
        renderLoading(message.message, message.stage);
        break;
      case 'structuredResponse':
        renderStructuredResponse(message.response);
        break;
      case 'rubricResponse':
        renderRubricResponse(message.response);
        break;
      case 'exportComplete':
        showStatus(`LaTeX export saved to ${message.exportPath}`);
        elements.exportPath.textContent = message.exportPath;
        break;
      case 'finished':
        setLocked(true);
        elements.checkRubricButton.disabled = true;
        elements.exportButton.disabled = true;
        elements.markReadyButton.disabled = true;
        showStatus('Session marked ready and saved.');
        if (message.exportPath) {
          elements.exportPath.textContent = message.exportPath;
        }
        break;
      case 'error':
        showStatus(message.message, true);
        break;
      default:
        break;
    }
  });

  function bindEvents() {
    elements.previewText.addEventListener('input', () => {
      state.dirty = elements.previewText.value !== state.lastSyncedText;
    });

    elements.previewText.addEventListener('blur', () => {
      syncPreviewText();
    });

    elements.removeSensitiveButton.addEventListener('click', () => {
      vscode.postMessage({
        type: 'removeSensitive',
        text: elements.previewText.value,
      });
    });

    elements.sendButton.addEventListener('click', () => {
      syncPreviewText();
      setLocked(true);
      vscode.postMessage({
        type: 'sendRequest',
        text: elements.previewText.value,
      });
    });

    elements.checkRubricButton.addEventListener('click', () => {
      vscode.postMessage({
        type: 'checkRubric',
        text: elements.previewText.value,
      });
    });

    elements.exportButton.addEventListener('click', () => {
      vscode.postMessage({
        type: 'exportLatex',
        text: elements.previewText.value,
      });
    });

    elements.markReadyButton.addEventListener('click', () => {
      vscode.postMessage({
        type: 'markReady',
        text: elements.previewText.value,
      });
    });
  }

  function renderInit(message) {
    state.previewText = message.previewText || '';
    state.lastSyncedText = state.previewText;
    state.flags = Array.isArray(message.flags) ? message.flags : [];
    state.dirty = false;
    state.locked = false;

    elements.fileName.textContent = message.selection.fileName;
    elements.lineRange.textContent = message.selection.lineLabel;
    elements.previewText.value = state.previewText;
    elements.exportPath.textContent = '';
    elements.reasoningSteps.innerHTML = '';
    elements.verifyList.innerHTML = '';
    elements.rubricItems.innerHTML = '';
    elements.rubricName.textContent = '';
    elements.rubricSummary.textContent = '';

    elements.reasoningSection.classList.add('is-hidden');
    elements.reasoningContent.classList.add('is-hidden');
    elements.rubricSection.classList.add('is-hidden');
    elements.finalSection.classList.add('is-hidden');
    elements.loadingCard.classList.add('is-hidden');
    elements.exportButton.disabled = false;
    elements.markReadyButton.disabled = false;
    elements.checkRubricButton.disabled = false;

    updateWarningBanner();
    setLocked(false);
    showStatus('');

    vscode.postMessage({
      type: 'previewViewed',
    });
  }

  function renderPreviewUpdate(message) {
    state.previewText = message.previewText || '';
    state.lastSyncedText = state.previewText;
    state.flags = Array.isArray(message.flags) ? message.flags : [];
    state.dirty = false;
    elements.previewText.value = state.previewText;
    updateWarningBanner();
  }

  function renderLoading(copy, stage) {
    elements.reasoningSection.classList.remove('is-hidden');
    elements.loadingCard.classList.remove('is-hidden');

    if (stage === 'reasoning') {
      elements.reasoningContent.classList.add('is-hidden');
    }

    elements.loadingCopy.textContent = copy;
    showStatus('');
  }

  function renderStructuredResponse(response) {
    elements.loadingCard.classList.add('is-hidden');
    elements.reasoningSection.classList.remove('is-hidden');
    elements.reasoningContent.classList.remove('is-hidden');
    elements.reasoningSteps.innerHTML = '';
    elements.verifyList.innerHTML = '';

    response.steps.forEach((step) => {
      const listItem = document.createElement('li');
      const title = document.createElement('div');
      const label = document.createElement('strong');
      const badge = document.createElement('span');
      const detail = document.createElement('p');

      label.textContent = step.label;
      badge.textContent = step.status;
      badge.className = `step-badge status-${step.status}`;
      detail.textContent = step.detail;

      title.appendChild(label);
      title.appendChild(badge);
      listItem.appendChild(title);
      listItem.appendChild(detail);
      elements.reasoningSteps.appendChild(listItem);
    });

    response.verify.forEach((item) => {
      const listItem = document.createElement('li');
      listItem.textContent = item;
      elements.verifyList.appendChild(listItem);
    });
  }

  function renderRubricResponse(response) {
    elements.loadingCard.classList.add('is-hidden');
    elements.reasoningContent.classList.remove('is-hidden');
    elements.rubricSection.classList.remove('is-hidden');
    elements.finalSection.classList.remove('is-hidden');
    elements.rubricName.textContent = response.rubricName;
    elements.rubricSummary.textContent = response.summary;
    elements.rubricItems.innerHTML = '';

    response.items.forEach((item) => {
      const listItem = document.createElement('li');
      const title = document.createElement('div');
      const label = document.createElement('strong');
      const badge = document.createElement('span');
      const explanation = document.createElement('p');

      label.textContent = item.label;
      badge.textContent = item.status;
      badge.className = `rubric-badge status-${item.status}`;
      explanation.textContent = item.explanation;

      title.appendChild(label);
      title.appendChild(badge);
      listItem.appendChild(title);
      listItem.appendChild(explanation);
      elements.rubricItems.appendChild(listItem);
    });
  }

  function updateWarningBanner() {
    const uniqueLines = [...new Set(state.flags.map((flag) => flag.lineNumber))];

    if (uniqueLines.length === 0) {
      elements.warningBanner.classList.add('is-hidden');
      elements.warningCopy.textContent = '';
      elements.removeSensitiveButton.disabled = true;
      return;
    }

    elements.warningBanner.classList.remove('is-hidden');
    elements.warningCopy.textContent = `Review selected lines ${uniqueLines.join(', ')} before sending this context.`;
    elements.removeSensitiveButton.disabled = false;
  }

  function setLocked(locked) {
    state.locked = locked;
    elements.previewText.disabled = locked;
    elements.removeSensitiveButton.disabled = locked || state.flags.length === 0;
    elements.sendButton.disabled = locked;
  }

  function syncPreviewText() {
    if (state.locked || !state.dirty) {
      return;
    }

    state.lastSyncedText = elements.previewText.value;
    state.previewText = elements.previewText.value;
    state.dirty = false;

    vscode.postMessage({
      type: 'editPreview',
      text: state.previewText,
    });
  }

  function showStatus(copy, isError) {
    if (!copy) {
      elements.statusBanner.textContent = '';
      elements.statusBanner.classList.add('is-hidden');
      return;
    }

    elements.statusBanner.textContent = copy;
    elements.statusBanner.classList.remove('is-hidden');
    elements.statusBanner.style.borderColor = isError ? 'rgba(170, 59, 36, 0.25)' : '';
    elements.statusBanner.style.background = isError ? 'rgba(170, 59, 36, 0.12)' : '';
    elements.statusBanner.style.color = isError ? '#7a2413' : '';
  }
})();
