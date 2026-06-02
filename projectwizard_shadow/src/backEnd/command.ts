/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
import * as fs    from 'fs';
import * as path  from 'path';
import * as vscode from 'vscode';
import * as ini   from 'ini';

import { extension } from '../extension';
import { res }       from '../i18n/backEndTrans';
import { ApiMethod } from './interface/apiMethod';
import type { GetInfoCallBack, LanguageSetMessage } from './interface/api';
import type { OperateStruct, ShadowProjectData } from './interface/model';
import {
  addItemsToProList,
  updateOneItemToLatestList,
  deleteFromProjectList,
  getProjectList,
  getLatestList,
  getHiprojContent,
  findHiprojFiles,
  showMessageModal,
  getUserDir,
} from './utils';

// ─── helpers ─────────────────────────────────────────────────────────────────

function postToWizard(message: any): void {
  extension.chipConfigPanel?.postMessage(message);
}

function postToImport(message: any): void {
  extension.projectImportPanel?.postMessage(message);
}

function callback(key: string, data: any, target: 'wizard' | 'import' = 'wizard'): void {
  const msg: GetInfoCallBack = {
    method: ApiMethod.GET_INFO_CALLBAK,
    params: { key, data },
  };
  if (target === 'import') {
    postToImport(msg);
  } else {
    postToWizard(msg);
  }
}

// ─── Minimal .hiproj writer ───────────────────────────────────────────────────

/**
 * Write a minimal .hiproj file into hiprojDir.
 *
 * New layout (since this change):
 *   {projectPath}/
 *     {name}/              ← SDK workspace folder (opened in VSCode, nothing placed here)
 *     {name}_hiproj/       ← hiprojDir: contains .hiproj + aicache/
 *         {name}.hiproj
 *         aicache/
 *
 * @param projectData  Data from the wizard form.
 * @param hiprojDir    The xxx_hiproj folder path where the .hiproj file is written.
 * @param sdkDir       The SDK workspace folder path, stored as sdk_path in the .hiproj.
 */
function writeHiproj(projectData: ShadowProjectData, hiprojDir: string, sdkDir: string): void {
  const hiprojPath = path.join(hiprojDir, `${projectData.projectName}.hiproj`);
  const content = {
    information: {
      'board_build.mcu': projectData.soc,
      board:             projectData.board,
      platform:          projectData.platform,
      project_name:      projectData.projectName,
      project_path:      hiprojDir,
      sdk_path:          sdkDir,
      series_name:       'shadow',
      project_type:      'SHADOW',
    },
    compile: {},
    debug:   {},
  };
  fs.writeFileSync(hiprojPath, ini.stringify(content), 'utf-8');
}

// ─── Command class ────────────────────────────────────────────────────────────

export class Command {

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  static async closeProgress(): Promise<void> {
    // no-op in shadow (no progress bar)
  }

  // ── Language / theme ───────────────────────────────────────────────────────

  static getLanguage(operate: OperateStruct): void {
    const msg: LanguageSetMessage = {
      method: ApiMethod.SET_LANGUAGE,
      params: { language: vscode.env.language },
    };
    if (operate.source === 'import') {
      postToImport(msg);
    } else {
      postToWizard(msg);
    }
  }

  // ── Chip list ──────────────────────────────────────────────────────────────

  static getJsonInfo(operate: OperateStruct): void {
    const { fileName } = operate.paramData ?? {};
    if (fileName === 'chiplist.json') {
      const chiplistPath = path.join(extension.extensionPath!, 'resources', 'chips', 'chiplist.json');
      try {
        const data = JSON.parse(fs.readFileSync(chiplistPath, 'utf-8'));
        callback('chipList', data, operate.source === 'import' ? 'import' : 'wizard');
      } catch (e) {
        callback('chipList', [], operate.source === 'import' ? 'import' : 'wizard');
      }
    }
  }

  // ── User config ────────────────────────────────────────────────────────────

  static getUserConfig(operate: OperateStruct): void {
    const cfg = {
      projectCreate_last_projectPath: getUserDir(),
    };
    callback('userConfig', cfg);
  }

