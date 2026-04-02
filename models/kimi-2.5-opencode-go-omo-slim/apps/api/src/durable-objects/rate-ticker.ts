export class RateTicker {
  private state: DurableObjectState;
  private connections: Set<WebSocket> = new Set();
  private alarmInterval: number = 30000; // 30 seconds

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/internal/notify') {
      // Internal notification from scheduled handler
      await this.broadcastRates();
      return new Response('OK');
    }

    if (url.pathname === '/ws' || url.pathname === '/') {
      // WebSocket upgrade request
      return this.handleWebSocket(request);
    }

    return new Response('Not found', { status: 404 });
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected websocket upgrade', { status: 400 });
    }

    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];

    this.connections.add(server);

    server.addEventListener('open', () => {
      console.log('WebSocket connection opened');
      // Send initial heartbeat
      server.send(JSON.stringify({ type: 'connected' }));
    });

    server.addEventListener('close', () => {
      console.log('WebSocket connection closed');
      this.connections.delete(server);
    });

    server.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      this.connections.delete(server);
    });

    // Set up alarm for heartbeat
    await this.scheduleAlarm();

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private async scheduleAlarm(): Promise<void> {
    const existingAlarm = await this.state.storage.getAlarm();
    if (existingAlarm === null) {
      await this.state.storage.setAlarm(Date.now() + this.alarmInterval);
    }
  }

  async alarm(): Promise<void> {
    // Send heartbeat to all connections
    this.broadcast({ type: 'heartbeat', timestamp: Date.now() });
    
    // Schedule next alarm
    await this.state.storage.setAlarm(Date.now() + this.alarmInterval);
  }

  private async broadcastRates(): Promise<void> {
    this.broadcast({ type: 'rates_updated', timestamp: Date.now() });
  }

  private broadcast(message: unknown): void {
    const data = JSON.stringify(message);
    const deadConnections: WebSocket[] = [];

    for (const ws of this.connections) {
      try {
        ws.send(data);
      } catch {
        deadConnections.push(ws);
      }
    }

    // Clean up dead connections
    for (const ws of deadConnections) {
      this.connections.delete(ws);
    }
  }
}
