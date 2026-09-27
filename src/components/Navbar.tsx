import React, { useState } from 'react';
import {
  ShieldAlert,
  LogIn,
  LogOut,
  UserPlus,
  FolderCode,
  FileCheck,
  Sparkles,
  Award,
  LayoutDashboard,
  PlusCircle,
  Terminal,
  CheckCircle2,
  ShieldCheck,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { Project } from '../types/index.ts';

export type NavView = 'dashboard' | 'analysis' | 'plan' | 'workspace' | 'report';

export interface NavOptions {
  focusVerification?: boolean;
  reportSection?: 'check' | 'report';
}

interface NavbarProps {
  currentView: NavView;
  setCurrentView: (view: NavView, options?: NavOptions) => void;
  activeProject: Project | null;
  projects?: Project[];
  onSelectProject?: (project: Project, targetView?: NavView) => void;
  onOpenCreateModal: () => void;
  focusVerification?: boolean;
  reportSection?: 'check' | 'report';
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  setCurrentView,
  activeProject,
  onOpenCreateModal,
  focusVerification = false,
  reportSection = 'report',
}) => {
  const { user, openAuthModal, signInWithGoogle, signOut } = useAuth();

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8">
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
          <nav className="hidden xl:flex items-center space-x-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80 text-xs font-medium shrink-0">
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                currentView === 'dashboard'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={onOpenCreateModal}
              className="px-2.5 py-1.5 rounded-lg transition-all flex items-center space-x-1 text-rose-300 hover:text-white hover:bg-slate-800/60 whitespace-nowrap"
            >
              <PlusCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>Project Rescue</span>
            </button>
            <button
              onClick={() => setCurrentView('analysis')}
              className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 whitespace-nowrap ${
                currentView === 'analysis'
                  ? 'bg-slate-800 text-indigo-400 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FolderCode className="w-3.5 h-3.5 shrink-0" />
              <span>Analysis</span>
            </button>
            <button
              onClick={() => setCurrentView('plan')}
              className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 whitespace-nowrap ${
                currentView === 'plan'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Rescue Plan</span>
            </button>
            <button
              onClick={() => setCurrentView('workspace', { focusVerification: false })}
              className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 whitespace-nowrap ${
                currentView === 'workspace' && !focusVerification
                  ? 'bg-slate-800 text-amber-400 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>AI Workspace</span>
            </button>
            <button
              onClick={() => setCurrentView('workspace', { focusVerification: true })}
              className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 whitespace-nowrap ${
                currentView === 'workspace' && focusVerification
                  ? 'bg-slate-800 text-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Verification</span>
            </button>
            <button
              onClick={() => setCurrentView('report', { reportSection: 'check' })}
              className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 whitespace-nowrap ${
                currentView === 'report' && reportSection === 'check'
                  ? 'bg-slate-800 text-sky-400 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Final Check</span>
            </button>
            <button
              onClick={() => setCurrentView('report', { reportSection: 'report' })}
              className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 whitespace-nowrap ${
                currentView === 'report' && reportSection === 'report'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Award className="w-3.5 h-3.5 shrink-0" />
              <span>Final Report</span>
            </button>
          </nav>

          {/* Right Action: Project status & User Auth */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            {activeProject ? (
              <div className="hidden md:flex items-center bg-slate-800/80 border border-slate-700/60 rounded-lg px-2.5 py-1 text-xs space-x-2">
                <span className="text-slate-400">Active:</span>
                <span className="font-semibold text-slate-200 max-w-[130px] truncate">
                  {activeProject.title}
                </span>
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

        {/* Mobile / Tablet / Laptop Navigation Bar (< xl) */}
        <div className="xl:hidden border-t border-slate-800/80 py-2 flex items-center justify-between gap-2 overflow-x-auto">
          <nav className="flex items-center space-x-1 text-xs shrink-0">
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                currentView === 'dashboard'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={onOpenCreateModal}
              className="px-2.5 py-1.5 rounded-lg font-medium transition-all flex items-center space-x-1 text-rose-300 hover:text-white whitespace-nowrap"
            >
              <PlusCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>Project Rescue</span>
            </button>
            <button
              onClick={() => setCurrentView('analysis')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-all flex items-center space-x-1 whitespace-nowrap ${
                currentView === 'analysis'
                  ? 'bg-slate-800 text-indigo-400 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FolderCode className="w-3.5 h-3.5 shrink-0" />
              <span>Analysis</span>
            </button>
            <button
              onClick={() => setCurrentView('plan')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-all flex items-center space-x-1 whitespace-nowrap ${
                currentView === 'plan'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Rescue Plan</span>
            </button>
            <button
              onClick={() => setCurrentView('workspace', { focusVerification: false })}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-all flex items-center space-x-1 whitespace-nowrap ${
                currentView === 'workspace' && !focusVerification
                  ? 'bg-slate-800 text-amber-400 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>AI Workspace</span>
            </button>
            <button
              onClick={() => setCurrentView('workspace', { focusVerification: true })}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-all flex items-center space-x-1 whitespace-nowrap ${
                currentView === 'workspace' && focusVerification
                  ? 'bg-slate-800 text-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Verification</span>
            </button>
            <button
              onClick={() => setCurrentView('report', { reportSection: 'check' })}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-all flex items-center space-x-1 whitespace-nowrap ${
                currentView === 'report' && reportSection === 'check'
                  ? 'bg-slate-800 text-sky-400 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Final Check</span>
            </button>
            <button
              onClick={() => setCurrentView('report', { reportSection: 'report' })}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-all flex items-center space-x-1 whitespace-nowrap ${
                currentView === 'report' && reportSection === 'report'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Award className="w-3.5 h-3.5 shrink-0" />
              <span>Final Report</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};

export const SideNavbar: React.FC<NavbarProps> = ({
  currentView,
  setCurrentView,
  activeProject,
  projects = [],
  onSelectProject,
  onOpenCreateModal,
  focusVerification = false,
  reportSection = 'report',
}) => {
  const { user, openAuthModal, signInWithGoogle, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navSteps = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      subtitle: 'Projects & Overview',
      icon: LayoutDashboard,
      activeColor: 'text-white bg-slate-800 border-slate-700',
      iconColor: 'text-indigo-400',
      isActive: currentView === 'dashboard',
      onClick: () => {
        setCurrentView('dashboard');
        setMobileOpen(false);
      },
    },
    {
      id: 'rescue',
      label: 'Project Rescue',
      subtitle: 'Upload ZIP or GitHub',
      icon: PlusCircle,
      activeColor: 'text-rose-300 bg-rose-500/15 border-rose-500/30',
      iconColor: 'text-rose-400',
      isActive: false,
      onClick: () => {
        onOpenCreateModal();
        setMobileOpen(false);
      },
    },
    {
      id: 'analysis',
      label: 'Analysis',
      subtitle: 'Deep AST & Gemini Report',
      icon: FolderCode,
      activeColor: 'text-indigo-300 bg-indigo-500/15 border-indigo-500/30',
      iconColor: 'text-indigo-400',
      isActive: currentView === 'analysis',
      onClick: () => {
        setCurrentView('analysis');
        setMobileOpen(false);
      },
    },
    {
      id: 'plan',
      label: 'Rescue Plan',
      subtitle: 'Prioritized Tasks',
      icon: FileCheck,
      activeColor: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
      iconColor: 'text-emerald-400',
      isActive: currentView === 'plan',
      onClick: () => {
        setCurrentView('plan');
        setMobileOpen(false);
      },
    },
    {
      id: 'workspace',
      label: 'AI Workspace',
      subtitle: 'Code Fixes & Diff Review',
      icon: Sparkles,
      activeColor: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
      iconColor: 'text-amber-400',
      isActive: currentView === 'workspace' && !focusVerification,
      onClick: () => {
        setCurrentView('workspace', { focusVerification: false });
        setMobileOpen(false);
      },
    },
    {
      id: 'verification',
      label: 'Verification',
      subtitle: 'Isolated Sandbox Checks',
      icon: Terminal,
      activeColor: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
      iconColor: 'text-emerald-400',
      isActive: currentView === 'workspace' && focusVerification,
      onClick: () => {
        setCurrentView('workspace', { focusVerification: true });
        setMobileOpen(false);
      },
    },
    {
      id: 'final-check',
      label: 'Final Check',
      subtitle: 'Readiness & Audit Log',
      icon: CheckCircle2,
      activeColor: 'text-sky-300 bg-sky-500/15 border-sky-500/30',
      iconColor: 'text-sky-400',
      isActive: currentView === 'report' && reportSection === 'check',
      onClick: () => {
        setCurrentView('report', { reportSection: 'check' });
        setMobileOpen(false);
      },
    },
    {
      id: 'final-report',
      label: 'Final Report',
      subtitle: 'Certificate & ZIP Export',
      icon: Award,
      activeColor: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
      iconColor: 'text-emerald-400',
      isActive: currentView === 'report' && reportSection === 'report',
      onClick: () => {
        setCurrentView('report', { reportSection: 'report' });
        setMobileOpen(false);
      },
    },
  ];

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full justify-between p-4 space-y-6">
      <div className="space-y-5">
        {/* Authentication Status Pill */}
        <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/90 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              1. Authentication
            </span>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                user
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
              }`}
            >
              {user ? 'Verified' : 'Required'}
            </span>
          </div>
          {user ? (
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-xs text-slate-200 font-medium truncate">
                {user.displayName || user.email}
              </span>
            </div>
          ) : (
            <button
              onClick={() => {
                openAuthModal('login');
                setMobileOpen(false);
              }}
              className="w-full py-1.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition flex items-center justify-center space-x-1.5"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In / Sign Up</span>
            </button>
          )}
        </div>

        {/* Rescue Workflow Navigation */}
        <div className="space-y-1">
          <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Rescue Pipeline
          </div>
          {navSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <button
                key={step.id}
                onClick={step.onClick}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition border ${
                  step.isActive
                    ? step.activeColor
                    : 'border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-center shrink-0">
                    <Icon className={`w-4 h-4 ${step.iconColor}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">
                      {index + 2}. {step.label}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">{step.subtitle}</div>
                  </div>
                </div>
                <ChevronRight
                  className={`w-3.5 h-3.5 shrink-0 transition ${
                    step.isActive ? 'opacity-100 text-white' : 'opacity-30'
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Active & Saved Projects Switcher */}
        {user && projects.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
            <div className="px-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Your Projects ({projects.length})
              </span>
            </div>
            <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
              {projects.map((proj) => {
                const isSelected = activeProject?.id === proj.id;
                return (
                  <button
                    key={proj.id}
                    onClick={() => {
                      if (onSelectProject) {
                        onSelectProject(proj, currentView === 'dashboard' ? 'analysis' : currentView);
                      }
                      setMobileOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition border ${
                      isSelected
                        ? 'bg-slate-800/90 border-indigo-500/40 text-white font-semibold'
                        : 'border-transparent text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                    }`}
                  >
                    <span className="truncate pr-2">{proj.title}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                        proj.status === 'analyzing'
                          ? 'bg-indigo-500/20 text-indigo-300'
                          : proj.healthScore > 0
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {proj.status === 'analyzing'
                        ? 'SCAN'
                        : proj.healthScore > 0
                        ? `${proj.healthScore}%`
                        : 'NEW'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Sidebar Footer: Firebase Auth Controls */}
      <div className="pt-4 border-t border-slate-800/80">
        {user ? (
          <button
            onClick={() => {
              signOut();
              setMobileOpen(false);
            }}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Out</span>
          </button>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  openAuthModal('login');
                  setMobileOpen(false);
                }}
                className="flex items-center justify-center space-x-1 px-2.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition"
              >
                <LogIn className="w-3.5 h-3.5 text-indigo-400" />
                <span>Log In</span>
              </button>
              <button
                onClick={() => {
                  openAuthModal('signup');
                  setMobileOpen(false);
                }}
                className="flex items-center justify-center space-x-1 px-2.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition"
              >
                <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Sign Up</span>
              </button>
            </div>
            <button
              onClick={() => {
                signInWithGoogle().catch(() => openAuthModal('login'));
                setMobileOpen(false);
              }}
              className="w-full py-2 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-semibold shadow-sm transition"
            >
              Google Login
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Floating Sidebar Toggle Button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed bottom-5 left-5 z-40 bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-2xl shadow-xl border border-indigo-400/30 flex items-center space-x-2"
        title="Toggle Rescue Navigation"
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        <span className="text-xs font-bold pr-1">Pipeline</span>
      </button>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-50 w-72 max-w-[85vw] bg-slate-900 border-r border-slate-800 h-full overflow-y-auto shadow-2xl">
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Desktop Left Side Navigation Bar */}
      <aside className="hidden lg:block w-64 shrink-0 bg-slate-900/90 border-r border-slate-800/90 min-h-[calc(100vh-4rem)] sticky top-16 self-start">
        {renderSidebarContent()}
      </aside>
    </>
  );
};

