interface Props {
  connected: boolean;
}

export function Header({ connected }: Props) {
  return (
    <header className="flex items-center justify-between border-b border-ink-700 bg-ink-900/50 px-6 py-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-gradient-to-br from-accent to-accent-glow text-white">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M4 17l5-5-5-5M12 19h8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-ink-100">deviewer</h1>
          <p className="text-[11px] text-ink-500">Live developer feedback for GitHub pushes</p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px]">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            connected ? "bg-emerald-400 animate-pulseDot" : "bg-rose-500"
          }`}
        />
        <span className={connected ? "text-emerald-300" : "text-rose-300"}>
          {connected ? "Stream connected" : "Stream offline"}
        </span>
      </div>
    </header>
  );
}
