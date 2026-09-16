/**
 * عارض Markdown خفيف وآمن لردود المساعد: عناوين، فقرات، قوائم نقطية ومرقّمة، جداول،
 * نص غامق/مائل، كود، وروابط (تُفتح خارجيًا). بلا HTML خام.
 */
import { Fragment, type ReactNode } from "react";
import { nativeOpenExternal } from "../platform/native";

function inline(text: string, key = 0): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^)\s]+)\)|https?:\/\/[^\s<>()]+|_[^_\n]+_|\*[^*\n]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${key}-${i++}`;
    if (t.startsWith("**")) out.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={k} className="md-code">{t.slice(1, -1)}</code>);
    else if (t.startsWith("[")) {
      const label = t.slice(1, t.indexOf("]"));
      const href = m[2];
      out.push(
        <a key={k} href={href} className="link" onClick={(e) => { e.preventDefault(); nativeOpenExternal(href); }}>
          {label}
        </a>,
      );
    } else if (t.startsWith("http")) {
      out.push(
        <a key={k} href={t} className="link" dir="ltr" onClick={(e) => { e.preventDefault(); nativeOpenExternal(t); }}>
          {t.length > 60 ? `${t.slice(0, 57)}…` : t}
        </a>,
      );
    } else out.push(<em key={k}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block =
  | { type: "h"; level: number; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "code"; text: string }
  | { type: "table"; rows: string[][] }
  | { type: "hr" };

function parse(src: string): Block[] {
  const lines = src.replace(/\r/g, "").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i++]);
      i++;
      blocks.push({ type: "code", text: buf.join("\n") });
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      blocks.push({ type: "h", level: h[1].length, text: h[2] });
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const rows: string[][] = [];
      const cells = (l: string) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
      rows.push(cells(line));
      i += 2;
      while (i < lines.length && lines[i].includes("|")) rows.push(cells(lines[i++]));
      blocks.push({ type: "table", rows });
      continue;
    }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*•]|\d+[.)])\s+/, ""));
        i++;
        // أسطر متابعة مُزاحة
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) items[items.length - 1] += ` ${lines[i++].trim()}`;
      }
      blocks.push({ type: ordered ? "ol" : "ul", items });
      continue;
    }
    const buf = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|\s*([-*•]|\d+[.)])\s+)/.test(lines[i]) && !(lines[i].includes("|") && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1]))) buf.push(lines[i++]);
    blocks.push({ type: "p", text: buf.join("\n") });
  }
  return blocks;
}

export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  const blocks = parse(text);
  return (
    <div className={`md ${className}`}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "h": {
            const Tag = (`h${Math.min(4, b.level + 2)}` as unknown) as "h3";
            return <Tag key={i} className="md-h">{inline(b.text, i)}</Tag>;
          }
          case "ul":
            return (
              <ul key={i} className="md-ul">
                {b.items.map((it, k) => (
                  <li key={k}>{inline(it, i * 100 + k)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="md-ol">
                {b.items.map((it, k) => (
                  <li key={k}>{inline(it, i * 100 + k)}</li>
                ))}
              </ol>
            );
          case "code":
            return (
              <pre key={i} className="md-pre" dir="ltr">
                {b.text}
              </pre>
            );
          case "table":
            return (
              <div key={i} className="md-table-wrap">
                <table className="md-table">
                  <thead>
                    <tr>
                      {b.rows[0].map((c, k) => (
                        <th key={k}>{inline(c, i * 100 + k)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.slice(1).map((r, k) => (
                      <tr key={k}>
                        {r.map((c, j) => (
                          <td key={j}>{inline(c, i * 1000 + k * 10 + j)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "hr":
            return <hr key={i} className="md-hr" />;
          default:
            return (
              <p key={i} className="md-p">
                {b.text.split("\n").map((l, k, arr) => (
                  <Fragment key={k}>
                    {inline(l, i * 100 + k)}
                    {k < arr.length - 1 && <br />}
                  </Fragment>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
}
