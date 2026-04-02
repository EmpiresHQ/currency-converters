import type { Currency, Rate, ConversionResult, RateHistoryPoint } from '../types';

const API_BASE = '/api';

export async function fetchCurrencies(): Promise<Currency[]> {
  const response = await fetch(`${API_BASE}/available_currencies`);
  if (!response.ok) {
    throw new Error('Failed to fetch currencies');
  }
  const data = await response.json();
  return data.currencies;
}

export async function fetchRates(pairs: string[]): Promise<Record<string, Rate>> {
  const pairsParam = pairs.join(',');
  const response = await fetch(`${API_BASE}/rates?pairs=${encodeURIComponent(pairsParam)}`);
  if (!response.ok) {
    throw new Error('Failed to fetch rates');
  }
  const data = await response.json();
  return data.rates;
}

export async function convertCurrency(
  source: string,
  target: string,
  amount: number
): Promise<ConversionResult> {
  const response = await fetch(`${API_BASE}/convert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, target, amount }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Conversion failed');
  }
  
  return response.json();
}

export async function fetchRateHistory(
  source: string,
  target: string,
  limit: number = 100
): Promise<RateHistoryPoint[]> {
  const params = new URLSearchParams({
    source,
    target,
    limit: limit.toString(),
  });
  
  const response = await fetch(`${API_BASE}/rate_history?${params}`);
  if (!response.ok) {
    throw new Error('Failed to fetch rate history');
  }
  const data = await response.json();
  return data.history;
}
