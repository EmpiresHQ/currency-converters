export interface AppBindings {
  ASSETS: Fetcher;
  DB: D1Database;
  RATE_TICKER: DurableObjectNamespace;
}

export interface AppVariables {
  validatedBody: unknown;
  validatedQuery: unknown;
}

export interface AppEnv {
  Bindings: AppBindings;
  Variables: AppVariables;
}

