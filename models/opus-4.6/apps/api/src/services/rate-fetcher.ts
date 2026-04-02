import { Kysely } from 'kysely';
import type { Database } from '../db/types';
import { ExchangeRateResponseSchema, CurrencyNamesResponseSchema } from '../schemas';

const RATES_URL = 'https://latest.currency-api.pages.dev/v1/currencies/usd.json';
const NAMES_URL = 'https://latest.currency-api.pages.dev/v1/currencies.json';

const FIAT_CODES = new Set([
  'usd', 'eur', 'gbp', 'jpy', 'chf', 'cad', 'aud', 'nzd',
  'cny', 'inr', 'brl', 'krw', 'mxn', 'sgd', 'hkd', 'nok',
  'sek', 'dkk', 'pln', 'zar', 'thb', 'idr', 'myr', 'php',
  'twd', 'czk', 'huf', 'ils', 'clp', 'aed', 'sar', 'try',
  'rub', 'ars', 'cop', 'egp', 'ngn', 'pkr', 'vnd', 'bdt',
]);

const CRYPTO_CODES = new Set(['btc', 'eth', 'sol', 'xrp']);

function isKnownCurrency(code: string): 'fiat' | 'crypto' | null {
  if (FIAT_CODES.has(code)) return 'fiat';
  if (CRYPTO_CODES.has(code)) return 'crypto';
  return null;
}

export async function fetchAndStoreRates(db: Kysely<Database>): Promise<void> {
  const [ratesResponse, namesResponse] = await Promise.all([
    fetch(RATES_URL),
    fetch(NAMES_URL),
  ]);

  if (!ratesResponse.ok || !namesResponse.ok) {
    throw new Error(`API fetch failed: rates=${ratesResponse.status}, names=${namesResponse.status}`);
  }

  const ratesData = ExchangeRateResponseSchema.parse(await ratesResponse.json());
  const namesData = CurrencyNamesResponseSchema.parse(await namesResponse.json());

  const now = new Date().toISOString();
  const usdRates = ratesData.usd;

  // Upsert currencies
  const currencyRows: Array<{ code: string; name: string; type: 'fiat' | 'crypto'; provider: string }> = [];
  currencyRows.push({ code: 'USD', name: namesData['usd'] || 'US Dollar', type: 'fiat', provider: 'fawazahmed0' });

  for (const [code, _rate] of Object.entries(usdRates)) {
    const type = isKnownCurrency(code);
    if (!type) continue;
    const upperCode = code.toUpperCase();
    const name = namesData[code] || upperCode;
    currencyRows.push({ code: upperCode, name, type, provider: 'fawazahmed0' });
  }

  for (const row of currencyRows) {
    await db
      .insertInto('currencies')
      .values(row)
      .onConflict((oc) => oc.column('code').doUpdateSet({ name: row.name, type: row.type, provider: row.provider }))
      .execute();
  }

  // Upsert rates and insert history
  const rateRows: Array<{ source: string; target: string; rate: number; provider: string; updated_at: string }> = [];
  const historyRows: Array<{ source: string; target: string; rate: number; provider: string; recorded_at: string }> = [];

  for (const [code, rate] of Object.entries(usdRates)) {
    const type = isKnownCurrency(code);
    if (!type) continue;
    const upperCode = code.toUpperCase();

    if (type === 'fiat') {
      rateRows.push({ source: 'USD', target: upperCode, rate, provider: 'fawazahmed0', updated_at: now });
      historyRows.push({ source: 'USD', target: upperCode, rate, provider: 'fawazahmed0', recorded_at: now });
    } else {
      const invertedRate = 1 / rate;
      rateRows.push({ source: upperCode, target: 'USD', rate: invertedRate, provider: 'fawazahmed0', updated_at: now });
      historyRows.push({ source: upperCode, target: 'USD', rate: invertedRate, provider: 'fawazahmed0', recorded_at: now });
    }
  }

  for (const row of rateRows) {
    await db
      .insertInto('rates')
      .values(row)
      .onConflict((oc) =>
        oc.columns(['source', 'target']).doUpdateSet({
          rate: row.rate,
          provider: row.provider,
          updated_at: row.updated_at,
        })
      )
      .execute();
  }

  if (historyRows.length > 0) {
    await db.insertInto('rate_history').values(historyRows).execute();
  }
}
