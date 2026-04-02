import { useDeferredValue, useEffect, useRef, useState } from "react";

import type { CurrencyRecord } from "../lib/types";

interface CurrencyDropdownProps {
  onChange: (code: string) => void;
  options: CurrencyRecord[];
  value: string;
}

const Chevron = ({ open }: { open: boolean }) => (
  <svg
    className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    fill="none"
    viewBox="0 0 24 24"
  >
    <path
      d="M6 9L12 15L18 9"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  </svg>
);

export const CurrencyDropdown = ({
  onChange,
  options,
  value
}: CurrencyDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const selected = options.find((option) => option.code === value);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    searchRef.current?.focus();

    const handlePointerDown = (event: PointerEvent) => {
      if (wrapperRef.current?.contains(event.target as Node)) {
        return;
      }

      setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  const filtered = options.filter((option) => {
    const needle = deferredQuery.trim().toLowerCase();
    if (!needle) {
      return true;
    }

    return (
      option.code.toLowerCase().includes(needle) ||
      option.name.toLowerCase().includes(needle)
    );
  });

  return (
    <div className={`relative flex-1 ${isOpen ? "z-50" : "z-0"}`} ref={wrapperRef}>
      <button
        className="flex h-14 w-full items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-left text-sm text-white shadow-inner shadow-slate-950/60 transition-colors hover:border-sky-300/40"
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        <div className="min-w-0">
          <p className="font-semibold">{selected?.code ?? "Select"}</p>
          <p className="truncate text-xs text-slate-400">{selected?.name ?? "Choose a currency"}</p>
        </div>
        <div className="text-slate-400">
          <Chevron open={isOpen} />
        </div>
      </button>

      {isOpen ? (
        <div className="absolute left-0 top-[calc(100%+0.75rem)] z-50 w-full rounded-[1.4rem] border border-white/10 bg-[#091321] p-3 shadow-[0_30px_80px_rgba(3,10,20,0.65)] backdrop-blur-2xl">
          <input
            className="mb-3 h-11 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-300/50"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search currency"
            ref={searchRef}
            value={query}
          />

          <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
            {filtered.map((option) => (
              <button
                className={[
                  "flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition-colors",
                  option.code === value
                    ? "bg-sky-400/12 text-sky-100"
                    : "text-slate-200 hover:bg-white/6"
                ].join(" ")}
                key={option.code}
                onClick={() => {
                  onChange(option.code);
                  setQuery("");
                  setIsOpen(false);
                }}
                type="button"
              >
                <div className="min-w-0">
                  <p className="font-medium">{option.code}</p>
                  <p className="truncate text-xs text-slate-400">{option.name}</p>
                </div>

                <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.25em] text-slate-400">
                  {option.type}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};
