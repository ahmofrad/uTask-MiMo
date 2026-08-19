"use client";

import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { cn } from "@/lib/cn";

type TooltipProps = {
  /** The single trigger element the tooltip anchors to (cloneable DOM element). */
  children: ReactElement;
  /** Panel content. */
  content: ReactNode;
  /** Preferred side; flips to the other side when there is no room. */
  side?: "top" | "bottom";
  className?: string;
  "data-testid"?: string;
};

const GAP = 6;
const VIEWPORT_MARGIN = 8;

/**
 * Styled, theme-aware tooltip. The panel is `position: fixed` and positioned
 * from the trigger's bounding rect, so it escapes `overflow` containers (the
 * Gantt timeline scrolls horizontally) and stays within the viewport. It
 * re-positions on scroll/resize while open, closes on Escape, and wires
 * `aria-describedby` between the trigger and the panel.
 */
export function Tooltip({ children, content, side = "top", className, "data-testid": dataTestId }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const tipId = useId();

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const tip = tipRef.current;
    if (!trigger || !tip) return;
    const tr = trigger.getBoundingClientRect();
    const tipW = tip.offsetWidth;
    const tipH = tip.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = side === "top" ? tr.top - tipH - GAP : tr.bottom + GAP;
    let left = tr.left + tr.width / 2 - tipW / 2;
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, vw - tipW - VIEWPORT_MARGIN));
    if (top < VIEWPORT_MARGIN) top = tr.bottom + GAP;
    if (top + tipH > vh - VIEWPORT_MARGIN) top = tr.top - tipH - GAP;
    setPos({ top, left });
  }, [side]);

  // First open: the panel is rendered invisible so it can be measured, then
  // placed before paint (no flash of a 0x0 corner).
  useLayoutEffect(() => {
    if (open && !pos) place();
  }, [open, pos, place]);

  useEffect(() => {
    if (!open) return;
    const refresh = () => place();
    window.addEventListener("scroll", refresh, true);
    window.addEventListener("resize", refresh);
    return () => {
      window.removeEventListener("scroll", refresh, true);
      window.removeEventListener("resize", refresh);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // The child is a DOM element (e.g. a <div>); type the injected props so
  // cloneElement accepts the ref + event handlers React injects. The
  // aria-describedby link is spread conditionally to satisfy
  // exactOptionalPropertyTypes.
  const trigger = cloneElement(children as ReactElement<{
    ref?: Ref<HTMLElement>;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    onFocus?: () => void;
    onBlur?: () => void;
    "aria-describedby"?: string;
  }>, {
    ref: triggerRef,
    onMouseEnter: () => setOpen(true),
    onMouseLeave: () => setOpen(false),
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false),
    ...(open ? { "aria-describedby": tipId } : {}),
  });

  return (
    <>
      {trigger}
      {open && (
        <div
          ref={tipRef}
          id={tipId}
          role="tooltip"
          data-testid={dataTestId}
          className={cn(
            "pointer-events-none fixed z-[60] max-w-64 rounded-md border border-border-primary bg-bg-surface px-2.5 py-1.5 text-xs text-fg shadow-lg",
            !pos && "invisible",
            className,
          )}
          style={pos ? { top: pos.top, left: pos.left } : undefined}
        >
          {content}
        </div>
      )}
    </>
  );
}
