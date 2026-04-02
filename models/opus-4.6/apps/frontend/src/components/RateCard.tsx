import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import Sparkline from './Sparkline';

type RateCardProps = {
  pair: string;
};

function formatRate(pair: string, rate: number): string {
  const isFiat = !pair.startsWith('BTC') && !pair.startsWith('ETH') && !pair.startsWith('SOL') && !pair.startsWith('XRP');
  if (isFiat) {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(rate);
  }
  if (rate >= 1) {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rate);
  }
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 }).format(rate);
}

export default function RateCard({ pair }: RateCardProps) {
  const entry = useStore((s) => s.rates[pair]);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const prevRateRef = useRef<number | undefined>();

  useEffect(() => {
    if (!entry) return;
    if (prevRateRef.current !== undefined && prevRateRef.current !== entry.rate) {
      setFlash(entry.rate > prevRateRef.current ? 'up' : 'down');
      const timer = setTimeout(() => setFlash(null), 600);
      prevRateRef.current = entry.rate;
      return () => clearTimeout(timer);
    }
    prevRateRef.current = entry.rate;
  }, [entry?.rate]);

  const pctChange =
    entry?.previousRate && entry.previousRate !== 0
      ? ((entry.rate - entry.previousRate) / entry.previousRate) * 100
      : 0;

  const flashBg =
    flash === 'up'
      ? 'bg-green-900/40'
      : flash === 'down'
        ? 'bg-red-900/40'
        : '';

  return (
    <div
      className={`bg-gray-800 border border-gray-700 rounded-xl p-4 transition-colors duration-500 ${flashBg}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-300">{pair}</span>
        {pctChange !== 0 && (
          <span className={`text-xs font-medium ${pctChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {pctChange > 0 ? '\u25B2' : '\u25BC'} {Math.abs(pctChange).toFixed(2)}%
          </span>
        )}
      </div>
      <div className="text-lg font-bold mb-2">
        {entry ? `$${formatRate(pair, entry.rate)}` : '--'}
      </div>
      <Sparkline data={entry?.history ?? []} />
    </div>
  );
}
