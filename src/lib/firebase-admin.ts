import { initializeApp, getApps, getApp, cert, type App, type ServiceAccount } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';

const authorizedDomainsCache = new Set<string>();
let domainSyncInFlight: Promise<string[]> | null = null;

export function getPublicFirebaseClientConfig() {
  return {
    apiKey: (process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '').trim(),
    authDomain: (
      process.env.VITE_FIREBASE_AUTH_DOMAIN ||
      process.env.FIREBASE_AUTH_DOMAIN ||
      ''
    ).trim(),
    projectId: (
      process.env.VITE_FIREBASE_PROJECT_ID ||
      process.env.FIREBASE_PROJECT_ID ||
      ''
    ).trim(),
    storageBucket: (
      process.env.VITE_FIREBASE_STORAGE_BUCKET ||
      process.env.FIREBASE_STORAGE_BUCKET ||
      ''
    ).trim(),
    messagingSenderId: (
      process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
      process.env.FIREBASE_MESSAGING_SENDER_ID ||
      ''
    ).trim(),
    appId: (process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || '').trim(),
  };
}

function parseServiceAccountFromEnv(): (ServiceAccount & { project_id?: string }) | null {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch (err) {
      console.warn('Warning parsing FIREBASE_SERVICE_ACCOUNT_KEY:', err);
    }
  }

  const projectId = (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    ''
  ).trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();

  if (projectId && clientEmail && privateKey) {
    return {
      projectId,
      clientEmail,
      privateKey,
      project_id: projectId,
    };
  }

  return null;
}

export function getFirebaseProjectId(tokenAudienceFallback?: string): string {
  if (process.env.FIREBASE_PROJECT_ID?.trim()) {
    return process.env.FIREBASE_PROJECT_ID.trim();
  }
  if (process.env.VITE_FIREBASE_PROJECT_ID?.trim()) {
    return process.env.VITE_FIREBASE_PROJECT_ID.trim();
  }
  const sa = parseServiceAccountFromEnv();
  if (sa?.project_id) {
    return String(sa.project_id).trim();
  }
  if (sa?.projectId) {
    return String(sa.projectId).trim();
  }
  if (tokenAudienceFallback?.trim()) {
    return tokenAudienceFallback.trim();
  }
  return '';
}

function extractJwtAudience(token: string): string | undefined {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return undefined;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (typeof payload.aud === 'string' && payload.aud.trim()) {
      return payload.aud.trim();
    }
  } catch {
    // ignore malformed JWT
  }
  return undefined;
}

function getOrInitializeAdminApp(targetProjectId?: string): App {
  const projectId = getFirebaseProjectId(targetProjectId);
  const appName = projectId ? `admin-${projectId}` : '[DEFAULT]';

  const existing = getApps().find((a) => a.name === appName);
  if (existing) {
    return getApp(appName);
  }

  const sa = parseServiceAccountFromEnv();
  if (sa) {
    return initializeApp(
      {
        credential: cert(sa),
        projectId: sa.project_id || sa.projectId || projectId || undefined,
      },
      appName
    );
  }

  return initializeApp(projectId ? { projectId } : {}, appName);
}

/**
 * Ensures that "rescue-student-project.ai.studio", the APP_URL hostname, and any active
 * runtime/preview hostnames are added to Firebase Authentication's authorizedDomains
 * via Google Identity Toolkit Admin API.
 */
export async function ensureFirebaseAuthorizedDomains(
  extraDomains: string[] = []
): Promise<string[]> {
  const sa = parseServiceAccountFromEnv();
  const projectId = getFirebaseProjectId();
  if (!sa || !projectId) {
    return [];
  }

  const candidateDomains = new Set<string>([
    'localhost',
    '127.0.0.1',
    `${projectId}.firebaseapp.com`,
    `${projectId}.web.app`,
    'rescue-student-project.ai.studio',
    'ai.studio',
  ]);

  if (process.env.APP_URL) {
    try {
      const appUrlHost = new URL(process.env.APP_URL).hostname;
      if (appUrlHost) candidateDomains.add(appUrlHost);
    } catch {
      // ignore invalid URL
    }
  }

  for (const d of extraDomains) {
    const clean = (d || '').trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
    if (clean && clean.includes('.') || clean === 'localhost') {
      candidateDomains.add(clean);
    }
  }

  // If all candidate domains are already verified in cache, return immediately
  const allCached = Array.from(candidateDomains).every((d) => authorizedDomainsCache.has(d));
  if (allCached && authorizedDomainsCache.size > 0) {
    return Array.from(authorizedDomainsCache);
  }

  if (domainSyncInFlight) {
    return domainSyncInFlight;
  }

  domainSyncInFlight = (async () => {
    try {
      const credential = cert(sa);
      const tokenObj = await credential.getAccessToken();
      if (!tokenObj?.access_token) {
        return Array.from(authorizedDomainsCache);
      }

      const configUrl = `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`;
      const getRes = await fetch(configUrl, {
        headers: { Authorization: `Bearer ${tokenObj.access_token}` },
      });

      if (!getRes.ok) {
        return Array.from(authorizedDomainsCache);
      }

      const currentConfig = await getRes.json();
      const existingDomains: string[] = Array.isArray(currentConfig.authorizedDomains)
        ? currentConfig.authorizedDomains
        : [];

      existingDomains.forEach((d) => authorizedDomainsCache.add(d));

      const missing = Array.from(candidateDomains).filter((d) => !existingDomains.includes(d));
      if (missing.length === 0) {
        return existingDomains;
      }

      const mergedDomains = Array.from(new Set([...existingDomains, ...candidateDomains]));
      const patchRes = await fetch(`${configUrl}?updateMask=authorizedDomains`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${tokenObj.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ authorizedDomains: mergedDomains }),
      });

      if (patchRes.ok) {
        const updated = await patchRes.json();
        const finalDomains: string[] = Array.isArray(updated.authorizedDomains)
          ? updated.authorizedDomains
          : mergedDomains;
        finalDomains.forEach((d) => authorizedDomainsCache.add(d));
        return finalDomains;
      }

      return existingDomains;
    } catch (err) {
      console.warn('Could not sync Firebase authorizedDomains:', err);
      return Array.from(authorizedDomainsCache);
    } finally {
      domainSyncInFlight = null;
    }
  })();

  return domainSyncInFlight;
}

export async function verifyFirebaseToken(token: string): Promise<DecodedIdToken> {
  const jwtAud = extractJwtAudience(token);
  const configuredProjectId = getFirebaseProjectId();
  const effectiveProjectId = configuredProjectId || jwtAud;
  const app = getOrInitializeAdminApp(effectiveProjectId);
  return await getAuth(app).verifyIdToken(token);
}
