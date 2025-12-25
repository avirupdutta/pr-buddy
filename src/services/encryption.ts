// Encryption utilities for secure API key storage using Web Crypto API
import { getStorage, setStorage } from "./chrome-storage";

// Constants for encryption
const ENCRYPTION_ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits recommended for AES-GCM
const SALT_LENGTH = 16;
const ITERATIONS = 100000;

// Fixed passphrase - combined with random salt for key derivation
// This provides security through the salt's randomness
const PASSPHRASE = "pr-buddy-secure-storage-v1";

/**
 * Generate a random salt for key derivation
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

/**
 * Convert Uint8Array to base64 string
 */
function arrayToBase64(array: Uint8Array): string {
  return btoa(String.fromCharCode(...array));
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToArray(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derive an encryption key from salt using PBKDF2
 */
async function deriveKey(salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(PASSPHRASE),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt.buffer as ArrayBuffer,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: ENCRYPTION_ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a plaintext string
 * Returns: base64 encoded string containing IV + ciphertext
 */
async function encrypt(plaintext: string, key: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const ciphertext = await crypto.subtle.encrypt(
    { name: ENCRYPTION_ALGORITHM, iv },
    key,
    encoder.encode(plaintext)
  );

  // Combine IV and ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return arrayToBase64(combined);
}

/**
 * Decrypt a base64 encoded ciphertext
 */
async function decrypt(encryptedData: string, key: CryptoKey): Promise<string> {
  const combined = base64ToArray(encryptedData);

  // Extract IV and ciphertext
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const decrypted = await crypto.subtle.decrypt(
    { name: ENCRYPTION_ALGORITHM, iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Get or create encryption salt from storage
 */
async function getOrCreateSalt(): Promise<Uint8Array> {
  const result = await getStorage(["encryptionSalt"]);

  if (result.encryptionSalt) {
    return base64ToArray(result.encryptionSalt);
  }

  // Create new salt and store it
  const salt = generateSalt();
  await setStorage({ encryptionSalt: arrayToBase64(salt) });
  return salt;
}

/**
 * High-level function to encrypt an API key for storage
 */
export async function encryptApiKey(value: string): Promise<string> {
  if (!value) return value;

  const salt = await getOrCreateSalt();
  const key = await deriveKey(salt);
  return encrypt(value, key);
}

/**
 * High-level function to decrypt an API key from storage
 */
export async function decryptApiKey(
  encryptedValue: string
): Promise<string | null> {
  if (!encryptedValue) return null;

  try {
    const result = await getStorage(["encryptionSalt"]);
    if (!result.encryptionSalt) {
      // No salt means the value is not encrypted (legacy data)
      return encryptedValue;
    }

    const salt = base64ToArray(result.encryptionSalt);
    const key = await deriveKey(salt);
    return await decrypt(encryptedValue, key);
  } catch (error) {
    // If decryption fails, the value might be legacy unencrypted data
    console.warn("Failed to decrypt API key, assuming legacy format:", error);
    return encryptedValue;
  }
}
