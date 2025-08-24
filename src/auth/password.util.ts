import * as bcrypt from "bcrypt";

const DEFAULT_SALT_ROUNDS = 12;

export async function hashPassword(
  plainPassword: string,
  saltRounds = DEFAULT_SALT_ROUNDS
): Promise<string> {
  if (!plainPassword) {
    throw new Error("Password must be a non-empty string");
  }
  return bcrypt.hash(plainPassword, saltRounds);
}

export async function verifyPassword(
  plainPassword: string,
  passwordHash: string
): Promise<boolean> {
  if (!plainPassword || !passwordHash) {
    return false;
  }
  return bcrypt.compare(plainPassword, passwordHash);
}
