import { hash, compare } from "bcryptjs";
import { randomBytes } from "crypto";
import type { Request, Response } from "express";
import * as db from "./db";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Hash password using bcryptjs
 */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, SALT_ROUNDS);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return compare(password, hash);
}

/**
 * Generate random token
 */
export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Register new user
 */
export async function registerUser(username: string, password: string, name?: string) {
  // Check if user already exists
  const existingUser = await db.getUserByUsername(username);
  if (existingUser) {
    throw new Error("User already exists");
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user
  await db.upsertUser({
    username,
    passwordHash,
    name: name || null,
    role: "user",
  });

  const user = await db.getUserByUsername(username);
  return user;
}

/**
 * Login user
 */
export async function loginUser(username: string, password: string) {
  const user = await db.getUserByUsername(username);
  if (!user) {
    throw new Error("Invalid credentials");
  }

  if (user.isBlocked) {
    throw new Error("User is blocked");
  }

  const isPasswordValid = await verifyPassword(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new Error("Invalid credentials");
  }

  // Create session
  const token = generateToken();
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

  await db.createSession({
    userId: user.id,
    token,
    expiresAt,
  });

  // Update last signed in
  await db.upsertUser({
    username: user.username,
    passwordHash: user.passwordHash,
    lastSignedIn: new Date(),
  });

  return { user, token };
}

/**
 * Authenticate request using session token
 */
export async function authenticateRequest(req: Request): Promise<any> {
  const cookies = parseCookies(req.headers.cookie || "");
  const sessionCookie = cookies.get(COOKIE_NAME);

  if (!sessionCookie) {
    return null;
  }

  const session = await db.getSessionByToken(sessionCookie);
  if (!session) {
    return null;
  }

  // Check if session is expired
  if (new Date() > session.expiresAt) {
    await db.deleteSession(sessionCookie);
    return null;
  }

  const user = await db.getUserById(session.userId);
  if (!user || user.isBlocked) {
    return null;
  }

  return user;
}

/**
 * Logout user
 */
export async function logoutUser(req: Request, res: Response) {
  const cookies = parseCookies(req.headers.cookie || "");
  const sessionCookie = cookies.get(COOKIE_NAME);

  if (sessionCookie) {
    await db.deleteSession(sessionCookie);
  }

  const cookieOptions = getSessionCookieOptions(req);
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
}

/**
 * Set session cookie
 */
export function setSessionCookie(res: Response, token: string, req: Request) {
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, token, {
    ...cookieOptions,
    maxAge: TOKEN_EXPIRY_MS,
  });
}

/**
 * Parse cookies from header
 */
function parseCookies(cookieHeader: string): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!cookieHeader) return cookies;

  cookieHeader.split(";").forEach((cookie) => {
    const [name, value] = cookie.trim().split("=");
    if (name && value) {
      cookies.set(name, decodeURIComponent(value));
    }
  });

  return cookies;
}
