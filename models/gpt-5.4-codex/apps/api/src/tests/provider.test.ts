import { describe, expect, test } from "bun:test";

import { normalizeProviderSnapshot } from "../lib/provider";

describe("normalizeProviderSnapshot", () => {
  test("stores fiat directly and inverts crypto rates into X/USD", () => {
    const parsed = normalizeProviderSnapshot(
      {
        date: "2026-04-03",
        usd: {
          btc: 0.000015,
          eth: 0.00045,
          eur: 0.92,
          gbp: 0.79,
          sol: 0.0069,
          xrp: 1.91
        }
      },
      {
        btc: "Bitcoin",
        eth: "Ethereum",
        eur: "Euro",
        gbp: "British Pound Sterling",
        sol: "Solana",
        usd: "United States Dollar",
        xrp: "XRP"
      },
      "2026-04-03T12:00:00.000Z"
    );

    expect(parsed.currencies.some((currency) => currency.code === "USD")).toBe(true);
    const eurRate = parsed.rates.find(
      (rate) => rate.source === "USD" && rate.target === "EUR"
    );
    const btcRate = parsed.rates.find(
      (rate) => rate.source === "BTC" && rate.target === "USD"
    );

    expect(eurRate?.rate).toBe(0.92);
    expect(btcRate?.rate).toBe(1 / 0.000015);
  });

  test("falls back when provider returns blank currency names", () => {
    const parsed = normalizeProviderSnapshot(
      {
        date: "2026-04-03",
        usd: {
          btc: 0.000015,
          eur: 0.92
        }
      },
      {
        btc: "",
        eur: "   ",
        usd: ""
      },
      "2026-04-03T12:00:00.000Z"
    );

    const usd = parsed.currencies.find((currency) => currency.code === "USD");
    const eur = parsed.currencies.find((currency) => currency.code === "EUR");
    const btc = parsed.currencies.find((currency) => currency.code === "BTC");

    expect(usd?.name).toBe("United States Dollar");
    expect(eur?.name).toBe("Euro");
    expect(btc?.name).toBe("Bitcoin");
  });
});
