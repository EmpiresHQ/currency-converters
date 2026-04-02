import type { Kysely } from "kysely";

import { createDb } from "../db/client";
import type { Database } from "../db/types";
import type { AppBindings } from "./app-types";
import { PROVIDER_NAMES_URL, PROVIDER_RATES_URL, RATE_TICKER_OBJECT_NAME } from "./constants";
import { HttpError } from "./http-error";
import { normalizeProviderSnapshot } from "./provider";

export interface BroadcastRate {
  rate: number;
  source: string;
  target: string;
  updated_at: string;
}

const D1_SAFE_SQL_VARIABLES = 90;

let seeded = false;
let seedPromise: Promise<void> | null = null;

const chunkArray = <TValue>(items: TValue[], size: number): TValue[][] => {
  const chunks: TValue[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

const countRows = async (
  db: Kysely<Database>,
  table: "currencies" | "rates",
  type?: "crypto" | "fiat"
): Promise<number> => {
  const query =
    table === "currencies" && type
      ? db
          .selectFrom("currencies")
          .select(({ fn }) => fn.countAll<number>().as("count"))
          .where("type", "=", type)
      : db.selectFrom(table).select(({ fn }) => fn.countAll<number>().as("count"));

  const row = await query.executeTakeFirstOrThrow();
  return Number(row.count);
};

const upsertCurrencies = async (
  db: Kysely<Database>,
  currencies: Awaited<ReturnType<typeof normalizeProviderSnapshot>>["currencies"]
): Promise<void> => {
  if (currencies.length === 0) {
    return;
  }

  const chunkSize = Math.floor(D1_SAFE_SQL_VARIABLES / 4);

  for (const chunk of chunkArray(currencies, chunkSize)) {
    await db
      .insertInto("currencies")
      .values(chunk)
      .onConflict((conflict) =>
        conflict.column("code").doUpdateSet((expressionBuilder) => ({
          name: expressionBuilder.ref("excluded.name"),
          provider: expressionBuilder.ref("excluded.provider"),
          type: expressionBuilder.ref("excluded.type")
        }))
      )
      .execute();
  }
};

const upsertRates = async (
  db: Kysely<Database>,
  rates: Awaited<ReturnType<typeof normalizeProviderSnapshot>>["rates"]
): Promise<void> => {
  if (rates.length === 0) {
    return;
  }

  const chunkSize = Math.floor(D1_SAFE_SQL_VARIABLES / 5);

  for (const chunk of chunkArray(rates, chunkSize)) {
    await db
      .insertInto("rates")
      .values(chunk)
      .onConflict((conflict) =>
        conflict.columns(["source", "target"]).doUpdateSet((expressionBuilder) => ({
          provider: expressionBuilder.ref("excluded.provider"),
          rate: expressionBuilder.ref("excluded.rate"),
          updated_at: expressionBuilder.ref("excluded.updated_at")
        }))
      )
      .execute();
  }
};

const insertRateHistory = async (
  db: Kysely<Database>,
  rates: Awaited<ReturnType<typeof normalizeProviderSnapshot>>["rates"],
  recordedAt: string
): Promise<void> => {
  if (rates.length === 0) {
    return;
  }

  const historyRows = rates.map((rate) => ({
    provider: rate.provider,
    rate: rate.rate,
    recorded_at: recordedAt,
    source: rate.source,
    target: rate.target
  }));
  const chunkSize = Math.floor(D1_SAFE_SQL_VARIABLES / 5);

  for (const chunk of chunkArray(historyRows, chunkSize)) {
    await db.insertInto("rate_history").values(chunk).execute();
  }
};

const broadcastRates = async (
  env: AppBindings,
  rates: BroadcastRate[],
  timestamp: string
): Promise<void> => {
  if (rates.length === 0) {
    return;
  }

  const objectId = env.RATE_TICKER.idFromName(RATE_TICKER_OBJECT_NAME);
  const stub = env.RATE_TICKER.get(objectId);

  try {
    await stub.fetch("https://rate-ticker.internal/broadcast", {
      body: JSON.stringify({
        rates,
        timestamp,
        type: "rates_update"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
  } catch (error) {
    console.error("Failed to broadcast rate update", error);
  }
};

export const syncRates = async (env: AppBindings): Promise<BroadcastRate[]> => {
  const [ratesResponse, namesResponse] = await Promise.all([
    fetch(PROVIDER_RATES_URL),
    fetch(PROVIDER_NAMES_URL)
  ]);

  if (!ratesResponse.ok || !namesResponse.ok) {
    throw new HttpError(502, "Failed to fetch provider data", {
      namesStatus: namesResponse.status,
      ratesStatus: ratesResponse.status
    });
  }

  const [rawRates, rawNames] = await Promise.all([
    ratesResponse.json(),
    namesResponse.json()
  ]);

  const timestamp = new Date().toISOString();
  const snapshot = normalizeProviderSnapshot(rawRates, rawNames, timestamp);
  const db = createDb(env.DB);

  await upsertCurrencies(db, snapshot.currencies);
  await upsertRates(db, snapshot.rates);
  await insertRateHistory(db, snapshot.rates, timestamp);

  const broadcastPayload = snapshot.rates.map((rate) => ({
    rate: rate.rate,
    source: rate.source,
    target: rate.target,
    updated_at: rate.updated_at
  }));

  await broadcastRates(env, broadcastPayload, timestamp);
  return broadcastPayload;
};

export const ensureSeeded = async (env: AppBindings): Promise<void> => {
  if (seeded) {
    return;
  }

  if (!seedPromise) {
    seedPromise = (async () => {
      const db = createDb(env.DB);
      const [fiatCount, cryptoCount] = await Promise.all([
        countRows(db, "currencies", "fiat"),
        countRows(db, "currencies", "crypto")
      ]);

      if (fiatCount === 0 || cryptoCount === 0) {
        await syncRates(env);
      }

      seeded = true;
    })().finally(() => {
      if (!seeded) {
        seedPromise = null;
      }
    });
  }

  await seedPromise;
};

export const hasLoadedRates = async (env: AppBindings): Promise<boolean> => {
  const db = createDb(env.DB);
  return (await countRows(db, "rates")) > 0;
};
