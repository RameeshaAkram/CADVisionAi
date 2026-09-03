import { Outlet, Link } from 'react-router-dom';

export function AppShell() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)]">
      {/* Topbar */}
      <header className="h-[52px] border-b border-[var(--border)] flex items-center px-4 shrink-0 bg-[var(--bg)] z-[var(--z-sticky)]">
        <div className="font-semibold text-[var(--text)] tracking-[-0.02em] text-[18px]">
          <Link to="/" className="hover:text-[var(--text-secondary)] transition-colors">CAD AI</Link>
        </div>
        <div className="ml-auto flex gap-4 text-[14px] text-[var(--text-secondary)] font-medium">
          <Link to="/jobs" className="hover:text-[var(--text)] transition-colors">Jobs</Link>
          <span className="text-[var(--text-disabled)] cursor-not-allowed">Docs</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
