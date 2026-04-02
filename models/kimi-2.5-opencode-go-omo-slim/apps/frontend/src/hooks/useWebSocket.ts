import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';
import type { WebSocketMessage } from '../types';

const RECONNECT_DELAY_BASE = 1000;
const MAX_RECONNECT_DELAY = 30000;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const setConnectionStatus = useStore((state) => state.setConnectionStatus);
  const setRates = useStore((state) => state.setRates);

  const connect = useCallback(() => {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${location.host}/ws`;

    setConnectionStatus('connecting');
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setConnectionStatus('connected');
      reconnectAttemptsRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        
        if (message.type === 'rates_updated') {
          // Refresh rates from API
          refreshRates();
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
      setConnectionStatus('disconnected');
      wsRef.current = null;
      
      // Schedule reconnect
      const delay = Math.min(
        RECONNECT_DELAY_BASE * Math.pow(2, reconnectAttemptsRef.current),
        MAX_RECONNECT_DELAY
      );
      
      reconnectAttemptsRef.current++;
      
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, delay);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }, [setConnectionStatus]);

  const refreshRates = useCallback(async () => {
    try {
      const pairs = [
        'BTC/USD', 'ETH/USD', 'EUR/USD',
        'GBP/USD', 'SOL/USD', 'XRP/USD'
      ];

      const response = await fetch(`/api/rates?pairs=${pairs.join(',')}`);
      if (response.ok) {
        const data = await response.json();
        // Transform Record<string, Rate> to Record<string, number>
        const rateValues: Record<string, number> = {};
        for (const [pair, rateObj] of Object.entries(data.rates as Record<string, { rate: number }>)) {
          rateValues[pair] = rateObj.rate;
        }
        setRates(rateValues);
      }
    } catch (error) {
      console.error('Failed to refresh rates:', error);
    }
  }, [setRates]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { connect };
}
