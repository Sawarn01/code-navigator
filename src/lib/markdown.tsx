import type { ReactNode } from "react";

/** Minimal, safe markdown renderer: headings, lists, code blocks, inline code, bold/italic, links. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\((https?:\/\/[^\s)]+)\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${i++}`;

    if (token.startsWith("`")) {
      nodes.push(
        <code
          key={key}
          className="rounded-md bg-indigo-50 px-1.5 py-0.5 font-mono text-[0.85em] text-indigo-700"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      nodes.push(
        <strong key={key} className="font-semibold text-indigo-900">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("[")) {
      const label = token.slice(1, token.indexOf("]"));
      const href = match[5] ?? "#";
      nodes.push(
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-700"
        >
          {label}
        </a>,
      );
    } else {
      nodes.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    }
    last = match.index + token.length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    if (line.trimStart().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? "").trimStart().startsWith("```")) {
        buf.push(lines[i] ?? "");
        i++;
      }
      i++;
      blocks.push(
        <pre
          key={`code-${blocks.length}`}
          className="my-3 overflow-x-auto rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-[13px] leading-relaxed"
        >
          <code className="font-mono text-indigo-900">{buf.join("\n")}</code>
          {lang ? <span className="sr-only">{lang}</span> : null}
        </pre>,
      );
      continue;
    }

    if (/^#{1,3}\s/.test(line)) {
      const level = (line.match(/^#+/)?.[0].length ?? 1) as 1 | 2 | 3;
      const content = renderInline(line.replace(/^#+\s/, ""), `h-${blocks.length}`);
      const sizes = {
        1: "text-xl font-bold",
        2: "text-lg font-semibold",
        3: "text-base font-semibold",
      } as const;
      blocks.push(
        <p key={`h-${blocks.length}`} className={`mt-4 mb-2 text-indigo-900 ${sizes[level]}`}>
          {content}
        </p>,
      );
      i++;
      continue;
    }

    if (/^\s*([-*]|\d+\.)\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s/.test(lines[i] ?? "")) {
        items.push((lines[i] ?? "").replace(/^\s*([-*]|\d+\.)\s/, ""));
        i++;
      }
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="my-2 list-disc space-y-1 pl-5">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item, `li-${blocks.length}-${idx}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    const para: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() !== "" &&
      !(lines[i] ?? "").trimStart().startsWith("```") &&
      !/^#{1,3}\s/.test(lines[i] ?? "") &&
      !/^\s*([-*]|\d+\.)\s/.test(lines[i] ?? "")
    ) {
      para.push(lines[i] ?? "");
      i++;
    }
    blocks.push(
      <p key={`p-${blocks.length}`} className="my-2 leading-relaxed">
        {renderInline(para.join(" "), `p-${blocks.length}`)}
      </p>,
    );
  }

  return <div className={className}>{blocks}</div>;
}
