import dollarSign from '../assets/dollar-sign.svg';
import { useStore } from '../store';

export default function Header() {
  const connectionStatus = useStore((s) => s.connectionStatus);

  const dotColor =
    connectionStatus === 'connected'
      ? 'bg-green-500'
      : connectionStatus === 'reconnecting'
        ? 'bg-yellow-500'
        : 'bg-red-500';

  return (
    <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <img src={dollarSign} alt="CurrencyX" className="w-8 h-8 animate-spin" style={{ animationDuration: '3s' }} />
        <span className="text-xl font-bold tracking-tight">CurrencyX</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
        <span className="capitalize">{connectionStatus}</span>
      </div>
    </header>
  );
}
