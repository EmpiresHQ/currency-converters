import { describe, expect, test } from "bun:test";

import { convertRequestSchema, pairsQuerySchema, rateHistoryQuerySchema } from "../lib/schemas";

describe("request schemas", () => {
  test("normalizes codes and rejects invalid amounts", () => {
    const parsed = convertRequestSchema.safeParse({
      amount: "100",
      source: "usd",
      target: "eur"
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.source).toBe("USD");
      expect(parsed.data.target).toBe("EUR");
    }

    const invalid = convertRequestSchema.safeParse({
      amount: 0,
      source: "usd",
      target: "eur"
    });

    expect(invalid.success).toBe(false);
  });

  test("supplies defaults for rate queries", () => {
    const pairsQuery = pairsQuerySchema.parse({});
    const historyQuery = rateHistoryQuerySchema.parse({});

    expect(pairsQuery.pairs.length).toBe(6);
    expect(historyQuery.limit).toBe(60);
  });
});

