export interface Currency {
  code: string;
  name: string;
  type: 'fiat' | 'crypto';
  provider: string;
}

export interface Rate {
  source: string;
  target: string;
  rate: number;
  provider: string;
  updated_at: string;
}

export interface RateHistory {
  id: number;
  source: string;
  target: string;
  rate: number;
  provider: string;
  recorded_at: string;
}

export interface Database {
  currencies: Currency;
  rates: Rate;
  rate_history: RateHistory;
}
