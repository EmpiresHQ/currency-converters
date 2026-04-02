import { useEffect, useState } from "react";

import { formatChange, formatPairRate, getTrendDirection } from "../lib/format";
import type { DashboardRate } from "../lib/types";
import { Sparkline } from "./Sparkline";

interface RateCardProps {
  pair: string;
  rate: DashboardRate | undefined;
}

const Arrow = ({ direction }: { direction: "up" | "down" | "flat" }) => {
  if (direction === "flat") {
    return <span className="text-slate-500">•</span>;
  }

  return (
    <span className={direction === "up" ? "text-emerald-400" : "text-rose-400"}>
      {direction === "up" ? "▲" : "▼"}
    </span>
  );
};

export const RateCard = ({ pair, rate }: RateCardProps) => {
  const trend = getTrendDirection(rate);
  const [flash, setFlash] = useState<"down" | "up" | null>(null);

  useEffect(() => {
    if (!rate?.previousRate || rate.rate === rate.previousRate) {
      return;
    }

    const direction = rate.rate > rate.previousRate ? "up" : "down";
    setFlash(direction);
    const timer = window.setTimeout(() => setFlash(null), 650);
    return () => window.clearTimeout(timer);
  }, [rate?.previousRate, rate?.rate]);

  return (
    <article
      className={[
        "rounded-[1.8rem] border border-white/10 bg-white/6 p-5 shadow-[0_18px_60px_rgba(4,12,24,0.45)] backdrop-blur-xl transition-transform duration-300 hover:-translate-y-1",
        flash === "up" ? "rate-flash-up" : "",
        flash === "down" ? "rate-flash-down" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-sky-200/70">{pair}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
            {rate ? formatPairRate(pair, rate.rate) : "Loading"}
          </p>
        </div>

        <div className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs text-slate-300">
          Live
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-sm">
        <Arrow direction={trend} />
        <span className={trend === "up" ? "text-emerald-300" : trend === "down" ? "text-rose-300" : "text-slate-400"}>
          {formatChange(rate?.changePct ?? null)}
        </span>
      </div>

      <div className="mt-4">
        <Sparkline points={rate?.history ?? []} />
      </div>
    </article>
  );
};
