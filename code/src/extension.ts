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

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { ColorTheme } from 'vscode';
import ChipConfigPanel from './backEnd/panels/chip/chipconfigpanel';
import ReleaseNotePanel from './backEnd/panels/releaseNotePanel';
import type { ThemeChangeMessage } from './backEnd/interface/api';
import { ApiMethod } from './backEnd/interface/apiMethod';
import MockLocalStorage from '@src/backEnd/mockLocalStorage/mockLocalStorage';
import type { Target } from './backEnd/panels/panel';
import { logger } from '@src/backEnd/log4js';
import { GlobalModel } from './backEnd/storage/Global';
import { HomeTreeDataProvider, HomeTreeNode } from './backEnd/tree/HomeTreeDataProvider';
import { containsChineseOrSpace, getUserToolsPath, reSelectToolsPath, setUserToolsPath, untarByName, unzipFileToToolsPath } from './backEnd/utils/manageToolChain';
import { checkPythonDepsInstalledLater, downloadFileWithRetry, extractZipFile, getIsDownloading, getToolsPath, installPipPackages, setIsDownloading } from './backEnd/utils/downloadToolChains';
import { addPythonFile, mkdirPath, modifyPythonFile, updateToolChainJson } from './backEnd/utils/downloadPython';
import { SerialPortWatcher } from './backEnd/watchers/SerialPortWatcher';
import { RemoteHeartbeatWatcher } from './backEnd/watchers/RemoteHeartbeatWatcher';
import { WizardContext }   from './backEnd/wizard/context';
import { WizardPanel }     from './backEnd/wizard/panels/wizardPanel';
import { ImportPanel }     from './backEnd/wizard/panels/importPanel';

const WALKTHROUGH_STRING = 'HiSpark.hisparkai#hisparkAI.basicGuide';

function getWorkFolderPath(): string {
  const projectPath = vscode.workspace.workspaceFolders;
  if (!projectPath || !Array.isArray(projectPath) || !projectPath[0]?.uri?.fsPath) {
    return '';
  } else {
    return projectPath[0].uri.fsPath;
  }
}

function detectTargetFromWorkspace(): Target {
  const workspaceFolderPath = getWorkFolderPath();
  if (!fs.existsSync(workspaceFolderPath)) {
    logger.warn(`WARN: Workspace path not found: ${workspaceFolderPath}`);
    return 'NONE';
  }
  const cpuRelPath = path.join('build', 'config', 'target_config', 'ws63', 'ws63.json');
  const npuRelPath = path.join('build', 'config', 'target_config', '3322', '3322.json');
  const cpuIDPath = path.join(workspaceFolderPath, cpuRelPath);
  const npuIDPath = path.join(workspaceFolderPath, npuRelPath);

  const cpuExist = fs.existsSync(cpuIDPath);
  const npuExist = fs.existsSync(npuIDPath);

  if (cpuExist && npuExist) {
    logger.error('WARN: Both CPU and NPU configurations exist. Using CPU by default.');
    return 'CPU';
  } else if (cpuExist) {
    return 'CPU';
  } else if (npuExist) {
    return 'NPU';
  } else {
    logger.log('INFO: No target configuration found.');
    return 'NONE';
  }
}

/**
 * chip config extension
 */
export default class Extension {
  public chipConfigPanel: ChipConfigPanel | undefined;
  public mockLocalStorage: MockLocalStorage | undefined;
  private releaseNotePanels: Map<string, ReleaseNotePanel> = new Map();
  private connected = false;

