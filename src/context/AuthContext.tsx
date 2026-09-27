import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import {
  auth,
  loginWithGoogle,
  loginWithEmail,
  signUpWithEmail,
  logoutUser,
  formatFirebaseAuthError,
  ensureCurrentDomainAuthorized,
} from '../lib/firebase.ts';
import { syncAuthenticatedUser } from '../lib/project-service.ts';

export interface DbUserProfile {
  id: number;
  uid: string;
  email: string;
  displayName?: string | null;
  photoUrl?: string | null;
}

export type AuthModalMode = 'login' | 'signup';
export type AppView = 'dashboard' | 'analysis' | 'plan' | 'workspace' | 'report';

export interface IntendedDestination {
  view?: AppView;
  openCreateModal?: boolean;
  focusVerification?: boolean;
  reportSection?: 'check' | 'report';
  projectId?: string;
  taskId?: string;
  label?: string;
}

interface AuthContextType {
  user: User | null;
  dbUser: DbUserProfile | null;
  loading: boolean;
  authError: string | null;
  isAuthModalOpen: boolean;
  authModalMode: AuthModalMode;
  intendedDestination: IntendedDestination | null;
  openAuthModal: (mode?: AuthModalMode, intended?: IntendedDestination) => void;
  closeAuthModal: () => void;
  clearAuthError: () => void;
  requireAuthForAction: (intended: IntendedDestination, mode?: AuthModalMode) => boolean;
  consumeIntendedDestination: () => IntendedDestination | null;
  signIn: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  dbUser: null,
  loading: true,
  authError: null,
  isAuthModalOpen: false,
  authModalMode: 'login',
  intendedDestination: null,
  openAuthModal: () => {},
  closeAuthModal: () => {},
  clearAuthError: () => {},
  requireAuthForAction: () => false,
  consumeIntendedDestination: () => null,
  signIn: async () => {},
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  signOut: async () => {},
  getIdToken: async () => null,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<DbUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>('login');
  const [intendedDestination, setIntendedDestination] = useState<IntendedDestination | null>(null);
  const intendedRef = useRef<IntendedDestination | null>(null);

  useEffect(() => {
    void ensureCurrentDomainAuthorized();
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);

      if (firebaseUser) {
        setIsAuthModalOpen(false);
        try {
          const token = await firebaseUser.getIdToken();
          const synced = await syncAuthenticatedUser(token, firebaseUser.displayName);
          if (synced?.user) {
            setDbUser(synced.user);
          }
        } catch (err) {
          console.warn('Could not sync Firebase user with Neon PostgreSQL backend:', err);
        }
      } else {
        setDbUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const openAuthModal = (mode: AuthModalMode = 'login', intended?: IntendedDestination) => {
    setAuthError(null);
    setAuthModalMode(mode);
    if (intended) {
      intendedRef.current = intended;
      setIntendedDestination(intended);
    }
    setIsAuthModalOpen(true);
    try {
      const targetPath = mode === 'signup' ? '/signup' : '/login';
      if (window.location.pathname !== targetPath) {
        window.history.pushState({}, '', targetPath);
      }
    } catch {
      // ignore history errors
    }
  };

  const closeAuthModal = () => {
    setAuthError(null);
    setIsAuthModalOpen(false);
    try {
      if (window.location.pathname === '/login' || window.location.pathname === '/signup') {
        window.history.pushState({}, '', '/dashboard');
      }
    } catch {
      // ignore history errors
    }
  };

  const clearAuthError = () => setAuthError(null);

  const requireAuthForAction = (
    intended: IntendedDestination,
    mode: AuthModalMode = 'login'
  ): boolean => {
    if (user || auth.currentUser) {
      return true;
    }
    openAuthModal(mode, intended);
    return false;
  };

  const consumeIntendedDestination = (): IntendedDestination | null => {
    const current = intendedRef.current;
    intendedRef.current = null;
    setIntendedDestination(null);
    return current;
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      const cred = await loginWithGoogle();
      setUser(cred.user);
      const token = await cred.user.getIdToken();
      const synced = await syncAuthenticatedUser(token, cred.user.displayName);
      if (synced?.user) {
        setDbUser(synced.user);
      }
      setIsAuthModalOpen(false);
    } catch (error: any) {
      const formatted = formatFirebaseAuthError(error);
      setAuthError(formatted);
      throw new Error(formatted);
    }
  };

  const handleEmailSignIn = async (email: string, password: string) => {
    setAuthError(null);
    try {
      const cred = await loginWithEmail(email, password);
      setUser(cred.user);
      const token = await cred.user.getIdToken();
      const synced = await syncAuthenticatedUser(token, cred.user.displayName);
      if (synced?.user) {
        setDbUser(synced.user);
      }
      setIsAuthModalOpen(false);
    } catch (error: any) {
      const formatted = formatFirebaseAuthError(error);
      setAuthError(formatted);
      throw new Error(formatted);
    }
  };

  const handleEmailSignUp = async (email: string, password: string, displayName: string) => {
    setAuthError(null);
    try {
      const cred = await signUpWithEmail(email, password, displayName);
      setUser(cred.user);
      const token = await cred.user.getIdToken(true);
      const synced = await syncAuthenticatedUser(token, displayName || cred.user.displayName);
      if (synced?.user) {
        setDbUser(synced.user);
      }
      setIsAuthModalOpen(false);
    } catch (error: any) {
      const formatted = formatFirebaseAuthError(error);
      setAuthError(formatted);
      throw new Error(formatted);
    }
  };

  const handleSignOut = async () => {
    setAuthError(null);
    try {
      await logoutUser();
      setUser(null);
      setDbUser(null);
      intendedRef.current = { view: 'dashboard', label: 'Dashboard' };
      setIntendedDestination({ view: 'dashboard', label: 'Dashboard' });
      setAuthModalMode('login');
      setIsAuthModalOpen(true);
      try {
        window.history.pushState({}, '', '/login');
      } catch {
        // ignore
      }
    } catch (error: any) {
      const formatted = formatFirebaseAuthError(error);
      setAuthError(formatted);
      throw new Error(formatted);
    }
  };

  const getIdToken = async (): Promise<string | null> => {
    const activeUser = auth.currentUser || user;
    if (!activeUser) return null;
    try {
      return await activeUser.getIdToken();
    } catch {
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        dbUser,
        loading,
        authError,
        isAuthModalOpen,
        authModalMode,
        intendedDestination,
        openAuthModal,
        closeAuthModal,
        clearAuthError,
        requireAuthForAction,
        consumeIntendedDestination,
        signIn: handleGoogleSignIn,
        signInWithGoogle: handleGoogleSignIn,
        signInWithEmail: handleEmailSignIn,
        signUpWithEmail: handleEmailSignUp,
        signOut: handleSignOut,
        getIdToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

