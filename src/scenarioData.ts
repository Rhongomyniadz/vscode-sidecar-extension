import type { SelectionContext, RubricFeedback, StructuredResponse } from './utils';
import { escapeLatex } from './utils';

export const studyScenario = {
  id: 'stats_hw3',
  title: 'Week 7 Regression Homework Review',
};

export const mockStructuredResponse: StructuredResponse = {
  title: 'Structured Reasoning',
  steps: [
    {
      id: 1,
      label: 'Define feature matrix X and target y',
      status: 'ok',
      detail: 'The selected code correctly separates predictors and the target variable.',
    },
    {
      id: 2,
      label: 'Fit the regression model without feature scaling',
      status: 'warning',
      detail: 'A scaling step is still missing before model fitting, which could affect coefficient interpretation.',
    },
    {
      id: 3,
      label: 'Confirm residual diagnostics before submission',
      status: 'pending',
      detail: 'Residual validation is referenced but the final verification step is not fully shown in the current snippet.',
    },
  ],
  verify: [
    'Add StandardScaler before model fitting.',
    'Check the residual distribution before submission.',
    'Confirm every rubric requirement is visible in the final answer.',
  ],
};

export const mockRubricFeedback: RubricFeedback = {
  rubricName: 'Week 7 Programming Rubric',
  items: [
    {
      id: 1,
      label: 'Feature matrix correctly shaped',
      status: 'met',
      explanation: 'Predictors and the target are defined in a structure that matches the assignment expectations.',
    },
    {
      id: 2,
      label: 'Features standardized before fit',
      status: 'unmet',
      explanation: 'The current snippet does not apply a scaling step before calling fit().',
    },
    {
      id: 3,
      label: 'R^2 score reported',
      status: 'met',
      explanation: 'The model score is included, which satisfies the reporting requirement.',
    },
    {
      id: 4,
      label: 'Residual plot included',
      status: 'unmet',
      explanation: 'Residual computation is implied, but the actual plotting step is not shown in the selection.',
    },
  ],
  summary: '2 of 4 rubric items currently met.',
};

export const exportSummaryText =
  'This export summarizes the selected code context, a deterministic structured reasoning response, and rubric feedback for the Ambient AI sidecar study.';

export function buildLatexExport(params: {
  participantId: string;
  sessionId: string;
  selection?: SelectionContext;
  previewText: string;
}): string {
  const fileName = params.selection?.fileName ?? 'Unknown file';
  const lineRange = params.selection
    ? `${params.selection.lineStart}-${params.selection.lineEnd}`
    : 'N/A';

  return [
    '\\documentclass{article}',
    '\\usepackage[margin=1in]{geometry}',
    '\\usepackage[T1]{fontenc}',
    '\\begin{document}',
    '\\section*{Ambient AI Sidecar Export}',
    `\\textbf{Participant ID:} ${escapeLatex(params.participantId)}\\\\`,
    `\\textbf{Session ID:} ${escapeLatex(params.sessionId)}\\\\`,
    `\\textbf{Scenario:} ${escapeLatex(studyScenario.title)}\\\\`,
    `\\textbf{Source File:} ${escapeLatex(fileName)}\\\\`,
    `\\textbf{Selected Lines:} ${escapeLatex(lineRange)}\\\\`,
    '',
    '\\subsection*{Summary}',
    escapeLatex(exportSummaryText),
    '',
    '\\subsection*{Structured Reasoning}',
    '\\begin{enumerate}',
    ...mockStructuredResponse.steps.map(
      (step) =>
        `\\item \\textbf{${escapeLatex(step.label)}} (${escapeLatex(step.status)}): ${escapeLatex(step.detail)}`,
    ),
    '\\end{enumerate}',
    '',
    '\\subsection*{Rubric Alignment}',
    '\\begin{itemize}',
    ...mockRubricFeedback.items.map(
      (item) =>
        `\\item \\textbf{${escapeLatex(item.label)}} (${escapeLatex(item.status)}): ${escapeLatex(item.explanation)}`,
    ),
    '\\end{itemize}',
    escapeLatex(mockRubricFeedback.summary),
    '',
    '\\subsection*{Selected Context}',
    '\\begin{verbatim}',
    params.previewText,
    '\\end{verbatim}',
    '\\end{document}',
    '',
  ].join('\n');
}
