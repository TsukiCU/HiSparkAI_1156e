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
import type { ColorTheme } from 'vscode';
import ChipConfigPanel from './backEnd/panels/chipconfigpanel';
import TargetManagePanel from './backEnd/panels/targetManagePanel';
import type { ThemeChangeMessage } from './backEnd/interface/api';
import { ApiMethod } from './backEnd/interface/apiMethod';
import ProjectSettingPanel from './backEnd/panels/projectSettingsPanel';
import ProjectImportPanel from './backEnd/panels/projectImportPanel';
import {
  addItemsToProList, updateOneItemToLatestList, getActiveWorkFolderPath, getLatestProjectInfo,
  checkCppProperties, showMessageModal, generateLatestListMenu,
  pathIsHimpw, pathIsHiproj, showFolder, pathIsDir, getHiprojContent, creLaunchJsonFile,
  recreateHiproj, canRecreateHiproj, reCreLaunchJsonFile, showHiprojParseErrModal,
  deleteFromProjectList, deleteFromLatestList, findHiprojFileSync, getProjectType, 
  setMultiModevalue, deleteProjectList, getActiveIniPath
} from './backEnd/utils';
import { res } from './i18n/backEndTrans';
import * as fs from 'fs';
import * as path from 'path';

import * as ini from 'ini';
import type { Invoker, launchJsonParam } from './backEnd/interface/model';
import { checkEmptyProject, creDebugInitFile, checkProjectDataJsonExists, updateProjectDataJson } from './backEnd/creProjFile';
import { Command } from './backEnd/command';
import { getResource } from './backEnd/resourceManage/resourceManager';
import { getToolsPath, getPlatformType, getUserDir, PLATFORM } from './pythonUtils';

let binPath: any;
let extensionContext: vscode.ExtensionContext;
export function getExtensionContext(): vscode.ExtensionContext {
  return extensionContext;
}

/**
 * projectwizard extension
 */
export default class Extension {
  public chipConfigPanel: ChipConfigPanel | undefined;
  public targetManagePanel: TargetManagePanel | undefined;
  public settingPanel: ProjectSettingPanel | undefined;
  public projectImportPanel: ProjectImportPanel | undefined;
  public globalStoragePath: string | undefined;
  public extensionPath: string | undefined;
  public messageModalManage: {
    [key: string]: boolean;
  } | undefined;
  public isCustomIDE: boolean = true;
  private toolBarItems: any[] = [];
  private toolBarMap = new Map<any, any>([]);
  private projectSettingBtn: any;

  // progress
  private progressObject: vscode.Progress<{ message?: string; increment?: number }> | null = null;
  private progressStarted: boolean = false;
  private progressResolve: ((value: unknown) => void) | null = null;

  constructor(isCustomIDE: boolean = true) {
    this.isCustomIDE = isCustomIDE;
  }

