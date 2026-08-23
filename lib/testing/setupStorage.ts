/**
 * Test-only `localStorage`.
 *
 * Node 26 exposes its own `localStorage` global, which shadows the one jsdom
 * installs — and Node's is inert unless the process was started with
 * `--localstorage-file`. The result is a DOM environment where
 * `window.localStorage` is `undefined`, which is neither jsdom's fault nor
 * something the application should have to know about.
 *
 * So the tests bring their own: a plain in-memory `Storage`, reset between
 * files by virtue of being installed fresh in each worker.
 */

class MemoryStorage implements Storage {
  private entries = new Map<string, string>();

  get length(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  getItem(key: string): string | null {
    return this.entries.has(key) ? (this.entries.get(key) as string) : null;
  }

  key(index: number): string | null {
    return Array.from(this.entries.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, String(value));
  }
}

if (typeof window !== 'undefined' && !window.localStorage) {
  const storage = new MemoryStorage();
  Object.defineProperty(window, 'localStorage', {
    value: storage,
    configurable: true,
    writable: false,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
    writable: false,
  });
}
