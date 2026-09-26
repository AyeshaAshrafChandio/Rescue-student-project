import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  displayName?: string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

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
          email: decoded.email,
          displayName: decoded.name,
        };
        return next();
      } catch (err: any) {
        console.warn('Firebase ID token verification failed:', err.message);
        return res.status(401).json({ error: 'Unauthorized: Invalid Firebase authentication token.' });
      }
    }
  }

  // Allow guest student identifier if not signed in to Google
  if (guestHeader && guestHeader.trim()) {
    req.user = {
      uid: guestHeader.trim(),
      email: 'guest@student.local',
    };
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized: Missing authentication token or user session.' });
};
