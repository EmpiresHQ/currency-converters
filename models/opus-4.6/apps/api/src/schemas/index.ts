import { z } from 'zod';

export const ExchangeRateResponseSchema = z.object({
  date: z.string(),
  usd: z.record(z.string(), z.number()),
});

export const CurrencyNamesResponseSchema = z.record(z.string(), z.string());

export const ConvertRequestSchema = z.object({
  source: z.string().min(1).transform((s) => s.toUpperCase()),
  target: z.string().min(1).transform((s) => s.toUpperCase()),
  amount: z.number().positive(),
});

export const RatesQuerySchema = z.object({
  pairs: z.string().min(1),
});

export type ConvertRequest = z.infer<typeof ConvertRequestSchema>;

export type ConvertResponse = {
  source: string;
  target: string;
  amount: number;
  result: number;
  rate: number;
  via_usd: boolean;
  timestamp: string;
};

export type CurrencyDto = {
  code: string;
  name: string;
  type: 'fiat' | 'crypto';
};

export type RateDto = {
  source: string;
  target: string;
  rate: number;
  updated_at: string;
};
