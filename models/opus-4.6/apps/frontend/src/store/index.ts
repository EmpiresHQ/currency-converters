import { create } from 'zustand';

export type Currency = {
  code: string;
  name: string;
  type: 'fiat' | 'crypto';
};

export type ConversionResult = {
  source: string;
  target: string;
  amount: number;
  result: number;
  rate: number;
  via_usd: boolean;
  timestamp: string;
};

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

type RateEntry = {
  pair: string;
  rate: number;
  updated_at: string;
  previousRate?: number;
  history: number[];
};

type AppState = {
  currencies: Currency[];
  setCurrencies: (currencies: Currency[]) => void;

  rates: Record<string, RateEntry>;
  updateRates: (incoming: Record<string, { rate: number; updated_at: string }>) => void;

  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;

  conversionResult: ConversionResult | null;
  setConversionResult: (result: ConversionResult | null) => void;

  recentConversions: ConversionResult[];
  addConversion: (conversion: ConversionResult) => void;
  clearHistory: () => void;

  isConverting: boolean;
  setIsConverting: (val: boolean) => void;

  error: string | null;
  setError: (error: string | null) => void;
};

function loadRecentConversions(): ConversionResult[] {
  try {
    const stored = sessionStorage.getItem('recentConversions');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentConversions(conversions: ConversionResult[]) {
  try {
    sessionStorage.setItem('recentConversions', JSON.stringify(conversions));
  } catch {
    // ignore
  }
}

export const useStore = create<AppState>((set) => ({
  currencies: [],
  setCurrencies: (currencies) => set({ currencies }),

  rates: {},
  updateRates: (incoming) =>
    set((state) => {
      const newRates = { ...state.rates };

      for (const [pair, data] of Object.entries(incoming)) {
        const existing = newRates[pair];
        const history = existing ? [...existing.history, data.rate].slice(-60) : [data.rate];

        newRates[pair] = {
          pair,
          rate: data.rate,
          updated_at: data.updated_at,
          previousRate: existing?.rate,
          history,
        };

        // Compute and store inverse rate
        const parts = pair.split('/');
        if (parts.length === 2) {
          const inversePair = `${parts[1]}/${parts[0]}`;
          const inverseRate = 1 / data.rate;
          const existingInverse = newRates[inversePair];
          const inverseHistory = existingInverse
            ? [...existingInverse.history, inverseRate].slice(-60)
            : [inverseRate];

          newRates[inversePair] = {
            pair: inversePair,
            rate: inverseRate,
            updated_at: data.updated_at,
            previousRate: existingInverse?.rate,
            history: inverseHistory,
          };
        }
      }

      return { rates: newRates };
    }),

  connectionStatus: 'disconnected',
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

  conversionResult: null,
  setConversionResult: (conversionResult) => set({ conversionResult }),

  recentConversions: loadRecentConversions(),
  addConversion: (conversion) =>
    set((state) => {
      const updated = [conversion, ...state.recentConversions].slice(0, 10);
      saveRecentConversions(updated);
      return { recentConversions: updated };
    }),
  clearHistory: () => {
    sessionStorage.removeItem('recentConversions');
    set({ recentConversions: [] });
  },

  isConverting: false,
  setIsConverting: (isConverting) => set({ isConverting }),

  error: null,
  setError: (error) => set({ error }),
}));