  /**
   * 注册自定义菜单
   */
  public registerCustomMenus(): void {
    if (!this.isCustomIDE) {
      return;
    }

    try {
      // 注册 Project Wizard 子菜单
      (vscode.window as any).registerMenu('projectSubmenu', {
        command: {
          id: 'showProjectWizard',
          title: res('projectWizardSubMenu'),
        },
        group: '1_wizard',
        order: 1,
      });
      (vscode.window as any).registerMenu('CommandPalette', {
        command: {
          id: 'showProjectWizard',
          title: { value: res('newProjectName'), original: 'New Project' },
          category: { value: res('project'), original: 'Project' },
        },
      });

      // 注册 Open Project 子菜单
      (vscode.window as any).registerMenu('projectSubmenu', {
        command: {
          id: 'openSingalProject',
          title: res('openProjectMenu'),
        },
        group: '1_wizard',
        order: 2,
      });
      (vscode.window as any).registerMenu('CommandPalette', {
        command: {
          id: 'openSingalProject',
          title: { value: res('openProjectName'), original: 'Open Project' },
          category: { value: res('project'), original: 'Project' },
        },
      });

      // 注册 Close Project 子菜单
      (vscode.window as any).registerMenu('projectSubmenu', {
        command: {
          id: 'workbench.action.closeFolder',
          title: res('closeProjectMenu'),
          precondition: 'workspaceFolderCount',
        },
        group: '1_wizard',
        order: 6,
      });
      (vscode.window as any).registerMenu('CommandPalette', {
        command: {
          id: 'workbench.action.closeFolder',
          title: { value: res('closeProjectMenu'), original: 'Close Project/Workspace' },
          category: { value: res('project'), original: 'Project' },
        },
      });

      // 注册 Project Setting 子菜单
      (vscode.window as any).registerMenu('projectSubmenu', {
        command: {
          id: 'showProjectSetting',
          title: res('projectSettingName'),
          precondition: 'workspaceFolderCount',
        },
        group: '2_settings',
        order: 4,
      });
      (vscode.window as any).registerMenu('CommandPalette', {
        command: {
          id: 'showProjectSetting',
          title: { value: res('projectSettingName'), original: 'Project Options' },
          category: { value: res('project'), original: 'Project' },
        },
      });

      // 注册主菜单
      (vscode.window as any).registerMenu('MenubarMainMenu', {
        submenu: 'projectSubmenu',
        title: res('projectSubmenu'),
        order: 6,
      });

      // 注册文件菜单中的打开项目
      (vscode.window as any).registerMenu('MenubarFileMenu', {
        command: {
          id: 'openSingalProject',
          title: res('openProjectFileMenu'),
        },
        group: '2_open',
        order: 3,
      });

      // 注册资源管理器上下文菜单
      (vscode.window as any).registerMenu('ExplorerContext', {
        command: {
          id: 'showProjectSetting',
          title: res('projectSettingName'),
          precondition: 'workspaceFolderCount',
        },
        group: '8_operation',
        order: 7,
      });
    } catch (error) {
      console.error('注册自定义菜单时出错:', error);
    }
  }

  /**
   * 初始化工具栏
   * @param context 扩展上下文
   */
  public initToolbar(context: vscode.ExtensionContext): void {
    if (!this.isCustomIDE) {
      return;
    }

    try {
      const jsonUri = path.resolve(__dirname, '../resources', './toolbarActions.json');

      if (!fs.existsSync(jsonUri)) {
        return;
      }

      const actions: any[] = JSON.parse(fs.readFileSync(jsonUri, 'utf-8'));
      const keyBindingDir = path.join(context.globalStorageUri.fsPath, '../..');
      const keyBindingPath = path.join(keyBindingDir, 'keybindings.json');
      let keyBindings: any[];

      if (fs.existsSync(keyBindingPath)) {
        try {
          keyBindings = JSON.parse(fs.readFileSync(keyBindingPath, 'utf-8'));
        } catch (e) {
          keyBindings = [];
        }
      } else {
        keyBindings = [];
      }

      this.toolBarItems = actions.map((action, index) => {
        try {
          const iconPath = path.resolve(__dirname, '../resources/icons', action.icon);
          const iconUri = vscode.Uri.file(iconPath);
          const name = res(action.name);
          const description = res(action.description);

          // 使用any类型以避免类型检查错误
          const toolBarItem = (vscode.window as any).createToolBarItem(action.id, name, iconUri, description, action.group, action.order);

          if (toolBarItem) {
            toolBarItem.command = action.command;
            toolBarItem.arg = action.arg;

            const keyBinding = keyBindings?.find((kb) => kb.command === action.command);
            toolBarItem.shortcut = keyBinding?.key ?? action.shortcut;

            context.subscriptions.push(toolBarItem);
            this.toolBarMap.set(toolBarItem, action);

            if (action.id === 'projectSetting') {
              this.projectSettingBtn = toolBarItem;
            }

            return toolBarItem;
          }
        } catch (error) {
          console.error(`处理工具栏项 ${action.id} 时出错:`, error);
        }
        return null;
      }).filter(Boolean); // 过滤掉null值

      // 监听键绑定文件变化
      try {
        fs.watch(keyBindingDir, (eventType, filename) => {
          // rename means delete, use default shortcut
          if (filename === 'keybindings.json' && eventType === 'rename') {
            this.toolBarItems.forEach((item) => {
              item.shortcut = this.toolBarMap.get(item)?.shortcut;
            });
          }
          // if keybindings.json changed, use new settings to update
          if (filename === 'keybindings.json' && eventType === 'change') {
            try {
              const json: any[] = JSON.parse(fs.readFileSync(keyBindingPath, 'utf-8'));
              this.toolBarItems.filter(item => item.command).forEach((item) => {
                const keyBinding = json.find((kb) => kb.command === item.command);
                item.shortcut = keyBinding?.key ?? this.toolBarMap.get(item)?.shortcut;
              });
            } catch (e) {
              console.error('更新键绑定时出错:', e);
            }
          }
        });
      } catch (e) {
        console.error('设置键绑定文件监听器失败:', e);
      }
    } catch (error) {
      console.error('初始化工具栏时出错:', error);
    }
  }