  // ── Project path dialog ────────────────────────────────────────────────────

  static selectFolderPath(operate: OperateStruct): void {
    const { key, currentValue } = operate.paramData ?? {};
    const defaultUri = currentValue && fs.existsSync(currentValue)
      ? vscode.Uri.file(currentValue)
      : vscode.Uri.file(getUserDir());

    vscode.window.showOpenDialog({
      canSelectFiles:    false,
      canSelectFolders:  true,
      canSelectMany:     false,
      defaultUri,
      title: res('selectFolderTitle'),
    }).then((result) => {
      if (result?.[0]?.fsPath) {
        callback(key, result[0].fsPath);
      }
    });
  }

  // ── Path validation ────────────────────────────────────────────────────────

  static updateProjectTips(operate: OperateStruct): void {
    const { projectPath } = operate.paramData ?? {};
    if (!projectPath) { return; }
    if (fs.existsSync(projectPath)) {
      callback('projectPathRightInfo', projectPath);
    } else {
      callback('projectPathWrongInfo', projectPath);
    }
  }

  // ── Create project ─────────────────────────────────────────────────────────

  static async getProjectData(projectData: ShadowProjectData): Promise<void> {
    if (!projectData.soc || !projectData.projectName || !projectData.projectPath) {
      showMessageModal({ content: res('fieldsMissing'), infoType: 'err' });
      return;
    }

    // New layout:
    //   {projectPath}/{name}/            ← SDK workspace folder (VSCode opens this)
    //   {projectPath}/{name}_hiproj/     ← hiproj folder (.hiproj + aicache/)
    const sdkDir    = path.join(projectData.projectPath, projectData.projectName);
    const hiprojDir = path.join(projectData.projectPath, `${projectData.projectName}_hiproj`);

    // Check for conflicts on EITHER folder before creating anything.
    if (fs.existsSync(sdkDir) || fs.existsSync(hiprojDir)) {
      callback('thisProjectExists', new Date().getTime());
      return;
    }

    try {
      fs.mkdirSync(sdkDir,    { recursive: true });
      fs.mkdirSync(hiprojDir, { recursive: true });
    } catch {
      showMessageModal({ content: res('createFolderFailed', [sdkDir]), infoType: 'err' });
      return;
    }

    // Write .hiproj into the xxx_hiproj folder; record the SDK folder as sdk_path.
    writeHiproj(projectData, hiprojDir, sdkDir);

    // Register the project: path points to the .hiproj file inside hiprojDir.
    const item = {
      name:     projectData.projectName,
      path:     path.join(hiprojDir, `${projectData.projectName}.hiproj`),
      chip:     projectData.soc,
      board:    projectData.board,
      platform: projectData.platform,
      time:     new Date().toLocaleString('zh-CN'),
    };
    if (extension.globalStoragePath) {
      addItemsToProList([item], extension.globalStoragePath);
      updateOneItemToLatestList(item, extension.globalStoragePath);
    }

    // Signal wizard to close
    callback('thisProjectNotExists', new Date().getTime());

    // Open the SDK workspace folder (nothing is placed in it by this plugin).
    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(sdkDir));
    extension.deactivate('chipConfig');
  }

  // ── Close wizard ───────────────────────────────────────────────────────────

  static closeProjectWizard(_operate?: OperateStruct): void {
    extension.deactivate('chipConfig');
  }

  // ─── Project list (history) ────────────────────────────────────────────────

  static getProjectList(operate: OperateStruct): void {
    if (!extension.globalStoragePath) { callback('projectList', []); return; }
    const list = getProjectList(extension.globalStoragePath);
    callback('projectList', list);
  }

  static getLatestList(operate: OperateStruct): void {
    if (!extension.globalStoragePath) { callback('latestList', []); return; }
    const list = getLatestList(extension.globalStoragePath);
    callback('latestList', list);
  }

  static deleteProject(operate: OperateStruct): void {
    const { projectPath } = operate.paramData ?? {};
    if (!projectPath || !extension.globalStoragePath) { return; }
    deleteFromProjectList(projectPath, extension.globalStoragePath);
  }

  // ─── Import panel ─────────────────────────────────────────────────────────

  /** User picked a folder to scan for .hiproj files */
  static selectImportPath(_operate: OperateStruct): void {
    vscode.window.showOpenDialog({
      canSelectFiles:   false,
      canSelectFolders: true,
      canSelectMany:    false,
      defaultUri:       vscode.Uri.file(getUserDir()),
      title:            res('selectImportPath'),
    }).then((result) => {
      if (result?.[0]?.fsPath) {
        const scanPath = result[0].fsPath;
        callback('importablePath', scanPath, 'import');
        // Scan for .hiproj files
        const found = findHiprojFiles(scanPath);
        const items = found.map((hiprojPath, idx) => ({
          key:      String(idx),
          name:     path.parse(hiprojPath).name,
          path:     hiprojPath,
          disabled: false,
        }));
        callback('importableItemsInfo', items, 'import');
      }
    });
  }

  /** Confirm import: add selected .hiproj files to the project list */
  static confirmImport(operate: OperateStruct): void {
    const selectedPaths: string[] = operate.paramData?.selectedPaths ?? [];
    if (!extension.globalStoragePath) { return; }

    const succeeded: string[] = [];
    const failed: string[] = [];

    for (const hiprojPath of selectedPaths) {
      const content = getHiprojContent(hiprojPath);
      if (!content) { failed.push(hiprojPath); continue; }
      const chip  = content?.information?.['board_build.mcu'] ?? '';
      const board = content?.information?.board ?? chip;
      const item = {
        name:     path.parse(hiprojPath).name,
        path:     hiprojPath,
        chip,
        board,
        platform: content?.information?.platform ?? '',
        time:     new Date().toLocaleString('zh-CN'),
      };
      addItemsToProList([item], extension.globalStoragePath!);
      updateOneItemToLatestList(item, extension.globalStoragePath!);
      succeeded.push(hiprojPath);
    }

    callback('importResult', { succeeded, failed }, 'import');

    if (failed.length === 0) {
      showMessageModal({ content: res('importSuccess') });
    } else {
      showMessageModal({ content: res('importPartialFailed', [String(failed.length)]), infoType: 'warn' });
    }

    extension.deactivate('projectImport');
  }

  /** Open a project by .hiproj path.
   *
   * The workspace to open is the SDK folder, NOT the xxx_hiproj folder.
   * Resolution order:
   *   1. Read sdk_path from the .hiproj [information] section.
   *   2. Fall back to naming convention: strip the '_hiproj' suffix from the
   *      containing directory name to derive the sibling SDK folder.
   */
  static async openProject(operate: OperateStruct): Promise<void> {
    const hiprojPath: string = operate.paramData?.path ?? '';
    if (!hiprojPath || !fs.existsSync(hiprojPath)) {
      showMessageModal({ content: res('pathNotExist', [hiprojPath]), infoType: 'err' });
      return;
    }

    // Primary: sdk_path stored inside the .hiproj file.
    let sdkDir: string | undefined;
    const content = getHiprojContent(hiprojPath);
    const sdkPathFromFile: string | undefined = content?.information?.sdk_path;
    if (sdkPathFromFile && fs.existsSync(sdkPathFromFile)) {
      sdkDir = sdkPathFromFile;
    }

    // Fallback: derive from naming convention ({name}_hiproj/ → {name}/).
    if (!sdkDir) {
      const hiprojDirName = path.basename(path.dirname(hiprojPath));
      if (hiprojDirName.endsWith('_hiproj')) {
        const sdkDirName = hiprojDirName.replace(/_hiproj$/, '');
        const candidate  = path.join(path.dirname(path.dirname(hiprojPath)), sdkDirName);
        if (fs.existsSync(candidate)) {
          sdkDir = candidate;
        }
      }
    }

    // Last resort: open the directory that contains the .hiproj (legacy / non-shadow layout).
    if (!sdkDir) {
      sdkDir = path.dirname(hiprojPath);
    }

    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(sdkDir));
  }

  /** Update folder path (called on .hiproj watch change, kept for compatibility) */
  static updateFolderPath(): void { /* no-op in shadow */ }
}
