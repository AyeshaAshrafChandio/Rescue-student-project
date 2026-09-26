import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import {
  auth,
  loginWithGoogle,
  loginWithEmail,
  signUpWithEmail,
  resetUserPassword,
  logoutUser,
  formatFirebaseAuthError,
} from '../lib/firebase.ts';
import { syncAuthenticatedUser } from '../lib/project-service.ts';

export interface DbUserProfile {
  id: number;
  uid: string;
  email: string;
  displayName?: string | null;
  photoUrl?: string | null;
}

export type AuthModalMode = 'login' | 'signup' | 'reset';

interface AuthContextType {
  user: User | null;
  dbUser: DbUserProfile | null;
  loading: boolean;
  authError: string | null;
  isAuthModalOpen: boolean;
  authModalMode: AuthModalMode;
  openAuthModal: (mode?: AuthModalMode) => void;
  closeAuthModal: () => void;
  clearAuthError: () => void;
  signIn: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
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
  openAuthModal: () => {},
  closeAuthModal: () => {},
  clearAuthError: () => {},
  signIn: async () => {},
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  sendPasswordReset: async () => {},
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);

      if (firebaseUser) {
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

  const openAuthModal = (mode: AuthModalMode = 'login') => {
    setAuthError(null);
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthError(null);
    setIsAuthModalOpen(false);
  };

  const clearAuthError = () => setAuthError(null);

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      const cred = await loginWithGoogle();
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

  const handlePasswordReset = async (email: string) => {
    setAuthError(null);
    try {
      await resetUserPassword(email);
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
      setDbUser(null);
    } catch (error: any) {
      const formatted = formatFirebaseAuthError(error);
      setAuthError(formatted);
      throw new Error(formatted);
    }
  };

  const getIdToken = async (): Promise<string | null> => {
    if (!auth.currentUser) return null;
    try {
      return await auth.currentUser.getIdToken();
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
        openAuthModal,
        closeAuthModal,
        clearAuthError,
        signIn: handleGoogleSignIn,
        signInWithGoogle: handleGoogleSignIn,
        signInWithEmail: handleEmailSignIn,
        signUpWithEmail: handleEmailSignUp,
        sendPasswordReset: handlePasswordReset,
        signOut: handleSignOut,
        getIdToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
