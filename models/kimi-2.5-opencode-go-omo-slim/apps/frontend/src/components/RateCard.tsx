import { useState, useEffect, useRef } from 'react';
import { Sparkline } from './Sparkline';
import { fetchRateHistory } from '../api/client';

interface RateCardProps {
  pair: string;
  rate: number;
  previousRate?: number;
}

export function RateCard({ pair, rate, previousRate }: RateCardProps) {
  const [history, setHistory] = useState<number[]>([]);
  const [flashState, setFlashState] = useState<'up' | 'down' | null>(null);
  const prevRateRef = useRef(rate);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const [source, target] = pair.split('/');
        const data = await fetchRateHistory(source, target, 60);
        setHistory(data.map(d => d.rate));
      } catch (error) {
        console.error('Failed to load rate history:', error);
      }
    };

    loadHistory();
  }, [pair]);

  useEffect(() => {
    if (prevRateRef.current !== rate) {
      const isUp = rate > prevRateRef.current;
      setFlashState(isUp ? 'up' : 'down');
      
      // Update history with new rate
      setHistory(prev => [...prev.slice(-59), rate]);

      const timer = setTimeout(() => {
        setFlashState(null);
      }, 500);

      prevRateRef.current = rate;
      return () => clearTimeout(timer);
    }
  }, [rate]);

  const change = previousRate ? ((rate - previousRate) / previousRate) * 100 : 0;
  const isPositive = change >= 0;

  const formatRate = (r: number) => {
    if (r < 1) return r.toFixed(4);
    if (r < 100) return r.toFixed(2);
    return r.toLocaleString('en-US', { maximumFractionDigits: 0 });
  };

  const flashClass = flashState === 'up' 
    ? 'animate-flash-green' 
    : flashState === 'down' 
    ? 'animate-flash-red' 
    : '';

  return (
    <div className={`rate-card ${flashClass}`}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-sm font-medium text-gray-400">{pair}</span>
        <span className={`text-xs ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {isPositive ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
        </span>
      </div>
      <div className="text-2xl font-bold text-white mb-2">
        ${formatRate(rate)}
      </div>
      <Sparkline 
        data={history.length > 1 ? history : [rate, rate]} 
        className="w-full"
      />
    </div>
  );
}
