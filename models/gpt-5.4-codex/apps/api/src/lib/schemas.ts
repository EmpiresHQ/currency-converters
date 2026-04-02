import { z } from "zod";

import {
  DASHBOARD_PAIRS,
  DEFAULT_HISTORY_LIMIT,
  MAX_HISTORY_LIMIT,
  MAX_QUERY_PAIRS
} from "./constants";

export const currencyCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[A-Z0-9]{3,10}$/.test(value), {
    message: "Currency code must contain 3-10 uppercase letters or digits"
  });

const pairSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[A-Z0-9]{3,10}\/[A-Z0-9]{3,10}$/.test(value), {
    message: "Pair must match SOURCE/TARGET"
  });

const pairsListSchema = z
  .array(pairSchema)
  .min(1, "At least one pair is required")
  .max(MAX_QUERY_PAIRS, `No more than ${MAX_QUERY_PAIRS} pairs are allowed`);

export const convertRequestSchema = z.object({
  amount: z.coerce.number().positive().finite(),
  source: currencyCodeSchema,
  target: currencyCodeSchema
});

export const pairsQuerySchema = z.object({
  pairs: z.preprocess((value) => {
    if (typeof value !== "string" || value.trim() === "") {
      return [...DASHBOARD_PAIRS];
    }

    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }, pairsListSchema)
});

export const rateHistoryQuerySchema = z.object({
  limit: z.preprocess((value) => {
    if (typeof value !== "string" || value.trim() === "") {
      return DEFAULT_HISTORY_LIMIT;
    }

    return Number(value);
  }, z.number().int().positive().max(MAX_HISTORY_LIMIT)),
  pairs: z.preprocess((value) => {
    if (typeof value !== "string" || value.trim() === "") {
      return [...DASHBOARD_PAIRS];
    }

    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }, pairsListSchema)
});

export const providerRatesSchema = z.object({
  date: z.string().min(1),
  usd: z.record(z.number().positive())
});

export const providerNamesSchema = z.record(z.string());

export type ConvertRequest = z.infer<typeof convertRequestSchema>;
export type PairsQuery = z.infer<typeof pairsQuerySchema>;
export type RateHistoryQuery = z.infer<typeof rateHistoryQuerySchema>;
