import { useStore } from '../store';

export default function RecentConversions() {
  const recentConversions = useStore((s) => s.recentConversions);
  const clearHistory = useStore((s) => s.clearHistory);

  if (recentConversions.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Recent Conversions</h2>
        <button
          type="button"
          onClick={clearHistory}
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          Clear history
        </button>
      </div>
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left px-4 py-2 font-medium">From</th>
              <th className="text-left px-4 py-2 font-medium">To</th>
              <th className="text-right px-4 py-2 font-medium">Amount</th>
              <th className="text-right px-4 py-2 font-medium">Result</th>
              <th className="text-center px-4 py-2 font-medium">Via USD?</th>
            </tr>
          </thead>
          <tbody>
            {recentConversions.map((c, i) => (
              <tr key={i} className="border-b border-gray-700/50 last:border-b-0">
                <td className="px-4 py-2">{c.source}</td>
                <td className="px-4 py-2">{c.target}</td>
                <td className="px-4 py-2 text-right">
                  {new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(c.amount)}
                </td>
                <td className="px-4 py-2 text-right">
                  {new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(c.result)}
                </td>
                <td className="px-4 py-2 text-center">{c.via_usd ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
