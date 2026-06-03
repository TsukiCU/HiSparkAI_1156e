/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 *
 * All backend commands for the Project Wizard (New Project + Import Project).
 * Kept in a separate file so code/src/backEnd/command.ts does not grow further.
 */
import * as fs    from 'fs';
import * as path  from 'path';
import * as vscode from 'vscode';
import * as ini   from 'ini';

import { WizardContext }   from './context';
import { res }             from './i18n/backEndTrans';
import { WizardApiMethod, type GetInfoCallBack, type LanguageSetMessage } from './interface/api';
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
  upsertProjectDataJson,
  removeProjectDataJson,
} from './utils';

// ─── helpers ─────────────────────────────────────────────────────────────────

function callback(key: string, data: any, target: 'wizard' | 'import' = 'wizard'): void {
  const msg: GetInfoCallBack = {
    method: WizardApiMethod.GET_INFO_CALLBAK,
    params: { key, data },
  };
  if (target === 'import') {
    WizardContext.postToImport(msg);
  } else {
    WizardContext.postToWizard(msg);
  }
}

// ─── Minimal .hiproj writer ───────────────────────────────────────────────────

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

export class WizardCommand {

  static closeProgress(): void { /* no-op */ }

  // ── Language / theme ───────────────────────────────────────────────────────

  static getLanguage(operate: OperateStruct): void {
    const msg: LanguageSetMessage = {
      method: WizardApiMethod.SET_LANGUAGE,
      params: { language: vscode.env.language },
    };
    if (operate.source === 'import') {
      WizardContext.postToImport(msg);
    } else {
      WizardContext.postToWizard(msg);
    }
  }

  // ── Chip list ──────────────────────────────────────────────────────────────

  static getJsonInfo(operate: OperateStruct): void {
    const { fileName } = operate.paramData ?? {};
    if (fileName === 'chiplist.json') {
      const chiplistPath = path.join(WizardContext.extensionPath!, 'resources', 'chips', 'chiplist.json');
      try {
        const data = JSON.parse(fs.readFileSync(chiplistPath, 'utf-8'));
        callback('chipList', data, operate.source === 'import' ? 'import' : 'wizard');
      } catch {
        callback('chipList', [], operate.source === 'import' ? 'import' : 'wizard');
      }
    }
  }

  // ── User config ────────────────────────────────────────────────────────────

  static getUserConfig(_operate: OperateStruct): void {
    callback('userConfig', { projectCreate_last_projectPath: getUserDir() });
  }

  // ── Project path dialog ────────────────────────────────────────────────────

