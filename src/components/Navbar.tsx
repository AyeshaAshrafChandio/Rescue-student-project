import React from 'react';
import { ShieldAlert, LogIn, LogOut, FolderCode, FileCheck, Sparkles, CheckCircle2, Award } from 'lucide-react';
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
  const { user, signIn, signOut } = useAuth();

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Tagline */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentView('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400">
                  Student Project Rescue
                </span>
                <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded">
                  Rescue Engine
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Rescue your project before the deadline</p>
            </div>
          </div>

          {/* Active Navigation Tabs */}
          {activeProject && (
            <nav className="hidden md:flex items-center space-x-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80 text-sm">
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  currentView === 'dashboard' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setCurrentView('analysis')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center space-x-1.5 ${
                  currentView === 'analysis' ? 'bg-slate-800 text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <FolderCode className="w-4 h-4" />
                <span>Rescue Report</span>
              </button>
              <button
                onClick={() => setCurrentView('plan')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center space-x-1.5 ${
                  currentView === 'plan' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileCheck className="w-4 h-4" />
                <span>Rescue Plan</span>
              </button>
              <button
                onClick={() => setCurrentView('workspace')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center space-x-1.5 ${
                  currentView === 'workspace' ? 'bg-slate-800 text-amber-400 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>AI Workspace</span>
              </button>
              <button
                onClick={() => setCurrentView('report')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center space-x-1.5 ${
                  currentView === 'report' ? 'bg-slate-800 text-sky-400 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Award className="w-4 h-4" />
                <span>Final Check</span>
              </button>
            </nav>
          )}

          {/* Right Action: Project status & User Auth */}
          <div className="flex items-center space-x-3">
            {activeProject ? (
              <div className="hidden lg:flex items-center bg-slate-800/80 border border-slate-700/60 rounded-lg px-3 py-1 text-xs space-x-2">
                <span className="text-slate-400">Active:</span>
                <span className="font-semibold text-slate-200 max-w-[140px] truncate">{activeProject.title}</span>
                <span className="bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-bold">
                  {activeProject.healthScore}%
                </span>
              </div>
            ) : (
              <button
                onClick={onOpenCreateModal}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition"
              >
                + Rescue New Project
              </button>
            )}

            {user ? (
              <div className="flex items-center space-x-2">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-8 h-8 rounded-full border border-slate-700"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-700 text-white flex items-center justify-center font-bold text-xs">
                    {(user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <button
                  onClick={signOut}
                  title="Sign Out"
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={signIn}
                className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-700 transition"
              >
                <LogIn className="w-4 h-4 text-indigo-400" />
                <span>Google Login</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
