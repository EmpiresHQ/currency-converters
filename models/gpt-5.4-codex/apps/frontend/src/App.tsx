import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";

import { startTransition, useEffect } from "react";

import { fetchAvailableCurrencies, fetchRateHistory, fetchRates } from "./lib/api";
import { DASHBOARD_PAIRS } from "./lib/dashboard-pairs";
import { connectRateSocket } from "./lib/ws";
import { Converter } from "./components/Converter";
import { Header } from "./components/Header";
import { RateDashboard } from "./components/RateDashboard";
import { RecentConversionsTable } from "./components/RecentConversionsTable";
import { useAppStore } from "./store/use-app-store";

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : "Unexpected error";
};

export const App = () => {
  const clearHistory = useAppStore((state) => state.clearHistory);
  const connectionStatus = useAppStore((state) => state.connectionStatus);
  const currencies = useAppStore((state) => state.currencies);
  const isInitializing = useAppStore((state) => state.isInitializing);
  const ratesByPair = useAppStore((state) => state.ratesByPair);
  const recentConversions = useAppStore((state) => state.recentConversions);
  const runtimeError = useAppStore((state) => state.runtimeError);

  useEffect(() => {
    let cancelled = false;
    let disconnectSocket: (() => void) | undefined;

    const {
      applyRateHistory,
      applyRates,
      currencies: existingCurrencies,
      ratesByPair: existingRates,
      setConnectionStatus,
      setCurrencies,
      setInitializing,
      setRuntimeError
    } = useAppStore.getState();

    const hasBootstrapData =
      existingCurrencies.length > 0 && Object.keys(existingRates).length > 0;

    if (hasBootstrapData) {
      disconnectSocket = connectRateSocket({
        onRates: (message) => {
          startTransition(() => {
            useAppStore.getState().applyRates(message.rates);
          });
        },
        onStatusChange: (status) => {
          useAppStore.getState().setConnectionStatus(status);
        }
      });

      return () => {
        cancelled = true;
        disconnectSocket?.();
      };
    }

    const bootstrap = async () => {
      setInitializing(true);
      setRuntimeError(null);

      try {
        const currencyResponse = await fetchAvailableCurrencies();
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setCurrencies(currencyResponse.currencies);
        });

        const ratesResponse = await fetchRates([...DASHBOARD_PAIRS]);
        if (cancelled) {
          return;
        }

        startTransition(() => {
          applyRates(ratesResponse.rates);
        });

        disconnectSocket = connectRateSocket({
          onRates: (message) => {
            startTransition(() => {
              useAppStore.getState().applyRates(message.rates);
            });
          },
          onStatusChange: (status) => {
            useAppStore.getState().setConnectionStatus(status);
          }
        });

        void fetchRateHistory([...DASHBOARD_PAIRS], 60)
          .then((historyResponse) => {
            if (cancelled) {
              return;
            }

            startTransition(() => {
              applyRateHistory(historyResponse.histories);
            });
          })
          .catch((error) => {
            if (cancelled) {
              return;
            }

            setRuntimeError(getErrorMessage(error));
          });
      } catch (error) {
        if (!cancelled) {
          setRuntimeError(getErrorMessage(error));
          setConnectionStatus("disconnected");
        }
      } finally {
        if (!cancelled) {
          setInitializing(false);
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
      disconnectSocket?.();
    };
  }, []);

  return (
    <main className="relative min-h-screen overflow-x-hidden px-4 py-6 text-slate-100 md:px-8">
      <div className="pointer-events-none absolute inset-0 opacity-90">
        <div className="absolute left-[-10%] top-0 h-96 w-96 rounded-full bg-sky-500/18 blur-3xl" />
        <div className="absolute right-[-8%] top-32 h-[28rem] w-[28rem] rounded-full bg-emerald-500/12 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-cyan-400/8 blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6">
        <Header status={connectionStatus} />

        {runtimeError ? (
          <div className="animate-fade-up rounded-[1.5rem] border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
            {runtimeError}
          </div>
        ) : null}

        <RateDashboard ratesByPair={ratesByPair} />

        {isInitializing ? (
          <div className="animate-fade-up rounded-[1.5rem] border border-white/10 bg-slate-950/50 px-5 py-4 text-sm text-slate-300">
            Loading currencies, dashboard rates, and live ticker connection.
          </div>
        ) : null}

        <Converter currencies={currencies} />

        <RecentConversionsTable onClear={clearHistory} rows={recentConversions} />
      </div>
    </main>
  );
};
