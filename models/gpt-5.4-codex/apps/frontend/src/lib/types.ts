export interface CurrencyRecord {
  code: string;
  name: string;
  provider: string;
  type: "crypto" | "fiat";
}

export interface RateApiRecord {
  inverted?: boolean;
  provider?: string;
  rate: number;
  requestedPair?: string;
  source: string;
  storedPair?: string;
  target: string;
  updated_at: string;
}

export interface RateHistoryPoint {
  rate: number;
  recorded_at: string;
}

export interface ConversionResponse {
  amount: number;
  path: string[];
  rate: number;
  result: number;
  source: string;
  target: string;
  via_usd: boolean;
}

export interface RecentConversion extends ConversionResponse {
  createdAt: string;
  id: string;
}

export type ConnectionStatus = "connected" | "disconnected" | "reconnecting";

export interface DashboardRate {
  changePct: number | null;
  history: number[];
  pair: string;
  previousRate: number | null;
  rate: number;
  source: string;
  target: string;
  updatedAt: string;
}

export interface RatesApiResponse {
  missing: string[];
  rates: RateApiRecord[];
}

export interface AvailableCurrenciesResponse {
  currencies: CurrencyRecord[];
}

export interface RateHistoryResponse {
  histories: Record<string, RateHistoryPoint[]>;
}

export interface RatesUpdateMessage {
  rates: Array<{
    rate: number;
    source: string;
    target: string;
    updated_at: string;
  }>;
  timestamp: string;
  type: "rates_update";
}
