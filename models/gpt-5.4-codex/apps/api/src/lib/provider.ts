import { PROVIDER_NAME, SUPPORTED_CRYPTO_CURRENCIES, SUPPORTED_CURRENCY_CODES, USD } from "./constants";
import { HttpError } from "./http-error";
import { providerNamesSchema, providerRatesSchema } from "./schemas";

type CurrencyRecord = {
  code: string;
  name: string;
  provider: string;
  type: "crypto" | "fiat";
};

type RateRecord = {
  provider: string;
  rate: number;
  source: string;
  target: string;
  updated_at: string;
};

export interface ParsedProviderSnapshot {
  currencies: CurrencyRecord[];
  providerDate: string;
  rates: RateRecord[];
}

const NAME_FALLBACKS: Record<string, string> = {
  AED: "United Arab Emirates Dirham",
  AUD: "Australian Dollar",
  BRL: "Brazilian Real",
  BTC: "Bitcoin",
  CAD: "Canadian Dollar",
  CHF: "Swiss Franc",
  CNY: "Chinese Yuan",
  CZK: "Czech Koruna",
  DKK: "Danish Krone",
  ETH: "Ethereum",
  EUR: "Euro",
  GBP: "British Pound Sterling",
  HKD: "Hong Kong Dollar",
  HUF: "Hungarian Forint",
  INR: "Indian Rupee",
  JPY: "Japanese Yen",
  MXN: "Mexican Peso",
  NOK: "Norwegian Krone",
  NZD: "New Zealand Dollar",
  PLN: "Polish Zloty",
  RON: "Romanian Leu",
  SEK: "Swedish Krona",
  SGD: "Singapore Dollar",
  SOL: "Solana",
  TRY: "Turkish Lira",
  USD: "United States Dollar",
  XRP: "XRP",
  ZAR: "South African Rand"
};

const isCryptoCode = (code: string): code is (typeof SUPPORTED_CRYPTO_CURRENCIES)[number] => {
  return SUPPORTED_CRYPTO_CURRENCIES.includes(
    code as (typeof SUPPORTED_CRYPTO_CURRENCIES)[number]
  );
};

const resolveCurrencyName = (code: string, rawName: string | undefined): string => {
  const trimmed = rawName?.trim();

  if (trimmed && trimmed.length > 0) {
    return trimmed;
  }

  return NAME_FALLBACKS[code] ?? code;
};

export const normalizeProviderSnapshot = (
  rawRates: unknown,
  rawNames: unknown,
  updatedAt: string
): ParsedProviderSnapshot => {
  const ratesPayload = providerRatesSchema.parse(rawRates);
  const namesPayload = providerNamesSchema.parse(rawNames);

  const currencies: CurrencyRecord[] = [];
  const rates: RateRecord[] = [];
  const usdName = resolveCurrencyName(USD, namesPayload.usd);

  for (const code of SUPPORTED_CURRENCY_CODES) {
    if (code === USD) {
      currencies.push({
        code,
        name: usdName,
        provider: PROVIDER_NAME,
        type: "fiat"
      });
      continue;
    }

    const lowerCode = code.toLowerCase();
    const rawRate = ratesPayload.usd[lowerCode];

    if (!rawRate || !Number.isFinite(rawRate) || rawRate <= 0) {
      continue;
    }

    const resolvedName = resolveCurrencyName(code, namesPayload[lowerCode]);

    currencies.push({
      code,
      name: resolvedName,
      provider: PROVIDER_NAME,
      type: isCryptoCode(code) ? "crypto" : "fiat"
    });

    if (isCryptoCode(code)) {
      rates.push({
        provider: PROVIDER_NAME,
        rate: 1 / rawRate,
        source: code,
        target: USD,
        updated_at: updatedAt
      });
    } else {
      rates.push({
        provider: PROVIDER_NAME,
        rate: rawRate,
        source: USD,
        target: code,
        updated_at: updatedAt
      });
    }
  }

  if (rates.length === 0) {
    throw new HttpError(502, "Provider response did not include any supported rates");
  }

  return {
    currencies,
    providerDate: ratesPayload.date,
    rates
  };
};
