import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { RateCard } from './RateCard';
import { fetchRates } from '../api/client';

const DASHBOARD_PAIRS = [
  'BTC/USD',
  'ETH/USD',
  'EUR/USD',
  'GBP/USD',
  'SOL/USD',
  'XRP/USD',
];

export function RateDashboard() {
  const rates = useStore((state) => state.rates);
  const setRates = useStore((state) => state.setRates);
  const [previousRates, setPreviousRates] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadRates = async () => {
      try {
        const data = await fetchRates(DASHBOARD_PAIRS);
        setPreviousRates(rates);
        // Transform Record<string, Rate> to Record<string, number>
        const rateValues: Record<string, number> = {};
        for (const [pair, rateObj] of Object.entries(data)) {
          rateValues[pair] = rateObj.rate;
        }
        setRates(rateValues);
      } catch (error) {
        console.error('Failed to load rates:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadRates();
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {DASHBOARD_PAIRS.map((pair) => (
          <div key={pair} className="rate-card h-32 animate-pulse bg-gray-800" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {DASHBOARD_PAIRS.map((pair) => (
        <RateCard
          key={pair}
          pair={pair}
          rate={rates[pair] || 0}
          previousRate={previousRates[pair]}
        />
      ))}
    </div>
  );
}
