import { useStore } from '../store';

export default function ResultDisplay() {
  const result = useStore((s) => s.conversionResult);
  const error = useStore((s) => s.error);

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 text-red-300">
        {error}
      </div>
    );
  }

  if (!result) return null;

  const fmtAmount = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(result.amount);
  const fmtResult = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(result.result);

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
      <p className="text-xl font-semibold">
        {fmtAmount} {result.source} = {fmtResult} {result.target}
      </p>
      {result.via_usd && (
        <p className="text-sm text-gray-400 mt-1">Converted via USD</p>
      )}
    </div>
  );
}
