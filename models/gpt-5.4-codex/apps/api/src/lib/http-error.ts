export class HttpError extends Error {
  public readonly details?: unknown;
  public readonly status: number;

  public constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
  }
}

