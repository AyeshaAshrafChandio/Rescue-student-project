import type { Request, Response, NextFunction } from 'express';
import { verifyFirebaseToken } from '../lib/firebase-admin.ts';
import { getOrCreateUser } from '../db/users.ts';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  displayName?: string;
  photoUrl?: string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Strictly requires a valid Firebase ID token in the Authorization: Bearer <token> header.
 * Verifies the token with Firebase Admin SDK and synchronizes the user with PostgreSQL.
 */
export const requireStrictFirebaseAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication required: Please log in or sign up with Firebase Authentication.',
    });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token || token === 'undefined' || token === 'null') {
    return res.status(401).json({
      error: 'Authentication required: Missing Firebase ID token.',
    });
  }

  try {
    const decoded = await verifyFirebaseToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email || 'user@firebase.auth',
      displayName: decoded.name || undefined,
      photoUrl: decoded.picture || undefined,
    };

    // Synchronize user record in PostgreSQL via Drizzle upsert
    await getOrCreateUser(
      decoded.uid,
      decoded.email || 'user@firebase.auth',
      decoded.name || null,
      decoded.picture || null
    ).catch((dbErr) => {
      console.warn('Non-fatal user sync warning:', dbErr.message);
    });

    return next();
  } catch (err: any) {
    console.warn('Firebase ID token verification failed:', err.message);
    return res.status(401).json({
      error: 'Unauthorized: Invalid or expired Firebase authentication token. Please sign in again.',
    });
  }
};

/**
 * All project-related and user-related routes strictly require a verified Firebase ID token.
 */
export const requireAuth = requireStrictFirebaseAuth;

