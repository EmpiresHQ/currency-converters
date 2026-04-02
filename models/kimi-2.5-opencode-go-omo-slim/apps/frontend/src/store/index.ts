import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Currency, ConversionRecord, ConnectionStatus } from '../types';

interface AppState {
  // Currencies
  currencies: Currency[];
  setCurrencies: (currencies: Currency[]) => void;
  
  // Rates - normalized to the requested direction with inverse computed
  rates: Record<string, number>;
  setRates: (rates: Record<string, number>) => void;
  updateRate: (pair: string, rate: number) => void;
  
  // Connection status
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;
  
  // Recent conversions
  recentConversions: ConversionRecord[];
  addConversion: (conversion: ConversionRecord) => void;
  clearConversions: () => void;
}

const SESSION_STORAGE = {
  getItem: (name: string): string | null => {
    return sessionStorage.getItem(name);
  },
  setItem: (name: string, value: string): void => {
    sessionStorage.setItem(name, value);
  },
  removeItem: (name: string): void => {
    sessionStorage.removeItem(name);
  },
};

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      currencies: [],
      setCurrencies: (currencies) => set({ currencies }),
      
      rates: {},
      setRates: (newRates) => {
        // Compute inverse rates for each pair
        const computedRates: Record<string, number> = {};
        
        for (const [pair, rate] of Object.entries(newRates)) {
          computedRates[pair] = rate;
          
          // Add inverse rate
          const [source, target] = pair.split('/');
          if (source && target && rate !== 0) {
            const inversePair = `${target}/${source}`;
            computedRates[inversePair] = 1 / rate;
          }
        }
        
        set({ rates: computedRates });
      },
      updateRate: (pair, rate) => {
        set((state) => {
          const newRates = { ...state.rates, [pair]: rate };
          
          // Add inverse rate
          const [source, target] = pair.split('/');
          if (source && target && rate !== 0) {
            const inversePair = `${target}/${source}`;
            newRates[inversePair] = 1 / rate;
          }
          
          return { rates: newRates };
        });
      },
      
      connectionStatus: 'disconnected',
      setConnectionStatus: (status) => set({ connectionStatus: status }),
      
      recentConversions: [],
      addConversion: (conversion) =>
        set((state) => ({
          recentConversions: [conversion, ...state.recentConversions.slice(0, 9)],
        })),
      clearConversions: () => set({ recentConversions: [] }),
    }),
    {
      name: 'currency-converter-storage',
      storage: createJSONStorage(() => SESSION_STORAGE),
      partialize: (state) => ({ recentConversions: state.recentConversions }),
    }
  )
);
