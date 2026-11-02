import 'expo-sqlite/localStorage/install';

import { useSyncExternalStore } from 'react';

export type Prefs = {
  biometricLock: boolean;
  autoLockSeconds: number;
  ollamaUrl: string;
  ollamaModel: string;
  monthlyBudget: number;
  /** Use the Ollama model for entry parsing, receipts and chat. Off = everything runs on the phone. */
  aiEnabled: boolean;
  /** Set once the one-time re-sort of "Other" entries has run (v1.2.0). */
  tidiedCategories: boolean;
  /** Scan for new bank SMS and payment notifications each time Ginti opens. */
  autoDetect: boolean;
};

const DEFAULTS: Prefs = {
  autoDetect: true,
  aiEnabled: true,
  tidiedCategories: false,
  biometricLock: true,
  autoLockSeconds: 60,
  ollamaUrl: process.env.EXPO_PUBLIC_OLLAMA_URL ?? 'http://192.168.0.147:11434',
  ollamaModel: process.env.EXPO_PUBLIC_OLLAMA_MODEL ?? 'gemma4:e2b',
  monthlyBudget: 60000,
};

const KEY = 'ginti.prefs';

// Undefined when modules are evaluated outside the app (bundling, server rendering).
const store = globalThis.localStorage as Storage | undefined;

function load(): Prefs {
  try {
    const raw = store?.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

let current = load();
const listeners = new Set<() => void>();

export function getPrefs() {
  return current;
}

export function setPrefs(patch: Partial<Prefs>) {
  current = { ...current, ...patch };
  store?.setItem(KEY, JSON.stringify(current));
  listeners.forEach((l) => l());
}

export function usePrefs() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getPrefs,
  );
}
