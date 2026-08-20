import crypto from "node:crypto";

const ITERATIONS = 100000;
const KEY_LEN = 64;
const DIGEST = "sha512";

/**
 * Hashes a plaintext password with a randomly generated salt using PBKDF2.
 */
export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");
    crypto.pbkdf2(password, salt, ITERATIONS, KEY_LEN, DIGEST, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

/**
 * Verifies a plaintext password against a stored salt:hash string.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const parts = storedHash.split(":");
    if (parts.length !== 2) return resolve(false);

    const [salt, key] = parts;
    crypto.pbkdf2(password, salt, ITERATIONS, KEY_LEN, DIGEST, (err, derivedKey) => {
      if (err) return reject(err);
      const keyBuffer = Buffer.from(key, "hex");
      if (keyBuffer.length !== derivedKey.length) {
        return resolve(false);
      }
      resolve(crypto.timingSafeEqual(keyBuffer, derivedKey));
    });
  });
}

/**
 * Generates a random session token.
 */
export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}
