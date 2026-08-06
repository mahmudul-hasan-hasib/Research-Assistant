"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/utils/cn";

const components: Components = {
  a: ({ className, children, ...props }) => (
    <a
      className={cn("font-medium text-primary underline underline-offset-4", className)}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = String(children).includes("\n");
    if (isBlock) {
      return (
        <code
          className={cn(
            "block overflow-x-auto rounded-md bg-muted px-3 py-2 text-sm",
            className,
          )}
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        className={cn("rounded bg-muted px-1 py-0.5 text-[0.875em] font-mono", className)}
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => <pre className="my-2 overflow-hidden rounded-md">{children}</pre>,
  ul: ({ className, ...props }) => (
    <ul className={cn("my-2 list-disc space-y-1 pl-5", className)} {...props} />
  ),
  ol: ({ className, ...props }) => (
    <ol className={cn("my-2 list-decimal space-y-1 pl-5", className)} {...props} />
  ),
  li: ({ className, ...props }) => <li className={cn("leading-relaxed", className)} {...props} />,
  p: ({ className, ...props }) => <p className={cn("my-2 leading-relaxed", className)} {...props} />,
  h1: ({ className, ...props }) => (
    <h1 className={cn("my-3 text-xl font-semibold tracking-tight", className)} {...props} />
  ),
  h2: ({ className, ...props }) => (
    <h2 className={cn("my-3 text-lg font-semibold tracking-tight", className)} {...props} />
  ),
  h3: ({ className, ...props }) => (
    <h3 className={cn("my-2 text-base font-semibold tracking-tight", className)} {...props} />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn("my-2 border-l-2 border-primary/40 pl-4 italic text-muted-foreground", className)}
      {...props}
    />
  ),
  table: ({ className, ...props }) => (
    <div className="my-2 overflow-x-auto">
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  ),
  th: ({ className, ...props }) => (
    <th
      className={cn("border px-3 py-1.5 text-left font-semibold", className)}
      {...props}
    />
  ),
  td: ({ className, ...props }) => (
    <td className={cn("border px-3 py-1.5", className)} {...props} />
  ),
  hr: () => <hr className="my-4 border-t" />,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
};

export function Markdown({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn("prose prose-sm max-w-none dark:prose-invert", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
