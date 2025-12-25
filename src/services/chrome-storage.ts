// Chrome storage utilities with type safety
import type { StoredSettings, StoredPreferences } from "@/types/chrome";

type StorageKeys = StoredSettings & StoredPreferences;

/**
 * Get values from Chrome local storage
 */
export async function getStorage<K extends keyof StorageKeys>(
  keys: K[]
): Promise<Pick<StorageKeys, K>> {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => {
      resolve(result as Pick<StorageKeys, K>);
    });
  });
}

/**
 * Set values in Chrome local storage
 */
export async function setStorage(items: Partial<StorageKeys>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set(items, resolve);
  });
}

/**
 * Remove values from Chrome local storage
 */
export async function removeStorage(
  keys: (keyof StorageKeys)[]
): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove(keys, resolve);
  });
}

/**
 * Listen for storage changes
 */
export function onStorageChange(
  callback: (changes: { [key: string]: chrome.storage.StorageChange }) => void
): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string
  ) => {
    if (areaName === "local") {
      callback(changes);
    }
  };

  chrome.storage.onChanged.addListener(listener);

  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}
