import { Link, useRouterState } from "@tanstack/react-router";

const navItems = [{ to: "/creator-sourcing", label: "Processor" }] as const;

export function TopBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="relative z-50 px-4 pt-4 sm:px-5">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-3 rounded-[1.7rem] border border-white/65 bg-white/58 px-3 py-3 shadow-[0_18px_50px_rgba(38,72,58,0.1)] backdrop-blur-xl md:flex-row md:items-center md:justify-between md:px-4">
        <Link
          to="/creator-sourcing"
          className="inline-flex w-fit items-center gap-2 rounded-full border border-white/70 bg-white/72 px-3 py-1.5 text-xs font-semibold text-foreground shadow-[0_10px_26px_rgba(38,72,58,0.08)] transition hover:border-ring/40 hover:bg-card"
        >
          <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.8)]" />
          EasyKOL Processor
        </Link>

        <div className="flex min-w-0 items-center justify-between gap-3 md:justify-end">
          <nav className="flex min-w-0 items-center gap-1 overflow-x-auto rounded-full border border-white/70 bg-white/60 p-1 text-sm shadow-inner backdrop-blur">
            {navItems.map((n) => {
              const active = pathname === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 transition-colors ${
                    active
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
