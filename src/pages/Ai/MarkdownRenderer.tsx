// MarkdownRenderer
// ================
// A small but practical Markdown → React renderer for AI chat output.
// Handles: bold/italic/code, headings, ordered/unordered lists, pipe
// tables, fenced code blocks, blockquotes, links, line breaks. We don't
// pull in react-markdown because Claude's output stays inside a small,
// well-known subset — keeping the code here means no extra dependency
// and full control over Tailwind classes for the styling.

import React from "react";

// ── Inline formatting (bold, italic, code, links) ───────────────────────
// Parses one line of inline markdown into an array of React nodes.
function renderInline(text: string, keyPrefix = "i"): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let rest = text;
  let counter = 0;

  // We walk the string looking for the next match of any of these
  // patterns; whichever matches earliest wins. This gives the right
  // precedence even when patterns overlap (e.g. **a `b` c**).
  const patterns: { re: RegExp; render: (m: RegExpExecArray) => React.ReactNode }[] = [
    {
      re: /\*\*(.+?)\*\*/,
      render: (m) => <strong key={`${keyPrefix}-${counter++}`}>{renderInline(m[1], `${keyPrefix}-${counter}`)}</strong>,
    },
    {
      re: /__(.+?)__/,
      render: (m) => <strong key={`${keyPrefix}-${counter++}`}>{renderInline(m[1], `${keyPrefix}-${counter}`)}</strong>,
    },
    {
      re: /\*(.+?)\*/,
      render: (m) => <em key={`${keyPrefix}-${counter++}`}>{renderInline(m[1], `${keyPrefix}-${counter}`)}</em>,
    },
    {
      re: /_(.+?)_/,
      render: (m) => <em key={`${keyPrefix}-${counter++}`}>{renderInline(m[1], `${keyPrefix}-${counter}`)}</em>,
    },
    {
      re: /`([^`]+)`/,
      render: (m) => (
        <code key={`${keyPrefix}-${counter++}`} className="px-1 py-0.5 bg-gray-100 text-pink-700 text-[0.85em] rounded font-mono">
          {m[1]}
        </code>
      ),
    },
    {
      // [label](url)
      re: /\[([^\]]+)\]\(([^)]+)\)/,
      render: (m) => (
        <a key={`${keyPrefix}-${counter++}`} href={m[2]} target="_blank" rel="noreferrer noopener" className="text-blue-600 underline">
          {m[1]}
        </a>
      ),
    },
  ];

  while (rest.length > 0) {
    let best: { index: number; match: RegExpExecArray; pat: typeof patterns[0] } | null = null;
    for (const p of patterns) {
      const m = p.re.exec(rest);
      if (m && (best === null || m.index < best.index)) {
        best = { index: m.index, match: m, pat: p };
      }
    }
    if (!best) {
      out.push(rest);
      break;
    }
    if (best.index > 0) out.push(rest.slice(0, best.index));
    out.push(best.pat.render(best.match));
    rest = rest.slice(best.index + best.match[0].length);
  }

  return out;
}

// ── Block parsing ───────────────────────────────────────────────────────
type Block =
  | { kind: "heading"; level: 1 | 2 | 3 | 4; text: string }
  | { kind: "para"; lines: string[] }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "code"; lang: string | null; lines: string[] }
  | { kind: "quote"; lines: string[] }
  | { kind: "table"; headers: string[]; rows: string[][] }
  | { kind: "hr" };

function parseBlocks(input: string): Block[] {
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Blank line
    if (trimmed === "") { i++; continue; }

    // Fenced code block
    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim() || null;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]); i++;
      }
      i++; // closing ```
      blocks.push({ kind: "code", lang, lines: codeLines });
      continue;
    }

    // Heading
    const h = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (h) {
      blocks.push({ kind: "heading", level: h[1].length as 1 | 2 | 3 | 4, text: h[2] });
      i++; continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ kind: "hr" });
      i++; continue;
    }

    // Pipe table — line + separator + at least one row
    if (trimmed.includes("|") && i + 1 < lines.length && /^[\s|\-:]+$/.test(lines[i + 1].trim())) {
      const headers = splitRow(trimmed);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes("|") && lines[i].trim() !== "") {
        rows.push(splitRow(lines[i].trim()));
        i++;
      }
      blocks.push({ kind: "table", headers, rows });
      continue;
    }

    // Blockquote
    if (trimmed.startsWith(">")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        buf.push(lines[i].trim().replace(/^>\s?/, "")); i++;
      }
      blocks.push({ kind: "quote", lines: buf });
      continue;
    }

    // Unordered list (- or *)
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, "")); i++;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    // Ordered list (1. 2. 3.)
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, "")); i++;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }

    // Paragraph (lump consecutive non-blank lines)
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !looksLikeBlockStart(lines[i])) {
      paraLines.push(lines[i]); i++;
    }
    if (paraLines.length > 0) blocks.push({ kind: "para", lines: paraLines });
  }

  return blocks;
}

