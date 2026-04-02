import { useState } from 'react';
import { useStore } from '../store';
import CurrencyDropdown from './CurrencyDropdown';

export default function Converter() {
  const currencies = useStore((s) => s.currencies);
  const setConversionResult = useStore((s) => s.setConversionResult);
  const addConversion = useStore((s) => s.addConversion);
  const isConverting = useStore((s) => s.isConverting);
  const setIsConverting = useStore((s) => s.setIsConverting);
  const setError = useStore((s) => s.setError);

  const [source, setSource] = useState('USD');
  const [target, setTarget] = useState('EUR');
  const [amount, setAmount] = useState('1000');

  const handleSwap = () => {
    setSource(target);
    setTarget(source);
  };

  const handleConvert = async () => {
    setIsConverting(true);
    setError(null);
    try {
      const res = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, target, amount: parseFloat(amount) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Conversion failed' }));
        throw new Error(err.error || 'Conversion failed');
      }
      const data = await res.json();
      setConversionResult(data);
      addConversion(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Conversion failed');
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <CurrencyDropdown currencies={currencies} selected={source} onSelect={setSource} />

      <button
        type="button"
        onClick={handleSwap}
        className="shrink-0 p-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors"
        title="Swap currencies"
      >
        <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      </button>

      <CurrencyDropdown currencies={currencies} selected={target} onSelect={setTarget} />

      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-32 shrink-0 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-right outline-none focus:border-gray-500"
        placeholder="Amount"
        min="0"
        step="any"
      />

      <button
        type="button"
        onClick={handleConvert}
        disabled={isConverting}
        className="shrink-0 px-5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg font-medium transition-colors"
      >
        {isConverting ? '...' : 'Go'}
      </button>
    </div>
  );
}
