export class RateTicker implements DurableObject {
  private connections: Set<WebSocket> = new Set();

  constructor(private ctx: DurableObjectState, private env: unknown) {
    this.ctx.getWebSockets().forEach((ws) => this.connections.add(ws));
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Internal broadcast trigger from cron
    if (request.method === 'POST' && url.pathname === '/broadcast') {
      const message = JSON.stringify({ type: 'rate_update', timestamp: new Date().toISOString() });
      for (const ws of this.connections) {
        try {
          ws.send(message);
        } catch {
          this.connections.delete(ws);
        }
      }
      return new Response('OK');
    }

    // WebSocket upgrade
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server);
    this.connections.add(server);

    // Set heartbeat alarm
    await this.ctx.storage.setAlarm(Date.now() + 30000);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    // Echo back for now
    ws.send(JSON.stringify({ type: 'pong' }));
  }

  async webSocketClose(ws: WebSocket) {
    this.connections.delete(ws);
  }

  async webSocketError(ws: WebSocket) {
    this.connections.delete(ws);
  }

  async alarm() {
    // Heartbeat ping
    for (const ws of this.connections) {
      try {
        ws.send(JSON.stringify({ type: 'ping' }));
      } catch {
        this.connections.delete(ws);
      }
    }
    // Re-schedule alarm
    if (this.connections.size > 0) {
      await this.ctx.storage.setAlarm(Date.now() + 30000);
    }
  }
}