  /**
   * 设置进度条
   * @param value 进度值
   * @param message 消息
   */
  public setProgress(value: number, message: string): void {
    if (this.isCustomIDE) {
      try {
        vscode.commands.executeCommand('setProgress', value, message);
      } catch (error) {
        console.error('执行 setProgress 命令时出错:', error);
      }
    } else {
      this.setVSCodeProgress(value, message);
    }
  }

  /**
   * VSCode原生进度条实现
   * @private
   * @param value 进度值
   * @param message 消息
   */
  public setVSCodeProgress(value: number, message: string): void {
    if (!this.progressStarted) {
      // 首次调用，初始化进度条
      this.progressStarted = true;
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: '',
          cancellable: true,
        },
        async (progress, token) => {
          // 保存progress对象以便后续更新
          this.progressObject = progress;

          // 初始显示
          progress.report({ increment: value, message });

          // 监听取消
          token.onCancellationRequested(() => {
            this.progressResolve = null;
            this.progressStarted = false;
            this.progressObject = null;
          });

          // 返回Promise
          return new Promise(resolve => {
            this.progressResolve = resolve;

            // 如果初始值就是100%，则立即关闭
            if (value >= 100) {
              this.progressResolve = null;
              this.progressStarted = false;
              this.progressObject = null;
              resolve(undefined);
            }
          });
        }
      );
    } else if (this.progressObject) {
      // 直接使用保存的进度条对象更新，而不是创建新的
      this.progressObject.report({ increment: value, message });

      // 如果进度为100%，立即关闭
      if (value >= 100 && this.progressResolve) {
        this.progressResolve(undefined);
        this.progressResolve = null;
        this.progressStarted = false;
        this.progressObject = null;
      }
    }
  }

  /**
   * 更新项目设置按钮状态
   * @param iniPath INI路径
   */
  public updateProjectSettingBtnState(iniPath: string): void {
    if (!this.isCustomIDE || !this.projectSettingBtn) {
      return;
    }

    if (!iniPath) {
      this.projectSettingBtn.disable();
    } else {
      this.projectSettingBtn.enable();
    }
  }

  /**
   * Activation Event
   * @param {vscode.ExtensionContext} context
   */
  public async activate(context: vscode.ExtensionContext): Promise<void> {
    extensionContext = context;
    this.messageModalManage = {};
    this.extensionPath = context.extensionPath;
    let workspaceFolderPath = await getActiveWorkFolderPath();
    let iniPath: any;
    if (workspaceFolderPath) {
      await showFolder(path.join(workspaceFolderPath, '.vscode'));
      let isActiveProjectFound = false;
      const storageDir = path.dirname(extensionContext.globalStorageUri.fsPath);
      const cachePath = path.join(storageDir, 'projectdata.json');
      checkProjectDataJsonExists();
      const projectDataContent = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      for (const item of projectDataContent) {
        if (item.SDK === workspaceFolderPath && item.active) {
          iniPath = item.active;
          isActiveProjectFound = true;
          break;
        }
      }
      if (!isActiveProjectFound) {
        iniPath = findHiprojFileSync(workspaceFolderPath);
      }
    }

    if (fs.existsSync(iniPath)) {
      const chipData = getHiprojContent(iniPath);
      const sdkPath = workspaceFolderPath;
      let launchJsonData = {
        soc: chipData?.information?.['board_build.mcu'],
        boardJsonPath: chipData?.information?.json_path,
        sdkPath: chipData?.information?.sdk_path,
        seriesName: chipData?.information?.series_name,
        toolChain: chipData?.compile?.tool_chain,
        tool: chipData?.debug?.tool,
      };
      setMultiModevalue(chipData.debug.debug_mode);
      let cpuNumber = this.getCpuNumber(chipData);
      await creLaunchJsonFile(launchJsonData, sdkPath, true, cpuNumber);

      if (chipData?.information?.['board_build.mcu'].includes('nb')) {
        let launchJsonPath = path.join(workspaceFolderPath, '.vscode', 'launch.json');
        let launchJsonContent = JSON.parse(fs.readFileSync(launchJsonPath, 'utf-8'));
        const toolchainBinDir = path.join('${command:toolsPath}', 'Windows', 'cc_riscv32_musl_fp_win', 'bin');
        launchJsonContent.configurations.forEach((config: any) => {
          if (config.toolchainBinDir) {
            config.toolchainBinDir = toolchainBinDir;
          }
        });
        fs.writeFileSync(launchJsonPath, JSON.stringify(launchJsonContent, null, 2), 'utf-8');

        chipData.compile.tool_chain = 'cc_riscv32_musl_fp_win';
        fs.writeFileSync(iniPath, ini.stringify(chipData), 'utf-8');
      }
      let independenceFlg: boolean = false;
      if (chipData?.information?.project_type === 'MCU') {
        independenceFlg = true;
      }
      vscode.commands.executeCommand('setContext', 'independenceVisable', independenceFlg);
    }

    const platformType = getPlatformType();
    this.globalStoragePath = platformType === PLATFORM.WINDOWS ? context.globalStorageUri.path.slice(1) : context.globalStorageUri.path;
    const commands = [
      vscode.commands.registerCommand('showProjectWizard', async () => {
        if (!this.chipConfigPanel?.panel) {
          this.setProgress(50, res('wait'));
          this.chipConfigPanel = new ChipConfigPanel(context);
        }
        this.chipConfigPanel.toggle();
        this.chipConfigPanel.panel?.reveal();
      }),
      vscode.commands.registerCommand('showTargetManage', async () => {
        if (!this.targetManagePanel?.panel) {
          this.targetManagePanel = new TargetManagePanel(context);
        }
        this.targetManagePanel.toggle();
        this.targetManagePanel.panel?.reveal();
      }),
      vscode.commands.registerCommand('showProjectSetting', async (type?: string, relativePath?: string) => {
        iniPath = await getActiveIniPath();
        if (!iniPath) {
          showMessageModal({
            content: res('obtainFileFailed', ['.hiproj']),
            infoType: 'err',
          });
          return;
        }

        await showFolder(path.join(workspaceFolderPath, '.vscode'));

        if (!this.settingPanel?.panel) {
          this.setProgress(50, res('wait'));
          this.settingPanel = new ProjectSettingPanel(context);
        }
        if (type === 'independentConfig') {
          this.settingPanel.path = relativePath;
        } else {
          this.settingPanel.path = '';
        }
        this.settingPanel.iniPath = iniPath;
        this.settingPanel.toggle();
        this.settingPanel.panel?.reveal();
      }),
      vscode.commands.registerCommand('independentCompileConfig', (uri: vscode.Uri) => {
        const relativePath = path.relative(workspaceFolderPath, uri.fsPath);
        vscode.commands.executeCommand('showProjectSetting', 'independentConfig', relativePath);
      }),
      vscode.commands.registerCommand('toolsPath', () => {
        if (this.isCustomIDE) {
          return path.join(vscode.env.appRoot, '..', '..', 'tools');
        } else {
          const toolsPath: string = getToolsPath();
          return path.join(toolsPath, 'tools');
        }
      }),
      vscode.commands.registerCommand('projectWizardExtensionPath', () => {
        return context.extensionPath;
      }),
      vscode.commands.registerCommand('showProjectImport', async () => {
        if (!this.projectImportPanel?.panel) {
          this.setProgress(50, res('wait'));
          this.projectImportPanel = new ProjectImportPanel(context);
        }
        this.projectImportPanel.toggle();
        this.projectImportPanel.panel?.reveal();
      }),
      vscode.commands.registerCommand('openSingalProject', (param: { projectPath: string; source: 'himpw' | 'hiproj'; invoker: Invoker }) => {
        const { projectPath, source, invoker } = param ?? {};
        if (!projectPath) {
          let filters = {
            'Project Files': ['hiproj'],
            'Multi Project Workspaces': ['himpw'],
            'All Files': ['*'],
          };
          if (source === 'himpw') {
            filters = {
              'Multi Project Workspaces': ['himpw'],
              'Project Files': ['hiproj'],
              'All Files': ['*'],
            };
          }
          const latest = getLatestProjectInfo(this.globalStoragePath);
          let defaultUri = vscode.Uri.file(getUserDir());
          if (latest?.content?.[0]?.path) {
            defaultUri = vscode.Uri.file(latest.content[0].path);
          }
          vscode.window.showOpenDialog({
            canSelectFiles: true,
            defaultUri,
            canSelectFolders: false,
            canSelectMany: false,
            filters: filters,
            title: 'Open Project',
          }).then((fileInfo: any) => {
            if (fileInfo?.[0]?.fsPath) {
              this.openPath(fileInfo[0].fsPath, 'handSelect');
            }
          });
        } else {
          this.openPath(projectPath, invoker);
        }
      }),
      vscode.commands.registerCommand('deleteProject', (deletePath, deleteName?, deleteTime?) => {
        if (deletePath) {
          deleteFromProjectList(deletePath, this.globalStoragePath);
        } else {
          deleteProjectList(deleteName, deleteTime, this.globalStoragePath);
        }
      }),
      vscode.commands.registerCommand('openProjectByPath', (projectPath: string, invoker: Invoker) => {
        if (projectPath) {
          this.openPath(projectPath, invoker);
        }
      }),
      vscode.commands.registerCommand('recreateHiproj', (hiprojContent: any, projFolderPath: string) => {
        if (projFolderPath && fs.existsSync(projFolderPath) && canRecreateHiproj(hiprojContent)) {
          recreateHiproj(hiprojContent, projFolderPath);
        }
      }),
      vscode.commands.registerCommand('creDebugInitFile', (projectPath: string, debugTool: string, projectType: string) => {
        if (projectPath && fs.existsSync(projectPath)) {
          creDebugInitFile(projectPath, debugTool, projectType);
        }
      }),
      vscode.commands.registerCommand('creLaunchJsonFile', (projectData: launchJsonParam, projectPath: string, isReloadWindow: boolean) => {
        if (projectPath && fs.existsSync(projectPath)) {
          reCreLaunchJsonFile(projectData, projectPath, isReloadWindow);
        }
      }),
      vscode.commands.registerCommand('canRecreateHiproj', (hiprojContent: any) => {
        canRecreateHiproj(hiprojContent);
      }),
    ];
    context.subscriptions.push(...commands);
    if (iniPath) {
      this.updateList(iniPath);
      checkCppProperties(iniPath, workspaceFolderPath);
    }

    // 注册自定义菜单
    this.registerCustomMenus();
    generateLatestListMenu(this.globalStoragePath);

    // 初始化工具栏
    this.initToolbar(context);

    // 更新项目设置按钮状态
    this.updateProjectSettingBtnState(iniPath);

    // 实现FBB/MCU单核多核场景下,烧录配置界面与工程配置界面BinPath的双向同步;
    if (fs.existsSync(iniPath)) {
      let fileToWatch = [iniPath];
      const iniContent = getHiprojContent(iniPath);
      const projectType = iniContent?.information?.project_type;
      const projectNewType = iniContent?.information?.project_new_type;
      if (projectNewType === 'multiCoreProject' && iniContent.multiCore) {
        fileToWatch = getMultiCoreFileToWatch(iniPath);
      }

      fileToWatch.forEach((filePath :any) => {
        fs.watch(filePath, async (eventType : any) => {
          if (eventType === 'change') {
            if (projectType === 'MCU') {
              iniPath = await getActiveIniPath();
            }
            const curIniContent = ini.parse(fs.readFileSync(iniPath, 'utf-8'));
            if (curIniContent?.upload?.bin_path !== binPath) {
              Command.updateFolderPath();
              binPath = curIniContent.upload.bin_path;
            }
          }
        });
      });
    }

    if (iniPath) {
      const iniContent = ini.parse(fs.readFileSync(iniPath, 'utf-8'));
      if (iniContent.information.check_empty_type === true) {
        let projetcPath = path.dirname(iniPath);
        let configType = iniContent.compile.float_type;
        checkEmptyProject(projetcPath, configType);
      }
      iniContent.information.check_empty_type = '';
      fs.writeFileSync(iniPath, ini.stringify(iniContent), 'utf-8');
    }

    // on theme change
    vscode.window.onDidChangeActiveColorTheme(this.onThemeChange.bind(this));

    vscode.commands.executeCommand('setContext', 'chipConfigReady', true);
  }

  getCpuNumber(chipData: any): string {
    const currentCPU = chipData?.information?.currentCPU;
    switch (currentCPU) {
     case 'CPU0':
       return '0';
     case 'CPU1':
      return '1';
     case 'CPU2':
      return '2';
     default:
      return '';
    };
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
    const message: ThemeChangeMessage = {
      method: ApiMethod.CHANGE_THEME,
      params: {
        theme: themeMap[colorTheme.kind],
      },
    };
    this.chipConfigPanel?.postMessage(message);
    this.projectImportPanel?.postMessage(message);
    this.settingPanel?.postMessage(message);
    this.targetManagePanel?.postMessage(message);
  }

  async openPath(paramPath: string, invoker: Invoker): Promise<void> {
    if (!fs.existsSync(paramPath)) {
      if (invoker === 'welcomePage' || invoker === 'projectSubMenu') {
        showMessageModal({
          content: `${res('pathNotExist', [paramPath])}${res('wantToDeleteTheItem')}`,
          btn: [res('confirm')],
          cb: (btn: string) => {
            if (btn === res('confirm')) {
              deleteFromProjectList(paramPath, this.globalStoragePath);
              deleteFromLatestList(paramPath, this.globalStoragePath);
              vscode.commands.executeCommand('workbench.action.reloadWindow');
            }
          },
        });
      } else if (invoker === 'handSelect') {
        showMessageModal({
          content: `${res('pathNotExistPleaseTry', [paramPath])}${res('tryOtherPath')}`,
        });
      } else {
        showMessageModal({
          content: `${res('pathNotExistPleaseTry', [paramPath])}
          ${res('pathNotExistWay1')}
          ${res('pathNotExistWay2')}`,
        });
      }
      return;
    }
    if (pathIsHiproj(paramPath)) {
      await this.openProj(paramPath);
    } else if (pathIsHimpw(paramPath)) {
      this.openWorkspace(paramPath);
    } else if (pathIsDir(paramPath)) {
      const folderUri = vscode.Uri.file(paramPath);
      vscode.commands.executeCommand('vscode.openFolder', folderUri);
    } else {
      const folderUri = vscode.Uri.file(paramPath);
      const document = await vscode.workspace.openTextDocument(folderUri);
      vscode.window.showTextDocument(document);
    }
  }

  async openProj(projPath: string): Promise<void> {
    if (!fs.existsSync(projPath)) {
      showMessageModal({
        content: res('pathNotExist', [projPath]),
        infoType: 'err',
      });
      return;
    }

    const storageDir = path.dirname(extensionContext.globalStorageUri.fsPath);
    const cachePath = path.join(storageDir, 'projectdata.json');
    checkProjectDataJsonExists();
    const hiProjectContent = getHiprojContent(projPath);
    const projectType = getProjectType(hiProjectContent);
    const sdkPath = hiProjectContent?.information?.sdk_path;

    if (projectType === 'cfbb') {
      await this.handleCfbbProject(projPath, sdkPath, cachePath, hiProjectContent);
    } else {
      await this.handleMcuProject(projPath);
    }
  }

  async handleCfbbProject(projPath: string, sdkPath: string, cachePath: string, hiProjectContent: any): Promise<void> {
    const workspaceFolderPath = await getActiveWorkFolderPath();
    const sdkPathNormalized = path.normalize(hiProjectContent?.information?.sdk_path);
    const workspaceFolderPathNormalized = workspaceFolderPath ? path.normalize(workspaceFolderPath) : null;
    const projectDataContent = JSON.parse(fs.readFileSync(cachePath, 'utf8'));

    if (sdkPathNormalized === workspaceFolderPathNormalized) {
      this.matchSdkPath(projPath, sdkPathNormalized, projectDataContent, cachePath);
    } else {
      await showFolder(path.join(sdkPath, '.vscode'));
      checkCppProperties(projPath, sdkPath);
      // Add the item to be opened to projectList.json
      this.updateList(projPath);
      const folderUri = vscode.Uri.file(sdkPath);
      updateProjectDataJson(projPath);
      vscode.commands.executeCommand('vscode.openFolder', folderUri);
    }
  }

  matchSdkPath(projPath: string, sdkPathNormalized: string, projectDataContent: any[], cachePath: string): void {
    const targetProject = projectDataContent.find((item: any) => path.normalize(item.SDK) === sdkPathNormalized);

    if (targetProject) {
      if (path.normalize(targetProject.active) === path.normalize(projPath)) {
        if (!targetProject.project.includes(projPath)) {
          targetProject.project.push(projPath);
        }
        showMessageModal({
          content: res('pathAlreadyOpen'),
          infoType: 'tips',
        });
      } else {
        this.switchToAnotherProjectInFolder(projPath, targetProject, projectDataContent, cachePath);
      }
    } else {
      this.addNewProject(projPath, sdkPathNormalized, projectDataContent, cachePath);
    }
  }

  switchToAnotherProjectInFolder(projPath: string, targetProject: any, projectDataContent: any[], cachePath: string): void {
    targetProject.active = projPath;
    if (!targetProject.project.includes(projPath)) {
      targetProject.project.push(projPath);
    }
    fs.writeFileSync(cachePath, JSON.stringify(projectDataContent, null, 2));
    vscode.commands.executeCommand('workbench.action.reloadWindow');
  }

  addNewProject(projPath: string, sdkPathNormalized: string, projectDataContent: any[], cachePath: string): void {
    const newProject = {
      SDK: sdkPathNormalized,
      project: [projPath],
      active: projPath,
    };
    projectDataContent.push(newProject);
    fs.writeFileSync(cachePath, JSON.stringify(projectDataContent, null, 2));
  }

  async handleMcuProject(projPath: string): Promise<void> {
    const { workspace: { workspaceFolders } } = vscode;
    const p1 = path.normalize(path.dirname(projPath)).toLowerCase();
    const alreadyOpenflag = workspaceFolders?.some((item: any) => path.normalize(item?.uri?.fsPath).toLowerCase() === p1);

    if (alreadyOpenflag) {
      showMessageModal({
        content: res('pathAlreadyOpen'),
        infoType: 'tips',
      });
    } else {
      await showFolder(path.join(path.dirname(projPath), '.vscode'));
      checkCppProperties(projPath, path.dirname(projPath));
          // Add the item to be opened to projectList.json
          this.updateList(projPath);
          const folderUri = vscode.Uri.file(path.dirname(projPath));
          vscode.commands.executeCommand('vscode.openFolder', folderUri);
    }
  }

  updateList(projPath: string): void {
    let iniContent = getHiprojContent(projPath);

    if (iniContent) {
      const chip = iniContent?.information?.['board_build.mcu'];
      const board = iniContent?.information?.board;
      if (chip && board) {
        const proItem = {
          name: path.parse(projPath).name,
          path: projPath,
          chip,
          board,
          time: (new Date()).toLocaleString('zh-CN'),
        };
        addItemsToProList([proItem], this.globalStoragePath);
        updateOneItemToLatestList(proItem, this.globalStoragePath);
      } else {
        showHiprojParseErrModal(projPath);
      }
    }
  }

  openWorkspace(filePath: string): void {
    if (fs.existsSync(filePath) && fs.readFileSync(filePath).toString()) {
      let newContent: any;
      try {
        newContent = JSON.parse(fs.readFileSync(filePath).toString());
      } catch {
        showMessageModal({
          content: res('fileOpenDamage'),
          infoType: 'err',
        });
        return;
      }

      let folderList = newContent?.folders;
      if (!Array.isArray(folderList)) {
        return;
      }
      let newList: any = [];
      folderList.forEach(item => {
        if (fs.existsSync(item.path)) {
          newList.push({ uri: vscode.Uri.file(item.path) });
        }
      });
      vscode.workspace.updateWorkspaceFolders(0, vscode.workspace.workspaceFolders?.length, ...newList);

      // Add the item to be opened to projectList.json
      const workspaceItem = {
        name: path.parse(filePath).name,
        path: filePath,
        chip: '',
        board: '',
        time: (new Date()).toLocaleString('zh-CN'),
      };
      addItemsToProList([workspaceItem], this.globalStoragePath);
      updateOneItemToLatestList(workspaceItem, this.globalStoragePath);
    } else {
      showMessageModal({
        content: res('fileNotExistOrDamage'),
        infoType: 'err',
      });
    }
  }

  /**
   * Deactivation Event
   */
  public async deactivate(type: string = 'chipConfig'): Promise<void> {
    switch (type) {
      case 'chipConfig':
        if (this.chipConfigPanel) {
          this.chipConfigPanel.onPanelDisposed();
        }
        this.chipConfigPanel = undefined;
        break;
      case 'projectImport':
        if (this.projectImportPanel) {
          this.projectImportPanel.onPanelDisposed();
        }
        this.projectImportPanel = undefined;
        break;
      case 'projectSettings':
        if (this.settingPanel) {
          this.settingPanel.onPanelDisposed();
        }
        this.settingPanel = undefined;
        break;
      case 'targetManage':
        if (this.targetManagePanel) {
          this.targetManagePanel.onPanelDisposed();
        }
        this.targetManagePanel = undefined;
        break;
      default:
        break;
    }
  }
}

