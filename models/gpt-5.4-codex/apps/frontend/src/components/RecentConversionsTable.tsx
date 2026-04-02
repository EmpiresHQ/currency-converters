import { formatAmountWithCode, formatConversionResult } from "../lib/format";
import type { RecentConversion } from "../lib/types";

interface RecentConversionsTableProps {
  onClear: () => void;
  rows: RecentConversion[];
}

export const RecentConversionsTable = ({
  onClear,
  rows
}: RecentConversionsTableProps) => {
  return (
    <section className="relative z-0 animate-fade-up rounded-[2rem] border border-white/10 bg-white/7 p-6 shadow-[0_22px_70px_rgba(4,12,24,0.45)] backdrop-blur-xl">
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-sky-200/60">
            Recent Conversions
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            Session-backed conversion history
          </h2>
        </div>

        <button
          className="self-start rounded-full border border-white/10 bg-slate-950/65 px-4 py-2 text-sm text-slate-200 transition-colors hover:border-rose-300/40 hover:text-rose-200"
          onClick={onClear}
          type="button"
        >
          Clear history
        </button>
      </div>

      <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-950/65">
        <div className="grid grid-cols-5 gap-3 border-b border-white/10 px-4 py-3 text-[11px] uppercase tracking-[0.35em] text-slate-400">
          <span>From</span>
          <span>To</span>
          <span>Amount</span>
          <span>Result</span>
          <span>Via USD?</span>
        </div>

        <div className="divide-y divide-white/6">
          {rows.length > 0 ? (
            rows.map((row) => (
              <div
                className="grid grid-cols-5 gap-3 px-4 py-4 text-sm text-slate-200"
                key={row.id}
              >
                <span>{row.source}</span>
                <span>{row.target}</span>
                <span>{formatAmountWithCode(row.amount, row.source)}</span>
                <span>{formatConversionResult(row.result, row.target)}</span>
                <span>{row.via_usd ? "Yes" : "No"}</span>
              </div>
            ))
          ) : (
            <div className="px-4 py-10 text-sm text-slate-400">
              No conversions yet in this session.
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
