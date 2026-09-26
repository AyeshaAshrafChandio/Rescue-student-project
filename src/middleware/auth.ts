import type { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser } from '../db/users.ts';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  displayName?: string;
  photoUrl?: string;
  isGuest?: boolean;
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
      error: 'Unauthorized: Missing Firebase Bearer token.',
    });
  }

  const token = authHeader.split('Bearer ')[1].trim();
  if (!token || token === 'undefined' || token === 'null') {
    return res.status(401).json({
      error: 'Unauthorized: Empty Firebase Bearer token.',
    });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email || 'user@firebase.auth',
      displayName: decoded.name || undefined,
      photoUrl: decoded.picture || undefined,
      isGuest: false,
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
      error: 'Unauthorized: Invalid or expired Firebase authentication token.',
    });
  }
};

/**
 * Verifies Firebase ID token when provided in Authorization: Bearer <token> header
 * (rejecting invalid tokens with 401), and syncs authenticated users to PostgreSQL.
 * Also supports guest workspace session IDs (x-user-id) when not yet signed in.
 */
export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const guestHeader = req.headers['x-user-id'] as string;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1].trim();

    if (token && token !== 'undefined' && token !== 'null') {
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        req.user = {
          uid: decoded.uid,
          email: decoded.email || 'user@firebase.auth',
          displayName: decoded.name || undefined,
          photoUrl: decoded.picture || undefined,
          isGuest: false,
        };

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
          error: 'Unauthorized: Invalid Firebase authentication token.',
        });
      }
    }
  }

  if (guestHeader && guestHeader.trim()) {
    req.user = {
      uid: guestHeader.trim(),
      email: 'guest@student.local',
      isGuest: true,
    };
    return next();
  }

  return res.status(401).json({
    error: 'Unauthorized: Missing Firebase authentication token or session.',
  });
};
