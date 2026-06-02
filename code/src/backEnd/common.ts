/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { sum } from '@src/backEnd/sum';
import { execSync } from 'child_process';
import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { Logger } from './output/outputLogger';
import * as fsp from 'fs/promises';
import * as fs from 'fs';
import * as path from 'path';

const shownErrors = new Set<string>();

export interface RunProcessOptions {
  cmd?: string;
  customEnv?: NodeJS.ProcessEnv;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
  stdoutFilter?: (line: string) => boolean;
}

export interface ExeRunnerOptions {
  exe: string;
  args: string[];
  cwd?: string;
  mode?: 'utf8' | 'utf16le'; // Output of `wsl.exe -xxx` using pipe is in UTF-16LE.
  logger?: Logger;
  python?: boolean; // If it's a python script.
  silent?: boolean; // Run in background.
}

export type ExeRunner = (
  options: ExeRunnerOptions
) => Promise<{ code: number; stdout: string; stderr: string }>;

export function foo(a: number, b: number): number {
  const c = sum(a, b);
  const d = c - 1;
  return d;
}

// Path info on WSL.
export interface LinuxPathInfo {
  linuxPath: string; // /mnt/c/... or /home/... or /root/...
  distro?: string;
  source: 'windows' | 'wsl-unc' | 'linux';
};

export function getWorkFolderPath(): string {
  const projectPath = vscode.workspace.workspaceFolders;
  if (!projectPath || !Array.isArray(projectPath) || !projectPath[0]?.uri?.fsPath) {
    return '';
  } else {
    return projectPath[0].uri.fsPath;
  }
}

export function getToolsPath(): string {
  const envKey = 'HISPARK_TOOL_PATH';
  const escapedName = envKey.replace(/'/g, "''");
  const command = `powershell -Command "[Environment]::GetEnvironmentVariable('${escapedName}', 'User')"`;

  try {
    const stdout = execSync(command, { encoding: 'utf8' });
    const value = stdout.trim();
    return value;
  } catch (err) {
    return '';
  }
}

export async function safeExecuteCommand(
  command: string,
  args: any[] = [],
  notFoundMessage?: string
): Promise<boolean> {
  const commands = await vscode.commands.getCommands(true);

  if (!commands.includes(command)) {
    if (notFoundMessage) {
      vscode.window.showInformationMessage(notFoundMessage);
    }
    return false;
  }

  await vscode.commands.executeCommand(command, ...args);
  return true;
}

export function parseArray(data: any): any[] {
  if (Array.isArray(data)) { return data; }
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function winPathToMnt(winPath: string): string | undefined {
  try {
    const m = winPath.match(/^(?<drive>[a-zA-Z]):\\(?<rest>.*)$/);
    if (!m?.groups) {
      return undefined;
    }

    const drive = m.groups.drive.toLowerCase();
    const rest = m.groups.rest.replace(/\\/g, '/');
    return `/mnt/${drive}/${rest}`;
  } catch (err) {
    throw new Error(String(err));
  }
}

export function exeRunner(
  options: ExeRunnerOptions
): Promise<{ code: number; stdout: string; stderr: string }> {
  const { exe, args, cwd, mode = 'utf8', logger, python, silent } = options;

  return new Promise((resolve) => {
    const child = spawn(exe, args, { cwd, windowsHide: true });

    const encoding = mode === 'utf16le' ? 'utf16le' : 'utf8';
    child.stdout.setEncoding(encoding);
    child.stderr.setEncoding(encoding);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data;
      if (logger && !silent) {
        logger.raw(data);
      }
    });

    child.stderr.on('data', (data) => {
      stderr += data;
      if (!logger || silent) { return; }
      logger.raw(data);
    });

    child.on('error', (err) =>
      resolve({ code: -1, stdout, stderr: String(err) })
    );

    child.on('close', (code) =>
      resolve({ code: code ?? -1, stdout, stderr })
    );
  });
}

// Handle both '\\wsl$\distro\path' and '\\wsl.localhost\distro\path'.
export function wslUncToLinuxPath(
  uncPath: string
): { distro: string; linuxPath: string } | undefined {
  const m = uncPath.match(
    /^\\\\wsl(?:\.localhost)?\\(?<distro>[^\\]+)\\(?<rest>.*)$/i
  );
  if (!m?.groups) {
    return undefined;
  }

  const distro = m.groups.distro;
  const rest = m.groups.rest.replace(/\\/g, '/');
  return { distro, linuxPath: `/${rest}` };
}


