import { useStore } from '../store';

export function RecentConversions() {
  const recentConversions = useStore((state) => state.recentConversions);
  const clearConversions = useStore((state) => state.clearConversions);

  const formatNumber = (n: number) => {
    return n.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 4 
    });
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (recentConversions.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Conversions</h3>
        <p className="text-gray-500 text-center py-4">No conversions yet</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Recent Conversions</h3>
        <button
          type="button"
          onClick={clearConversions}
          className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 
                     text-gray-300 hover:text-white rounded transition-colors"
        >
          Clear history
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-gray-400 text-sm border-b border-gray-700">
              <th className="pb-2 font-medium">From</th>
              <th className="pb-2 font-medium">To</th>
              <th className="pb-2 font-medium text-right">Amount</th>
              <th className="pb-2 font-medium text-right">Result</th>
              <th className="pb-2 font-medium text-center">Via USD</th>
              <th className="pb-2 font-medium text-right">Time</th>
            </tr>
          </thead>
          <tbody>
            {recentConversions.map((conversion) => (
              <tr key={conversion.id} className="border-b border-gray-700/50 last:border-0">
                <td className="py-3 text-white font-medium">{conversion.from}</td>
                <td className="py-3 text-white font-medium">{conversion.to}</td>
                <td className="py-3 text-right text-gray-300">
                  {formatNumber(conversion.amount)}
                </td>
                <td className="py-3 text-right text-white font-semibold">
                  {formatNumber(conversion.result)}
                </td>
                <td className="py-3 text-center">
                  {conversion.viaUsd ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs 
                                   bg-blue-900 text-blue-300">
                      Yes
                    </span>
                  ) : (
                    <span className="text-gray-500">No</span>
                  )}
                </td>
                <td className="py-3 text-right text-gray-500 text-sm">
                  {formatTime(conversion.timestamp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
