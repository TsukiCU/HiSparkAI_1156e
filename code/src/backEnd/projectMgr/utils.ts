/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
import * as fs   from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { ProjectListItem } from './interface/model';

// ─── Path helpers ────────────────────────────────────────────────────────────

export function getUserDir(): string {
  return process.env.HOME ?? process.env.USERPROFILE ?? '/';
}

// ─── Project list helpers ─────────────────────────────────────────────────────

const PROJECT_LIST_FILE = 'projectMgr_list.json';
const LATEST_LIST_FILE  = 'projectMgr_latestlist.json';

function getListPath(globalStoragePath: string, file: string): string {
  return path.join(path.dirname(globalStoragePath), file);
}

function readJsonSafe(filePath: string): any[] {
  if (!fs.existsSync(filePath)) { return []; }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return [];
  }
}

export function addItemsToProList(items: ProjectListItem[], globalStoragePath: string): void {
  const listPath = getListPath(globalStoragePath, PROJECT_LIST_FILE);
  const list: ProjectListItem[] = readJsonSafe(listPath);
  for (const item of items) {
    const idx = list.findIndex((x) => x.path === item.path);
    if (idx >= 0) { list[idx] = item; } else { list.push(item); }
  }
  fs.writeFileSync(listPath, JSON.stringify(list, null, 2), 'utf-8');
}

export function updateOneItemToLatestList(item: ProjectListItem, globalStoragePath: string): void {
  const listPath = getListPath(globalStoragePath, LATEST_LIST_FILE);
  let list: ProjectListItem[] = readJsonSafe(listPath);
  list = list.filter((x) => x.path !== item.path);
  list.unshift(item);
  if (list.length > 50) { list = list.slice(0, 50); }
  fs.writeFileSync(listPath, JSON.stringify(list, null, 2), 'utf-8');
}

export function getProjectList(globalStoragePath: string): ProjectListItem[] {
  return readJsonSafe(getListPath(globalStoragePath, PROJECT_LIST_FILE));
}

export function getLatestList(globalStoragePath: string): ProjectListItem[] {
  return readJsonSafe(getListPath(globalStoragePath, LATEST_LIST_FILE));
}

export function deleteFromProjectList(targetPath: string, globalStoragePath: string): void {
  const listPath = getListPath(globalStoragePath, PROJECT_LIST_FILE);
  const list = readJsonSafe(listPath).filter((x) => x.path !== targetPath);
  fs.writeFileSync(listPath, JSON.stringify(list, null, 2), 'utf-8');

  const latestPath = getListPath(globalStoragePath, LATEST_LIST_FILE);
  const latest = readJsonSafe(latestPath).filter((x) => x.path !== targetPath);
  fs.writeFileSync(latestPath, JSON.stringify(latest, null, 2), 'utf-8');
}

// ─── projectdata.json bridge ──────────────────────────────────────────────────
// code (hisparkai) extension reads projectdata.json to map SDK workspace → .hiproj path.

const PROJECTDATA_FILE = 'projectdata.json';

export function upsertProjectDataJson(
  sdkDir: string,
  hiprojPath: string,
  globalStoragePath: string,
): void {
  const filePath = getListPath(globalStoragePath, PROJECTDATA_FILE);
  const list: any[] = readJsonSafe(filePath);
  const idx = list.findIndex((x) => x.SDK === sdkDir);
  const entry = { SDK: sdkDir, active: hiprojPath };
  if (idx >= 0) { list[idx] = { ...list[idx], ...entry }; } else { list.push(entry); }
  fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf-8');
}

export function removeProjectDataJson(sdkDir: string, globalStoragePath: string): void {
  const filePath = getListPath(globalStoragePath, PROJECTDATA_FILE);
  const list: any[] = readJsonSafe(filePath).filter((x) => x.SDK !== sdkDir);
  fs.writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf-8');
}

// ─── Main plugin project list bridge ─────────────────────────────────────────
// ChipConfigPanel.toggle() reads projectlist.json (path stored as ChipConfigPanel.configPath)
// to populate window.initialDemoData for the welcome page's project list.
// The wizard writes to the SAME file using the path pre-computed in extension.ts
// (ProjectMgrContext.mainProjectListPath) so there is no independent path calculation that
// could drift from ChipConfigPanel's path on non-standard IDE installs.

export function upsertMainProjectList(item: ProjectListItem, mainProjectListPath: string): void {
  const list: ProjectListItem[] = readJsonSafe(mainProjectListPath);
  const idx = list.findIndex((x) => x.path === item.path);
  if (idx >= 0) { list[idx] = item; } else { list.push(item); }
  try { fs.writeFileSync(mainProjectListPath, JSON.stringify(list, null, 2), 'utf-8'); } catch { /* ignore */ }
}

export function removeFromMainProjectList(targetPath: string, mainProjectListPath: string): void {
  const list = readJsonSafe(mainProjectListPath).filter((x: any) => x.path !== targetPath);
  try { fs.writeFileSync(mainProjectListPath, JSON.stringify(list, null, 2), 'utf-8'); } catch { /* ignore */ }
}

// ─── hiproj helpers ───────────────────────────────────────────────────────────

export function getHiprojContent(hiprojPath: string): any {
  if (!fs.existsSync(hiprojPath)) { return null; }
  try {
    const ini = require('ini');
    return ini.parse(fs.readFileSync(hiprojPath, 'utf-8'));
  } catch {
    return null;
  }
}

export function findHiprojFiles(rootDir: string, depth = 0): string[] {
  if (depth > 5 || !fs.existsSync(rootDir)) { return []; }
  const results: string[] = [];
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(rootDir, { withFileTypes: true }); } catch { return []; }
  for (const entry of entries) {
    const full = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findHiprojFiles(full, depth + 1));
    } else if (entry.isFile() && entry.name.endsWith('.hiproj')) {
      results.push(full);
    }
  }
  return results;
}

// ─── Modal helper ─────────────────────────────────────────────────────────────

export function showMessageModal(opts: { content: string; infoType?: 'tips' | 'err' | 'warn' }): void {
  if (opts.infoType === 'err') {
    vscode.window.showErrorMessage(opts.content);
  } else {
    vscode.window.showInformationMessage(opts.content);
  }
}