  static selectFolderPath(operate: OperateStruct): void {
    const { key, currentValue } = operate.paramData ?? {};
    const defaultUri = currentValue && fs.existsSync(currentValue)
      ? vscode.Uri.file(currentValue)
      : vscode.Uri.file(getUserDir());

    vscode.window.showOpenDialog({
      canSelectFiles:   false,
      canSelectFolders: true,
      canSelectMany:    false,
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
    if (!projectData.soc || !projectData.projectName || !projectData.projectPath || !projectData.sdkPath) {
      showMessageModal({ content: res('fieldsMissing'), infoType: 'err' });
      return;
    }

    const sdkDir    = projectData.sdkPath;
    const hiprojDir = path.join(projectData.projectPath, `${projectData.projectName}_hiproj`);

    // Only check hiprojDir — sdkDir is an existing folder chosen by the user.
    if (fs.existsSync(hiprojDir)) {
      callback('thisProjectExists', new Date().getTime());
      return;
    }

    try {
      fs.mkdirSync(hiprojDir, { recursive: true });
    } catch {
      showMessageModal({ content: res('createFolderFailed', [hiprojDir]), infoType: 'err' });
      return;
    }

    writeHiproj(projectData, hiprojDir, sdkDir);

    const hiprojFilePath = path.join(hiprojDir, `${projectData.projectName}.hiproj`);
    const item = {
      name:     projectData.projectName,
      path:     hiprojFilePath,
      chip:     projectData.soc,
      board:    projectData.board,
      platform: projectData.platform,
      time:     new Date().toLocaleString('zh-CN'),
    };

    if (WizardContext.globalStoragePath) {
      addItemsToProList([item], WizardContext.globalStoragePath);
      updateOneItemToLatestList(item, WizardContext.globalStoragePath);
      upsertProjectDataJson(sdkDir, hiprojFilePath, WizardContext.globalStoragePath);
    }

    callback('thisProjectNotExists', new Date().getTime());
    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(sdkDir));
    WizardContext.deactivate('wizard');
  }

  // ── Close wizard ───────────────────────────────────────────────────────────

  static closeProjectWizard(_operate?: OperateStruct): void {
    WizardContext.deactivate('wizard');
  }

  // ─── Project list ──────────────────────────────────────────────────────────

  static getProjectList(_operate: OperateStruct): void {
    if (!WizardContext.globalStoragePath) { callback('projectList', []); return; }
    callback('projectList', getProjectList(WizardContext.globalStoragePath));
  }

  static getLatestList(_operate: OperateStruct): void {
    if (!WizardContext.globalStoragePath) { callback('latestList', []); return; }
    callback('latestList', getLatestList(WizardContext.globalStoragePath));
  }

  static deleteProject(operate: OperateStruct): void {
    const { projectPath } = operate.paramData ?? {};
    if (!projectPath || !WizardContext.globalStoragePath) { return; }
    deleteFromProjectList(projectPath, WizardContext.globalStoragePath);

    const content = getHiprojContent(projectPath);
    const sdkDir: string | undefined = content?.information?.sdk_path;
    if (sdkDir) {
      removeProjectDataJson(sdkDir, WizardContext.globalStoragePath);
    }
  }

  // ─── Import panel ─────────────────────────────────────────────────────────

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

  static confirmImport(operate: OperateStruct): void {
    const selectedPaths: string[] = operate.paramData?.selectedPaths ?? [];
    if (!WizardContext.globalStoragePath) { return; }

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
      addItemsToProList([item], WizardContext.globalStoragePath!);
      updateOneItemToLatestList(item, WizardContext.globalStoragePath!);
      succeeded.push(hiprojPath);
    }

    callback('importResult', { succeeded, failed }, 'import');

    if (failed.length === 0) {
      showMessageModal({ content: res('importSuccess') });
    } else {
      showMessageModal({ content: res('importPartialFailed', [String(failed.length)]), infoType: 'warn' });
    }

    WizardContext.deactivate('import');
  }

  static async openProject(operate: OperateStruct): Promise<void> {
    const hiprojPath: string = operate.paramData?.path ?? '';
    if (!hiprojPath || !fs.existsSync(hiprojPath)) {
      showMessageModal({ content: res('pathNotExist', [hiprojPath]), infoType: 'err' });
      return;
    }

    let sdkDir: string | undefined;
    const content = getHiprojContent(hiprojPath);
    const sdkPathFromFile: string | undefined = content?.information?.sdk_path;
    if (sdkPathFromFile && fs.existsSync(sdkPathFromFile)) {
      sdkDir = sdkPathFromFile;
    }

    if (!sdkDir) {
      const hiprojDirName = path.basename(path.dirname(hiprojPath));
      if (hiprojDirName.endsWith('_hiproj')) {
        const sdkDirName = hiprojDirName.replace(/_hiproj$/, '');
        const candidate  = path.join(path.dirname(path.dirname(hiprojPath)), sdkDirName);
        if (fs.existsSync(candidate)) { sdkDir = candidate; }
      }
    }

    if (!sdkDir) { sdkDir = path.dirname(hiprojPath); }

    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(sdkDir));
  }

  static updateFolderPath(): void { /* no-op */ }
}
