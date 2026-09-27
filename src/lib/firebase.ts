import { initializeApp, getApps, type FirebaseOptions } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  type UserCredential,
} from 'firebase/auth';

declare global {
  interface Window {
    __FIREBASE_CONFIG__?: Record<string, string | undefined>;
  }
}

function resolveInitialFirebaseConfig(): FirebaseOptions {
  const runtimeCfg = (typeof window !== 'undefined' && window.__FIREBASE_CONFIG__) || {};
  const viteEnv =
    ((import.meta as unknown as { env?: Record<string, string | undefined> }).env) || {};
  const nodeEnv =
    ((globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process
      ?.env) || {};

  return {
    apiKey:
      runtimeCfg.apiKey ||
      viteEnv.VITE_FIREBASE_API_KEY ||
      nodeEnv.VITE_FIREBASE_API_KEY ||
      nodeEnv.FIREBASE_API_KEY ||
      '',
    authDomain:
      runtimeCfg.authDomain ||
      viteEnv.VITE_FIREBASE_AUTH_DOMAIN ||
      nodeEnv.VITE_FIREBASE_AUTH_DOMAIN ||
      nodeEnv.FIREBASE_AUTH_DOMAIN ||
      '',
    projectId:
      runtimeCfg.projectId ||
      viteEnv.VITE_FIREBASE_PROJECT_ID ||
      nodeEnv.VITE_FIREBASE_PROJECT_ID ||
      nodeEnv.FIREBASE_PROJECT_ID ||
      '',
    storageBucket:
      runtimeCfg.storageBucket ||
      viteEnv.VITE_FIREBASE_STORAGE_BUCKET ||
      nodeEnv.VITE_FIREBASE_STORAGE_BUCKET ||
      nodeEnv.FIREBASE_STORAGE_BUCKET ||
      undefined,
    messagingSenderId:
      runtimeCfg.messagingSenderId ||
      viteEnv.VITE_FIREBASE_MESSAGING_SENDER_ID ||
      nodeEnv.VITE_FIREBASE_MESSAGING_SENDER_ID ||
      nodeEnv.FIREBASE_MESSAGING_SENDER_ID ||
      undefined,
    appId:
      runtimeCfg.appId ||
      viteEnv.VITE_FIREBASE_APP_ID ||
      nodeEnv.VITE_FIREBASE_APP_ID ||
      nodeEnv.FIREBASE_APP_ID ||
      undefined,
  };
}

const app = getApps().length === 0 ? initializeApp(resolveInitialFirebaseConfig()) : getApps()[0];

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function ensureCurrentDomainAuthorized(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const host = window.location.hostname;
    await fetch(`/api/auth/firebase-config?domain=${encodeURIComponent(host)}`);
  } catch {
    // Non-fatal background check
  }
}

// 1. Google Login (with automatic authorized-domain verification and retry)
export async function loginWithGoogle(): Promise<UserCredential> {
  await ensureCurrentDomainAuthorized();
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (err: any) {
    if (err?.code === 'auth/unauthorized-domain' && typeof window !== 'undefined') {
      try {
        await fetch('/api/auth/authorize-domain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain: window.location.hostname }),
        });
        await new Promise((r) => setTimeout(r, 1200));
        return await signInWithPopup(auth, googleProvider);
      } catch {
        // Fall through to throw original error
      }
    }
    throw err;
  }
}

// 2. Email/Password Login
export async function loginWithEmail(email: string, password: string): Promise<UserCredential> {
  return await signInWithEmailAndPassword(auth, email.trim(), password);
}

// 3. Email/Password Sign Up
export async function signUpWithEmail(
  email: string,
  password: string,
  displayName?: string
): Promise<UserCredential> {
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (displayName && displayName.trim()) {
    await updateProfile(credential.user, { displayName: displayName.trim() });
  }
  return credential;
}

// 4. Logout
export async function logoutUser(): Promise<void> {
  return await signOut(auth);
}

export function formatFirebaseAuthError(err: any): string {
  const code = err?.code || '';
  const msg = err?.message || '';

  if (code === 'auth/operation-not-allowed' || msg.includes('OPERATION_NOT_ALLOWED')) {
    return 'Email/Password sign-in is not yet toggled on in the Firebase Console for this project. Please sign in with Google Login, or enable Email/Password in Firebase Console > Authentication > Sign-in method.';
  }
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return 'Invalid email or password. Please check your credentials or switch to Sign Up to create an account.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'An account with this email already exists. Please switch to Log In.';
  }
  if (code === 'auth/weak-password') {
    return 'Password should be at least 6 characters long.';
  }
  if (code === 'auth/invalid-email') {
    return 'Please enter a valid email address.';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Google sign-in popup was closed before completing authentication.';
  }
  if (code === 'auth/popup-blocked') {
    return 'Browser blocked the sign-in popup. Please allow popups for this site and try again.';
  }
  if (code === 'auth/unauthorized-domain') {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
    return `Domain "${host}" is being authorized in Firebase Authentication. Please try clicking Google Login again in a moment, or sign in with Email & Password.`;
  }
  if (code === 'auth/api-key-not-valid.-please-pass-a-valid-api-key.' || msg.includes('api-key-not-valid')) {
    return 'Firebase API key is missing or invalid. Please provide valid Firebase credentials in your environment secrets.';
  }
  return msg || 'Authentication failed. Please try again.';
}