export function toLinuxPath(fsPath: string): LinuxPathInfo | undefined {
  if (!fsPath) {
    return undefined;
  }

  if (fsPath.startsWith('/')) {
    return { linuxPath: fsPath, source: 'linux' };
  }

  try {
    // if it's WSL UNC, set LinuxPathInfo
    const unc = wslUncToLinuxPath(fsPath);
    if (unc) {
      return { linuxPath: unc.linuxPath, distro: unc.distro, source: 'wsl-unc' };
    }

    // Path transformation. Windows drive path -> /mnt/<drive>)
    const mnt = winPathToMnt(fsPath);
    if (mnt) {
      return { linuxPath: mnt, source: 'windows' };
    }
  } catch (err) {
    throw new Error(String(err));
  }

  return undefined;
}

export function shQuote(s: string): string {
  // To run safely in shell.
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

// Convert a Windows path into a Linux path that works on WSL
export async function winToLinuxPathForWsl(
  distro: string,
  winPath: string,
  runner: ExeRunner
): Promise<string | undefined> {
  // Already is a wsl path.
  if (winPath.startsWith('/mnt/')) {
    return winPath;
  }

  // For standard path such as 'C:\\xxx\\yyy', map into /mnt/c/xxx/yyy directly.
  const mnt = winPathToMnt(winPath);
  if (mnt) { return mnt; }

  // Fallback option. Let wslpath decide.
  const r = await runner({
    exe: 'wsl.exe',
    args: ['-d', distro, '--', 'bash', '-lc', `wslpath -u ${shQuote(winPath)}`],
  });

  if (r.code !== 0) { return undefined; }

  return r.stdout.trim();
}

export async function copyFileToFolder(srcFile: string, targetFolder: string): Promise<void> {
  const fileName = path.basename(srcFile);
  const targetPath = path.join(targetFolder, fileName);

  try {
    await fsp.copyFile(srcFile, targetPath);
  } catch (err) {
    throw err;
  }
}

export function showErrorOnce(errMsg: string): void {
  if (shownErrors.has(errMsg)) {
    return;
  }
  shownErrors.add(errMsg);

  vscode.window.showErrorMessage(errMsg);
}

export function showErrorOnceWithTTL(errMsg: string, ttl = 5000): void {
  // show every 5 seconds.
  if (shownErrors.has(errMsg)) {
    return;
  }
  shownErrors.add(errMsg);
  vscode.window.showErrorMessage(errMsg);

  setTimeout(() => {
    shownErrors.delete(errMsg);
  }, ttl);
}

export function parseToLowerArray(input: string): string[] {
  // SupportConvertType field of parsedModel.json.
  return input
    .split(',') // Split by ','
    .map(item => item.trim()) // Remove leading and trailing spaces.
    .filter(Boolean) // Remove empty strings.
    .map(item => item.toLowerCase()); // All lower case for consistency.
}

export function parseArrayString(str: any): any {
  try {
    let cleanStr = str.replace(/\s+/g, '');
    cleanStr = cleanStr.replace(/\[|\]/g, '');

    if (!cleanStr) {
      return [];
    }

    return cleanStr.split(',');
  } catch (error) {
    return [];
  }
}

// Parses a CSV line
export function parseCSVLine(line: any): any {
  const matches = line.match(/(?:"(?:[^"]|"")*"|[^,]*),?/g);
  if (!matches) { return []; }
 
  return matches.map((field: any) => {
    let fielded = field.endsWith(',') ? field.slice(0, -1) : field;
    if (fielded.startsWith('"') && fielded.endsWith('"')) {
      fielded = fielded.slice(1, -1).replace(/""/g, '"');
    }
    const x = fielded.trim();
    if (fielded.includes(',')) {
      return parseArrayString(x);
    }
    return x;
  });
}

export function deleteFolder(paths: string): void {
  const deleteFolderRecursive = (filePath: string): void => {
    if (fs.existsSync(filePath)) {
      fs.readdirSync(filePath).forEach((file) => {
        const curPath = `${filePath}/${file}`;
        if (fs.lstatSync(curPath).isDirectory()) {
          deleteFolderRecursive(curPath);
        } else {
          fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(filePath);
    }
  };

  deleteFolderRecursive(paths);
}