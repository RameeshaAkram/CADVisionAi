import { Outlet, Link, useLocation } from 'react-router-dom';
import { Box, FolderOpen } from 'lucide-react';

export function AppShell() {
  const location = useLocation();
  return (
    <div className="app-shell min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)]">
      {/* Topbar */}
      <header className="topbar border-b flex items-center px-5 md:px-8 shrink-0 z-[var(--z-sticky)]">
        <div>
          <Link to="/" className="brand-mark text-[var(--text)]"><Box className="w-4 h-4 text-[var(--cyan-400)]" /> CADVision AI</Link>
          <div className="text-[10px] font-data text-[var(--g-500)] ml-[26px] mt-1 tracking-[0.08em] uppercase">Reverse engineering workspace</div>
        </div>
        <nav className="ml-auto flex items-center gap-1 text-[14px] font-medium">
          <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}><span>New job</span></Link>
          <Link to="/jobs" className={`nav-link ${location.pathname.startsWith('/jobs') ? 'active' : ''}`}><FolderOpen className="w-4 h-4 mr-2" /> Jobs</Link>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
