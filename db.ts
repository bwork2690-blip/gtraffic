import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, tasks, messages, sessions, taskEvidences } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

/**
 * Create or update a user with local authentication
 */
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.username) {
    throw new Error("User username is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      username: user.username,
      passwordHash: user.passwordHash,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

/**
 * Get user by username
 */
export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Get user by ID
 */
export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Get all users (for admin)
 */
export async function getAllUsers() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get users: database not available");
    return [];
  }

  return await db.select().from(users);
}

/**
 * Get tasks assigned to user
 */
export async function getUserTasks(userId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get tasks: database not available");
    return [];
  }

  return await db.select().from(tasks).where(eq(tasks.assignedToUserId, userId));
}

/**
 * Get all tasks (for admin)
 */
export async function getAllTasks() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get tasks: database not available");
    return [];
  }

  return await db.select().from(tasks);
}

/**
 * Get task by ID
 */
export async function getTaskById(taskId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get task: database not available");
    return undefined;
  }

  const result = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Create task
 */
export async function createTask(task: typeof tasks.$inferInsert) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.insert(tasks).values(task);
  return result;
}

/**
 * Update task
 */
export async function updateTask(taskId: number, updates: Partial<typeof tasks.$inferInsert>) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return await db.update(tasks).set(updates).where(eq(tasks.id, taskId));
}

/**
 * Get task evidences
 */
export async function getTaskEvidences(taskId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get evidences: database not available");
    return [];
  }

  return await db.select().from(taskEvidences).where(eq(taskEvidences.taskId, taskId));
}

/**
 * Add task evidence
 */
export async function addTaskEvidence(evidence: typeof taskEvidences.$inferInsert) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return await db.insert(taskEvidences).values(evidence);
}

/**
 * Get user messages
 */
export async function getUserMessages(userId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get messages: database not available");
    return [];
  }

  return await db.select().from(messages).where(eq(messages.toUserId, userId));
}

/**
 * Send message
 */
export async function sendMessage(message: typeof messages.$inferInsert) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return await db.insert(messages).values(message);
}

/**
 * Mark message as read
 */
export async function markMessageAsRead(messageId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return await db.update(messages).set({ isRead: true }).where(eq(messages.id, messageId));
}

/**
 * Create session
 */
export async function createSession(session: typeof sessions.$inferInsert) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return await db.insert(sessions).values(session);
}

/**
 * Get session by token
 */
export async function getSessionByToken(token: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get session: database not available");
    return undefined;
  }

  const result = await db.select().from(sessions).where(eq(sessions.token, token)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Delete session
 */
export async function deleteSession(token: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return await db.delete(sessions).where(eq(sessions.token, token));
}

/**
 * Block/unblock user
 */
export async function setUserBlockStatus(userId: number, isBlocked: boolean) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return await db.update(users).set({ isBlocked }).where(eq(users.id, userId));
}
