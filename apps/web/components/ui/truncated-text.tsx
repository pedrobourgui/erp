"use client";

import React from "react";

import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────

interface TruncatedTextProps {
  /** The complete text. What is clipped on screen is still readable here. */
  text: string | number | null | undefined;
  /** Rendered when `text` is empty — the em dash the detail screens already use. */
  fallback?: string;
  /** Element to render. Headings must stay headings. */
  as?: "span" | "p" | "div" | "h1" | "h2" | "h3";
  /** 1 clips to a single line; more clamps to that many lines. */
  lines?: number;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

// ─── Hook ───────────────────────────────────────────────────────────────

/**
 * Is this box actually clipping its content right now?
 *
 * Asked on every resize, because it is a layout question and not a text-length
 * one: "Camiseta" is clipped in a 60px column and a 255-character description
 * is not clipped in a full-width card. Guessing from `text.length` puts a
 * tooltip on text the user can already read — noise that trains people to
 * ignore tooltips.
 */
function useIsClipped(node: HTMLElement | null, deps: unknown[]) {
  const [clipped, setClipped] = React.useState(false);

  React.useLayoutEffect(() => {
    if (!node) {return;}

    const measure = () => {
      // A node React has already detached measures 0×0 and would read as "fits"
      // — turning the tooltip off, remounting the node, and starting the whole
      // dance again. Answering only for a node that is still on screen is what
      // keeps the state from oscillating.
      if (!node.isConnected) {return;}
      setClipped(
        node.scrollWidth > node.clientWidth + 1 ||
          node.scrollHeight > node.clientHeight + 1
      );
    };

    measure();

    // The column can shrink without the text changing — a sidebar collapsing or
    // a window resize is exactly when a tooltip starts being needed.
    if (typeof ResizeObserver === "undefined") {return;}
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, ...deps]);

  return clipped;
}

// Literal class names on purpose: Tailwind scans the source, so an
// interpolated `line-clamp-${n}` would never be generated.
const CLAMP_BY_LINES: Record<number, string> = {
  2: "line-clamp-2",
  3: "line-clamp-3",
  4: "line-clamp-4",
  5: "line-clamp-5",
  6: "line-clamp-6",
};

// ─── Component ──────────────────────────────────────────────────────────

/**
 * AE-31: a 255-character product name — a length the schema allows — ran out
 * of its grid column and painted *over* the SKU and Tipo fields beside it, and
 * the page heading left the viewport entirely. Text coming from the database is
 * unbounded by nature; the layout that shows it is not.
 *
 * Clips with an ellipsis and hands the full text back through a tooltip, but
 * **only while it is really clipped** — see `useIsClipped`. Clipped text also
 * enters the tab order, otherwise the tooltip would exist for mouse users only
 * and the rest would simply lose the data (WCAG 1.4.13).
 */
export function TruncatedText({
  text,
  fallback = "—",
  as: Tag = "span",
  lines = 1,
  side = "top",
  className,
}: TruncatedTextProps) {
  // The node lives in state, not in a ref: wrapping the text in a tooltip
  // remounts it, and the measurement has to follow the node that is actually
  // on screen.
  const [node, setNode] = React.useState<HTMLElement | null>(null);
  const content = text === null || text === undefined || text === "" ? null : String(text);
  const clipped = useIsClipped(node, [content, lines]);

  if (content === null) {
    return <Tag className={className}>{fallback}</Tag>;
  }

  const element = (
    <Tag
      ref={setNode as React.Ref<HTMLHeadingElement>}
      data-truncated={clipped}
      // `min-w-0` is half the fix: a flex or grid child keeps its intrinsic
      // width without it, so `truncate` has nothing to clip against (AE-07).
      className={cn(
        "block min-w-0",
        lines === 1
          ? "truncate"
          : cn(CLAMP_BY_LINES[lines] ?? "line-clamp-3", "break-words"),
        className
      )}
      tabIndex={clipped ? 0 : undefined}
    >
      {content}
    </Tag>
  );

  if (!clipped) {
    return element;
  }

  return (
    <Tooltip content={content} side={side} className="max-w-sm whitespace-pre-wrap break-words">
      {element}
    </Tooltip>
  );
}