function looksLikeBlockStart(line: string): boolean {
  const t = line.trim();
  return (
    /^#{1,4}\s+/.test(t) ||
    t.startsWith("```") ||
    t.startsWith(">") ||
    /^[-*]\s+/.test(t) ||
    /^\d+\.\s+/.test(t) ||
    /^(-{3,}|\*{3,}|_{3,})$/.test(t)
  );
}

function splitRow(line: string): string[] {
  // Strip leading/trailing pipes, split on pipes that aren't escaped.
  return line.replace(/^\||\|$/g, "").split("|").map(s => s.trim());
}

// ── Public component ────────────────────────────────────────────────────
export default function MarkdownRenderer({ source }: { source: string }) {
  const blocks = parseBlocks(source);

  return (
    <div className="md-body text-sm leading-relaxed text-gray-800 space-y-2">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "heading": {
            const sizes = {
              1: "text-xl font-bold mt-2 mb-1",
              2: "text-lg font-bold mt-2 mb-1",
              3: "text-base font-semibold mt-2 mb-1",
              4: "text-sm font-semibold mt-2 mb-1",
            } as const;
            return <div key={i} className={sizes[b.level]}>{renderInline(b.text, `h${i}`)}</div>;
          }
          case "para":
            return (
              <p key={i} className="whitespace-pre-wrap">
                {b.lines.map((ln, j) => (
                  <React.Fragment key={j}>
                    {j > 0 && <br />}
                    {renderInline(ln, `p${i}-${j}`)}
                  </React.Fragment>
                ))}
              </p>
            );
          case "ul":
            return (
              <ul key={i} className="list-disc pl-5 space-y-1 marker:text-gray-400">
                {b.items.map((it, j) => <li key={j}>{renderInline(it, `ul${i}-${j}`)}</li>)}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="list-decimal pl-5 space-y-1 marker:text-gray-400">
                {b.items.map((it, j) => <li key={j}>{renderInline(it, `ol${i}-${j}`)}</li>)}
              </ol>
            );
          case "code":
            return (
              <pre key={i} className="bg-gray-900 text-gray-100 rounded-md p-3 overflow-auto text-xs font-mono leading-snug">
                <code>{b.lines.join("\n")}</code>
              </pre>
            );
          case "quote":
            return (
              <blockquote key={i} className="border-l-4 border-blue-300 bg-blue-50/50 pl-3 py-1 italic text-gray-700">
                {b.lines.map((ln, j) => <div key={j}>{renderInline(ln, `q${i}-${j}`)}</div>)}
              </blockquote>
            );
          case "hr":
            return <hr key={i} className="my-3 border-gray-200" />;
          case "table": {
            // Right-align numeric columns automatically — looks more like a real report.
            const isNumericCol = b.headers.map((_, ci) =>
              b.rows.length > 0 && b.rows.every(r => /^[-+$]?[\d,]+(\.\d+)?%?$/.test((r[ci] || "").trim()))
            );
            return (
              <div key={i} className="overflow-x-auto my-2 rounded-md border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {b.headers.map((h, j) => (
                        <th
                          key={j}
                          className={
                            "px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200 " +
                            (isNumericCol[j] ? "text-right" : "text-left")
                          }
                        >
                          {renderInline(h, `th${i}-${j}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {b.rows.map((row, ri) => (
                      <tr key={ri} className="hover:bg-gray-50">
                        {row.map((cell, ci) => (
                          <td
                            key={ci}
                            className={
                              "px-3 py-1.5 " +
                              (isNumericCol[ci] ? "text-right font-mono tabular-nums" : "")
                            }
                          >
                            {renderInline(cell, `td${i}-${ri}-${ci}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
        }
      })}
    </div>
  );
}
