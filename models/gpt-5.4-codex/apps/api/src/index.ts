import { Hono } from "hono";

import { createDb } from "./db/client";
import { RateTicker } from "./durable-objects/rate-ticker";
import type { AppEnv } from "./lib/app-types";
import { convertAmount, resolveRateHistory, resolveRequestedRates } from "./lib/conversion";
import { RATE_TICKER_OBJECT_NAME } from "./lib/constants";
import { HttpError } from "./lib/http-error";
import {
  ensureSeeded,
  hasLoadedRates,
  syncRates
} from "./lib/rate-sync";
import {
  type ConvertRequest,
  type PairsQuery,
  type RateHistoryQuery,
  convertRequestSchema,
  pairsQuerySchema,
  rateHistoryQuerySchema
} from "./lib/schemas";
import {
  getValidatedBody,
  getValidatedQuery,
  validateJson,
  validateQuery
} from "./lib/validation";

export { RateTicker };

const app = new Hono<AppEnv>();

app.onError((error, context) => {
  console.error(error);

  if (error instanceof HttpError) {
    return Response.json(
      {
        details: error.details,
        error: error.message
      },
      {
        status: error.status
      }
    );
  }

  return context.json(
    {
      error: "Internal server error"
    },
    500
  );
});

app.use("/api/*", async (context, next) => {
  await ensureSeeded(context.env);
  await next();
});

app.get("/api/available_currencies", async (context) => {
  const db = createDb(context.env.DB);
  const currencies = await db
    .selectFrom("currencies")
    .selectAll()
    .orderBy("type", "asc")
    .orderBy("code", "asc")
    .execute();

  if (currencies.length === 0) {
    throw new HttpError(503, "Currency catalogue has not been loaded yet");
  }

  return context.json({
    currencies
  });
});

app.post("/api/convert", validateJson(convertRequestSchema), async (context) => {
  const db = createDb(context.env.DB);
  const { amount, source, target } = getValidatedBody<ConvertRequest>(context);

  const knownCurrencies = await db
    .selectFrom("currencies")
    .select("code")
    .where("code", "in", [source, target])
    .execute();

  if (knownCurrencies.length !== 2) {
    const known = new Set(knownCurrencies.map((row) => row.code));
    const missing = [source, target].filter((code) => !known.has(code));
    throw new HttpError(400, `Unknown currency code(s): ${missing.join(", ")}`);
  }

  const conversion = await convertAmount(db, source, target, amount);
  if (!conversion) {
    throw new HttpError(404, "No conversion path found");
  }

  return context.json(conversion);
});

app.get("/api/rates", validateQuery(pairsQuerySchema), async (context) => {
  const { pairs } = getValidatedQuery<PairsQuery>(context);

  if (!(await hasLoadedRates(context.env))) {
    throw new HttpError(503, "Rates are not loaded yet");
  }

  const db = createDb(context.env.DB);
  const result = await resolveRequestedRates(db, pairs);

  return context.json(result);
});

app.get("/api/rate_history", validateQuery(rateHistoryQuerySchema), async (context) => {
  const { limit, pairs } = getValidatedQuery<RateHistoryQuery>(context);

  if (!(await hasLoadedRates(context.env))) {
    throw new HttpError(503, "Rates are not loaded yet");
  }

  const db = createDb(context.env.DB);
  const histories = await resolveRateHistory(db, pairs, limit);

  return context.json({
    histories
  });
});

app.get("/ws", async (context) => {
  const id = context.env.RATE_TICKER.idFromName(RATE_TICKER_OBJECT_NAME);
  const stub = context.env.RATE_TICKER.get(id);
  return stub.fetch(context.req.raw);
});

app.all("*", async (context) => {
  return context.env.ASSETS.fetch(context.req.raw);
});

const runScheduledSync = async (env: AppEnv["Bindings"]): Promise<void> => {
  try {
    await syncRates(env);
  } catch (error) {
    console.error("Scheduled rate sync failed", error);
  }
};

export default {
  fetch: app.fetch,
  scheduled: (
    _event: ScheduledEvent,
    env: AppEnv["Bindings"],
    context: ExecutionContext
  ) => {
    context.waitUntil(runScheduledSync(env));
  }
};
