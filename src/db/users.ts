import { eq } from 'drizzle-orm';
import { getDb } from './index.ts';
import { users } from './schema.ts';

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName?: string | null,
  photoUrl?: string | null
) {
  try {
    const db = await getDb();
    const result = await db
      .insert(users)
      .values({
        uid,
        email: email || 'student@user.local',
        displayName: displayName || null,
        photoUrl: photoUrl || null,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: email || 'student@user.local',
          displayName: displayName || null,
          photoUrl: photoUrl || null,
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user profile with Neon PostgreSQL database.', { cause: error });
  }
}

export async function getUserByUid(uid: string) {
  try {
    const db = await getDb();
    const rows = await db.select().from(users).where(eq(users.uid, uid));
    return rows[0] || null;
  } catch (error) {
    console.error('Database query failed in getUserByUid:', error);
    throw new Error('Failed to retrieve user profile from Neon PostgreSQL database.', { cause: error });
  }
}
