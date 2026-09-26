import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  UserCredential,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function loginWithGoogle(): Promise<UserCredential> {
  return await signInWithPopup(auth, googleProvider);
}

export async function loginWithEmail(email: string, password: string): Promise<UserCredential> {
  return await signInWithEmailAndPassword(auth, email.trim(), password);
}

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

export async function resetUserPassword(email: string): Promise<void> {
  return await sendPasswordResetEmail(auth, email.trim());
}

export async function logoutUser(): Promise<void> {
  return await signOut(auth);
}

export function formatFirebaseAuthError(err: any): string {
  const code = err?.code || '';
  const msg = err?.message || '';

  if (code === 'auth/operation-not-allowed' || msg.includes('OPERATION_NOT_ALLOWED')) {
    return 'Email/Password sign-in is not yet toggled on in the Firebase Console for this project. Please sign in with Google Login below, or enable Email/Password in Firebase Console > Authentication > Sign-in method.';
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Invalid email or password. Please check your credentials or create a new account.';
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
    return 'Sign-in popup was closed before completing authentication.';
  }
  if (code === 'auth/popup-blocked') {
    return 'Browser blocked the sign-in popup. Please allow popups for this site and try again.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'This preview domain is not yet authorized in Firebase Console > Authentication > Settings > Authorized domains.';
  }
  return msg || 'Authentication failed. Please try again.';
}
