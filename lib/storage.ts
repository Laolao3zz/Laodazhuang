/**
 * 双写存储层：localStorage（主）+ IndexedDB（镜像）
 *
 * - 写：每次都同步写 localStorage（UI 立刻拿到）+ 异步写 IndexedDB（持久化）
 * - 读：仍然走 localStorage（保持现有同步代码兼容）
 * - 恢复：启动时如果 localStorage 缺失关键 key，自动从 IndexedDB 拉回
 *
 * 解决 iOS 16 及以下 PWA 14 天没打开会清 localStorage 的问题。
 * IndexedDB 不在 7 天清理白名单里，更可靠。
 */

const DB_NAME = 'laodazhuang';
const DB_VERSION = 1;
const STORE = 'kv';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB not available')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function idbGet<T = unknown>(key: string): Promise<T | undefined> {
  try {
    const db = await openDB();
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  } catch { return undefined; }
}

async function idbSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* swallow */ }
}

/** 同步写 localStorage + 异步镜像到 IndexedDB */
export function saveWithMirror(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (e) { console.warn('[storage] localStorage save failed:', e); }
  void idbSet(key, value); // fire-and-forget
}

/**
 * 启动时调用：检查关键 key 在 localStorage 是否缺失/为空，
 * 若是，从 IndexedDB 拉回并写回 localStorage。
 * 返回被恢复的 key 列表（用于 UI 提示）。
 */
export async function recoverMissingKeys(keys: string[]): Promise<string[]> {
  const recovered: string[] = [];
  for (const key of keys) {
    const ls = localStorage.getItem(key);
    const isEmpty = ls == null || ls === '[]' || ls === '{}' || ls === 'null' || ls === '""';
    if (!isEmpty) continue;
    const idb = await idbGet(key);
    if (idb === undefined || idb === null) continue;
    try {
      localStorage.setItem(key, JSON.stringify(idb));
      recovered.push(key);
    } catch (e) { console.warn('[storage] recover failed for', key, e); }
  }
  return recovered;
}

// ===== Schema version =====

const SCHEMA_KEY = 'fitness_schema_version';
export const CURRENT_SCHEMA = 1;

export function getSchemaVersion(): number {
  const v = localStorage.getItem(SCHEMA_KEY);
  return v ? parseInt(v, 10) || 0 : 0;
}

export function setSchemaVersion(v: number): void {
  saveWithMirror(SCHEMA_KEY, v);
  // saveWithMirror stringifies to "1", but legacy code expects raw number; write both ways
  localStorage.setItem(SCHEMA_KEY, String(v));
}

/**
 * 跑迁移：从当前版本升到 CURRENT_SCHEMA。
 * 现在没有真实迁移，只是把版本号写上以备未来。
 */
export function runMigrations(): void {
  const from = getSchemaVersion();
  if (from >= CURRENT_SCHEMA) return;
  // future migrations: if (from < 2) migrateTo2();
  setSchemaVersion(CURRENT_SCHEMA);
}

// ===== 备份提醒 =====

const LAST_BACKUP_KEY = 'fitness_last_backup_ts';

export function markBackupDone(): void {
  saveWithMirror(LAST_BACKUP_KEY, Date.now());
}

export function getLastBackupTs(): number | null {
  const v = localStorage.getItem(LAST_BACKUP_KEY);
  if (!v) return null;
  // 兼容 saveWithMirror 写的 JSON 数字 与 旧的纯字符串
  try { return JSON.parse(v); } catch { return parseInt(v, 10) || null; }
}

/** 距离上次备份的天数；从未备份返回 Infinity */
export function daysSinceLastBackup(): number {
  const ts = getLastBackupTs();
  if (!ts) return Infinity;
  return Math.floor((Date.now() - ts) / 86400000);
}
