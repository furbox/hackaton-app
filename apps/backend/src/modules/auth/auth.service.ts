import Database from 'bun:sqlite';
import { randomBytes } from 'crypto';
import db from '../../db/client';
import { hashPassword, verifyPassword } from '../../utils/hash';
import { sendVerificationEmail, sendPasswordResetEmail } from '../../utils/email';

interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface JWTPayload {
  sub: number;
  username: string;
  email: string;
  rank: string;
}

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

export async function registerUser(input: RegisterInput): Promise<{ userId: number }> {
  const { username, email, password } = input;

  if (!USERNAME_REGEX.test(username)) {
    throw new Error('Invalid username: must be 3-30 alphanumeric characters or underscores');
  }

  if (!EMAIL_REGEX.test(email)) {
    throw new Error('Invalid email format');
  }

  if (!PASSWORD_REGEX.test(password)) {
    throw new Error('Password must be at least 8 characters with 1 uppercase letter and 1 digit');
  }

  const existingUser = db.query('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username) as { id: number } | undefined;
  if (existingUser) {
    const isEmail = db.query('SELECT id FROM users WHERE email = ?').get(email) as { id: number } | undefined;
    throw new Error(isEmail ? 'email_already_exists' : 'username_already_exists');
  }

  const passwordHash = await hashPassword(password);

  const result = db.query('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?) RETURNING id').get(username, email, passwordHash) as { id: number };
  const userId = result.id;

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  db.query('INSERT INTO email_verifications (user_id, token, expires_at) VALUES (?, ?, ?)').run(userId, token, expiresAt);

  try {
    await sendVerificationEmail(email, token);
  } catch (error) {
    console.error('Failed to send verification email:', error);
  }

  return { userId };
}

export async function verifyEmail(token: string): Promise<void> {
  const verification = db.query('SELECT * FROM email_verifications WHERE token = ? AND used_at IS NULL').get(token) as {
    id: number;
    user_id: number;
    expires_at: string;
  } | undefined;

  if (!verification) {
    throw new Error('token_invalid');
  }

  if (new Date(verification.expires_at) < new Date()) {
    throw new Error('token_expired');
  }

  db.query('UPDATE users SET email_verified = 1, updated_at = datetime("now") WHERE id = ?').run(verification.user_id);
  db.query('UPDATE email_verifications SET used_at = datetime("now") WHERE id = ?').run(verification.id);
}

export async function loginUser(input: LoginInput): Promise<{ token: string; user: JWTPayload }> {
  const { email, password } = input;

  const user = db.query('SELECT id, username, email, password_hash, rank, email_verified FROM users WHERE email = ?').get(email) as {
    id: number;
    username: string;
    email: string;
    password_hash: string;
    rank: string;
    email_verified: number;
  } | undefined;

  if (!user) {
    throw new Error('invalid_credentials');
  }

  if (user.email_verified === 0) {
    throw new Error('email_not_verified');
  }

  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    throw new Error('invalid_credentials');
  }

  const jwtSecret = Bun.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }

  const payload = {
    sub: user.id,
    username: user.username,
    email: user.email,
    rank: user.rank,
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signatureData = `${encodedHeader}.${encodedPayload}`;
  const signature = Buffer.from(await crypto.subtle.sign(
    'HMAC',
    await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(jwtSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    ),
    new TextEncoder().encode(signatureData)
  )).toString('base64url');

  const token = `${signatureData}.${signature}`;

  return { token, user: payload };
}

export async function forgotPassword(email: string): Promise<void> {
  const user = db.query('SELECT id FROM users WHERE email = ?').get(email) as { id: number } | undefined;

  if (!user) {
    return;
  }

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  db.query('INSERT INTO email_verifications (user_id, token, expires_at) VALUES (?, ?, ?)').run(user.id, token, expiresAt);

  try {
    await sendPasswordResetEmail(email, token);
  } catch (error) {
    console.error('Failed to send password reset email:', error);
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  if (!PASSWORD_REGEX.test(newPassword)) {
    throw new Error('Password must be at least 8 characters with 1 uppercase letter and 1 digit');
  }

  const verification = db.query('SELECT * FROM email_verifications WHERE token = ? AND used_at IS NULL').get(token) as {
    id: number;
    user_id: number;
    expires_at: string;
  } | undefined;

  if (!verification) {
    throw new Error('token_invalid');
  }

  if (new Date(verification.expires_at) < new Date()) {
    throw new Error('token_expired');
  }

  const passwordHash = await hashPassword(newPassword);

  db.query('UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?').run(passwordHash, verification.user_id);
  db.query('UPDATE email_verifications SET used_at = datetime("now") WHERE id = ?').run(verification.id);
}
