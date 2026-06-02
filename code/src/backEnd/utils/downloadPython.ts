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
import { spawnSync } from 'child_process';

/**
 * 检查指定路径下是否存在 toolChain.json 文件（同步）
 * @param dirPath - 要检查的目录路径
 * @returns 如果存在 toolChain.json 文件返回 true，否则返回 false
 */
function hasToolChainFile(dirPath: string): boolean {
  try {
    const filePath = path.join(dirPath, 'toolChain.json');
    return fs.existsSync(filePath);
  } catch (err) {
    return false;
  }
}

export function mkdirPath(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

type Obj = Record<string, any>;

function updateObjProperty(obj: Obj, key: string, value: any): void {
  obj[key] = value;
}

function processJsonToStr(json: any): string {
  const fileString = JSON.stringify(json, null, 2);
  return fileString;
}

export function updateToolChainJson(toolChainJsonDir: string, toolChainPath: string, toolChain: string): void {
  const toolChainJsonPath = path.join(toolChainJsonDir, 'toolChain.json');
  if (!hasToolChainFile(toolChainJsonDir)) {
    fs.writeFileSync(toolChainJsonPath, '{}');
  }

  try {
    const data = fs.readFileSync(toolChainJsonPath, 'utf8');
    const toolChainObject = JSON.parse(data);
    updateObjProperty(toolChainObject, toolChain, toolChainPath);
    const fileContent = processJsonToStr(toolChainObject);
    fs.writeFileSync(toolChainJsonPath, fileContent);
  } catch (err) {
    vscode.window.showErrorMessage('更新toolChain.json文件出错');
  }
}

/**
 * 替换文件中的特定字段
 * @param filePath - 文件路径
 * @param oldString - 要被替换的字符串
 * @param newString - 新的字符串
 */
function replaceInFile(filePath: string, oldString: string, newString: string): void {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    const newData = data.replace(new RegExp(oldString, 'g'), newString);
    fs.writeFileSync(filePath, newData, 'utf-8');
  } catch (err) {
    vscode.window.showErrorMessage(`文件更新失败: ${err}`);
  }
}

export function modifyPythonFile(pythonDir: string): void {
  const filePath = path.join(pythonDir, 'python311._pth');
  const oldString = '#import site';
  const newString = 'import site';
  replaceInFile(filePath, oldString, newString);
}

export function addPythonFile(pythonDir: string): void {
  const sitePackagesDir = path.join(pythonDir, 'Lib', 'site-packages');
  const filePath = path.join(sitePackagesDir, 'sitecustomize.py');

  // 确保目录存在，创建它（如果不存在）
  if (!fs.existsSync(sitePackagesDir)) {
    fs.mkdirSync(sitePackagesDir, { recursive: true });
  }
  const content = `
import sys
import os

# 获取当前脚本的路径
if len(sys.argv) > 0:
    script_path = os.path.dirname(os.path.abspath(sys.argv[0]))
    if script_path not in sys.path:
        sys.path.insert(0, script_path)
`;
  fs.writeFileSync(filePath, content);
}