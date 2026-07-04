"use client";

export function SearchTrigger() {
  return (
    <button
      className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm text-fg-tertiary border border-border-primary rounded-md hover:border-accent/50"
      onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "/" }))}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      Search... <kbd className="text-[10px]">/</kbd>
    </button>
  );
}
