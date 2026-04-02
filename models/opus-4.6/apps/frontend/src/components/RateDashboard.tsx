import RateCard from './RateCard';

const PAIRS = ['BTC/USD', 'ETH/USD', 'EUR/USD', 'GBP/USD', 'SOL/USD', 'XRP/USD'];

export default function RateDashboard() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {PAIRS.map((pair) => (
        <RateCard key={pair} pair={pair} />
      ))}
    </div>
  );
}
