import type {
  AvailableCurrenciesResponse,
  ConversionResponse,
  RateHistoryResponse,
  RatesApiResponse
} from "./types";

const readErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
};

const requestJson = async <TResponse>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<TResponse> => {
  const response = await fetch(input, init);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as TResponse;
};

export const fetchAvailableCurrencies = async (): Promise<AvailableCurrenciesResponse> => {
  return requestJson<AvailableCurrenciesResponse>("/api/available_currencies");
};

export const fetchRates = async (pairs: string[]): Promise<RatesApiResponse> => {
  const params = new URLSearchParams({
    pairs: pairs.join(",")
  });

  return requestJson<RatesApiResponse>(`/api/rates?${params.toString()}`);
};

export const fetchRateHistory = async (
  pairs: string[],
  limit = 60
): Promise<RateHistoryResponse> => {
  const params = new URLSearchParams({
    limit: String(limit),
    pairs: pairs.join(",")
  });

  return requestJson<RateHistoryResponse>(`/api/rate_history?${params.toString()}`);
};

export const submitConversion = async (payload: {
  amount: number;
  source: string;
  target: string;
}): Promise<ConversionResponse> => {
  return requestJson<ConversionResponse>("/api/convert", {
    body: JSON.stringify(payload),
    headers: {
      "content-type": "application/json"
    },
    method: "POST"
  });
};

