import { describe, expect, test } from "bun:test";

import { convertWithRateResolver, type RateResolver } from "../lib/conversion";

describe("conversion logic", () => {
  const resolver: RateResolver = (source, target) => {
    const directRates: Record<string, number> = {
      "BTC/USD": 66_000,
      "USD/EUR": 0.92
    };

    const direct = directRates[`${source}/${target}`];
    if (direct) {
      return Promise.resolve({
        inverted: false,
        provider: "fawazahmed0",
        rate: direct,
        requestedPair: `${source}/${target}`,
        source,
        storedPair: `${source}/${target}`,
        target,
        updated_at: "2026-04-03T12:00:00.000Z"
      });
    }

    const inverse = directRates[`${target}/${source}`];
    if (!inverse) {
      return Promise.resolve(null);
    }

    return Promise.resolve({
      inverted: true,
      provider: "fawazahmed0",
      rate: 1 / inverse,
      requestedPair: `${source}/${target}`,
      source,
      storedPair: `${target}/${source}`,
      target,
      updated_at: "2026-04-03T12:00:00.000Z"
    });
  };

  test("converts across crypto and fiat via USD", async () => {
    const result = await convertWithRateResolver(resolver, "BTC", "EUR", 0.5);

    expect(result).not.toBeNull();
    expect(result?.via_usd).toBe(true);
    expect(result?.rate).toBeCloseTo(66_000 * 0.92, 6);
    expect(result?.result).toBeCloseTo(0.5 * 66_000 * 0.92, 6);
  });

  test("supports inverse-only direct conversions", async () => {
    const result = await convertWithRateResolver(resolver, "EUR", "USD", 100);

    expect(result).not.toBeNull();
    expect(result?.via_usd).toBe(false);
    expect(result?.rate).toBeCloseTo(1 / 0.92, 8);
  });
});
