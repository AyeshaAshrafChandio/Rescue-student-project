import React from 'react';
import { ShieldAlert, LogIn, LogOut, UserPlus, FolderCode, FileCheck, Sparkles, Award } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { Project } from '../types/index.ts';

interface NavbarProps {
  currentView: 'dashboard' | 'analysis' | 'plan' | 'workspace' | 'report';
  setCurrentView: (view: 'dashboard' | 'analysis' | 'plan' | 'workspace' | 'report') => void;
  activeProject: Project | null;
  onOpenCreateModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  setCurrentView,
  activeProject,
  onOpenCreateModal,
}) => {
  const { user, openAuthModal, signInWithGoogle, signOut } = useAuth();

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          {/* Logo & Tagline */}
          <div
            className="flex items-center space-x-2.5 sm:space-x-3 cursor-pointer min-w-0"
            onClick={() => setCurrentView('dashboard')}
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-rose-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-rose-500/20 shrink-0">
              <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm sm:text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400 truncate">
                  Student Project Rescue
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded shrink-0">
                  Rescue Engine
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block truncate">
                Rescue your project before the deadline
              </p>
            </div>
          </div>

          {/* Active Navigation Tabs (Desktop xl+) */}
          {activeProject && (
            <nav className="hidden xl:flex items-center space-x-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80 text-sm shrink-0">
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                  currentView === 'dashboard' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setCurrentView('analysis')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center space-x-1.5 whitespace-nowrap ${
                  currentView === 'analysis' ? 'bg-slate-800 text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <FolderCode className="w-4 h-4 shrink-0" />
                <span>Rescue Report</span>
              </button>
              <button
                onClick={() => setCurrentView('plan')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center space-x-1.5 whitespace-nowrap ${
                  currentView === 'plan' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileCheck className="w-4 h-4 shrink-0" />
                <span>Rescue Plan</span>
              </button>
              <button
                onClick={() => setCurrentView('workspace')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center space-x-1.5 whitespace-nowrap ${
                  currentView === 'workspace' ? 'bg-slate-800 text-amber-400 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span>AI Workspace</span>
              </button>
              <button
                onClick={() => setCurrentView('report')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center space-x-1.5 whitespace-nowrap ${
                  currentView === 'report' ? 'bg-slate-800 text-sky-400 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Award className="w-4 h-4 shrink-0" />
                <span>Final Check</span>
              </button>
            </nav>
          )}

          {/* Right Action: Project status & User Auth */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            {activeProject ? (
              <div className="hidden md:flex items-center bg-slate-800/80 border border-slate-700/60 rounded-lg px-2.5 py-1 text-xs space-x-2">
                <span className="text-slate-400">Active:</span>
                <span className="font-semibold text-slate-200 max-w-[130px] truncate">{activeProject.title}</span>
                {activeProject.status === 'analyzing' ? (
                  <span className="bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-mono font-semibold animate-pulse">
                    Analyzing…
                  </span>
                ) : activeProject.status === 'failed' || activeProject.healthScore <= 0 ? (
                  <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-mono font-semibold">
                    Pending
                  </span>
                ) : (
                  <span className="bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-bold">
                    {activeProject.healthScore}%
                  </span>
                )}
              </div>
            ) : (
              <button
                onClick={onOpenCreateModal}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg shadow-sm transition whitespace-nowrap"
              >
                <span className="sm:hidden">+ New</span>
                <span className="hidden sm:inline">+ Rescue New Project</span>
              </button>
            )}

            {user ? (
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-2 bg-slate-800/70 border border-slate-700/70 rounded-xl px-2.5 py-1">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      className="w-6 h-6 rounded-full border border-slate-600 shrink-0"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                      {(user.displayName || user.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <span className="hidden sm:inline text-xs font-medium text-slate-200 max-w-[120px] truncate">
                    {user.displayName || user.email}
                  </span>
                </div>
                <button
                  onClick={() => signOut()}
                  title="Log Out"
                  className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white rounded-lg bg-slate-800/80 hover:bg-rose-500/20 border border-slate-700 hover:border-rose-500/40 transition"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-400" />
                  <span className="hidden sm:inline">Log Out</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <button
                  onClick={() => openAuthModal('login')}
                  className="flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-700 transition whitespace-nowrap"
                >
                  <LogIn className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span>Log In</span>
                </button>
                <button
                  onClick={() => openAuthModal('signup')}
                  className="hidden sm:flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-700 transition whitespace-nowrap"
                >
                  <UserPlus className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Sign Up</span>
                </button>
                <button
                  onClick={() => signInWithGoogle().catch(() => openAuthModal('login'))}
                  className="flex items-center space-x-1.5 bg-white hover:bg-slate-100 text-slate-900 text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-sm transition whitespace-nowrap"
                >
                  <span>Google Login</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile / Tablet / Laptop Navigation Bar (< xl) when a project is active */}
        {activeProject && (
          <div className="xl:hidden border-t border-slate-800/80 py-2 flex items-center justify-between gap-2 overflow-x-auto">
            <nav className="flex items-center space-x-1 text-xs shrink-0">
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`px-2.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                  currentView === 'dashboard' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setCurrentView('analysis')}
                className={`px-2.5 py-1.5 rounded-lg font-medium transition-all flex items-center space-x-1 whitespace-nowrap ${
                  currentView === 'analysis' ? 'bg-slate-800 text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <FolderCode className="w-3.5 h-3.5 shrink-0" />
                <span>Rescue Report</span>
              </button>
              <button
                onClick={() => setCurrentView('plan')}
                className={`px-2.5 py-1.5 rounded-lg font-medium transition-all flex items-center space-x-1 whitespace-nowrap ${
                  currentView === 'plan' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileCheck className="w-3.5 h-3.5 shrink-0" />
                <span>Rescue Plan</span>
              </button>
              <button
                onClick={() => setCurrentView('workspace')}
                className={`px-2.5 py-1.5 rounded-lg font-medium transition-all flex items-center space-x-1 whitespace-nowrap ${
                  currentView === 'workspace' ? 'bg-slate-800 text-amber-400 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>AI Workspace</span>
              </button>
              <button
                onClick={() => setCurrentView('report')}
                className={`px-2.5 py-1.5 rounded-lg font-medium transition-all flex items-center space-x-1 whitespace-nowrap ${
                  currentView === 'report' ? 'bg-slate-800 text-sky-400 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Award className="w-3.5 h-3.5 shrink-0" />
                <span>Final Check</span>
              </button>
            </nav>

            <div className="flex md:hidden items-center bg-slate-800/80 border border-slate-700/60 rounded-lg px-2 py-1 text-[11px] space-x-1.5 shrink-0">
              <span className="font-semibold text-slate-200 max-w-[90px] truncate">{activeProject.title}</span>
              {activeProject.status === 'analyzing' ? (
                <span className="bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-mono font-semibold animate-pulse">
                  Analyzing…
                </span>
              ) : activeProject.status === 'failed' || activeProject.healthScore <= 0 ? (
                <span className="bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono font-semibold">
                  Pending
                </span>
              ) : (
                <span className="bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-bold">
                  {activeProject.healthScore}%
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
