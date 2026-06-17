import { createHash, randomBytes, timingSafeEqual } from 'crypto';

function hashPassword(password: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${password}`).digest('hex');
}

function generateSalt(): string {
  return randomBytes(16).toString('hex');
}

function createPasswordRecord(password: string): { salt: string; hash: string } {
  const salt = generateSalt();
  return { salt, hash: hashPassword(password, salt) };
}

function verifyPassword(password: string, salt: string, hash: string): boolean {
  const candidate = hashPassword(password, salt);
  try {
    return timingSafeEqual(Buffer.from(candidate), Buffer.from(hash));
  } catch {
    return false;
  }
}

export { createPasswordRecord, verifyPassword };
