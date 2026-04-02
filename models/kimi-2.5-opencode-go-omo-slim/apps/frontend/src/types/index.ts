export interface Currency {
  code: string;
  name: string;
  type: 'fiat' | 'crypto';
  provider: string;
}

export interface Rate {
  rate: number;
  source: string;
  target: string;
}

export interface ConversionResult {
  source: string;
  target: string;
  amount: number;
  result: number;
  rate: number;
  via_usd: boolean;
}

export interface ConversionRecord {
  id: string;
  from: string;
  to: string;
  amount: number;
  result: number;
  viaUsd: boolean;
  timestamp: number;
}

export interface RateHistoryPoint {
  source: string;
  target: string;
  rate: number;
  recorded_at: string;
}

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export interface WebSocketMessage {
  type: 'connected' | 'rates_updated' | 'heartbeat';
  timestamp?: number;
}
