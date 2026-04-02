import { useState } from 'react';
import { useStore } from '../store';
import { CurrencyDropdown } from './CurrencyDropdown';
import { convertCurrency } from '../api/client';
import type { ConversionRecord } from '../types';

export function Converter() {
  const currencies = useStore((state) => state.currencies);
  const addConversion = useStore((state) => state.addConversion);
  
  const [source, setSource] = useState('USD');
  const [target, setTarget] = useState('EUR');
  const [amount, setAmount] = useState<string>('100');
  const [result, setResult] = useState<{
    amount: number;
    result: number;
    rate: number;
    via_usd: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSwap = () => {
    setSource(target);
    setTarget(source);
    setResult(null);
  };

  const handleConvert = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await convertCurrency(source, target, numAmount);
      setResult(data);
      
      // Add to recent conversions
      const record: ConversionRecord = {
        id: `${Date.now()}-${Math.random()}`,
        from: source,
        to: target,
        amount: numAmount,
        result: data.result,
        viaUsd: data.via_usd,
        timestamp: Date.now(),
      };
      addConversion(record);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed');
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (n: number) => {
    return n.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 6 
    });
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <div className="flex items-center gap-3 mb-6">
        <CurrencyDropdown
          currencies={currencies}
          value={source}
          onChange={setSource}
          placeholder="From"
        />
        
        <button
          type="button"
          onClick={handleSwap}
          className="p-3 rounded-lg bg-gray-700 hover:bg-gray-600 
                     transition-colors text-gray-300 hover:text-white"
          aria-label="Swap currencies"
        >
          <svg 
            className="w-5 h-5" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" 
            />
          </svg>
        </button>
        
        <CurrencyDropdown
          currencies={currencies}
          value={target}
          onChange={setTarget}
          placeholder="To"
        />

        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          min="0"
          step="any"
          className="w-32 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg
                     text-white placeholder-gray-500 focus:border-green-500 focus:outline-none"
        />

        <button
          type="button"
          onClick={handleConvert}
          disabled={isLoading}
          className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600
                     text-white font-semibold rounded-lg transition-colors
                     disabled:cursor-not-allowed"
        >
          {isLoading ? '...' : 'Go'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div className="p-4 bg-gray-900 rounded-lg">
          <div className="text-lg">
            <span className="text-gray-400">Result: </span>
            <span className="text-white font-semibold">
              {formatNumber(result.amount)} {source} = {formatNumber(result.result)} {target}
            </span>
          </div>
          {result.via_usd && (
            <div className="mt-2 text-sm text-blue-400">
              <span className="inline-flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Converted via USD
              </span>
            </div>
          )}
          <div className="mt-2 text-sm text-gray-500">
            Rate: 1 {source} = {result.rate.toFixed(6)} {target}
          </div>
        </div>
      )}
    </div>
  );
}