function getMultiCoreCpuNames(iniFilePath: any): any {
  const basePath = path.join(iniFilePath, '..', '..');
  const iniContent = ini.parse(fs.readFileSync(iniFilePath, 'utf-8'));
  const { CPU0Name, CPU1Name, CPU2Name } = iniContent.multiCore;
  const cpuNames = [CPU0Name, CPU1Name, CPU2Name];
  return { cpuNames, basePath };
}

function getMultiCoreFileToWatch(iniFilePath: any): any {
  const { cpuNames, basePath } = getMultiCoreCpuNames(iniFilePath);
  const resFileArr: string[] = [];
  for (const cpuName of cpuNames) {
    if (!cpuName) {
      continue;
    }
    const hiprojPath = path.join(basePath, cpuName, `${cpuName}.hiproj`);
    if (!fs.existsSync(hiprojPath)) {
      vscode.window.showWarningMessage(
        res('warningInfo'), 
        { modal: true, detail: res('checkBurnAllHiproj') }, 
        res('ok')
      );
      return [iniFilePath];
    }
    resFileArr.push(hiprojPath);
  }
  return resFileArr;
}

export const extension = new Extension();

export const activate = (context: vscode.ExtensionContext): void => {
  getResource.setConfig(context.extensionPath, true);
  extension.activate(context).then();
};

export const deactivate = (): void => {
  extension.deactivate('chipConfig').then();
  extension.deactivate('projectImport').then();
  extension.deactivate('projectSettings').then();
  extension.deactivate('targetManage').then();
};

// 为插件B导出的API
export function createProjectWizardExtension(
  context: vscode.ExtensionContext,
  isCustomIDE: boolean = false,
  customStaticPath?: string,
  customWebPath?: string
): void {
  // 设置资源管理器配置
  getResource.setConfig(context.extensionPath, isCustomIDE, customStaticPath, customWebPath);
  extension.isCustomIDE = isCustomIDE;
  // 创建新的实例并设置正确的IDE模式
  extension.activate(context).then();
}
