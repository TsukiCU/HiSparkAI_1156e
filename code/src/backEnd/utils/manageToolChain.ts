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
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { extractTarFile, extractZipFile, getToolsPath, setToolsPath } from './downloadToolChains';

export async function getUserToolsPath(): Promise<string> {
  let toolsPath: string = getToolsPath();
  let defaultUri;
  if (toolsPath && toolsPath.length > 0) {
    defaultUri = toolsPath;
  }
  // 选择路径
  const folderUri = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectFiles: false,
    canSelectMany: false,
    openLabel: '选择保存位置',
    title: '选择工具链保存位置',
    defaultUri: defaultUri ? vscode.Uri.file(defaultUri) : undefined,
  });
  if (!folderUri || folderUri.length === 0) {
    // 用户取消了选择
    return '';
  }
  toolsPath = folderUri[0].fsPath;
  return toolsPath;
}

export function containsChineseOrSpace(str: string): boolean {
  const regex = /[\u4e00-\u9fa5\s]/;
  return regex.test(str);
}

export async function reSelectToolsPath(): Promise<void> {
  const result = await vscode.window.showInformationMessage(
    '工具链下载路径中不能包含中文或者空格，请重新选择',
    { modal: true },
    '再次选择文件夹路径'
  );
  if (result === '再次选择文件夹路径') {
    vscode.commands.executeCommand('hispark-studio.manageToolchain');
  }
}

export function setUserToolsPath(toolsPath: string): boolean {
  const setInfo = setToolsPath(toolsPath);
  if (!setInfo.success) {
    vscode.window.showErrorMessage('环境配置失败，可参考用户指南“工具链toolchain配置”章节进行配置');
  }
  return setInfo.success;
}

/**
 * 解压zip文件至指定目录。
 * @param filesToDownload - 包含zip文件名的json。
 * @param isCancelled - 是否跳过解压。
 * @param downloadDir - zip文件存放路径。
 * @param toolsPath - zip文件解压路径。
 * @returns 一个布尔值，表示是否解压成功。
 */
export async function unzipFileToToolsPath(
  filesToDownload: any,
  isCancelled: boolean,
  downloadDir: string,
  toolsPath: string
): Promise<boolean> {
  const zipFile = filesToDownload.find((file: any) => file.type === 'zip' && file.name === 'compiler');
  if (zipFile) {
    if (isCancelled) {
      return false;
    }
    const zipPath = path.join(downloadDir, path.basename(zipFile.url));
    const extractPath = path.join(toolsPath, 'tools');

    // 确保目标目录存在
    if (!fs.existsSync(extractPath)) {
      fs.mkdirSync(extractPath, { recursive: true });
    }

    try {
      await extractZipFile(zipPath, extractPath);
    } catch (error) {
      vscode.window.showErrorMessage(`解压文件失败: ${error}`);
      return false;
    }
  }
  return true;
}

export async function untarByName(
  filesToDownload: any[],
  fileName: string,
  extractRelativePath: string,
  downloadDir: string,
  toolsPath: string
): Promise<boolean> {
  const tarFile = filesToDownload.find(file => file.type === 'tar.gz' && file.name === fileName);
  if (!tarFile) { return false; } // Nothing to extract
  const tarPath = path.join(downloadDir, path.basename(tarFile.url));

  // Normalize paths.
  const normalizedRelative = path.normalize(extractRelativePath);
  const extractPath = path.resolve(toolsPath, normalizedRelative);
  const normalizedToolsPath = path.resolve(toolsPath);

  if (!extractPath.startsWith(normalizedToolsPath)) {
    vscode.window.showErrorMessage(`${fileName} Untarring illegal path`);
    return false;
  }

  try {
    await fs.promises.mkdir(extractPath, { recursive: true });
    await extractTarFile(tarPath, extractPath);
    return true;
  } catch (error) {
    vscode.window.showErrorMessage(`${fileName} Failed to untar: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}
