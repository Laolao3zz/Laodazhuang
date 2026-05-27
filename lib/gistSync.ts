/**
 * GitHub Gist 同步
 *
 * - Token 仅存于 localStorage，永远不进代码仓库
 * - 第一次同步：POST /gists 创建，记下 gistId
 * - 后续同步：PATCH /gists/:id 更新
 * - 拉回：GET /gists/:id 读取
 *
 * 一份 Gist 对应一台设备的全量备份；换设备只需输入同一个 token + gistId
 */

import { saveWithMirror } from './storage';

const TOKEN_KEY = 'fitness_gist_token';
const GIST_ID_KEY = 'fitness_gist_id';
const LAST_SYNC_KEY = 'fitness_gist_last_sync';
const FILE_NAME = 'laodazhuang-backup.json';

export interface GistSyncSettings {
  token: string | null;
  gistId: string | null;
  lastSyncTs: number | null;
}

export function getSettings(): GistSyncSettings {
  return {
    token: localStorage.getItem(TOKEN_KEY),
    gistId: localStorage.getItem(GIST_ID_KEY),
    lastSyncTs: parseInt(localStorage.getItem(LAST_SYNC_KEY) || '0') || null,
  };
}

export function saveToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token.trim());
}

export function clearSettings(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(GIST_ID_KEY);
  localStorage.removeItem(LAST_SYNC_KEY);
}

export function saveGistId(id: string): void {
  localStorage.setItem(GIST_ID_KEY, id);
}

function markSynced(): void {
  localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
}

function authHeaders(token: string): HeadersInit {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

export interface BackupBlob {
  history: any;
  plans: any;
  stats: any;
  exHistory: any;
  planIndex: number;
  rewards: any;
  legacyMap: any;
}

/** 上传到 Gist：第一次 POST 创建，之后 PATCH 更新 */
export async function pushToGist(blob: BackupBlob): Promise<{ gistId: string }> {
  const { token, gistId } = getSettings();
  if (!token) throw new Error('未配置 GitHub Token');

  const content = JSON.stringify(blob, null, 2);
  const body = JSON.stringify({
    description: `劳大壮养成记备份 · ${new Date().toLocaleString('zh-CN')}`,
    public: false,
    files: { [FILE_NAME]: { content } },
  });

  let url = 'https://api.github.com/gists';
  let method: 'POST' | 'PATCH' = 'POST';
  if (gistId) {
    url = `https://api.github.com/gists/${gistId}`;
    method = 'PATCH';
  }

  const res = await fetch(url, { method, headers: authHeaders(token), body });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub API ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const id = data.id as string;
  saveGistId(id);
  markSynced();
  return { gistId: id };
}

/** 从 Gist 拉回数据，返回 BackupBlob */
export async function pullFromGist(): Promise<BackupBlob> {
  const { token, gistId } = getSettings();
  if (!token) throw new Error('未配置 GitHub Token');
  if (!gistId) throw new Error('未配置 Gist ID（请先上传一次创建）');

  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: 'GET',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub API ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const file = data.files?.[FILE_NAME];
  if (!file) throw new Error(`Gist 里找不到 ${FILE_NAME}`);

  // 大文件 GitHub 会截断，需要从 raw_url 二次拉取
  let content = file.content as string;
  if (file.truncated && file.raw_url) {
    const raw = await fetch(file.raw_url);
    content = await raw.text();
  }
  return JSON.parse(content);
}

/** 应用拉回的数据到 localStorage + IndexedDB（双写） */
export function applyBackupBlob(blob: BackupBlob): void {
  if (blob.history !== undefined) saveWithMirror('fitness_history_v6', blob.history);
  if (blob.plans !== undefined) saveWithMirror('fitness_plans_v8', blob.plans);
  if (blob.stats !== undefined) saveWithMirror('fitness_stats_v6', blob.stats);
  if (blob.exHistory !== undefined) saveWithMirror('fitness_ex_history_v6', blob.exHistory);
  if (typeof blob.planIndex === 'number') saveWithMirror('fitness_plan_index_v6', blob.planIndex);
  if (blob.rewards !== undefined) saveWithMirror('fitness_rewards_v6', blob.rewards);
  if (blob.legacyMap !== undefined) saveWithMirror('fitness_legacy_map_v1', blob.legacyMap);
  markSynced();
}

/** 距离上次 Gist 同步的分钟数；从未同步返回 Infinity */
export function minutesSinceLastSync(): number {
  const { lastSyncTs } = getSettings();
  if (!lastSyncTs) return Infinity;
  return Math.floor((Date.now() - lastSyncTs) / 60000);
}
