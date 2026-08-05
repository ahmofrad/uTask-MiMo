"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/cn";

export type MenuItem = {
  id: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
};

type MenuProps = {
  label: string;
  items: MenuItem[];
  align?: "start" | "end";
  header?: React.ReactNode;
  triggerAriaLabel?: string;
  triggerClassName?: string;
  children: React.ReactNode;
};

export function Menu({ label, items, align = "end", header, triggerAriaLabel, triggerClassName, children }: MenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (open) {
      const firstEnabled = items.findIndex((item) => !item.disabled);
      const idx = firstEnabled === -1 ? 0 : firstEnabled;
      itemRefs.current[idx]?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false);
      }
    }
    function onDocKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    document.addEventListener("keydown", onDocKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown);
      document.removeEventListener("keydown", onDocKeyDown);
    };
  }, [open]);

  function moveFocus(next: number) {
    const n = items.length;
    const idx = ((next % n) + n) % n;
    itemRefs.current[idx]?.focus();
  }

  function handleMenuKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveFocus((itemRefs.current.indexOf(document.activeElement as HTMLButtonElement)) + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveFocus((itemRefs.current.indexOf(document.activeElement as HTMLButtonElement)) - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      moveFocus(0);
    } else if (e.key === "End") {
      e.preventDefault();
      moveFocus(items.length - 1);
    }
  }

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={triggerAriaLabel}
        className={cn("inline-flex items-center gap-1 text-fg-muted hover:text-fg-primary transition-colors", triggerClassName)}
      >
        {children}
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          onKeyDown={handleMenuKeyDown}
          className={cn(
            "absolute z-30 mt-1 min-w-40 rounded-lg border border-border-primary bg-bg-primary shadow-lg p-1",
            align === "end" ? "end-0" : "start-0",
          )}
        >
          {header && (
            <div aria-hidden="true" className="px-3 py-2 border-b border-border-primary mb-1">
              {header}
            </div>
          )}
          {items.map((item, i) => (
            <button
              key={item.id}
              ref={(el) => { itemRefs.current[i] = el; }}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                item.onSelect();
                setOpen(false);
                triggerRef.current?.focus();
              }}
              className="w-full text-start px-3 py-1.5 text-sm rounded-md text-fg-primary hover:bg-bg-surface disabled:opacity-50 disabled:hover:bg-transparent"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
