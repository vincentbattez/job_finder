import ReactMarkdown from 'react-markdown';

// react-markdown builds React elements and skips raw HTML, so an Artefact cannot inject markup
export function Markdown({ markdown }: Readonly<{ markdown: string }>) {
  return (
    <div className="prose">
      <ReactMarkdown>{markdown}</ReactMarkdown>
    </div>
  );
}
