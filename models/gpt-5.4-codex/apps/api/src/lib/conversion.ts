import type { Kysely } from "kysely";

import type { Database } from "../db/types";
import { USD } from "./constants";

export interface ResolvedRate {
  inverted: boolean;
  provider: string;
  rate: number;
  requestedPair: string;
  storedPair: string;
  source: string;
  target: string;
  updated_at: string;
}

export interface ConversionResult {
  amount: number;
  path: string[];
  rate: number;
  result: number;
  source: string;
  target: string;
  via_usd: boolean;
}

export interface RequestedRatesResult {
  missing: string[];
  rates: ResolvedRate[];
}

export interface RateHistoryPoint {
  rate: number;
  recorded_at: string;
}

export type RateHistoryResponse = Record<string, RateHistoryPoint[]>;
export type RateResolver = (
  source: string,
  target: string
) => Promise<ResolvedRate | null>;

export const parsePair = (pair: string): { source: string; target: string } => {
  const [source, target] = pair.split("/");
  if (!source || !target) {
    throw new Error(`Invalid pair: ${pair}`);
  }

  return {
    source,
    target
  };
};

export const findRate = async (
  db: Kysely<Database>,
  source: string,
  target: string
): Promise<ResolvedRate | null> => {
  const direct = await db
    .selectFrom("rates")
    .selectAll()
    .where("source", "=", source)
    .where("target", "=", target)
    .executeTakeFirst();

  if (direct) {
    return {
      inverted: false,
      provider: direct.provider,
      rate: direct.rate,
      requestedPair: `${source}/${target}`,
      source,
      storedPair: `${direct.source}/${direct.target}`,
      target,
      updated_at: direct.updated_at
    };
  }

  const inverse = await db
    .selectFrom("rates")
    .selectAll()
    .where("source", "=", target)
    .where("target", "=", source)
    .executeTakeFirst();

  if (!inverse || inverse.rate === 0) {
    return null;
  }

  return {
    inverted: true,
    provider: inverse.provider,
    rate: 1 / inverse.rate,
    requestedPair: `${source}/${target}`,
    source,
    storedPair: `${inverse.source}/${inverse.target}`,
    target,
    updated_at: inverse.updated_at
  };
};

export const convertWithRateResolver = async (
  resolveRate: RateResolver,
  source: string,
  target: string,
  amount: number
): Promise<ConversionResult | null> => {
  if (source === target) {
    return {
      amount,
      path: [source, target],
      rate: 1,
      result: amount,
      source,
      target,
      via_usd: false
    };
  }

  const direct = await resolveRate(source, target);
  if (direct) {
    return {
      amount,
      path: [source, target],
      rate: direct.rate,
      result: amount * direct.rate,
      source,
      target,
      via_usd: false
    };
  }

  const sourceToUsd = await resolveRate(source, USD);
  const usdToTarget = await resolveRate(USD, target);

  if (!sourceToUsd || !usdToTarget) {
    return null;
  }

  const rate = sourceToUsd.rate * usdToTarget.rate;

  return {
    amount,
    path: [source, USD, target],
    rate,
    result: amount * rate,
    source,
    target,
    via_usd: true
  };
};

export const convertAmount = async (
  db: Kysely<Database>,
  source: string,
  target: string,
  amount: number
): Promise<ConversionResult | null> => {
  return convertWithRateResolver(
    (from, to) => findRate(db, from, to),
    source,
    target,
    amount
  );
};

export const resolveRequestedRates = async (
  db: Kysely<Database>,
  pairs: string[]
): Promise<RequestedRatesResult> => {
  const rates: ResolvedRate[] = [];
  const missing: string[] = [];

  for (const pair of pairs) {
    const { source, target } = parsePair(pair);
    const resolved = await findRate(db, source, target);

    if (!resolved) {
      missing.push(pair);
      continue;
    }

    rates.push(resolved);
  }

  return { missing, rates };
};

export const resolveRateHistory = async (
  db: Kysely<Database>,
  pairs: string[],
  limit: number
): Promise<RateHistoryResponse> => {
  const entries = await Promise.all(
    pairs.map(async (pair) => {
      const { source, target } = parsePair(pair);

      const rows = await db
        .selectFrom("rate_history")
        .select(["recorded_at", "rate", "source", "target"])
        .where((expressionBuilder) =>
          expressionBuilder.or([
            expressionBuilder.and([
              expressionBuilder("source", "=", source),
              expressionBuilder("target", "=", target)
            ]),
            expressionBuilder.and([
              expressionBuilder("source", "=", target),
              expressionBuilder("target", "=", source)
            ])
          ])
        )
        .orderBy("recorded_at", "desc")
        .limit(limit)
        .execute();

      const history = rows
        .reverse()
        .map((row) => ({
          rate:
            row.source === source && row.target === target ? row.rate : 1 / row.rate,
          recorded_at: row.recorded_at
        }))
        .filter((point) => Number.isFinite(point.rate));

      return [pair, history] as const;
    })
  );

  return Object.fromEntries(entries);
};
