export const APP_NAME = "CurrencyX";
export const PROVIDER_NAME = "fawazahmed0";
export const PROVIDER_RATES_URL =
  "https://latest.currency-api.pages.dev/v1/currencies/usd.json";
export const PROVIDER_NAMES_URL =
  "https://latest.currency-api.pages.dev/v1/currencies.json";
export const USD = "USD";
export const RATE_TICKER_OBJECT_NAME = "global-rate-ticker";
export const HEARTBEAT_INTERVAL_MS = 30_000;
export const DEFAULT_HISTORY_LIMIT = 60;
export const MAX_HISTORY_LIMIT = 240;
export const MAX_QUERY_PAIRS = 25;

export const SUPPORTED_FIAT_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "AUD",
  "CAD",
  "CHF",
  "CNY",
  "SEK",
  "NZD",
  "NOK",
  "DKK",
  "PLN",
  "CZK",
  "HUF",
  "RON",
  "TRY",
  "INR",
  "SGD",
  "HKD",
  "MXN",
  "BRL",
  "ZAR",
  "AED"
] as const;

export const SUPPORTED_CRYPTO_CURRENCIES = ["BTC", "ETH", "SOL", "XRP"] as const;

export const SUPPORTED_CURRENCY_CODES = [
  ...SUPPORTED_FIAT_CURRENCIES,
  ...SUPPORTED_CRYPTO_CURRENCIES
] as const;

export const DASHBOARD_PAIRS = [
  "BTC/USD",
  "ETH/USD",
  "EUR/USD",
  "GBP/USD",
  "SOL/USD",
  "XRP/USD"
] as const;

