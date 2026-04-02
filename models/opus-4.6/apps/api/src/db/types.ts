import type { Generated } from 'kysely';

export interface CurrencyTable {
  code: string;
  name: string;
  type: 'fiat' | 'crypto';
  provider: string;
}

export interface RateTable {
  source: string;
  target: string;
  rate: number;
  provider: string;
  updated_at: string;
}

export interface RateHistoryTable {
  id: Generated<number>;
  source: string;
  target: string;
  rate: number;
  provider: string;
  recorded_at: string;
}

export interface Database {
  currencies: CurrencyTable;
  rates: RateTable;
  rate_history: RateHistoryTable;
}
