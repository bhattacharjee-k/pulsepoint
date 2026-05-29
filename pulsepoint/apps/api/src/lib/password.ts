import bcrypt from 'bcrypt';

const rounds = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, rounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
