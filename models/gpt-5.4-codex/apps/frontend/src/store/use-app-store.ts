import { create } from "zustand";

import type {
  ConnectionStatus,
  ConversionResponse,
  CurrencyRecord,
  DashboardRate,
  RateApiRecord,
  RateHistoryPoint,
  RecentConversion
} from "../lib/types";

const MAX_RECENT_CONVERSIONS = 10;
const MAX_SPARKLINE_POINTS = 60;
const SESSION_KEY = "currencyx.recent-conversions";

interface AppState {
  addRecentConversion: (conversion: ConversionResponse) => void;
  applyRateHistory: (history: Record<string, RateHistoryPoint[]>) => void;
  applyRates: (rates: RateApiRecord[]) => void;
  clearHistory: () => void;
  connectionStatus: ConnectionStatus;
  conversionError: string | null;
  conversionResult: ConversionResponse | null;
  currencies: CurrencyRecord[];
  isInitializing: boolean;
  recentConversions: RecentConversion[];
  ratesByPair: Record<string, DashboardRate>;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setConversionError: (message: string | null) => void;
  setConversionResult: (result: ConversionResponse | null) => void;
  setCurrencies: (currencies: CurrencyRecord[]) => void;
  setInitializing: (value: boolean) => void;
  setRuntimeError: (message: string | null) => void;
  runtimeError: string | null;
}

const readSessionHistory = (): RecentConversion[] => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as RecentConversion[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeSessionHistory = (recentConversions: RecentConversion[]): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(recentConversions));
};

const removeSessionHistory = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(SESSION_KEY);
};

const toPair = (source: string, target: string): string => `${source}/${target}`;

const applyDirectionalRate = (
  currentRates: Record<string, DashboardRate>,
  source: string,
  target: string,
  rate: number,
  updatedAt: string
): Record<string, DashboardRate> => {
  const pair = toPair(source, target);
  const previous = currentRates[pair];
  const history = [...(previous?.history ?? []), rate].slice(-MAX_SPARKLINE_POINTS);
  const previousRate = previous?.rate ?? null;

  return {
    ...currentRates,
    [pair]: {
      changePct:
        previousRate && previousRate !== 0
          ? ((rate - previousRate) / previousRate) * 100
          : null,
      history,
      pair,
      previousRate,
      rate,
      source,
      target,
      updatedAt
    }
  };
};

const createRecentConversion = (conversion: ConversionResponse): RecentConversion => ({
  ...conversion,
  createdAt: new Date().toISOString(),
  id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
});

export const useAppStore = create<AppState>((set) => ({
  addRecentConversion: (conversion) => {
    set((state) => {
      const recentConversions = [
        createRecentConversion(conversion),
        ...state.recentConversions
      ].slice(0, MAX_RECENT_CONVERSIONS);

      writeSessionHistory(recentConversions);
      return { recentConversions };
    });
  },
  applyRateHistory: (history) => {
    set((state) => {
      const nextRates = { ...state.ratesByPair };

      for (const [pair, points] of Object.entries(history)) {
        const [source, target] = pair.split("/");
        if (!source || !target) {
          continue;
        }

        const series = points.map((point) => point.rate).slice(-MAX_SPARKLINE_POINTS);
        const updatedAt = points.at(-1)?.recorded_at ?? nextRates[pair]?.updatedAt ?? "";
        const latestRate = series.at(-1) ?? nextRates[pair]?.rate ?? 0;
        const previousRate = series.length > 1 ? (series.at(-2) ?? null) : nextRates[pair]?.previousRate ?? null;

        nextRates[pair] = {
          changePct:
            previousRate && previousRate !== 0
              ? ((latestRate - previousRate) / previousRate) * 100
              : nextRates[pair]?.changePct ?? null,
          history: series.length > 0 ? series : nextRates[pair]?.history ?? [],
          pair,
          previousRate,
          rate: latestRate,
          source,
          target,
          updatedAt
        };
      }

      return {
        ratesByPair: nextRates
      };
    });
  },
  applyRates: (rates) => {
    set((state) => {
      let nextRates = { ...state.ratesByPair };

      for (const rate of rates) {
        nextRates = applyDirectionalRate(
          nextRates,
          rate.source,
          rate.target,
          rate.rate,
          rate.updated_at
        );

        if (rate.rate !== 0) {
          nextRates = applyDirectionalRate(
            nextRates,
            rate.target,
            rate.source,
            1 / rate.rate,
            rate.updated_at
          );
        }
      }

      return {
        ratesByPair: nextRates
      };
    });
  },
  clearHistory: () => {
    removeSessionHistory();
    set({
      recentConversions: []
    });
  },
  connectionStatus: "disconnected",
  conversionError: null,
  conversionResult: null,
  currencies: [],
  isInitializing: true,
  recentConversions: readSessionHistory(),
  ratesByPair: {},
  runtimeError: null,
  setConnectionStatus: (status) => {
    set({
      connectionStatus: status
    });
  },
  setConversionError: (message) => {
    set({
      conversionError: message
    });
  },
  setConversionResult: (result) => {
    set({
      conversionResult: result
    });
  },
  setCurrencies: (currencies) => {
    set({
      currencies
    });
  },
  setInitializing: (value) => {
    set({
      isInitializing: value
    });
  },
  setRuntimeError: (message) => {
    set({
      runtimeError: message
    });
  }
}));

