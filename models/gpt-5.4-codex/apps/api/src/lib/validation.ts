import type { Context, MiddlewareHandler } from "hono";
import type { ZodTypeAny } from "zod";

import type { AppEnv } from "./app-types";

const formatValidationError = (issues: unknown): Response => {
  return Response.json(
    {
      error: "Validation failed",
      issues
    },
    {
      status: 400
    }
  );
};

export const validateJson = <TSchema extends ZodTypeAny>(
  schema: TSchema
): MiddlewareHandler<AppEnv> => {
  return async (context, next) => {
    let payload: unknown;

    try {
      payload = await context.req.json();
    } catch {
      return Response.json(
        {
          error: "Invalid JSON body"
        },
        {
          status: 400
        }
      );
    }

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      return formatValidationError(parsed.error.flatten());
    }

    context.set("validatedBody", parsed.data);
    await next();
  };
};

export const validateQuery = <TSchema extends ZodTypeAny>(
  schema: TSchema
): MiddlewareHandler<AppEnv> => {
  return async (context, next) => {
    const parsed = schema.safeParse(context.req.query());
    if (!parsed.success) {
      return formatValidationError(parsed.error.flatten());
    }

    context.set("validatedQuery", parsed.data);
    await next();
  };
};

export const getValidatedBody = <TValue>(context: Context<AppEnv>): TValue => {
  return context.get("validatedBody") as TValue;
};

export const getValidatedQuery = <TValue>(context: Context<AppEnv>): TValue => {
  return context.get("validatedQuery") as TValue;
};

