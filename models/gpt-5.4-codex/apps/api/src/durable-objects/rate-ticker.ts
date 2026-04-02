import { HEARTBEAT_INTERVAL_MS } from "../lib/constants";

interface RateBroadcastPayload {
  rates: Array<{
    rate: number;
    source: string;
    target: string;
    updated_at: string;
  }>;
  timestamp: string;
  type: "rates_update";
}

export class RateTicker {
  private readonly ctx: DurableObjectState;

  public constructor(ctx: DurableObjectState) {
    this.ctx = ctx;
  }

  public async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      return this.handleWebSocket(request);
    }

    if (url.pathname === "/broadcast" && request.method === "POST") {
      return this.handleBroadcast(request);
    }

    if (url.pathname === "/health") {
      return Response.json({
        connections: this.ctx.getWebSockets().length
      });
    }

    return new Response("Not found", { status: 404 });
  }

  public async alarm(): Promise<void> {
    const sockets = this.ctx.getWebSockets();
    if (sockets.length === 0) {
      return;
    }

    const heartbeat = JSON.stringify({
      timestamp: new Date().toISOString(),
      type: "heartbeat"
    });

    for (const socket of sockets) {
      try {
        socket.send(heartbeat);
      } catch {
        try {
          socket.close(1011, "Heartbeat failed");
        } catch {
          // Ignore close failures on stale sockets.
        }
      }
    }

    await this.scheduleHeartbeat();
  }

  public webSocketMessage(webSocket: WebSocket, message: ArrayBuffer | string): void {
    if (typeof message === "string" && message === "ping") {
      webSocket.send(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          type: "pong"
        })
      );
    }
  }

  public webSocketClose(): void {
    if (this.ctx.getWebSockets().length > 0) {
      void this.scheduleHeartbeat();
    }
  }

  public webSocketError(webSocket: WebSocket): void {
    try {
      webSocket.close(1011, "WebSocket error");
    } catch {
      // Ignore errors on already-closed sockets.
    }
  }

  private async handleBroadcast(request: Request): Promise<Response> {
    const payload: RateBroadcastPayload = await request.json();
    const message = JSON.stringify(payload);
    const sockets = this.ctx.getWebSockets();

    for (const socket of sockets) {
      try {
        socket.send(message);
      } catch {
        try {
          socket.close(1011, "Broadcast failed");
        } catch {
          // Ignore close failures on stale sockets.
        }
      }
    }

    if (sockets.length > 0) {
      await this.scheduleHeartbeat();
    }

    return Response.json({
      connections: sockets.length,
      ok: true
    });
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected websocket upgrade", { status: 426 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.ctx.acceptWebSocket(server);
    await this.scheduleHeartbeat();

    server.send(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        type: "connection"
      })
    );

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  private async scheduleHeartbeat(): Promise<void> {
    await this.ctx.storage.setAlarm(Date.now() + HEARTBEAT_INTERVAL_MS);
  }
}
