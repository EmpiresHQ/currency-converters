import React, { useEffect, useState } from 'react';

interface Currency {
  code: string;
  name: string;
  type: string;
}

interface ConversionResult {
  from: string;
  to: string;
  amount: number;
  result: number;
  rate: number;
  via_usd: boolean;
}

export default function App() {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [from, setFrom] = useState('USD');
  const [to, setTo] = useState('EUR');
  const [amount, setAmount] = useState('100');
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [error, setError] = useState('');
  const [wsStatus, setWsStatus] = useState<'connected' | 'disconnected'>('disconnected');

  useEffect(() => {
    fetch('/api/available_currencies')
      .then((r) => r.json())
      .then((d: { currencies: Currency[] }) => setCurrencies(d.currencies))
      .catch(() => {});

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${location.host}/ws`);
    ws.onopen = () => setWsStatus('connected');
    ws.onclose = () => setWsStatus('disconnected');
    return () => ws.close();
  }, []);

  const convert = async () => {
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, amount: parseFloat(amount) }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data as ConversionResult);
      }
    } catch {
      setError('Conversion failed');
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', fontFamily: 'system-ui' }}>
      <h1>Currency Converter (Dummy Test)</h1>
      <p>
        WebSocket:{' '}
        <span style={{ color: wsStatus === 'connected' ? 'green' : 'red' }}>
          {wsStatus}
        </span>
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <select value={from} onChange={(e) => setFrom(e.target.value)}>
          {currencies.map((c) => (
            <option key={c.code} value={c.code}>{c.code}</option>
          ))}
          {currencies.length === 0 && <option value="USD">USD</option>}
        </select>
        <span style={{ alignSelf: 'center' }}> to </span>
        <select value={to} onChange={(e) => setTo(e.target.value)}>
          {currencies.map((c) => (
            <option key={c.code} value={c.code}>{c.code}</option>
          ))}
          {currencies.length === 0 && <option value="EUR">EUR</option>}
        </select>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ width: 100 }}
        />
        <button onClick={convert}>Convert</button>
      </div>

      {result && (
        <div style={{ padding: 12, background: '#f0f0f0', borderRadius: 8 }}>
          <p>
            {result.amount} {result.from} = <strong>{result.result.toFixed(4)}</strong> {result.to}
          </p>
          {result.via_usd && <p style={{ color: '#666' }}>Converted via USD</p>}
        </div>
      )}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
