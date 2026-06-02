/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
import * as fs   from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { ProjectListItem } from './interface/model';

// ─── Path helpers ────────────────────────────────────────────────────────────

export function pathIsHiproj(p: string): boolean {
  return p.endsWith('.hiproj');
}

export function getUserDir(): string {
  return process.env.HOME ?? process.env.USERPROFILE ?? '/';
}

// ─── Project list helpers ─────────────────────────────────────────────────────

const PROJECT_LIST_FILE = 'shadow_projectlist.json';
const LATEST_LIST_FILE  = 'shadow_latestlist.json';

function getListPath(globalStoragePath: string, file: string): string {
  // Store one level up from globalStorageUri (same pattern as projectwizard)
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
    if (idx >= 0) {
      list[idx] = item;
    } else {
      list.push(item);
    }
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
  const list: ProjectListItem[] = readJsonSafe(listPath).filter((x) => x.path !== targetPath);
  fs.writeFileSync(listPath, JSON.stringify(list, null, 2), 'utf-8');

  const latestPath = getListPath(globalStoragePath, LATEST_LIST_FILE);
  const latest: ProjectListItem[] = readJsonSafe(latestPath).filter((x) => x.path !== targetPath);
  fs.writeFileSync(latestPath, JSON.stringify(latest, null, 2), 'utf-8');
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

/** Recursively find all .hiproj files under rootDir (max depth 5) */
export function findHiprojFiles(rootDir: string, depth = 0): string[] {
  if (depth > 5 || !fs.existsSync(rootDir)) { return []; }
  const results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return [];
  }
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

// ─── Active workspace ─────────────────────────────────────────────────────────

export async function getActiveWorkFolderPath(): Promise<string | undefined> {
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    return folders[0].uri.fsPath;
  }
  return undefined;
}
