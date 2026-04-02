import type { Kysely } from 'kysely';
import type { Database, Currency, Rate } from '../db/types';
import {
  fawazRatesResponseSchema,
  fawazNamesResponseSchema,
  type FawazRatesResponse,
  type FawazNamesResponse,
} from '../validation/schemas';

const RATES_URL = 'https://latest.currency-api.pages.dev/v1/currencies/usd.json';
const NAMES_URL = 'https://latest.currency-api.pages.dev/v1/currencies.json';

// Known fiat currencies to filter for
const KNOWN_FIAT = new Set([
  'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'AUD', 'CAD', 'CHF', 'SEK', 'NZD',
  'MXN', 'SGD', 'HKD', 'NOK', 'KRW', 'TRY', 'INR', 'RUB', 'BRL', 'ZAR',
  'AED', 'SAR', 'PLN', 'THB', 'IDR', 'HUF', 'CZK', 'ILS', 'CLP', 'PHP',
  'EGP', 'MYR', 'RON', 'DKK', 'COP', 'ARS', 'PEN', 'VND', 'NGN', 'PKR',
  'BDT', 'UAH', 'QAR', 'KWD', 'DZD', 'KZT', 'OMR', 'JOD', 'BHD', 'MAD',
  'TWD', 'ISK'
]);

// Crypto currencies we support
const SUPPORTED_CRYPTO = new Set(['BTC', 'ETH', 'SOL', 'XRP']);

interface RateData {
  source: string;
  target: string;
  rate: number;
  type: 'fiat' | 'crypto';
}

export async function fetchAndStoreRates(db: Kysely<Database>): Promise<void> {
  const [ratesResponse, namesResponse] = await Promise.all([
    fetch(RATES_URL),
    fetch(NAMES_URL),
  ]);

  if (!ratesResponse.ok) {
    throw new Error(`Failed to fetch rates: ${ratesResponse.status}`);
  }
  if (!namesResponse.ok) {
    throw new Error(`Failed to fetch names: ${namesResponse.status}`);
  }

  const ratesData: unknown = await ratesResponse.json();
  const namesData: unknown = await namesResponse.json();

  const parsedRates = fawazRatesResponseSchema.parse(ratesData);
  const parsedNames = fawazNamesResponseSchema.parse(namesData);

  const { currencies, rates } = processRateData(parsedRates, parsedNames);

  // Insert currencies
  for (const currency of currencies) {
    await db
      .insertInto('currencies')
      .values(currency)
      .onConflict((oc) => oc.column('code').doUpdateSet({
        name: currency.name,
        type: currency.type,
        provider: currency.provider,
      }))
      .execute();
  }

  const now = new Date().toISOString();

  // Insert rates
  for (const rate of rates) {
    await db
      .insertInto('rates')
      .values({
        source: rate.source,
        target: rate.target,
        rate: rate.rate,
        provider: 'fawazahmed0',
        updated_at: now,
      })
      .onConflict((oc) => oc.columns(['source', 'target']).doUpdateSet({
        rate: rate.rate,
        updated_at: now,
      }))
      .execute();

    // Insert into history
    await db
      .insertInto('rate_history')
      .values({
        source: rate.source,
        target: rate.target,
        rate: rate.rate,
        provider: 'fawazahmed0',
        recorded_at: now,
      })
      .execute();
  }
}

function processRateData(
  ratesData: FawazRatesResponse,
  namesData: FawazNamesResponse
): { currencies: Currency[]; rates: RateData[] } {
  const currencies: Currency[] = [];
  const rates: RateData[] = [];

  // Add USD first
  currencies.push({
    code: 'USD',
    name: 'US Dollar',
    type: 'fiat',
    provider: 'fawazahmed0',
  });

  for (const [code, rate] of Object.entries(ratesData.usd)) {
    const upperCode = code.toUpperCase();
    const name = namesData[code] || upperCode;

    const isKnownFiat = KNOWN_FIAT.has(upperCode);
    const isSupportedCrypto = SUPPORTED_CRYPTO.has(upperCode);

    if (!isKnownFiat && !isSupportedCrypto) {
      continue;
    }

    const type: 'fiat' | 'crypto' = isSupportedCrypto ? 'crypto' : 'fiat';

    currencies.push({
      code: upperCode,
      name,
      type,
      provider: 'fawazahmed0',
    });

    if (type === 'fiat') {
      // Store as USD -> X (direct from API)
      rates.push({
        source: 'USD',
        target: upperCode,
        rate,
        type: 'fiat',
      });
    } else {
      // Crypto: invert the rate (API gives USD -> BTC, we store BTC -> USD)
      if (rate > 0) {
        rates.push({
          source: upperCode,
          target: 'USD',
          rate: 1 / rate,
          type: 'crypto',
        });
      }
    }
  }

  return { currencies, rates };
}

export async function notifyRateTicker(rateTicker: DurableObjectNamespace): Promise<void> {
  const id = rateTicker.idFromName('singleton');
  const stub = rateTicker.get(id);
  
  await stub.fetch('http://internal/notify', {
    method: 'POST',
  });
}
