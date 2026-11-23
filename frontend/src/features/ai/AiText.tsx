import type { ReactNode } from 'react';

type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'paragraph'; text: string };

const HEADING = /^(#{1,4}\s+|\d+\.\s+)(.+)$/;
const BULLET = /^[-*•]\s+(.+)$/;

/** Strip Markdown emphasis markers the model may still return. */
function clean(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1');
}

/**
 * Turn plain or lightly formatted model output into readable blocks:
 * numbered or # lines become headings, "- " lines become bullets, the rest
 * paragraphs. Text content is otherwise kept as-is.
 */
function toBlocks(source: string): Block[] {
  const blocks: Block[] = [];

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const bullet = BULLET.exec(line);
    if (bullet) {
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'list') last.items.push(clean(bullet[1]));
      else blocks.push({ kind: 'list', items: [clean(bullet[1])] });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading && heading[2].length <= 80) {
      blocks.push({ kind: 'heading', text: clean(heading[2]).replace(/:$/, '') });
      continue;
    }

    blocks.push({ kind: 'paragraph', text: clean(line) });
  }

  return blocks;
}

export function AiText({ text }: { text: string }) {
  const blocks = toBlocks(text);

  return (
    <div className="ai-text">
      {blocks.map((block, index): ReactNode => {
        if (block.kind === 'heading') {
          return <h4 key={index}>{block.text}</h4>;
        }
        if (block.kind === 'list') {
          return (
            <ul key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{item}</li>
              ))}
            </ul>
          );
        }
        return <p key={index}>{block.text}</p>;
      })}
    </div>
  );
}
