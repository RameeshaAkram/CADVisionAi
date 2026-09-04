import { Outlet, Link, useLocation } from 'react-router-dom';
import { Box, FolderOpen, Plus } from 'lucide-react';

export function AppShell() {
  const location = useLocation();

  return (
    <div className="app-shell min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)]">
      {/* Precision Topbar */}
      <header className="topbar border-b border-[var(--g-700)] bg-[var(--surface)]/95 backdrop-blur-md flex items-center px-4 sm:px-6 md:px-8 shrink-0 z-[var(--z-sticky)]">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5 text-[var(--g-100)] group transition-colors">
            <div className="w-8 h-8 rounded-[4px] bg-[var(--g-950)] border border-[var(--g-700)] flex items-center justify-center text-[var(--cyan-400)] shadow-sm group-hover:border-[var(--cyan-500)] transition-colors">
              <Box className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[16px] tracking-tight leading-none text-[var(--g-100)]">
                  CADVision <span className="text-[var(--cyan-400)]">AI</span>
                </span>
                <span className="hidden sm:inline-block px-1.5 py-0.5 rounded-[3px] text-[10px] font-data font-medium bg-[var(--cyan-ghost)] text-[var(--cyan-400)] border border-[rgba(44,192,212,0.25)] uppercase tracking-wider">
                  v1.0 CAD
                </span>
              </div>
              <p className="text-[11px] text-[var(--g-400)] tracking-wide hidden sm:block mt-0.5 font-data">
                Precision Part Reconstruction
              </p>
            </div>
          </Link>
        </div>

        {/* Center/Right Status & Navigation */}
        <div className="ml-auto flex items-center gap-3 md:gap-5">
          {/* Status Indicator */}
          <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-[4px] bg-[var(--g-850)] border border-[var(--g-700)] text-[11px] font-data text-[var(--g-300)]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--cyan-400)] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--cyan-500)]"></span>
            </span>
            <span>AI Engine Ready</span>
          </div>

          <nav className="flex items-center gap-1.5 text-[13px] font-medium">
            <Link
              to="/"
              className={`nav-link flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] border transition-all ${
                location.pathname === '/'
                  ? 'bg-[var(--cyan-ghost)] text-[var(--cyan-400)] border-[rgba(44,192,212,0.3)] font-semibold'
                  : 'text-[var(--g-300)] hover:text-[var(--g-100)] border-transparent hover:bg-[var(--g-800)]'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Job</span>
            </Link>

            <Link
              to="/jobs"
              className={`nav-link flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] border transition-all ${
                location.pathname.startsWith('/jobs')
                  ? 'bg-[var(--cyan-ghost)] text-[var(--cyan-400)] border-[rgba(44,192,212,0.3)] font-semibold'
                  : 'text-[var(--g-300)] hover:text-[var(--g-100)] border-transparent hover:bg-[var(--g-800)]'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Jobs Library</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
