import { useEffect } from 'react';
import { Header } from './components/Header';
import { RateDashboard } from './components/RateDashboard';
import { Converter } from './components/Converter';
import { RecentConversions } from './components/RecentConversions';
import { useWebSocket } from './hooks/useWebSocket';
import { useStore } from './store';
import { fetchCurrencies } from './api/client';

function App() {
  const setCurrencies = useStore((state) => state.setCurrencies);
  useWebSocket();

  useEffect(() => {
    // Fetch currencies first (triggers seed if needed)
    const loadCurrencies = async () => {
      try {
        const data = await fetchCurrencies();
        setCurrencies(data);
      } catch (error) {
        console.error('Failed to load currencies:', error);
      }
    };

    loadCurrencies();
  }, [setCurrencies]);

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />
      
      <main className="max-w-6xl mx-auto p-6 space-y-6">
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">Live Rates</h2>
          <RateDashboard />
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-4">Currency Converter</h2>
          <Converter />
        </section>

        <section>
          <RecentConversions />
        </section>
      </main>
    </div>
  );
}

export default App;
