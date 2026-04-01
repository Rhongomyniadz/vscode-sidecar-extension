import { mockRubricFeedback, mockStructuredResponse } from './scenarioData';
import type { RubricFeedback, SensitiveFlag, StructuredResponse } from './utils';
import { cloneData } from './utils';

export const sensitivePatterns: RegExp[] = [/api[_-]?key/i, /token/i, /secret/i, /password/i];

export function detectSensitiveContent(text: string): SensitiveFlag[] {
  const lines = text.split(/\r?\n/);
  const flags: SensitiveFlag[] = [];

  lines.forEach((line, index) => {
    for (const pattern of sensitivePatterns) {
      pattern.lastIndex = 0;
      const match = line.match(pattern);

      if (match) {
        flags.push({
          lineNumber: index + 1,
          match: match[0],
          pattern: pattern.toString(),
          lineText: line,
        });
      }
    }
  });

  return flags;
}

export function generateStructuredResponse(_input: string): StructuredResponse {
  return cloneData(mockStructuredResponse);
}

export function generateRubricFeedback(_input: string): RubricFeedback {
  return cloneData(mockRubricFeedback);
}

export function getMockDelay(): number {
  return 1200;
}
