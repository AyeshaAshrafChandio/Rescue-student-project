import fs from 'fs';
import path from 'path';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function getFirebaseProjectId(): string {
  if (process.env.FIREBASE_PROJECT_ID) {
    return process.env.FIREBASE_PROJECT_ID;
  }
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.projectId === 'string' && parsed.projectId.trim()) {
        return parsed.projectId.trim();
      }
    }
  } catch (err) {
    console.warn('Warning reading firebase-applet-config.json:', err);
  }
  return 'gen-lang-client-0760789291';
}

if (!getApps().length) {
  initializeApp({
    projectId: getFirebaseProjectId(),
  });
}

export const adminAuth = getAuth();
