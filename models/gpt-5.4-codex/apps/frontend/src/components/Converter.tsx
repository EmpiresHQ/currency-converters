import { useEffect, useState } from "react";

import { submitConversion } from "../lib/api";
import { formatAmountWithCode, formatConversionResult } from "../lib/format";
import type { CurrencyRecord } from "../lib/types";
import { useAppStore } from "../store/use-app-store";
import { CurrencyDropdown } from "./CurrencyDropdown";

const SwapIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24">
    <path
      d="M7 7H20M20 7L16 3M20 7L16 11M17 17H4M4 17L8 13M4 17L8 21"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
    />
  </svg>
);

interface ConverterProps {
  currencies: CurrencyRecord[];
}

export const Converter = ({ currencies }: ConverterProps) => {
  const addRecentConversion = useAppStore((state) => state.addRecentConversion);
  const conversionError = useAppStore((state) => state.conversionError);
  const conversionResult = useAppStore((state) => state.conversionResult);
  const setConversionError = useAppStore((state) => state.setConversionError);
  const setConversionResult = useAppStore((state) => state.setConversionResult);

  const [amount, setAmount] = useState("1000");
  const [source, setSource] = useState("USD");
  const [target, setTarget] = useState("EUR");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (currencies.length === 0) {
      return;
    }

    const hasSource = currencies.some((currency) => currency.code === source);
    const hasTarget = currencies.some((currency) => currency.code === target);

    if (!hasSource) {
      setSource(currencies[0]!.code);
    }

    if (!hasTarget) {
      setTarget(currencies.find((currency) => currency.code === "EUR")?.code ?? currencies[1]?.code ?? currencies[0]!.code);
    }
  }, [currencies, source, target]);

  const handleConvert = async () => {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setConversionError("Amount must be a positive number");
      return;
    }

    setIsSubmitting(true);
    setConversionError(null);

    try {
      const response = await submitConversion({
        amount: numericAmount,
        source,
        target
      });

      setConversionResult(response);
      addRecentConversion(response);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Conversion failed";
      setConversionResult(null);
      setConversionError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="relative z-20 animate-fade-up overflow-visible rounded-[2rem] border border-white/10 bg-white/7 p-6 shadow-[0_22px_70px_rgba(4,12,24,0.45)] backdrop-blur-xl">
      <div className="flex flex-col gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-sky-200/60">
            Converter
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            Swap between supported fiat and crypto pairs
          </h2>
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <CurrencyDropdown onChange={setSource} options={currencies} value={source} />

          <button
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/70 text-sky-100 transition-colors hover:border-sky-300/50 hover:bg-slate-950"
            onClick={() => {
              setSource(target);
              setTarget(source);
            }}
            type="button"
          >
            <SwapIcon />
          </button>

          <CurrencyDropdown onChange={setTarget} options={currencies} value={target} />

          <input
            className="h-14 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-300/50 xl:w-36"
            inputMode="decimal"
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Amount"
            value={amount}
          />

          <button
            className="h-14 rounded-2xl bg-gradient-to-r from-sky-400 via-cyan-300 to-emerald-300 px-6 text-sm font-semibold text-slate-950 transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting || currencies.length === 0}
            onClick={() => {
              void handleConvert();
            }}
            type="button"
          >
            {isSubmitting ? "Converting..." : "Convert"}
          </button>
        </div>

        <div className="rounded-[1.6rem] border border-white/10 bg-slate-950/60 px-5 py-4">
          {conversionResult ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-300">
                Result:{" "}
                <span className="font-medium text-white">
                  {formatAmountWithCode(conversionResult.amount, conversionResult.source)}
                </span>{" "}
                ={" "}
                <span className="font-medium text-white">
                  {formatConversionResult(conversionResult.result, conversionResult.target)}
                </span>
              </p>

              {conversionResult.via_usd ? (
                <p className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-emerald-200">
                  Converted via USD
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              Run a conversion to see the current rate path and output.
            </p>
          )}

          {conversionError ? (
            <p className="mt-3 text-sm text-rose-300">{conversionError}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
};
