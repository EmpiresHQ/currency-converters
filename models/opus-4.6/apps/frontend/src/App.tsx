import { useEffect, useRef } from 'react';
import { useStore } from './store';
import Header from './components/Header';
import RateDashboard from './components/RateDashboard';
import Converter from './components/Converter';
import ResultDisplay from './components/ResultDisplay';
import RecentConversions from './components/RecentConversions';

const DASHBOARD_PAIRS = 'BTC/USD,ETH/USD,EUR/USD,GBP/USD,SOL/USD,XRP/USD';

export default function App() {
  const setCurrencies = useStore((s) => s.setCurrencies);
  const updateRates = useStore((s) => s.updateRates);
  const setConnectionStatus = useStore((s) => s.setConnectionStatus);
  const setError = useStore((s) => s.setError);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Step 1: fetch currencies (triggers seed)
        const currRes = await fetch('/api/available_currencies');
        if (!currRes.ok) throw new Error('Failed to load currencies');
        const currencies = await currRes.json();
        if (cancelled) return;
        setCurrencies(currencies);

        // Step 2: fetch initial rates (after currencies loaded)
        const ratesRes = await fetch(`/api/rates?pairs=${DASHBOARD_PAIRS}`);
        if (ratesRes.ok) {
          const ratesData = await ratesRes.json();
          if (!cancelled && Array.isArray(ratesData)) {
            const rateMap: Record<string, { rate: number; updated_at: string }> = {};
            for (const r of ratesData) {
              const pair = r.pair || `${r.source}/${r.target}`;
              rateMap[pair] = { rate: r.rate, updated_at: r.updated_at };
            }
            updateRates(rateMap);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Initialization failed');
        }
      }

      // Step 3: open WebSocket
      if (!cancelled) {
        connectWebSocket();
      }
    }

    function connectWebSocket() {
      if (cancelled) return;

      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        if (cancelled) return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'ping') return;
          if (msg.type === 'rates' && msg.data) {
            const rateMap: Record<string, { rate: number; updated_at: string }> = {};
            if (Array.isArray(msg.data)) {
              for (const r of msg.data) {
                // Handle both {pair} format (from /api/rates) and {source, target} format (from broadcast)
                const pair = r.pair || `${r.source}/${r.target}`;
                rateMap[pair] = { rate: r.rate, updated_at: r.updated_at };
              }
            }
            updateRates(rateMap);
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        if (cancelled) return;
        setConnectionStatus('reconnecting');
      };

      ws.onclose = () => {
        if (cancelled) return;
        setConnectionStatus('reconnecting');
        // Auto-reconnect with exponential backoff
        const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 30000);
        reconnectAttemptsRef.current++;
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, delay);
      };
    }

    init();

    return () => {
      cancelled = true;
      wsRef.current?.close();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [setCurrencies, updateRates, setConnectionStatus, setError]);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <RateDashboard />
        <Converter />
        <ResultDisplay />
        <RecentConversions />
      </main>
    </div>
  );
}
