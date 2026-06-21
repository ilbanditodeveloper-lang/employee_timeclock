import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_PREFIX = "scrypt";
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

function isScryptHash(storedPassword: string): boolean {
  return storedPassword.startsWith(`${SCRYPT_PREFIX}$`);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${SCRYPT_PREFIX}$${salt}$${hash}`;
}

function compareScryptPassword(password: string, storedPassword: string): boolean {
  const parts = storedPassword.split("$");
  if (parts.length !== 3) return false;
  const [, salt, storedHash] = parts;
  if (!salt || !storedHash) return false;

  const computedHash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  const expected = Buffer.from(storedHash, "hex");
  const actual = Buffer.from(computedHash, "hex");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export function verifyPassword(
  password: string,
  storedPassword: string | null | undefined
): { isValid: boolean; needsUpgrade: boolean } {
  if (!storedPassword) {
    return { isValid: false, needsUpgrade: false };
  }

  if (isScryptHash(storedPassword)) {
    return {
      isValid: compareScryptPassword(password, storedPassword),
      needsUpgrade: false,
    };
  }

  const legacyBase64 = Buffer.from(password).toString("base64");
  const isLegacyMatch = legacyBase64 === storedPassword;
  return { isValid: isLegacyMatch, needsUpgrade: isLegacyMatch };
}
