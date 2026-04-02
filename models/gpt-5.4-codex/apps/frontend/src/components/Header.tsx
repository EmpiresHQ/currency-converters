import logoDollar from "../assets/logo-dollar.svg";
import type { ConnectionStatus } from "../lib/types";

interface HeaderProps {
  status: ConnectionStatus;
}

const statusLabel = (status: ConnectionStatus): string => {
  switch (status) {
    case "connected":
      return "Connected";
    case "reconnecting":
      return "Reconnecting";
    default:
      return "Disconnected";
  }
};

const statusTone = (status: ConnectionStatus): string => {
  switch (status) {
    case "connected":
      return "bg-emerald-400";
    case "reconnecting":
      return "bg-amber-300";
    default:
      return "bg-rose-400";
  }
};

export const Header = ({ status }: HeaderProps) => {
  return (
    <header className="animate-fade-up mb-8 flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/7 px-6 py-5 shadow-[0_22px_70px_rgba(4,12,24,0.45)] backdrop-blur-xl md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-4">
        <img
          alt="CurrencyX logo"
          className="h-14 w-14 animate-spin-slow"
          src={logoDollar}
        />

        <div>
          <p className="text-xs uppercase tracking-[0.45em] text-sky-200/60">
            CurrencyX
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
            Real-time edge conversion studio
          </h1>
        </div>
      </div>

      <div className="inline-flex items-center gap-3 self-start rounded-full border border-white/10 bg-slate-950/65 px-4 py-2 text-sm text-slate-200 md:self-auto">
        <span className={`h-2.5 w-2.5 rounded-full ${statusTone(status)}`} />
        {statusLabel(status)}
      </div>
    </header>
  );
};

