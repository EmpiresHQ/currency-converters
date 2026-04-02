import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { z } from "zod";

import worker from "../index";
import type { AppBindings } from "../lib/app-types";
import { createTestDatabase } from "./test-db";

const ratesPayloadSchema = z.object({
  missing: z.array(z.string()),
  rates: z.array(
    z.object({
      rate: z.number(),
      requestedPair: z.string()
    })
  )
});

const convertPayloadSchema = z.object({
  result: z.number(),
  via_usd: z.boolean()
});

const createExecutionContext = (): ExecutionContext =>
  ({
    passThroughOnException() {
      return undefined;
    },
    props: undefined,
    waitUntil() {
      return undefined;
    }
  }) as unknown as ExecutionContext;

describe("worker routes", () => {
  let dispose: (() => Promise<void>) | undefined;
  let env: AppBindings;

  beforeEach(async () => {
    const testDb = await createTestDatabase();
    dispose = testDb.dispose;

    await testDb.rawDb.exec(
      "INSERT INTO currencies (code, name, type, provider) VALUES ('USD', 'United States Dollar', 'fiat', 'fawazahmed0'), ('EUR', 'Euro', 'fiat', 'fawazahmed0'), ('BTC', 'Bitcoin', 'crypto', 'fawazahmed0')"
    );

    await testDb.rawDb.exec(
      "INSERT INTO rates (source, target, rate, provider, updated_at) VALUES ('USD', 'EUR', 0.92, 'fawazahmed0', '2026-04-03T12:00:00.000Z'), ('BTC', 'USD', 66000, 'fawazahmed0', '2026-04-03T12:00:00.000Z')"
    );

    env = {
      ASSETS: {
        fetch: () => Promise.resolve(new Response("asset"))
      } as unknown as Fetcher,
      DB: testDb.rawDb,
      RATE_TICKER: {
        get() {
          return {
            fetch: () => Promise.resolve(new Response(null, { status: 200 }))
          } as unknown as DurableObjectStub;
        },
        idFromName() {
          return {} as DurableObjectId;
        }
      } as unknown as DurableObjectNamespace
    };
  });

  afterEach(async () => {
    await dispose?.();
  });

  test("returns requested rates and converts through USD", async () => {
    const ratesResponse = await worker.fetch(
      new Request("https://example.com/api/rates?pairs=EUR/USD,BTC/USD"),
      env,
      createExecutionContext()
    );

    expect(ratesResponse.status).toBe(200);
    const ratesPayload = ratesPayloadSchema.parse(await ratesResponse.json());

    expect(ratesPayload.missing).toEqual([]);
    const eurUsdRate = ratesPayload.rates.find(
      (rate) => rate.requestedPair === "EUR/USD"
    );
    const btcUsdRate = ratesPayload.rates.find(
      (rate) => rate.requestedPair === "BTC/USD"
    );

    expect(eurUsdRate?.rate).toBe(1 / 0.92);
    expect(btcUsdRate?.rate).toBe(66_000);

    const convertResponse = await worker.fetch(
      new Request("https://example.com/api/convert", {
        body: JSON.stringify({
          amount: 0.5,
          source: "BTC",
          target: "EUR"
        }),
        headers: {
          "content-type": "application/json"
        },
        method: "POST"
      }),
      env,
      createExecutionContext()
    );

    expect(convertResponse.status).toBe(200);
    const convertPayload = convertPayloadSchema.parse(await convertResponse.json());

    expect(convertPayload.via_usd).toBe(true);
    expect(convertPayload.result).toBeCloseTo(30_360, 6);
  });
});
