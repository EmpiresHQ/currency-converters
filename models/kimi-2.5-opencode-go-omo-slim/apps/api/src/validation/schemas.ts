import { z } from 'zod';

export const convertSchema = z.object({
  source: z.string().min(1).max(10),
  target: z.string().min(1).max(10),
  amount: z.number().positive(),
});

export type ConvertRequest = z.infer<typeof convertSchema>;

export const rateHistorySchema = z.object({
  source: z.string().min(1).max(10),
  target: z.string().min(1).max(10),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

export type RateHistoryRequest = z.infer<typeof rateHistorySchema>;

export const ratesQuerySchema = z.object({
  pairs: z.string().min(1),
});

export type RatesQueryRequest = z.infer<typeof ratesQuerySchema>;

export const fawazRatesResponseSchema = z.object({
  date: z.string(),
  usd: z.record(z.number()),
});

export const fawazNamesResponseSchema = z.record(z.string());

export type FawazRatesResponse = z.infer<typeof fawazRatesResponseSchema>;
export type FawazNamesResponse = z.infer<typeof fawazNamesResponseSchema>;
