/**
 * packages/apps/console/client/src/components/markdown/Markdown.tsx
 * Safe-by-default markdown rendering for operator-facing content.
 */
import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

function safeUrl(url: string | null | undefined): string {
  const raw = (url ?? "").trim();
  if (!raw) return "";
  if (raw.startsWith("#") || raw.startsWith("/")) return raw;

  try {
    const parsed = new URL(raw);
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return "#";
    return parsed.toString();
  } catch {
    // Relative URLs without leading / (e.g. "docs/foo") should still be safe.
    // Treat them as relative paths.
    if (!raw.includes(":")) return `/${raw.replace(/^\/+/, "")}`;
    return "#";
  }
}

export function Markdown(props: { content: string; className?: string }): JSX.Element {
  return (
    <div className={props.className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        // ReactMarkdown is safe by default (raw HTML is not rendered unless explicitly enabled).
        urlTransform={(url) => safeUrl(url)}
        components={{
          a: ({ href, children, ...rest }) => {
            const safeHref = safeUrl(href);
            const isExternal = safeHref.startsWith("http://") || safeHref.startsWith("https://");
            return (
              <a
                href={safeHref}
                {...rest}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noreferrer" : undefined}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {props.content}
      </ReactMarkdown>
    </div>
  );
}

export function MarkdownProse(props: { content: string; className?: string }): JSX.Element {
  return (
    <Markdown
      content={props.content}
      className={`prose prose-sm dark:prose-invert max-w-none ${props.className ?? ""}`.trim()}
    />
  );
}

