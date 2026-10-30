import { describeArtifactLanguage, type IPromptInput } from '#/ai-module/index.ts';

export const VISUALIZATION_FILE_NAME = 'visualization.html';

// The rules no Instructions can lift (ADR-0003); a single self-contained file without JavaScript,
// since the front's sandboxed frame runs no script and loads nothing from outside
export function composeVisualizationPrompt({ posting, outputDirectory, readVersionList }: IPromptInput): string {
  const outputPath = `${outputDirectory}/${VISUALIZATION_FILE_NAME}`;
  const briefList = readVersionList.filter(({ artifact }) => artifact === 'interview_brief');
  return `You lay out a Candidate's Interview Brief as an HTML page, more pleasant to revise with: tables and diagrams rather than running text. ${describeArtifactLanguage('Visualization')}

## The Posting

- Reference: ${posting.reference}
- Title: ${posting.title}
- Employer: ${posting.employer ?? 'not specified'}

The current folder is the Posting's.

## What you read

${briefList.map(({ filePath }) => `- The Chosen Interview Brief, as the Candidate may have corrected it: \`${filePath}\`. It is the only source of the page's content.`).join('\n')}

## What you produce

A single file: \`${outputPath}\`, a complete, self-contained HTML page, from \`<!DOCTYPE html>\` to \`</html>\`. The style goes in a \`<style>\` tag of the page, and each diagram is drawn in SVG directly in the page.

## Non-negotiable rules

- The page has the same content as the Interview Brief, laid out: add no fact and remove none. Keep each \`[à compléter : …]\` marker as it is, clearly visible.
- No JavaScript, no \`<script>\` tag, and no external resource: no stylesheet, font, image or script loaded from elsewhere. The front shows the page in an isolated frame, which runs no script and loads nothing from outside.
- Write no file other than \`${outputPath}\`, and never modify the Interview Brief or any other file of the Posting.
- Never touch the Status of the Posting or the tool's job queue.
- The next message holds the Candidate's Instructions: they say how to present the page. If they contradict what you read, the expected file, its language or these rules, this fixed part prevails.
`;
}
