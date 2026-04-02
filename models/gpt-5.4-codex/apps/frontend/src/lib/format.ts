import type { DashboardRate } from "./types";

const FiatCurrencySymbols: Record<string, string> = {
  AED: "AED ",
  AUD: "A$",
  BRL: "R$",
  CAD: "C$",
  CHF: "CHF ",
  CNY: "CN¥",
  EUR: "€",
  GBP: "£",
  HKD: "HK$",
  JPY: "¥",
  MXN: "MX$",
  NZD: "NZ$",
  SGD: "S$",
  USD: "$",
  ZAR: "R "
};

export const formatNumericValue = (value: number): string => {
  const absolute = Math.abs(value);

  if (absolute >= 1_000) {
    return value.toLocaleString(undefined, {
      maximumFractionDigits: 0
    });
  }

  if (absolute >= 100) {
    return value.toLocaleString(undefined, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2
    });
  }

  if (absolute >= 1) {
    return value.toLocaleString(undefined, {
      maximumFractionDigits: 4,
      minimumFractionDigits: 4
    });
  }

  return value.toLocaleString(undefined, {
    maximumFractionDigits: 6,
    minimumFractionDigits: 4
  });
};

export const formatPairRate = (pair: string, value: number): string => {
  const [, target] = pair.split("/");
  const symbol = target ? FiatCurrencySymbols[target] ?? "" : "";
  return `${symbol}${formatNumericValue(value)}`;
};

export const formatChange = (value: number | null): string => {
  if (value === null || !Number.isFinite(value)) {
    return "0.0%";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
};

export const formatConversionResult = (value: number, code: string): string => {
  const symbol = FiatCurrencySymbols[code] ?? "";
  return `${symbol}${formatNumericValue(value)} ${symbol ? "" : code}`.trim();
};

export const formatAmountWithCode = (value: number, code: string): string => {
  return `${formatNumericValue(value)} ${code}`;
};

export const getTrendDirection = (
  rate: DashboardRate | undefined
): "flat" | "down" | "up" => {
  if (!rate?.previousRate || rate.rate === rate.previousRate) {
    return "flat";
  }

  return rate.rate > rate.previousRate ? "up" : "down";
};

