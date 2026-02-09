// Shared utility for API key management
import { decryptApiKey } from "./encryption";

export type DecryptedKeys = Record<string, string>;

export async function getDecryptedAPIKeys(): Promise<DecryptedKeys> {
  const apiKeysResult = await chrome.storage.local.get([
    "openRouterKey", "openaiKey", "anthropicKey", "googleKey", "groqKey", "cerebrasKey"
  ]) as {
    openRouterKey?: string;
    openaiKey?: string;
    anthropicKey?: string;
    googleKey?: string;
    groqKey?: string;
    cerebrasKey?: string;
  };

  return {
    openRouterKey: (apiKeysResult.openRouterKey ? await decryptApiKey(apiKeysResult.openRouterKey) : null) || "",
    openaiKey: (apiKeysResult.openaiKey ? await decryptApiKey(apiKeysResult.openaiKey) : null) || "",
    anthropicKey: (apiKeysResult.anthropicKey ? await decryptApiKey(apiKeysResult.anthropicKey) : null) || "",
    googleKey: (apiKeysResult.googleKey ? await decryptApiKey(apiKeysResult.googleKey) : null) || "",
    groqKey: (apiKeysResult.groqKey ? await decryptApiKey(apiKeysResult.groqKey) : null) || "",
    cerebrasKey: (apiKeysResult.cerebrasKey ? await decryptApiKey(apiKeysResult.cerebrasKey) : null) || "",
  };
}