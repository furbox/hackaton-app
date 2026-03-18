import { createHash } from 'crypto';

export async function hashPassword(plain: string): Promise<string> {
  return await Bun.password.hash(plain, {
    algorithm: "argon2id",
    memorySize: 65536,
    timeCost: 3,
  });
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return await Bun.password.verify(plain, hash);
}

export function hashIP(ip: string): string {
  return createHash('sha256').update(ip).digest('hex');
}
