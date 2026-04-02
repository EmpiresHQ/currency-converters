import type { ConnectionStatus, RatesUpdateMessage } from "./types";

interface SocketHandlers {
  onRates: (message: RatesUpdateMessage) => void;
  onStatusChange: (status: ConnectionStatus) => void;
}

const buildSocketUrl = (): string => {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}/ws`;
};

const isRatesUpdateMessage = (value: unknown): value is RatesUpdateMessage => {
  if (typeof value !== "object" || value === null || !("type" in value)) {
    return false;
  }

  if (value.type !== "rates_update" || !("rates" in value)) {
    return false;
  }

  return Array.isArray(value.rates);
};

export const connectRateSocket = (handlers: SocketHandlers): (() => void) => {
  let disposed = false;
  let reconnectTimer: number | null = null;
  let socket: WebSocket | null = null;
  let attempts = 0;

  const cleanupReconnect = () => {
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (disposed) {
      return;
    }

    attempts += 1;
    handlers.onStatusChange("reconnecting");
    const delay = Math.min(10_000, 750 * 2 ** (attempts - 1));

    reconnectTimer = window.setTimeout(() => {
      connect();
    }, delay);
  };

  const connect = () => {
    cleanupReconnect();
    socket = new WebSocket(buildSocketUrl());

    socket.addEventListener("open", () => {
      attempts = 0;
      handlers.onStatusChange("connected");
    });

    socket.addEventListener("message", (event) => {
      try {
        if (typeof event.data !== "string") {
          return;
        }

        const parsed: unknown = JSON.parse(event.data);

        if (isRatesUpdateMessage(parsed)) {
          handlers.onRates(parsed);
        }
      } catch {
        // Ignore malformed payloads from the socket.
      }
    });

    socket.addEventListener("close", () => {
      if (disposed) {
        return;
      }

      scheduleReconnect();
    });

    socket.addEventListener("error", () => {
      handlers.onStatusChange("reconnecting");
      socket?.close();
    });
  };

  handlers.onStatusChange("reconnecting");
  connect();

  return () => {
    disposed = true;
    cleanupReconnect();
    handlers.onStatusChange("disconnected");
    socket?.close();
  };
};
