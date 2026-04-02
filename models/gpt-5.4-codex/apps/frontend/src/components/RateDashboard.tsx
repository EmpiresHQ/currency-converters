import { DASHBOARD_PAIRS } from "../lib/dashboard-pairs";
import type { DashboardRate } from "../lib/types";
import { RateCard } from "./RateCard";

interface RateDashboardProps {
  ratesByPair: Record<string, DashboardRate>;
}

export const RateDashboard = ({ ratesByPair }: RateDashboardProps) => {
  return (
    <section className="animate-fade-up">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.45em] text-sky-200/55">
            Live Board
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            Market pulse across fiat and crypto
          </h2>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {DASHBOARD_PAIRS.map((pair) => (
          <RateCard key={pair} pair={pair} rate={ratesByPair[pair]} />
        ))}
      </div>
    </section>
  );
};