  /**
   * Activation Event
   * @param {vscode.ExtensionContext} context
   */
  public async activate(context: vscode.ExtensionContext): Promise<void> {
    let target = detectTargetFromWorkspace();
    let iniPath;
    let isActiveProjectFound = false;
    const workspaceFolderPath = getWorkFolderPath();
    const storageDir = path.dirname(context.globalStorageUri.fsPath);
    const cachePath = path.join(storageDir, 'projectdata.json');
    if (fs.existsSync(cachePath)) {
      const projectDataContent = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      for (const item of projectDataContent) {
        if (item.SDK === workspaceFolderPath && item.active) {
          iniPath = item.active;
          isActiveProjectFound = true;
          break;
        }
      }
    }

    if (isActiveProjectFound) {
      GlobalModel.instance.hiprojPath = iniPath;
      // Derive the xxx_hiproj folder from the .hiproj file location.
      // New layout: {projectPath}/{name}_hiproj/{name}.hiproj  → hiprojDir = {projectPath}/{name}_hiproj/
      // Legacy layout: {workspaceFolder}/{name}.hiproj          → hiprojDir = workspaceFolder (backward-compat)
      GlobalModel.instance.hiprojDir = path.dirname(iniPath);
      // detectTargetFromWorkspace() only checks for ws63.json / 3322.json.
      // If the SDK passes wizard validation via a different chip JSON, target stays NONE.
      // Fall back to the platform field written into the .hiproj by the wizard.
      if (target === 'NONE' && iniPath && fs.existsSync(iniPath)) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const ini = require('ini');
          const hiprojContent = ini.parse(fs.readFileSync(iniPath, 'utf-8'));
          const platform = String(hiprojContent?.information?.platform ?? '').toUpperCase();
          if (platform === 'CPU') { target = 'CPU'; }
          else if (platform === 'NPU') { target = 'NPU'; }
        } catch { /* keep NONE on read failure */ }
      }
    } else {
      target = 'NONE'; // Present welcome page if no hiproj file is found.
    }

    // Consume the "wizard-triggered open" marker written before vscode.openFolder.
    // The marker distinguishes an explicit project open (show AI panel) from a
    // plain window reload (stay on welcome page).
    const pendingMarkerPath = path.join(storageDir, 'wizard_pending_open.json');
    const wizardPendingOpen = fs.existsSync(pendingMarkerPath);
    if (wizardPendingOpen) {
      try { fs.unlinkSync(pendingMarkerPath); } catch { /* ignore */ }
    }

    // Initialise wizard context so wizard commands can access extension globals.
    WizardContext.globalStoragePath    = context.globalStorageUri.fsPath;
    WizardContext.extensionPath        = context.extensionPath;
    // Computed identically to ChipConfigPanel.configPath so both point to the same file.
    WizardContext.mainProjectListPath  = path.join(context.globalStorageUri.fsPath, '../../../projectlist.json');
    WizardContext.pendingOpenMarkerPath = pendingMarkerPath;

    const homeTreeProvider = new HomeTreeDataProvider();
    vscode.window.registerTreeDataProvider('hisparkai-home', homeTreeProvider);
    if (!this.mockLocalStorage) {
      this.mockLocalStorage = new MockLocalStorage();
    }
    const chipConfigCommand = vscode.commands.registerCommand('HisparkAI.show', () => {
      if (!this.chipConfigPanel?.panel) {
        this.chipConfigPanel = new ChipConfigPanel(context, target);
      }
      this.chipConfigPanel.toggle();
    });
    const switchChipConfigCommand = vscode.commands.registerCommand('HisparkAI.switchPanel', () => {
      if (this.chipConfigPanel?.panel) {
        this.chipConfigPanel.onPanelDisposed();
      }
      this.chipConfigPanel = new ChipConfigPanel(context, target);
      this.chipConfigPanel.toggle();
    });
    const chipHomeConfigCommand = vscode.commands.registerCommand('HisparkAI.homeShow', () => {
      if (this.chipConfigPanel) {
        this.chipConfigPanel.onPanelDisposed();
      }
      this.chipConfigPanel = new ChipConfigPanel(context, 'NONE');
      this.chipConfigPanel.toggle();
    });

    // 注册打开基础指南的命令
    const openBasicWalkthroughCommand = vscode.commands.registerCommand('HisparkAI.showGuide', async () => {
      try {
        await vscode.commands.executeCommand('workbench.action.openWalkthrough', WALKTHROUGH_STRING);
      } catch (err) {
        vscode.window.showErrorMessage('Failed to open walkthrough guide');
      }
    });

    // 注册连接服务器的命令
    let connectServerCommand = vscode.commands.registerCommand('HisparkAI.connectServer', async () => {
      if (this.isConnected()) {
        vscode.window.showInformationMessage('Already connected to the server.');
        return;
      }
      const availableCmds = await vscode.commands.getCommands(true);
      const targetCommand = 'remoteBuild.connectLite';

      if (availableCmds.includes(targetCommand)) {
        const ret = await vscode.commands.executeCommand(targetCommand);
        if (ret) {
          this.setConnected(true);
        }
      } else {
        vscode.window.showWarningMessage(`Command ${targetCommand} not found, make sure HiSpark Studio is
          activated and a workspace folder is open.`);
      }
    });

    const sshCommand = vscode.commands.registerCommand('HisparkAI-studio.remote', async () => {
      const availableCmds = await vscode.commands.getCommands(true);
      const targetCommand = 'remoteBuild.api.openSshTerminal';

      if (availableCmds.includes(targetCommand)) {
        await vscode.commands.executeCommand(targetCommand, true);
      } else {
        vscode.window.showWarningMessage(`Command ${targetCommand} not found, make sure HiSpark Studio is
          activated and a workspace folder is open.`);
      }
    });

    const openReleaseNoteCommand = vscode.commands.registerCommand('HisparkAI.showReleaseNote', (version: string) => {
      let releaseNotePanel = this.releaseNotePanels.get(version);
      if (releaseNotePanel?.panel) {
        releaseNotePanel.panel.reveal();
      } else {
        releaseNotePanel = new ReleaseNotePanel(context, version);
        releaseNotePanel.toggle();
        this.releaseNotePanels.set(version, releaseNotePanel);
      }
    });

    let isDownloadInProgress = false;

    const manageToolchainCommand = vscode.commands.registerCommand('HisparkAI-studio.manageToolchain', async (): Promise<void> => {
      let toolsPath = await getUserToolsPath();
      if (!toolsPath || toolsPath.length === 0) {
        return;
      }
      if (containsChineseOrSpace(toolsPath)) {
        reSelectToolsPath();
        return;
      }
      // 检查是否已经在下载中，避免重复点击
      if (isDownloadInProgress) {
        return;
      }
      // 设置下载状态为进行中
      isDownloadInProgress = true;

      try {
        // 从JSON文件读取下载清单
        const manifestPath = path.join(context.extensionPath, 'resources', 'downloadToolChain.json');

        // 确保文件存在
        if (!fs.existsSync(manifestPath)) {
          throw new Error(`下载清单文件不存在: ${manifestPath}`);
        }

        // 读取并解析JSON文件
        let filesToDownload: any;
        try {
          const fileContent = fs.readFileSync(manifestPath, 'utf8');
          filesToDownload = JSON.parse(fileContent);

          // 验证JSON格式是否正确
          if (!Array.isArray(filesToDownload)) {
            throw new Error('下载清单格式错误，应为数组');
          }

          // 验证每个条目是否包含必要字段
          for (const item of filesToDownload) {
            if (!item.url || !item.name || !item.type) {
              throw new Error('下载清单中的项目缺少必要字段 (url, name, type)');
            }
          }
        } catch (jsonError) {
          throw new Error(`解析下载清单文件失败: ${jsonError}`);
        }

        // 创建下载目录
        const downloadDir = path.join(toolsPath, 'downloads');
        if (!fs.existsSync(downloadDir)) {
          fs.mkdirSync(downloadDir, { recursive: true });
        }

        // 依次下载每个文件
        const failedDownloads: string[] = [];
        let isCancelled = false;
        // 使用外层进度条，支持取消整个下载任务
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: '正在下载文件...',
          cancellable: true,
        }, async (progress, token) => {
          // 监听取消事件
          token.onCancellationRequested(() => {
            isCancelled = true;
            vscode.window.showInformationMessage('下载已取消');
            isDownloadInProgress = false;
          });
          setIsDownloading(false); // 重置isDownloading状态
          for (const file of filesToDownload) {
            if (isCancelled) {
              break; // 立即退出循环，不再下载后续文件
            }
            try {
              const filePath = path.join(downloadDir, path.basename(file.url));
              await downloadFileWithRetry(file, downloadDir);
            } catch (error) {
              failedDownloads.push(file.name);
              vscode.window.showErrorMessage(`下载 ${file.name} 失败: ${error}`);
            }
          }
        });

        // 如果有下载失败，则退出
        if (failedDownloads.length > 0) {
          vscode.window.showErrorMessage(`部分文件下载失败: ${failedDownloads.join(', ')}`);
          return;
        }

        // 解压免安装版本python,并生成json
        const toolChainJsonPath = path.join(toolsPath, 'tools');
        const pythonExtractPath = path.join(toolsPath, 'tools', 'python');

        // 检测本地是否已安装工具链
        const isEnvironmentSuccess = checkBuildPathExist(toolChainJsonPath);
        // python校验
        if (isEnvironmentSuccess) {
          vscode.window.showInformationMessage('环境已准备完成');
          return;
        }

        const pythonZipFile = filesToDownload.find(file => file.type === 'zip' && file.name === 'python');
        if (pythonZipFile) {
          if (isCancelled) {
            return;
          }
          const pythonZipPath = path.join(downloadDir, path.basename(pythonZipFile.url));
          // 确保目标目录存在
          mkdirPath(pythonExtractPath);
          try {
            await extractZipFile(pythonZipPath, pythonExtractPath);
          } catch (error) {
            vscode.window.showErrorMessage(`解压文件失败: ${error}`);
            return;
          }
          updateToolChainJson(toolChainJsonPath, pythonExtractPath, 'pythonDir');
        }

        // 修改python文件
        modifyPythonFile(pythonExtractPath);
        // 添加python文件
        addPythonFile(pythonExtractPath);
        // 安装wheel包
        const pipFiles = filesToDownload.filter(file => (file.type === 'whl' || (file.type === 'tar.gz' && file.name === 'tkinter-embed')));
        try {
          await installPipPackages(pipFiles.map(file => path.join(downloadDir, path.basename(file.url))), pythonExtractPath, downloadDir);
        } catch (error) {
          throw new Error(`安装Python依赖包失败: ${error}`);
        }

        // 解压zip文件
        const isUnzipSuccess = await unzipFileToToolsPath(filesToDownload, isCancelled, downloadDir, toolsPath);
        const [debugResult, mindsporeResult] = await Promise.all([
          untarByName(filesToDownload, 'DebugKits', path.join('tools', 'cfbb', 'DebugKits'), downloadDir, toolsPath),
          untarByName(filesToDownload, 'MindSpore', path.join('tools', 'mindspore-lite'), downloadDir, toolsPath),
        ]);

        if (!debugResult || !mindsporeResult || !isUnzipSuccess) {
          return;
        }
        if (!setUserToolsPath(toolsPath)) {
          return;
        }
        vscode.window.showInformationMessage('环境准备完成');
      } catch (error) {
        vscode.window.showErrorMessage(`工具链安装过程中出错: ${error}`);
      } finally {
        // 无论成功还是失败，都将下载状态重置为未进行
        isDownloadInProgress = false;
      }
    });

    function checkBuildPathExist(toolChainJsonPath: string): boolean {
      const burnToolPath = path.join(toolChainJsonPath, 'cfbb', 'BurnTool', 'BurnTool.exe');
      const debugkitsPath = path.join(toolChainJsonPath, 'cfbb', 'DebugKits', 'Start.exe');
      const pythonExePath = path.join(toolChainJsonPath, 'python', 'python.exe');

      // 检测tools目录下是否存在对应文件及python各项依赖
      const buildPathExist = fs.existsSync(burnToolPath) && fs.existsSync(debugkitsPath);
      const isPythonDepsInstalled = checkPythonDepsInstalledLater(
        pythonExePath, ['onnx', 'onnxruntime', 'pandas', 'numpy', 'pyserial', 'tensorflow', 'scipy', 'kconfiglib', 'cmake', 'windows_curses']);
      const isToolchainUpdate = getIsDownloading(); // 检测工具链是否更新
      const envToolsPath: string = getToolsPath(); // 检测环境变量是否添加
      const isEnvPath = !isToolchainUpdate && envToolsPath !== '' && isPythonDepsInstalled;
      return isEnvPath && buildPathExist;
    }

    // ── Project Wizard commands ────────────────────────────────────────────────
    const showProjectWizardCommand = vscode.commands.registerCommand('HisparkAI.showProjectWizard', () => {
      if (!WizardContext.wizardPanel?.panel) {
        WizardContext.wizardPanel = new WizardPanel(context);
      }
      WizardContext.wizardPanel.toggle();
      WizardContext.wizardPanel.panel?.reveal();
    });

    const showProjectImportCommand = vscode.commands.registerCommand('HisparkAI.showProjectImport', () => {
      if (!WizardContext.importPanel?.panel) {
        WizardContext.importPanel = new ImportPanel(context);
      }
      WizardContext.importPanel.toggle();
      WizardContext.importPanel.panel?.reveal();
    });

    context.subscriptions.push(
      manageToolchainCommand,
      chipConfigCommand,
      chipHomeConfigCommand,
      switchChipConfigCommand,
      openBasicWalkthroughCommand,
      connectServerCommand,
      sshCommand,
      openReleaseNoteCommand,
      showProjectWizardCommand,
      showProjectImportCommand,
    );

    context.subscriptions.push(RemoteHeartbeatWatcher.getInstance());
    context.subscriptions.push(SerialPortWatcher.getInstance());

    // on theme change
    vscode.window.onDidChangeActiveColorTheme(this.onThemeChange.bind(this));

    // Show the AI panel only when the wizard explicitly opened this workspace.
    // Plain reloads (e.g. Developer: Reload Window) must NOT auto-jump.
    if (target !== 'NONE' && wizardPendingOpen) {
      vscode.commands.executeCommand('HisparkAI.show');
    }
  }

  /**
   * change the panel`s theme when vscode theme changed
   * @param {ColorTheme} colorTheme
   */
  onThemeChange(colorTheme: ColorTheme): void {
    const themeMap = {
      1: 'light',
      2: 'dark',
      3: 'dark',
      4: 'light',
    };
    const themeMessage: ThemeChangeMessage = {
      method: ApiMethod.CHANGE_THEME,
      params: {
        theme: themeMap[colorTheme.kind],
      },
    };
    this.chipConfigPanel?.postMessage(themeMessage);
    WizardContext.postToWizard(themeMessage);
    WizardContext.postToImport(themeMessage);
  }

  /**
   * Deactivation Event
   */
  public async deactivate(): Promise<void> {
    if (this.chipConfigPanel) {
      this.chipConfigPanel.onPanelDisposed();
    }
    this.chipConfigPanel = undefined;
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public setConnected(value: boolean): void {
    this.connected = value;
  }
}

export const extension = new Extension();

export const activate = (context: vscode.ExtensionContext): void => {
  extension.activate(context).then();
};

export const deactivate = (): void => {
  extension.deactivate().then();
};