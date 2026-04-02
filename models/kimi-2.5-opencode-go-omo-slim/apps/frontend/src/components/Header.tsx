import { useStore } from '../store';
import type { ConnectionStatus } from '../types';

function ConnectionIndicator({ status }: { status: ConnectionStatus }) {
  const colorClass = {
    connected: 'bg-green-500',
    connecting: 'bg-yellow-500 animate-pulse',
    disconnected: 'bg-red-500',
  }[status];

  const label = {
    connected: 'Connected',
    connecting: 'Connecting...',
    disconnected: 'Disconnected',
  }[status];

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2.5 h-2.5 rounded-full ${colorClass}`} />
      <span className="text-sm text-gray-400">{label}</span>
    </div>
  );
}

export function Header() {
  const connectionStatus = useStore((state) => state.connectionStatus);

  return (
    <header className="bg-gray-800 border-b border-gray-700 py-4 px-6">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img 
            src="/logo.svg" 
            alt="CurrencyX Logo" 
            className="w-8 h-8 animate-spin-slow"
          />
          <h1 className="text-xl font-bold text-white">CurrencyX</h1>
        </div>
        <ConnectionIndicator status={connectionStatus} />
      </div>
    </header>
  );
}
