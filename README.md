# Ambient AI Sidecar

A deterministic VS Code extension prototype for studying an on-demand AI sidecar workflow.

This project captures a selected code snippet, shows it in an editable sidecar, warns about simple sensitive-content patterns, returns fixed structured reasoning and rubric feedback, exports a mock LaTeX artifact, and logs session events for later analysis.

## What This Repo Contains

- A VS Code extension named `ambient-ai-sidecar`
- A beside-editor webview sidecar
- A deterministic mock engine for reasoning and rubric feedback
- Local JSON session logging and `.tex` export
- Unit tests for the pure mock/logging modules

The repo folder is named `vscode-sidecar-extension`, while the extension package name is `ambient-ai-sidecar`.

## Features

- Command: `Ambient AI: Open Sidecar`
- Selection capture with file name and line range
- Editable preview before sending
- Sensitive-content detection for:
  - `api_key`
  - `token`
  - `secret`
  - `password`
- Deterministic structured reasoning response
- Deterministic rubric alignment feedback
- Mock loading delay for study realism
- Local session logging
- Mock LaTeX export

## Repo Structure

```text
vscode-sidecar-extension/
├── .vscode/launch.json
├── package.json
├── tsconfig.json
├── src/
│   ├── extension.ts
│   ├── logger.ts
│   ├── mockEngine.ts
│   ├── scenarioData.ts
│   ├── utils.ts
│   └── test/
├── media/
│   ├── sidecar.html
│   ├── sidecar.css
│   └── sidecar.js
├── logs/
└── out/
```

## Prerequisites

- VS Code `^1.87.0`
- Node.js and npm

Node can come from a system install, `nvm`, or a Conda environment. If you use Conda, make sure VS Code is launched from an activated environment so `npm` and `node` are available.

## Getting Started

1. Open this folder as the workspace root:

   ```bash
   code /mnt/e/cse593_prototype/vscode-sidecar-extension
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Compile the extension:

   ```bash
   npm run compile
   ```

4. Press `F5` in VS Code.

   This repo already includes [.vscode/launch.json](./.vscode/launch.json), so `F5` should open an **Extension Development Host** window.

## Using the Extension

In the **Extension Development Host** window:

1. Open a code file.
2. Select a block of code.
3. Open the Command Palette with `Ctrl+Shift+P`.
4. Run `Ambient AI: Open Sidecar`.
5. Enter a participant ID when prompted.
6. Review or edit the preview.
7. Optionally remove flagged content.
8. Click `Send`.
9. Review structured reasoning.
10. Click `Check Rubric`.
11. Click `Export LaTeX` or `Mark Ready`.

## Scripts

- `npm run compile` - Compile TypeScript to `out/`
- `npm run watch` - Recompile on file changes
- `npm test` - Compile and run the unit tests in `out/test`

## Logging And Export

The extension writes artifacts to `logs/`:

- `participantId-sessionId.json` - session log with raw events and derived metrics
- `participantId-sessionId.tex` - mock LaTeX export

Logged events include:

- `session_start`
- `invoke_sidecar`
- `invoke_sidecar_failed`
- `preview_viewed`
- `edit_preview`
- `remove_sensitive`
- `send_request`
- `response_viewed`
- `rubric_checked`
- `export_clicked`
- `session_end`

## Mock Behavior

This prototype is intentionally deterministic:

- Structured reasoning comes from a fixed study scenario
- Rubric feedback comes from a fixed study scenario
- Sensitive-content detection is keyword-based
- Mock response delay is fixed at `1200ms`

This keeps the prototype stable for controlled study sessions.

## Testing

Unit tests cover:

- Sensitive-content detection
- Line removal for flagged content
- Deterministic mock responses
- Session metric calculation and log writing

Run:

```bash
npm test
```

## Troubleshooting

### The command does not appear in the new window

- Make sure you pressed `F5` from this repo root: `/mnt/e/cse593_prototype/vscode-sidecar-extension`
- Make sure the new window title says **Extension Development Host**
- Re-run `npm run compile`
- In the Extension Development Host, search the Command Palette for `Ambient AI`

### VS Code tries to debug the current file instead of the extension

That usually means VS Code is not opened on this repo root, or you are launching from the wrong workspace folder.

### `npm install` fails with `ENOENT` for `package.json`

Run it from the repo root:

```bash
cd /mnt/e/cse593_prototype/vscode-sidecar-extension
npm install
```

## Notes

- This is a prototype for study use, not a production AI integration.
- There are no network calls or live model requests.
- The sidecar uses fixed scenario data for reproducibility.
