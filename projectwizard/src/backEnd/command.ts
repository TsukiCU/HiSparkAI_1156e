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
import { extension } from '../extension';
import type { CustomIDESetMessage, GetInfoCallBack, LanguageSetMessage } from './interface/api';
import { ApiMethod } from './interface/apiMethod';
import { exec, spawn } from 'child_process';
import { SerialPort } from 'serialport';
import { res } from '../i18n/backEndTrans';
import { copyFolderRecursiveSync } from './creProjFile';

import type { OperateStruct, ProjectData, HandleFactoryStruct, GetJsonInfoStruct, FailedFileChildren, ImportTableItem } from './interface/model';
import {
  creProIniFile, creEmptyProject, updateProjectDataJson,
  creDebugInitFile, jsonTypeGet, creCCppConfigJson, getToolChainString, getLaunchToolChainBinDir
} from './creProjFile';
import {
  addItemsToProList, editUserConfigJson, readUserConfigJson, getActiveWorkFolderPath,
  updatePathList, showMessageModal, asyncShowMessageModal, getActiveIniPath,
  pathIsHiproj, pathIsHormonyDir, getChipListBoaedsMap,
  showFolder, getUserconfigAndSubsystem, reCreLaunchJsonFile,
  getChipJsonContent, getExFileContent, isArray, writeWithcheckRight, getHiprojContent, modalType,
  getCCppJsonContent, creLaunchJsonFile, failedType, reCreCCppConfigJson, convertHormony, importMcuProj, getProjectType,
  getRealBoardJsonName,
  getCppCompilePath,
  setMultiModevalue,
  findConfigScriptPath,
  findConfigElf,
  getChipInfo,
  configScriptParse,
  addTargetToJson,
  updateJsonTargetName,
  deleteTargetFromJson,
  copyAndModifyConfigFiles,
  renameConfigFiles,
  deleteConfigFiles,
  jsonPathGet,
  findTargetBlockIndexes,
  updateField,
  inTargetAndHasConfigChipJsons,
  updateMultiProjectList,
  getBurnParamFilePath,
  findHiprojFileSync,
} from './utils';
import getAllDrive from './getAllDrive';

import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import * as ini from 'ini';
import * as cp from 'child_process';
// allinone
import { getResource } from './resourceManage/resourceManager';
import { script } from './resourceManage/resourcePath';
import { getToolsPath, getUserDir } from '../pythonUtils';

const singCoreDebugString: string = 'singleDebugMode';
const requiredFiles = [
  'bs20.json',
  'bs21.json',
  'bs21a.json',
  'bs20c.json',
  'bs20h.json',
  'bs21e.json',
  'bs22.json',
  'bs25.json',
  'bs26.json',
  'ws53.json',
  'ws63.json',
  'socmn2.json',
  '3322.json',
  'brandy.json',
  'nb17.json',
  'nb17e.json',
  'nb18.json',
  'hi2131.json',
  'hi2131c.json',
  'hi2113.json',
  'bs27a.json',
  'sw21.json',
  'hi2113.json',
  'bs27a.json',
  'sw21.json',
];
/**
 * deal with requests from webview
 */
export class Command {
  static mdTml: vscode.Terminal | undefined;
  public static child: any;
  static promiseIndex: any;

  /**
   * send project message
   * @param {string} key: thisProjectExists or thisProjectNotExists
   */
  static async sendProjectMessage(key: string): Promise<void> {
    const projectExistsCallbackMessage: GetInfoCallBack = {
      method: ApiMethod.GET_INFO_CALLBAK,
      params: {
        data: new Date().getTime(),
        key: key,
      },
    };
    extension.chipConfigPanel?.postMessage(projectExistsCallbackMessage);
  }

  /**
   * close progress modal
   */
  static async closeProgress(): Promise<void> {
    extension.setProgress(100, res('wait'));
  }

  /**
   * get project data
   * @param {ProjectData} projectData
   */
  static async getProjectData(projectData: ProjectData): Promise<void> {
    if (projectData.seriesName === '3071') {
      const result = await new Promise(async (resolve) => {
        const paths = path.resolve(__dirname, '..', 'resources', 'getArmGcc.bat');
        const armGccBat = spawn('cmd.exe', ['/c', paths]);
        let stdout = '';
        armGccBat.stdout.on('data', (data: any) => {
          stdout += data.toString();
        });
    
        armGccBat.on('close', (code: number) => {
          if (code === 0) {
            resolve(0);
          } else {
            showMessageModal({
              content: res('noArmGcc'),
              infoType: 'tips',
            });
            resolve(-1);
          }
        });
      });
      if (result !== 0) {
        return;
      }
    }
    if (projectData.seriesName === 'cfbb') {
      this.validateCfbbSdkPath(projectData?.sdkPath);
      if (projectData.projectNewType === 'emptyProject') {
        showMessageModal({
          content: res('cfbbNotEmptyProject'),
          infoType: 'err',
        });
        return;
      }
    } else {
      this.validateMcuSdkPath(projectData?.sdkPath);
    }

    // check whether the project exists
    let hiProjFilePath = '';
    let pathToOpen = '';
    let multiHiProjFilePath = '';
    let cpu0PathToOpen = '';
    let cpu1PathToOpen = '';
    let cpu2PathToOpen = '';
    let iniInfo;
    let cpu0IniInfo;
    let cpu1IniInfo;
    let cpu2IniInfo;
    let toolChain = '';
    let newProjPath = '';
    const isSupportMultiChip = (projectData.seriesName === '3066h') || (projectData.seriesName === '3067m');
    if (projectData.needSdk && projectData.projectType !== 'MCU') {
      pathToOpen = projectData.sdkPath;
      hiProjFilePath = projectData.projectPath;
      if (fs.existsSync(path.join(hiProjFilePath, `${projectData.projectName}.hiproj`))) {
        this.sendProjectMessage('thisProjectExists');
        return;
      }
    } else if (!projectData.projectType) {
        showMessageModal({content: res('jsonNotExist'), infoType: 'err'});
        return;
    } else {
      if (isSupportMultiChip && projectData.projectNewType === 'multiCoreProject') {
        newProjPath = path.join(projectData.projectPath, projectData.himpwName);
        if (!fs.existsSync(newProjPath)) {
          fs.mkdirSync(newProjPath);
        }
        cpu0PathToOpen = path.join(newProjPath, projectData.cpu0Name);
        cpu1PathToOpen = path.join(newProjPath, projectData.cpu1Name);
        cpu2PathToOpen = path.join(newProjPath, projectData.cpu2Name);
        multiHiProjFilePath = path.join(newProjPath, `${projectData.himpwName}.himpw`);
        const isExistMultiProject = await this.createMultiProject(cpu0PathToOpen, cpu1PathToOpen, cpu2PathToOpen, multiHiProjFilePath);
        if (!isExistMultiProject) {
          return;
        }
      } else {
        hiProjFilePath = path.join(projectData.projectPath, projectData.projectName);
        pathToOpen = hiProjFilePath;
        if (fs.existsSync(hiProjFilePath)) {
          this.sendProjectMessage('thisProjectExists');
          return;
        }
        try {
          fs.mkdirSync(hiProjFilePath);
        } catch {
          showMessageModal({content: res('createFolderFailed', [hiProjFilePath]), infoType: 'err'});
          return;
        }
        this.sendProjectMessage('thisProjectNotExists');
      }
    }
    if (isSupportMultiChip && projectData.projectNewType === 'multiCoreProject') {
      cpu0IniInfo = creProIniFile(projectData, cpu0PathToOpen, 'CPU0');
      cpu1IniInfo = creProIniFile(projectData, cpu1PathToOpen, 'CPU1');
      cpu2IniInfo = creProIniFile(projectData, cpu2PathToOpen, 'CPU2');
      this.deleteWorkspace(cpu0PathToOpen, projectData.cpu0Name);
      this.deleteWorkspace(cpu1PathToOpen, projectData.cpu1Name);
      this.deleteWorkspace(cpu2PathToOpen, projectData.cpu2Name);
      await this.creMultiCppConfig(cpu0PathToOpen, cpu1PathToOpen, cpu2PathToOpen, projectData);
      toolChain = getToolChainString(projectData);
    } else {
      await showFolder(path.join(pathToOpen, '.vscode'));
      // create project.ini file
      iniInfo = creProIniFile(projectData, hiProjFilePath);
      // create projectdata.json file
      const newProject = path.join(projectData.projectPath, `${projectData.projectName}.hiproj`);
      if (fs.existsSync(newProject)) {
        updateProjectDataJson(newProject);
      }
      // create debug launchinit and attachinit file
      toolChain = getToolChainString(projectData);
      creCCppConfigJson(pathToOpen, toolChain, projectData.seriesName);
    }   
    if (projectData.seriesName === 'cfbb') {
      creDebugInitFile(pathToOpen, 'jlink', projectData.projectType);
    } else if (projectData.seriesName === '3071') {
      creDebugInitFile(pathToOpen, 'HiSparkLinkPro', projectData.projectType);
    } else {
      if (isSupportMultiChip && projectData.projectNewType === 'multiCoreProject') {
        creDebugInitFile(cpu0PathToOpen, 'HiSpark-Trace', `${projectData.projectType}0`);
        creDebugInitFile(cpu1PathToOpen, 'HiSpark-Trace', `${projectData.projectType}1`);
        creDebugInitFile(cpu2PathToOpen, 'HiSpark-Trace', `${projectData.projectType}2`);
      } else {
        creDebugInitFile(pathToOpen, 'HiSpark-Trace', projectData.projectType);
      }
    }
    // create launch.json file
    const isMultiProj = cpu0IniInfo && cpu1IniInfo && cpu2IniInfo;
    if (projectData.projectType !== 'GUI' && isMultiProj) {
      let multiLaunchJsonData = {
        soc: projectData.soc,
        boardJsonPath: projectData.boardJsonPath,
        sdkPath: projectData.sdkPath,
        seriesName: projectData.seriesName,
        toolChain,
      };
      await creLaunchJsonFile(multiLaunchJsonData, cpu0PathToOpen, false, '0');
      await creLaunchJsonFile(multiLaunchJsonData, cpu1PathToOpen, false, '1');
      await creLaunchJsonFile(multiLaunchJsonData, cpu2PathToOpen, false, '2');
    }
    if (projectData.projectType !== 'GUI' && iniInfo) {
      let launchJsonData = {
        soc: projectData.soc,
        boardJsonPath: projectData.boardJsonPath,
        sdkPath: projectData.sdkPath,
        seriesName: projectData.seriesName,
        toolChain: toolChain,
      };

      await creLaunchJsonFile(launchJsonData, pathToOpen);
    }
    if (projectData.projectType === 'GUI') {
      // uncompress Simulator.zip
      let dirPath = path.resolve(__dirname, '..');
      let compressing = require('compressing');
      let simulatorPath = path.join(dirPath, 'resources', 'Simulator.zip');
      showMessageModal({
        content: res('uncompressing', ['Simulator.zip']),
        infoType: 'tips',
      });
      compressing.zip.uncompress(simulatorPath, pathToOpen, { zipFileNameEncoding: 'GBK' })
        .then(async () => {
          showMessageModal({
            content: res('uncompressSuccess', ['Simulator.zip']),
            infoType: 'tips',
          });
          // open project folder
          const folderUri = vscode.Uri.file(pathToOpen);
          await vscode.commands.executeCommand('vscode.openFolder', folderUri);
          // run gui plug-in
          await vscode.commands.executeCommand('GUI');
          extension.deactivate();
        })
        .catch((err: any) => {
          showMessageModal({
            content: res('uncompressFailed', ['Simulator.zip']),
            infoType: 'err',
          });
        });
    } else if (projectData.projectType === 'MCU') {
      if (isSupportMultiChip && projectData.projectNewType === 'multiCoreProject') {
        await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(multiHiProjFilePath), false);
      } else {
        await vscode.commands.executeCommand('openProjectByPath', pathToOpen, 'openAfterCreate');
      }
      if (projectData.projectNewType === 'emptyProject') {
        creEmptyProject(projectData, pathToOpen);
      }
      extension.deactivate();
    } else if (projectData.projectType === 'CFBB') {
      const workspaceFolderPath = await getActiveWorkFolderPath();
      if (projectData.projectNewType === 'sampleProject') {
        const sourcePath = path.join(projectData.samplePath, 'demo', projectData.sampleNameSelect);
        const targetPath = path.join(projectData.sdkPath, 'application', 'samples', 'peripheral', projectData.sampleNameSelect);
        fs.mkdirSync(targetPath, { recursive: true });
        copyFolderRecursiveSync(sourcePath, targetPath);
      }
      if (pathToOpen === workspaceFolderPath) {
        await vscode.commands.executeCommand('workbench.action.reloadWindow');
      } else {
        await vscode.commands.executeCommand('openProjectByPath', pathToOpen, 'openAfterCreate');
      }
      extension.deactivate();
    } else {
      extension.deactivate();
    }
    // Update the project list on the welcome page.
    if (isSupportMultiChip && projectData.projectNewType === 'multiCoreProject') {
      updateMultiProjectList(projectData, cpu0IniInfo, cpu1IniInfo, cpu2IniInfo);
    } else {
      const newProItemArr = [{
        name: projectData.projectName,
        path: iniInfo?.path,
        chip: iniInfo?.chip,
        board: iniInfo?.board,
        time: (new Date()).toLocaleString('zh-CN'),
      }];
      addItemsToProList(newProItemArr, extension.globalStoragePath);
    }
  }

  static checkCustomIDE(): void {
    // set webview language environment
    const message: CustomIDESetMessage = {
      method: ApiMethod.CHECK_CUSTOMIDE,
      params: {
        isCustomIDE: extension.isCustomIDE,
      },
    };
    extension.chipConfigPanel?.postMessage(message);
  }

  static getLanguage(operate: OperateStruct): void {
    // set webview language environment
    const message: LanguageSetMessage = {
      method: ApiMethod.SET_LANGUAGE,
      params: {
        language: vscode.env.language,
      },
    };
    if (operate.source === 'wizard') {
      extension.chipConfigPanel?.postMessage(message);
    } else if (operate.source === 'import') {
      extension.projectImportPanel?.postMessage(message);
    } else if (operate.source === 'target') {
      extension.targetManagePanel?.postMessage(message);
    } else {
      extension.settingPanel?.postMessage(message);
    }
  }

  static getSdkVersionList(): void {
    let sdkTagsList: string[] = [];
    sdkTagsList.push('master');
    const getSdkVersionListCallbackMessage: GetInfoCallBack = {
      method: ApiMethod.GET_INFO_CALLBAK,
      params: {
        data: sdkTagsList,
        key: 'sdkVersiontList',
      },
    };
    extension.chipConfigPanel?.postMessage(getSdkVersionListCallbackMessage);
  }

  static async createMultiProject(cpu0PathToOpen: string, cpu1PathToOpen: string, cpu2PathToOpen: string, multiHiProjFilePath: string): Promise<boolean> {
    const existingPaths = [];
    const isExistProj = fs.existsSync(cpu0PathToOpen) || fs.existsSync(cpu1PathToOpen) || fs.existsSync(cpu2PathToOpen) || fs.existsSync(multiHiProjFilePath);
    if (isExistProj) {
      if (fs.existsSync(cpu0PathToOpen)) {
        existingPaths.push(cpu0PathToOpen);
      }
      if (fs.existsSync(cpu1PathToOpen)) {
        existingPaths.push(cpu1PathToOpen);
      }
      if (fs.existsSync(cpu2PathToOpen)) {
        existingPaths.push(cpu2PathToOpen);
      }
      if (fs.existsSync(multiHiProjFilePath)) {
        existingPaths.push(multiHiProjFilePath);
      }
      let message = '';
      if (existingPaths.length === 1) {
        message = `${existingPaths[0]}`;
      } else if (existingPaths.length > 1) {
        message = `${existingPaths.join(', ')}`;
      }
      if (existingPaths.length > 0) {
        showMessageModal({content: res('multiProjectExist', [message]), infoType: 'tips'});
        return false;
      }
    }
    try {
      fs.mkdirSync(cpu0PathToOpen);
      fs.mkdirSync(cpu1PathToOpen);
      fs.mkdirSync(cpu2PathToOpen);
      const cpu0RelativePath = `.${path.sep}${path.basename(cpu0PathToOpen)}`;
      const cpu1RelativePath = `.${path.sep}${path.basename(cpu1PathToOpen)}`;
      const cpu2RelativePath = `.${path.sep}${path.basename(cpu2PathToOpen)}`;
      const data = {
        folders: [
          {path: cpu0RelativePath},
          {path: cpu1RelativePath},
          {path: cpu2RelativePath},
        ],
      };
      const dataString = JSON.stringify(data, null, 2);
      fs.writeFileSync(multiHiProjFilePath, dataString);
    } catch {
      showMessageModal({
        content: res('createMultiFolderFailed'),
        infoType: 'err',
      });
      return false;
    }
    this.sendProjectMessage('thisProjectNotExists');
    return true;
  }

  static async creMultiCppConfig(cpu0PathToOpen: string, cpu1PathToOpen: string, cpu2PathToOpen: string, projectData: ProjectData): Promise<void> {
    await showFolder(path.join(cpu0PathToOpen, '.vscode'));
    await showFolder(path.join(cpu1PathToOpen, '.vscode'));
    await showFolder(path.join(cpu2PathToOpen, '.vscode'));
    this.creMultiCppConfig(cpu0PathToOpen, cpu1PathToOpen, cpu2PathToOpen, projectData);
    const newCpu0Project = path.join(projectData.projectPath, `${projectData.cpu0Name}.hiproj`);
    const newCpu1Project = path.join(projectData.projectPath, `${projectData.cpu1Name}.hiproj`);
    const newCpu2Project = path.join(projectData.projectPath, `${projectData.cpu2Name}.hiproj`);
    if (fs.existsSync(newCpu0Project)) {
      updateProjectDataJson(newCpu0Project);
    }
    if (fs.existsSync(newCpu1Project)) {
      updateProjectDataJson(newCpu1Project);
    }
    if (fs.existsSync(newCpu2Project)) {
      updateProjectDataJson(newCpu2Project);
    }
    // create debug launchinit and attachinit file
    const toolChain = getToolChainString(projectData);
    creCCppConfigJson(cpu0PathToOpen, toolChain, projectData.seriesName);
    creCCppConfigJson(cpu1PathToOpen, toolChain, projectData.seriesName);
    creCCppConfigJson(cpu2PathToOpen, toolChain, projectData.seriesName);
  }

  static deleteWorkspace(cpuPathToOpen:string, hiprojName: string): void {
    const cpupuProject = path.join(cpuPathToOpen, `${hiprojName}.hiproj`);
    if (fs.existsSync(cpupuProject)) {
      // 读取文件内容
      fs.readFile(cpupuProject, 'utf8', (err, data) => {
        if (err) {
            return;
        }
        // 处理每一行，删除等号前后的空格
        const lines = data.split('\n');
        const processedLines = lines.map(line => {
            return line.replace(/\s*=\s*/, '=');
        });

        // 将处理后的内容写回文件
        const processedData = processedLines.join('\n');
        fs.writeFileSync(cpupuProject, processedData);
    });
    }
  }

  /**
   * get json info
   * @param {OperateStruct} operate
   */
  static getJsonInfo(operate: GetJsonInfoStruct): void {
    const config = getChipJsonContent(operate.paramData);
    if (config) {
      const getJsonInfoCallbackMessage: GetInfoCallBack = {
        method: ApiMethod.GET_INFO_CALLBAK,
        params: {
          data: config,
          key: operate?.paramData?.fileName === 'chiplist.json' ? 'chipList' : 'chipConfig',
        },
      };
      if (operate.source === 'wizard') {
        extension.chipConfigPanel?.postMessage(getJsonInfoCallbackMessage);
      } else {
        extension.settingPanel?.postMessage(getJsonInfoCallbackMessage);
      }

      fs.close;
    }
  }

  static showRemoteMessage(operate: GetJsonInfoStruct): void {
    vscode.window.showInformationMessage(res('remoteInformation'));
  }

  static setStaticLibParam(operate: GetJsonInfoStruct): void {
    let userconfigPath: string;
    const iniP = extension?.settingPanel?.iniPath;
    if (iniP) {
      userconfigPath = path.join(path.dirname(iniP), 'chip', 'target', 'userconfig.json');
      if (!fs.existsSync(userconfigPath)) {
        return;
      }
    } else {
      return;
    }

    if (operate.paramData.fileName && operate.paramData.sdkPath) {    
        // 读取文件内容
      fs.readFile(userconfigPath, 'utf8', (err, data) => {
        if (err) {
          showMessageModal({
            content: res('readConfigErr'),
            infoType: 'err',
          });
          return;
        }
        let config = JSON.parse(data);
  
        // 获取ldflags
        const ldflags = config.system[0].subsystem.find((sub: { name: string }) => sub.name === 'compile_frame').ldflags;
  
        // 将sdkPath转换为相对路径
        const relativeSdkPath = `..\\${path.dirname(operate.paramData.sdkPath).replace(/\\/g, '\\\\')}\\${path.basename(operate.paramData.sdkPath)}`;

        if (!ldflags.includes(relativeSdkPath)) {
          // 添加新的.o文件路径
          ldflags.push(relativeSdkPath);
        }
  
        // 写回文件
        try {
           fs.writeFileSync(userconfigPath, JSON.stringify(config, null, 2));
        } catch (error) {
          const errorMsg = error as Error;
          vscode.window.showErrorMessage(res('writeFailed', [userconfigPath, errorMsg.message]));
        }
      });
    } else {
        // 读取文件内容
      fs.readFile(userconfigPath, 'utf8', (err, data) => {
        if (err) {
          showMessageModal({
            content: res('readConfigErr'),
            infoType: 'err',
          });
          return;
        }
  
        let config = JSON.parse(data);
  
        // 获取ldflags
        const ldflags = config.system[0].subsystem.find((sub: { name: string }) => sub.name === 'compile_frame').ldflags;
   
        // 过滤掉以.o结尾的参数
        const filteredLdflags = ldflags.filter((flag: string) => !flag.endsWith('.o'));
  
        // 更新ldflags
        config.system[0].subsystem.find((sub: { name: string }) => sub.name === 'compile_frame').ldflags = filteredLdflags;
  
        // 写回文件
        try {
          fs.writeFileSync(userconfigPath, JSON.stringify(config, null, 2));
        } catch (error) {
          const errorMsg = error as Error;
          vscode.window.showErrorMessage(res('writeFailed', [userconfigPath, errorMsg.message]));
        }
      });
    }
    const getJsonInfoCallbackMessage = {
      method: ApiMethod.GET_INFO_CALLBAK,
      params: {
        data: operate.paramData.sdkPath,
        key: 'staticLibParam',
      },
    };
    extension.chipConfigPanel?.postMessage(getJsonInfoCallbackMessage);
  }

  static async getSampleJsonInfo(operate: GetJsonInfoStruct): Promise<void> {
    const jsonPath = path.join(operate.paramData.sdkPath, 'build_config.json');
    fs.readFile(jsonPath, 'utf-8', (err, data:any) => {
      let jsonData;
      if (err) {
        showMessageModal({
          content: res('samplePathWrong'),
        });
        jsonData = null;
      } else {
        jsonData = JSON.parse(data); // 解析 JSON 数据
      }
      const getJsonInfoCallbackMessage: GetInfoCallBack = {
        method: ApiMethod.GET_INFO_CALLBAK,
        params: {
          data: jsonData,
          key: 'build_config',
        },
      };
      extension.chipConfigPanel?.postMessage(getJsonInfoCallbackMessage);
    });
  }

  static async stopRefresh(operate: OperateStruct): Promise<void> {
    let data;

    if (operate.paramData.ifRefresh === undefined) {
      data = true;
    } else {
      data = false;
    }

    const callBackMessage: GetInfoCallBack = {
      method: ApiMethod.GET_INFO_CALLBAK,
      params: {
        data: data,
        key: 'ifRefresh',
      },
    };

    extension.settingPanel?.postMessage(callBackMessage);
  }

  static async saveTarget(operate: any): Promise<void> {
    const config = jsonTypeGet(operate.paramData.jsonGetParam);
    const target = config?.target;
    const hiprojPath = await getActiveIniPath();
    const content = fs.readFileSync(hiprojPath, 'utf-8');
    const parsedData = ini.parse(content);

    const workspaceFolderPath = await getActiveWorkFolderPath();
    const launchJsonPath = path.join(workspaceFolderPath, '.vscode', 'launch.json');
    const launchData = fs.readFileSync(launchJsonPath, 'utf8');
    const launch = JSON.parse(launchData);

    for (const versionValue of Object.values(target)) {
      for (const [targetKey, targetValue] of Object.entries(versionValue as { [key: string]: any })) {
        if (operate.paramData.target === targetKey) {
          parsedData.information['board_build.mcu'] = targetValue.cmake?.['chip config']?.['board_build.mcu'];
          parsedData.information.target = targetKey;

          const currentCommand = parsedData.compile.custom_build_command;
          const remainingCommandPart = currentCommand.match(/\s+-d\s+.*/);
          const remainingCommandText = remainingCommandPart ? remainingCommandPart[0] : '';
          const updatedCommand = targetValue.cmake?.build?.build_argv + remainingCommandText;
          parsedData.compile.custom_build_command = updatedCommand;

          parsedData.compile.map_path = targetValue.cmake?.['image analysis']?.analysis_map_path;
          parsedData.debug.elf_path = targetValue.cmake?.['image analysis']?.analysis_elf_path;
          parsedData.upload.bin_path = targetValue.cmake?.upload?.upload_partitions;
          parsedData.analysis.elf_path = targetValue.cmake?.['image analysis']?.analysis_elf_path;
          parsedData.analysis.map_path = targetValue.cmake?.['image analysis']?.analysis_map_path;
          parsedData.analysis.tool_path = targetValue.cmake?.['stack analysis']?.analysis_compiler_path;
          if (targetValue.cmake.kconfig) {
            parsedData.kConfig.menu_config_core = targetValue.cmake?.kconfig?.menu_config_core;
            parsedData.kConfig.menu_config_target_path = targetValue.cmake?.kconfig?.menu_config_target_path;
            parsedData.kConfig.menu_config_file_path = targetValue.cmake?.kconfig?.menu_config_file_path;
            parsedData.kConfig.menu_config_build_target = targetValue.cmake?.build?.build_argv;
          }
          break;
        } else if (operate.paramData.target.trim().split(' ')[0] === targetKey) {
          parsedData.compile.custom_build_command = operate.paramData.target;
          parsedData.information.target = operate.paramData.target;
          const targetName = operate.paramData.target.trim().split(' ')[0];
          let newMapPathArr = (targetValue.cmake?.['image analysis']?.analysis_map_path).split('/');
          newMapPathArr[newMapPathArr.length - 2] = targetName;
          const newMapPath = newMapPathArr.join('/');
          let newElfPathArr = (targetValue.cmake?.['image analysis']?.analysis_elf_path).split('/');
          newElfPathArr[newElfPathArr.length - 2] = targetName;
          const newElfPath = newElfPathArr.join('/');
          parsedData.compile.map_path = newMapPath;
          parsedData.debug.elf_path = newElfPath;
          parsedData.analysis.elf_path = newElfPath;
          parsedData.analysis.map_path = newMapPath;
          break;
        } else {
          parsedData.compile.custom_build_command = operate.paramData.target;
          parsedData.information.target = operate.paramData.target;
          parsedData.compile.map_path = '';
          parsedData.debug.elf_path = '';
          parsedData.analysis.elf_path = '';
          parsedData.analysis.map_path = '';
        }
      }
    }

    if (launch?.configurations) {
      for (const configuration of launch?.configurations) {
        configuration.executable = parsedData.debug.elf_path;
      }
    }

    const updatedJsonData = JSON.stringify(launch);
    fs.writeFileSync(launchJsonPath, updatedJsonData, 'utf-8');
    
    const updatedContent = ini.stringify(parsedData);
    fs.writeFileSync(hiprojPath, updatedContent, 'utf-8');
    if (parsedData?.debug?.elf_path) {
      const messageElfPath: GetInfoCallBack = {
        method: ApiMethod.GET_INFO_CALLBAK,
        params: {
          data: parsedData?.debug?.elf_path,
          key: 'elfPathInfo',
        },
      };
      extension.settingPanel?.postMessage(messageElfPath);

      const messageElfPathNew: GetInfoCallBack = {
        method: ApiMethod.GET_INFO_CALLBAK,
        params: {
          data: parsedData?.debug?.elf_path,
          key: 'elfPathInfoNew',
        },
      };
      extension.settingPanel?.postMessage(messageElfPathNew);
    }
    
    if (parsedData?.upload?.bin_path) {
      const messageBinPathInfo: GetInfoCallBack = {
        method: ApiMethod.GET_INFO_CALLBAK,
        params: {
          data: parsedData?.upload?.bin_path,
          key: 'binPathInfo',
        },
      };
      extension.settingPanel?.postMessage(messageBinPathInfo);
    }
  }

  static async getJsonData(operate: OperateStruct): Promise<void> {
    const key: string = operate?.paramData?.key;
    const config = jsonTypeGet(operate.paramData.jsonGetParam);
    const callBackMessage: GetInfoCallBack = {
      method: ApiMethod.GET_INFO_CALLBAK,
      params: {
        data: config,
        key: key,
      },
    };
    extension.settingPanel?.postMessage(callBackMessage);
  }

   /**
   * update folder path
   */
   static async updateFolderPath(): Promise<void> {
    const hiprojPath = await getActiveIniPath();
    const content = fs.readFileSync(hiprojPath, 'utf-8');
    const projectFile = ini.parse(content);
    const binPath = projectFile?.upload.bin_path;
    const message: GetInfoCallBack = {
      method: ApiMethod.GET_INFO_CALLBAK,
      params: {
        data: binPath,
        key: 'binPathInfo',
      },
    };
    extension.settingPanel?.postMessage(message);
  }

  /**
   * update usb bin path
   */
  static async updateUsbBinPath(): Promise<void> {
    const hiprojPath = await getActiveIniPath();
    const content = fs.readFileSync(hiprojPath, 'utf-8');
    const projectFile = ini.parse(content);
    const boardBuild = projectFile?.information?.['board_build.mcu'];
    const buildArgv = projectFile?.compile?.custom_build_command;
    let binPath = '';
    if (boardBuild === 'bs25') {
      binPath = path.join('tools', 'pkg', 'fwpkg', boardBuild, 'ota_dfu_fota.bin').replace(/\\/g, '/');
    } else {
      binPath = path.join('output', boardBuild, 'acore', buildArgv, 'fota.fwpkg').replace(/\\/g, '/');
    }
    binPath = `./${binPath}`;
    const message: GetInfoCallBack = {
      method: ApiMethod.GET_INFO_CALLBAK,
      params: {
        data: binPath,
        key: 'binPathInfo',
      },
    };
    extension.settingPanel?.postMessage(message);
  }

    /**
   * update default bin path
   */
  static async updateDefaultBinPath(): Promise<void> {
    // 默认值读取芯片配置json文件里的初始值
    const chipInfo = await getChipInfo();
    let binPath = chipInfo?.upload?.bin_path;
    const message: GetInfoCallBack = {
      method: ApiMethod.GET_INFO_CALLBAK,
      params: {
        data: binPath,
        key: 'binPathInfo',
      },
    };
    extension.settingPanel?.postMessage(message);
  }

  /**
   * update I2c hex path
   */
  static async updateI2cHexPath(): Promise<void> {
    // 3071芯片i2c模式下的烧写默认文件路径
    let binPath = './out/bin/target_boot.hex';
    const message: GetInfoCallBack = {
      method: ApiMethod.GET_INFO_CALLBAK,
      params: {
        data: binPath,
        key: 'binPathInfo',
      },
    };
    extension.settingPanel?.postMessage(message);
  }


  /**
   * select folder path
   * @param {OperateStruct} operate
   */
  static async selectFolderPath(operate: OperateStruct): Promise<void> {
    let newSelectPath: string = '';
    const key: string = operate?.paramData?.key;
    let currentPath = operate?.paramData?.currentValue;
    let currentPathExist = false;
    if (currentPath) {
      currentPathExist = fs.existsSync(currentPath);
    }
    const source = operate?.source;
    vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      defaultUri: vscode.Uri.file(currentPathExist ? currentPath : getUserDir()),
    }).then((fileInfo: any): void => {
      if (fileInfo?.[0]?.fsPath) {
        newSelectPath = fileInfo[0]?.fsPath;
      }
      if (newSelectPath) {
        if (source === 'wizard') {
          if (key === 'projectPathInfo') {
            editUserConfigJson({
              projectCreate_last_projectPath: newSelectPath,
            }, extension.globalStoragePath);

            if (operate.paramData.seriesName === 'cfbb') {
              this.sendProjectMessage('projectPathRightInfo');
            } else {
              Command.validateProjectPath(newSelectPath);
            }
          }
          if (key === 'sdkPathInfo') {
            editUserConfigJson({
              projectCreate_last_sdkPath: newSelectPath,
            }, extension.globalStoragePath);

            if (operate.paramData.seriesName === 'cfbb') {
              this.validateCfbbSdkPath(newSelectPath);
            } else {
              this.validateMcuSdkPath(newSelectPath);
            }
          }
          if (key === 'samplePathInfo') {
            editUserConfigJson({
              projectCreate_last_samplePath: newSelectPath,
            }, extension.globalStoragePath);
            
            const jsonPath = path.join(newSelectPath, 'build_config.json');
            if (!fs.existsSync(jsonPath)) {
              showMessageModal({
                content: res('samplePathWrong'),
              });
            }

            this.sendProjectMessage('samplePathRightInfo');
          }
        }
        const selectFolderPathCallBackMessage: GetInfoCallBack = {
          method: ApiMethod.GET_INFO_CALLBAK,
          params: {
            data: newSelectPath,
            key: key,
          },
        };
        if (operate.source === 'wizard') {
          extension.chipConfigPanel?.postMessage(selectFolderPathCallBackMessage);
        } else {
          extension.settingPanel?.postMessage(selectFolderPathCallBackMessage);
        }
        return;
      } else if (currentPath && source === 'wizard') {
        if (key === 'projectPathInfo') {
          if (operate.paramData.seriesName === 'cfbb') {
            this.sendProjectMessage('projectPathRightInfo');
          } else {
            Command.validateProjectPath(currentPath);
          }
        }
        if (key === 'sdkPathInfo') {
          if (operate.paramData.seriesName === 'cfbb') {
            this.validateCfbbSdkPath(currentPath);
          } else {
            this.validateMcuSdkPath(currentPath);
          }
        }
        if (key === 'samplePathInfo') {
          this.sendProjectMessage('samplePathRightInfo');
        }
        return;
      } else {
        return;
      }
    });
  }

  static async selectFilePath(operate: any): Promise<void> {
    let newSelectPath: string = '';
    const key: string = operate?.paramData?.key;
    let currentPath = operate?.paramData?.currentValue;
    const pathType = operate?.pathType;
    if (pathType === 'relativePath') {
      let rePath = operate?.paramData?.currentValue;
      currentPath = rePath ? path.join(await getActiveWorkFolderPath(), rePath) : await getActiveWorkFolderPath();
    }
    let iniPath = await getActiveIniPath();
    const hiProjectContent = getHiprojContent(iniPath);
    const projectType = hiProjectContent?.information?.project_type;
    const protocol = hiProjectContent?.upload?.protocol;
    const boardName = hiProjectContent?.information?.board;
    let fileType: string[] = [];
    let fileTypeTitle: string | undefined;
    switch (key) {
      case 'binPathInfo': {
        fileType = ['fwpkg'];
        fileTypeTitle = res('chooseFbbFwpkgFile');
        // bs25默认usb烧写文件是.bin格式
        if (boardName === 'bs25' && protocol === 'usb') {
          fileType.push('bin');
          fileTypeTitle = res('chooseFbbFwpkgOrBinFile');
        }
        if (projectType === 'MCU') {
          fileType = ['bin'];
          fileTypeTitle = res('chooseMcuBinFile');
          if (protocol === 'i2c') {
            fileType.push('hex');
            fileTypeTitle = res('chooseMcuBinOrHexFile');
          }
        }
        break;
      }
      case 'elfPathInfo':
      case 'elfPathInfoNew': {
        fileType = ['elf'];
        fileTypeTitle = res('chooseElfFile');
        break;
      }
      case 'jlinkScriptPathInfo':
      case 'jlinkScriptPathInfoNew': {
        fileType = ['JlinkScript'];
        fileTypeTitle = res('chooseJlinkScriptFile');
        break;
      }
      case 'jlinkServerPathInfo':
      case 'jlinkServerPathInfoNew': {
        fileType = ['exe'];
        fileTypeTitle = res('chooseJLinkGDBServerCLFile');
        break;
      }
      default: {
        break;
      }
    }
    vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      defaultUri: vscode.Uri.file(currentPath ? currentPath : ''),
      filters: { file: fileType },
      title: fileTypeTitle,
    }).then(async (fileInfo: any) => {
      if (fileInfo?.[0]?.fsPath) {
        newSelectPath = fileInfo[0].fsPath;
      }
      if (newSelectPath) {
        if (pathType === 'relativePath') {
          newSelectPath = path.relative(await getActiveWorkFolderPath(), newSelectPath);
        }
        const message: GetInfoCallBack = {
          method: ApiMethod.GET_INFO_CALLBAK,
          params: {
            data: newSelectPath,
            key: key,
          },
        };
        extension.settingPanel?.postMessage(message);
      }
    });
  }
  
  static async getFileAndFolder(operate: any): Promise<void> {
    const key: string = operate?.paramData?.key ? operate.paramData?.key : '';

    if (operate?.paramData?.diskinfo) {
      getAllDrive().then((re: Array<any>) => {
        const callBackMessage: GetInfoCallBack = {
          method: ApiMethod.GET_INFO_CALLBAK,
          params: {
            data: re.sort((a, b) => a?.title?.localeCompare(b?.title)),
            key: key,
          },
        };
        extension.settingPanel?.postMessage(callBackMessage);
      });
    } else {
      let rootPath: string = operate?.paramData?.data ? operate?.paramData?.data : (await getActiveWorkFolderPath());
      let pathArr: Array<string> = [];
      let resultArr: Array<{ title: string; path: string; relative: string; isDir?: boolean }> = [];
      if (rootPath) {
        try {
          pathArr = fs.readdirSync(rootPath);
        } catch {
          pathArr = [];
        }
        pathArr.forEach(item => {
          let fullPath = path.join(rootPath, item);
          try {
            const stat = fs.statSync(fullPath);
            resultArr.push({
              title: item,
              path: fullPath,
              relative: path.relative(rootPath, fullPath),
              isDir: stat?.isDirectory(),
            });
          } catch {
            return;
          }
        });
        const callBackMessage: GetInfoCallBack = {
          method: ApiMethod.GET_INFO_CALLBAK,
          params: {
            data: resultArr,
            key: key,
          },
        };
        extension.settingPanel?.postMessage(callBackMessage);
      }
    }
  }

  static async updateTreeArr(operate: any): Promise<void> {
    const key: string = operate?.paramData?.key;
    let treeArr = operate?.paramData?.treeArr;
    let rootPath = operate?.paramData?.path;
    const activePath = await getActiveWorkFolderPath();

    let rootArr: Array<any> = [];
    try {
      rootArr = fs.readdirSync(rootPath);
    } catch {
      rootArr = [];
    }
    let childArr = rootArr.map((item: any): any => {
      let fullPath = path.join(rootPath, item);
      if (fs.existsSync(fullPath)) {
        try {
          const stat = fs.statSync(fullPath);
          return {
            title: item,
            path: fullPath,
            relative: path.relative(activePath, fullPath),
            isDir: stat.isDirectory(),
          };
        } catch {
          return undefined;
        }
      } else {
        return undefined;
      }
    });
    let newChildArr = childArr.filter(function (val) {
      return val;
    });

    treeArr = updatePathList(treeArr, newChildArr, rootPath);
    const callBackMessage: GetInfoCallBack = {
      method: ApiMethod.GET_INFO_CALLBAK,
      params: {
        data: treeArr,
        key: key,
      },
    };
    extension.settingPanel?.postMessage(callBackMessage);
  }

  static async stopObtainImportableItems(): Promise<void> {
    this.promiseIndex.kill(`SIGKILL`);
    const callBackMessage: GetInfoCallBack = {
      method: ApiMethod.GET_INFO_CALLBAK,
      params: {
        data: new Date().getTime(),
        key: 'killImportFinished',
      },
    };
    extension.projectImportPanel?.postMessage(callBackMessage);
  }

  /**
* select folder path
*/
  static async obtainImportableItems(operate: any): Promise<void> {
    this.promiseIndex = extension.isCustomIDE ?
      cp.fork(path.join(__dirname, 'searchProjects.js')) :
      cp.fork(getResource.get(script.search));
    this.promiseIndex.on('message', (callBackMessage: any) => {
      extension.projectImportPanel?.postMessage(callBackMessage);
    });

    let importPath: string = '';
    const key: string = operate?.paramData?.key ? operate.paramData?.key : '';
    let paramPath = operate?.paramData?.path;
    if (paramPath) {
      this.promiseIndex.send({
        type: 'iterationToObtain',
        param: {
          importPath: path.join(paramPath),
          globalStoragePath: extension.globalStoragePath,
        },
      });
      return;
    }
    let defaultUri = operate?.paramData?.defaultPath;
    let defaultUriexist = false;
    if (defaultUri) {
      defaultUriexist = fs.existsSync(defaultUri);
    }
    vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      defaultUri: defaultUriexist ? vscode.Uri.file(defaultUri) : vscode.Uri.file(getUserDir()),
    }).then((fileInfo: any) => {
      if (!fileInfo || !fileInfo[0] || !fileInfo[0].fsPath) {
        this.promiseIndex.kill();
        return;
      }
      sendProgressDisplay();
      importPath = fileInfo[0].fsPath;
      editUserConfigJson({
        projectImport_last_importPath: importPath,
      }, extension.globalStoragePath);
      if (importPath) {
        const callBackMessage = {
          method: ApiMethod.GET_INFO_CALLBAK,
          params: {
            data: importPath,
            key: 'importablePath',
          },
        };
        extension.projectImportPanel?.postMessage(callBackMessage);
        this.promiseIndex.send({
          type: 'iterationToObtain',
          param: {
            importPath: path.join(importPath),
            globalStoragePath: extension.globalStoragePath,
          },
        });
      }
    });

    function sendProgressDisplay(display: boolean = true, progress: number = 0): void {
      const callBackMessage: GetInfoCallBack = {
        method: ApiMethod.GET_INFO_CALLBAK,
        params: {
          data: {
            display,
            progress,
          },
          key: 'progressDisplay',
        },
      };
      extension.projectImportPanel?.postMessage(callBackMessage);
    }
  }

  /**
   * confirm import items
   */
  static async confirmImport(param: any = []): Promise<void> {
    if (param.length <= 0) {
      return;
    }
    let importFailedArr: Array<ImportTableItem> = [];
    let importSuccessArr: Array<ImportTableItem> = [];
    // Converting a Harmony Project to a HiIDE Project
    let importItemArr: any = [];
    extension.setProgress(50, res('wait'));
    await Promise.all(param.map(async (item: any) => {
      // Indicates that the current is HarmonyOS.
      let newIniPath = item.path;
      let newChip = '';
      let board = '';
      let failedFileChildren: Array<FailedFileChildren> = [];
      let importTableItem: ImportTableItem = {
        key: new Date().toLocaleString('zh-CN'),
        path: '',
        status: '',
        children: failedFileChildren,
      };
      if (fs.existsSync(item.path)) {
        let iniPath = pathIsHormonyDir(item.path); // path of deveco.ini
        if (iniPath) {
          let importOk = false;
          ({ importOk, newIniPath, newChip, board } = await convertHormony({
            item, iniPath, importSuccessArr, importFailedArr, importTableItem, failedFileChildren,
          }));
          if (!importOk) {
            return;
          }
        } else if (pathIsHiproj(item.path)) {
          let importOk = false;
          ({ importOk, newIniPath, newChip, board } = await importMcuProj({
            item, iniPath, importSuccessArr, importFailedArr, importTableItem, failedFileChildren,
          }));
          if (!importOk) {
            return;
          }
        } else {
          failedFileChildren.push({
            path: item.path,
            status: failedType.wrongContent,
          });
          importTableItem.path = item.path;
          importTableItem.key = item.path;
          importTableItem.status = res('importFailed');
          importFailedArr.push(importTableItem);
          return;
        }
      }
      importItemArr.push({
        name: item.name,
        path: newIniPath,
        chip: newChip,
        board: board,
        time: (new Date()).toLocaleString('zh-CN'),
      });
    }));
    extension.setProgress(70, res('wait'));
    addItemsToProList(importItemArr, extension.globalStoragePath);
    extension.setProgress(100, res('wait'));
    if (importFailedArr.length > 0 || importSuccessArr.length > 0) {
      Command.postImportFaildFile(importFailedArr, importSuccessArr, importItemArr);
    } else {
      // If there is only one item, open it.
      if (importItemArr.length === 1) {
        vscode.commands.executeCommand('openSingalProject', {
          projectPath: importItemArr[0].path,
          invoker: 'openAfterImport',
        });
      }
      this.closeProjectImport();
    }
  }

  static confirmImportWrnModal(operate: any): void {
    let arr = operate.paramData.importSuccessArr;
    if (arr.length === 1) {
      vscode.commands.executeCommand('openSingalProject', {
        projectPath: arr[0].path,
        invoker: 'openAfterImport',
      });
    }
    this.closeProjectImport();
  }

  static async getUserConfig(operate: any): Promise<void> {
    const data = readUserConfigJson(extension.globalStoragePath);
    const callBackMessage: GetInfoCallBack = {
      method: ApiMethod.GET_INFO_CALLBAK,
      params: {
        data,
        key: 'userConfig',
      },
    };
    extension.chipConfigPanel?.postMessage(callBackMessage);
    extension.projectImportPanel?.postMessage(callBackMessage);
    if (operate.paramData.seriesName === 'cfbb') {
      this.validateCfbbSdkPath(data?.projectCreate_last_sdkPath);
    } else {
      this.validateMcuSdkPath(data?.projectCreate_last_sdkPath);
    }
    if (data?.projectCreate_last_projectPath) {
      if (operate.paramData.seriesName === 'cfbb') {
        this.sendProjectMessage('projectPathRightInfo');
      } else {
        Command.validateProjectPath(data?.projectCreate_last_projectPath);
      }
    }
  }

  /**
 * close project wizard
 */
  static async closeProjectWizard(): Promise<void> {
    extension.deactivate();
    vscode.commands.executeCommand('welcomePage.welcome');
  }

  static async closeProjectImport(): Promise<void> {
    extension.deactivate('projectImport');
    vscode.commands.executeCommand('welcomePage.welcome');
  }

  static async closeProjectSettings(): Promise<void> {
    extension.deactivate('projectSettings');
  }

  static getIniInfo(): void {
    const iniPath = extension.settingPanel?.iniPath ?? '';
    const iniInfo = getHiprojContent(iniPath);
    if (iniInfo) {
      const getIniInfoCallbackMessage: GetInfoCallBack = {
        method: ApiMethod.GET_INFO_CALLBAK,
        params: {
          data: iniInfo,
          key: 'project',
        },
      };
      extension.settingPanel?.postMessage(getIniInfoCallbackMessage);

      const board = iniInfo?.information?.board;
      const chip = iniInfo?.information?.['board_build.mcu'];
      const sdkPath = iniInfo?.information?.sdk_path;
      const seriesName = iniInfo?.information?.series_name;
      const boardJsonName = getRealBoardJsonName(seriesName, chip, board);
      const config: any = jsonTypeGet({
        soc: chip,
        sdkPath,
        boardJsonPath: boardJsonName,
      });
      const callBackMessage: GetInfoCallBack = {
        method: ApiMethod.GET_INFO_CALLBAK,
        params: {
          data: config,
          key: 'jsonData',
        },
      };
      extension.settingPanel?.postMessage(callBackMessage);
      fs.close;
    } else {
      Command.closeProjectSettings();
    }
  }

  static getIndependentConfig(operate: OperateStruct): void {
    const iniP = extension?.settingPanel?.iniPath;
    if (!iniP || !fs.existsSync(iniP)) {
      showMessageModal({
        content: res('hiprojNotInWorkSpace'),
      });
      return;
    }
    const source = operate.paramData;
    const userconfigPath = path.join(path.dirname(iniP), 'chip', 'target', 'userconfig.json');
    const cb = (): void => {
      if (operate?.source !== 'handleFactory') {
        Command.closeProjectSettings();
      }
    };
    const getResult: any = getUserconfigAndSubsystem(userconfigPath, iniP, cb);
    if (!getResult || !getResult.subsystem) {
      return;
    }
    const { subsystem } = getResult;
    let independentConfig: any = null;
    for (let i = 2; i < subsystem.length; i++) {
      if (source === subsystem[i]?.source || source.includes(subsystem[i]?.source)) {
        independentConfig = subsystem[i]?.compileConfig;
        break;
      }
    }

    const getJsonInfoCallbackMessage: GetInfoCallBack = {
      method: ApiMethod.GET_INFO_CALLBAK,
      params: {
        data: independentConfig,
        key: 'independentConfig',
      },
    };
    extension.settingPanel?.postMessage(getJsonInfoCallbackMessage);
  }

  static handleFactory(param: HandleFactoryStruct): void {
    const iniP = extension?.settingPanel?.iniPath;
    if (!iniP || !fs.existsSync(iniP)) {
      showMessageModal({
        content: res('hiprojNotInWorkSpace'),
      });
      return;
    }
    const userconfigPath = path.join(path.dirname(iniP), 'chip', 'target', 'userconfig.json');
    const getResult: any = getUserconfigAndSubsystem(userconfigPath, iniP);
    if (!getResult) {
      return;
    }
    const { userconfig, subsystem } = getResult;
    if (!userconfig || !subsystem) {
      return;
    }
    userconfig.system[0].subsystem = subsystem.filter((item: any) => item.source !== param.path);
    writeWithcheckRight(userconfigPath, JSON.stringify(userconfig, null, 4), {
      unExpectModal: modalType.usercfgJsonUnExpectErrW,
      wErrModal: modalType.usercfgJsonNoRightToW,
    });
    Command.getIndependentConfig({ operationType: '', paramData: param.path, source: 'handleFactory' });
    const factoryMessage: GetInfoCallBack = {
      method: ApiMethod.GET_INFO_CALLBAK,
      params: {
        data: Date.now(),
        key: 'factory',
      },
    };
    extension.settingPanel?.postMessage(factoryMessage);
  }

  static async setBurnCommand(iniInfo: any, config: any, initPath: any): Promise<void> {
    const baseInfo = iniInfo.information;
    const baseFlashPath = path.join(vscode.env.appRoot, '..', '..', 'tools', 'hw_openocd', 'bin', 'burn_flash_algo', 'online_burn', `CHIP_${baseInfo.series_name.toUpperCase()}`);
    const mainElfPath = path.join(baseFlashPath, 'PART_MAIN_RGN', 'FlashAlgo.elf');
    let seriesName = iniInfo?.information?.series_name.toUpperCase();
    let fileHeadName: string = 'PART_MAIN_RGN';
    const uploadStart = iniInfo?.upload?.editAddress ? iniInfo.upload.editAddress : iniInfo?.upload?.address;
    let iniPath: any = findHiprojFileSync(initPath);
    if (fs.existsSync(mainElfPath)) {
      if (iniInfo.upload.flash_region !== 0 || !iniInfo.upload.loadFiles) {
        iniInfo.upload.flash_region = 0;
        iniInfo.upload.loadFiles = path.join(fileHeadName, 'FlashAlgo.elf');
        fs.writeFileSync(iniPath, ini.stringify(iniInfo), 'utf-8');
      }
    } else {
      return;
    }
    config.loadFiles = [
      iniInfo?.upload?.bin_path,
      path.join('${command:toolsPath}', 'hw_openocd', 'bin', 'burn_flash_algo', 'online_burn', `CHIP_${seriesName}`, fileHeadName, 'FlashAlgo.elf'),
      uploadStart,
    ];
  }

  static setMultiCoreModeValue(data: any): void {
    let multiCoreValue: string = data.params.data.value;
    if (multiCoreValue === singCoreDebugString) {
      return;
    }
    setMultiModevalue(multiCoreValue);
    const iniPath: string = extension.settingPanel?.iniPath ?? '';
    let iniInfo = getHiprojContent(iniPath);
    if (!iniInfo) {
      return;
    }
    Command.updateLaunch(iniInfo, 'multiCore');
  }

  static async save2Ini(data: any): Promise<void> {
    if (data.path) {
      Command.handleIndpendentCompile(data);
    } else {
      const { section } = data;
      const { params } = data;
      const iniPath: string = extension.settingPanel?.iniPath ?? '';
      const workspaceFolderPath = await getActiveWorkFolderPath();
      let iniInfo = getHiprojContent(iniPath);
      if (!iniInfo) {
        return;
      }
      if (section === 'compile' && iniInfo?.compile?.tool_chain !== params.tool_chain) {
        if (!iniInfo.compile) {
          iniInfo.compile = {};
        }
        iniInfo.compile['tool_chain'] = params['tool_chain'];
        Command.updateLaunch(iniInfo, 'toolchainBinDir');
        const ccppPropertiesJsonPath = path.join(workspaceFolderPath, '.vscode', 'c_cpp_properties.json');

        let ccppProperties = getCCppJsonContent(ccppPropertiesJsonPath, workspaceFolderPath);
        if (ccppProperties) {
          if (Array.isArray(ccppProperties?.configurations)) {
            ccppProperties.configurations.forEach((item: any) => {
              if (item.compilerPath) {
                item.compilerPath = getCppCompilePath(iniInfo?.information?.series_name, params.tool_chain);
              }
            });
            writeWithcheckRight(ccppPropertiesJsonPath, JSON.stringify(ccppProperties, null, 4), {
              unExpectModal: modalType.cppJsonUnExpectErrW,
              wErrModal: modalType.cppJsonNoRightToW,
            });
          } else {
            showMessageModal({
              content: `${res('parseErrWhetherGenerate', [ccppPropertiesJsonPath])}${res('impactOfParseErrCCppJson')}`,
              btn: [res('confirm')],
              cb: async (btn: string) => {
                if (btn === res('confirm')) {
                  await reCreCCppConfigJson(workspaceFolderPath);
                }
              },
            });
          };
        }
        const configType = params.tool_chain === 'BiSheng' ? `bisheng_${iniInfo.compile.float_type}` : 'hcc_fpu';
        const src = path.join(workspaceFolderPath, 'build', 'config', configType, 'userconfig.json');
        const dest = path.join(workspaceFolderPath, 'chip', 'target', 'userconfig.json');
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
        } else {
          showMessageModal({ content: res('noUserConfigTip', [src]) });
        }
      }

      // update ini
      Command.saveUiSetting(iniInfo, iniPath, section, params);

      // update launch.json
      if (section === 'debug') {
        if (params?.elf_path || params?.new_elf_path) {
          Command.updateLaunch(iniInfo, 'executable');
        }
        if (params?.tool) {
          Command.updateLaunch(iniInfo, 'servertype');
          Command.updateLaunch(iniInfo, 'serverArgs');
        }
        if (params?.interface || params?.speed || params?.jlinkScriptPath || params?.new_jlinkScript_Path) {
          Command.updateLaunch(iniInfo, 'serverArgs');
        }
        if (params?.jlinkServerPath) {
          Command.updateLaunch(iniInfo, 'jlinkServerPath');
        }
      }

      if (section === 'upload' && iniInfo?.information?.project_type === 'MCU') {
        const debugTool = iniInfo?.debug?.tool;
        if ((debugTool === 'HiSpark-Trace' || debugTool === 'HiSpark-Link') && params?.bin_path) {
          Command.updateLaunch(iniInfo, 'loadFiles');
          Command.updateLaunch(iniInfo, 'serverArgs');   
        }
      }
    }
  }

  static handleIndpendentCompile(data: any): void {
    const iniP = extension?.settingPanel?.iniPath;
    if (!iniP || !fs.existsSync(iniP)) {
      showMessageModal({
        content: res('hiprojNotInWorkSpace'),
      });
      return;
    }
    const userconfigPath = path.join(path.dirname(iniP), 'chip', 'target', 'userconfig.json');
    const getResult: any = getUserconfigAndSubsystem(userconfigPath, iniP);
    if (!getResult) {
      return;
    }
    const { userconfig, subsystem } = getResult;
    if (!userconfig || !subsystem) {
      return;
    }
    const compileConfig = {
      optimization: data.params.optimization,
      werror: data.params.werror,
      werr_implicit_func: data.params.werr_implicit_func,
      warning: data.params.warning,
      wno_unused_function: data.params['wno_unused_function'],
      wno_unused_label: data.params['wno_unused_label'],
      wno_unused_parameter: data.params['wno_unused_parameter'],
      wno_unused_variable: data.params['wno_unused_variable'],
      wno_missing_prototypes: data.params['wno_missing_prototypes'],
      isCompile: data.params.isCompile,
    };
    let flag = false;
    for (let i = 2; i < subsystem.length; i++) {
      if (subsystem[i].source === data.path) {
        subsystem[i].compileConfig = compileConfig;
        flag = true;
        break;
      }
    }
    if (!flag) {
      subsystem.push({
        source: data.path,
        target_type: 'source_set',
        compileConfig,
      });
      const staticConfig = subsystem.shift();
      const compileFrame = subsystem.shift();
      subsystem.sort((a: any, b: any) => a.source < b.source ? 1 : -1);
      subsystem.unshift(compileFrame);
      subsystem.unshift(staticConfig);
    }
    writeWithcheckRight(userconfigPath, JSON.stringify(userconfig, null, 4), {
      unExpectModal: modalType.usercfgJsonUnExpectErrW,
      wErrModal: modalType.usercfgJsonNoRightToW,
    });
    const getInfoCallbackMessage: GetInfoCallBack = {
      method: ApiMethod.GET_INFO_CALLBAK,
      params: {
        data: compileConfig,
        key: 'independentConfig',
      },
    };
    extension.settingPanel?.postMessage(getInfoCallbackMessage);
  }

  static getTarget(debugInterface: string, socName: string): string {
    return path.join('target', `${socName?.toLocaleUpperCase()}-${debugInterface?.toLocaleLowerCase()}.cfg`);
  }

  static getInterface(debugInterface: string, debugBoard: string): string {
    if (debugBoard === 'HiSpark-Trace') {
      return path.join('interface', 'cmsis-dap.cfg');
    }
    if (debugBoard === 'HiSpark-Link' || 'HiSparkLinkPro') {
      const tmpIniPath = extension.settingPanel?.iniPath ?? '';
      const tmpIniInfo = getHiprojContent(tmpIniPath);
      const seriesName = tmpIniInfo?.information?.series_name;
      if (debugInterface === 'jtag') {
        if (seriesName === 'cfbb') {
          return path.join('interface', 'cmsis-dap.cfg');
        } else {
          return path.join('interface', 'ft2232h-ftdi-jtag.cfg');
        }
      } else if (debugInterface === 'swd') {
        /* In the CFBB scenario, the getInterface interface needs to return the cmsis-dap.cfg file. */
        if (seriesName === 'cfbb') {
          return path.join('interface', 'cmsis-dap.cfg');
        } else {
          return path.join('interface', 'ft2232h-ftdi-swd.cfg');
        }
      } else {
        return '';
      }
    }
    return '';
  }

   // NB芯片存在多核，需要根据不同的核配置不同的脚本文件
  static getNbOpenOcdCfg(iniInfo:any, config: any): void {
    if (!iniInfo?.information?.board.includes('nb')) {
      return;
    }
    if (iniInfo?.debug?.elf_path.includes('protocol')) {
      config.serverArgs = [
        '-c', `adapter speed ${iniInfo?.debug?.speed}`,
        '-c', 'gdb_port 3333',
        '-s', path.join('${command:toolsPath}', 'hw_openocd'),
        '-f', `${Command.getInterface(iniInfo?.debug?.interface, iniInfo?.debug?.tool)}`,
        '-f', `${Command.getTarget(iniInfo?.debug?.interface, 'nb18-pcore')}`,
      ];
    } else if (iniInfo?.debug?.elf_path.includes('application')) {
      config.serverArgs = [
        '-c', `adapter speed ${iniInfo?.debug?.speed}`,
        '-c', 'gdb_port 3333',
        '-s', path.join('${command:toolsPath}', 'hw_openocd'),
        '-f', `${Command.getInterface(iniInfo?.debug?.interface, iniInfo?.debug?.tool)}`,
        '-f', `${Command.getTarget(iniInfo?.debug?.interface, 'nb18-acore')}`,
      ];
    }
    return;
  }

  // iniInfo needs to be checked for the board_build.mcu、json_path、sdk_path、series_name attribute in advance.
  static async updateLaunch(iniInfo: any, key: string): Promise<void> {
    const workspaceFolderPath = await getActiveWorkFolderPath();
    let filePath: string = await getBurnParamFilePath(iniInfo?.upload?.flash_region);
    const launchPath = path.join(workspaceFolderPath, '.vscode', 'launch.json');
    const jsonGetParam = {
      soc: iniInfo?.information?.['board_build.mcu'],
      boardJsonPath: iniInfo?.information?.json_path,
      sdkPath: iniInfo?.information?.sdk_path,
      seriesName: iniInfo?.information?.series_name,
      toolChain: iniInfo?.compile?.tool_chain,
    };
    if (key === 'multiCore') {
      await creLaunchJsonFile(jsonGetParam, workspaceFolderPath);
      return;
    }
    let openocdTargetFile = '';
    let cpuNumber = '';
    cpuNumber = iniInfo?.information?.currentCPU?.match(/\d+$/);
    const isSupportMultiChip = (iniInfo?.information?.series_name === '3066h') || (iniInfo?.information?.series_name === '3067m');
    if (isSupportMultiChip && iniInfo?.information?.project_new_type === 'multiCoreProject') {
      openocdTargetFile = path.join('target', `${iniInfo?.information?.['board_build.mcu']?.toLocaleUpperCase()}${cpuNumber}-${iniInfo?.debug?.interface?.toLocaleLowerCase()}.cfg`);
    } else if (isSupportMultiChip && iniInfo?.information?.project_new_type === 'commonProject') {
      openocdTargetFile = path.join('target', `${iniInfo?.information?.['board_build.mcu']?.toLocaleUpperCase()}${0}-${iniInfo?.debug?.interface?.toLocaleLowerCase()}.cfg`);
    } else {
      openocdTargetFile = Command.getTarget(iniInfo?.debug?.interface, iniInfo?.information?.['board_build.mcu']);
    }
    let launch = getExFileContent(launchPath, 'json', {
      fErr: `${res('noPathWhetherGenerate', [launchPath])}${res('impactOfMissingLaunchJson')}`,
      rErr: `${res('noRightToR', [launchPath])}${res('impactOfUnupdateLaunchJson')}`,
      parseErr: `${res('parseErrWhetherGenerate', [launchPath])}${res('impactOfParseErrLaunchJson')}`,
    }, {
      fErr: async () => await reCreLaunchJsonFile(jsonGetParam, workspaceFolderPath),
      parseErr: async () => await reCreLaunchJsonFile(jsonGetParam, workspaceFolderPath),
    }, {
      fErrModal: modalType.launchJsonFErr,
      rErrModal: modalType.launchJsonRErr,
      parseErrModal: modalType.launchJsonParseErr,
    });
    if (launch) {
      if (!(isArray(launch?.configurations) && launch?.configurations.length > 0)) {
        if (!extension.messageModalManage) {
          extension.messageModalManage = {};
        }
        if (!extension.messageModalManage[modalType.launchJsonParseErr]) {
          extension.messageModalManage[modalType.launchJsonParseErr] = true;
          await asyncShowMessageModal({
            content: `${res('parseErrWhetherGenerate', [launchPath])}${res('impactOfParseErrLaunchJson')}`,
            btn: [res('confirm')],
            cb: (btn: string) => {
              if (btn === res('confirm')) {
                reCreLaunchJsonFile(jsonGetParam, workspaceFolderPath);
              }
              if (extension?.messageModalManage?.[modalType.launchJsonParseErr]) {
                extension.messageModalManage[modalType.launchJsonParseErr] = false;
              }
            },
          });
        }
        return;
      }

      let allCanChange: boolean = true;
      launch['configurations']?.forEach((config: any) => {
        if (key === 'executable') {
          if (config[key]) {
            config[key] = findConfigElf(config, iniInfo);
          } else {
            allCanChange = false;
          }
          if (iniInfo?.debug?.tool === 'HiSparkLinkPro') {
            Command.getNbOpenOcdCfg(iniInfo, config);
          }
        } else if (key === 'serverArgs') {
          if (config[key]) {
            if (iniInfo?.debug?.tool === 'jlink') {
              if (iniInfo.information.series_name === 'cfbb') {
                const noGuiArg = iniInfo.information?.board?.includes('3322');
                config.serverArgs = [
                  '-singlerun', ...(noGuiArg ? [] : ['-nogui']),
                  '-if', iniInfo?.debug?.interface,
                  '-port', '3333',
                  '-swoport', '50001',
                  '-telnetport', '50002',
                  '-device', 'RISC-V',
                  '-jlinkscriptfile', findConfigScriptPath(config, iniInfo),
                ];
              } else {
                config.serverArgs = [
                  '-singlerun',
                  '-if', iniInfo?.debug?.interface,
                  '-select', 'USB',
                  '-device', iniInfo?.information?.['board_build.mcu'],
                  '-port', '3333',
                  '-speed', iniInfo?.debug?.speed.toString(),
                ];
              }
            } else {
              config.serverArgs = [
                '-c', `adapter speed ${iniInfo?.debug?.speed}`,
                '-c', 'gdb_port 3333',
                '-s', path.join('${command:toolsPath}', 'hw_openocd'),
                '-f', `${Command.getInterface(iniInfo?.debug?.interface, iniInfo?.debug?.tool)}`,
                '-f', `${openocdTargetFile}`,
              ];
              if (iniInfo?.debug?.tool === 'HiSparkLinkPro') {
                Command.getNbOpenOcdCfg(iniInfo, config);
              }
              if (filePath !== '' && iniInfo?.information?.project_type === 'MCU') {
                config.serverArgs.push('-p');
                config.serverArgs.push(filePath);
              }
            }
          } else {
            allCanChange = false;
          }
        } else if (key === 'servertype') {
          if (config[key]) {
            if (iniInfo?.debug?.tool === 'jlink') {
              config[key] = iniInfo?.debug?.tool;
              config.serverArgs = [
                '-singlerun',
                '-if', iniInfo?.debug?.interface,
                '-select', 'USB',
                '-device', iniInfo?.information?.board,
                '-port', '3333',
                '-speed', iniInfo?.debug?.speed,
              ];
              config.serverpath = iniInfo?.debug?.jlinkServerPath ? iniInfo?.debug?.jlinkServerPath : '';
              if (iniInfo?.information?.project_type === 'MCU') {
                delete config.loadFiles;
              }
              let projectType = '';
              projectType = getProjectType(iniInfo);
              creDebugInitFile(workspaceFolderPath, 'jlink', projectType);
            } else {
              config[key] = `openocd(${iniInfo?.debug?.tool})`;
              config.serverArgs = [
                '-c', `adapter speed ${iniInfo?.debug?.speed}`,
                '-c', 'gdb_port 3333',
                '-s', path.join('${command:toolsPath}', 'hw_openocd'),
                '-f', `${Command.getInterface(iniInfo?.debug?.interface, iniInfo?.debug?.tool)}`,
                '-f', `${openocdTargetFile}`,
              ];
              if (filePath !== '' && iniInfo?.information?.project_type === 'MCU') {
                config.serverArgs.push('-p');
                config.serverArgs.push(filePath);
              }
              config.serverpath = path.join('${command:toolsPath}', 'hw_openocd', 'bin', 'openocd.exe');
              if (config.request === 'launch' && iniInfo?.information?.project_type === 'MCU') {
                Command.setBurnCommand(iniInfo, config, workspaceFolderPath);
              }

              let projectType = '';
              projectType = getProjectType(iniInfo);
              if (iniInfo?.debug?.tool?.includes('HiSpark-Trace')) {
                creDebugInitFile(workspaceFolderPath, 'HiSpark-Trace', projectType);
              }
              if (iniInfo?.debug?.tool?.includes('HiSpark-Link')) {
                creDebugInitFile(workspaceFolderPath, 'HiSpark-Link', projectType);
              }
              if (iniInfo?.debug?.tool?.includes('HiSparkLinkPro')) {
                creDebugInitFile(workspaceFolderPath, 'HiSparkLinkPro', projectType);
                config.serverpath = path.join('${command:toolsPath}', 'hw_openocd', 'bin', 'openocd_connect.exe');
              }
            }
          } else {
            allCanChange = false;
          }
        } else if (key === 'jlinkServerPath' && iniInfo?.debug?.tool === 'jlink') {
          config.serverpath = iniInfo?.debug?.jlinkServerPath;
        } else if (key === 'jlinkScriptPath' && iniInfo?.debug?.tool === 'jlink') {
          config.jlinkScriptPath = iniInfo?.debug?.jlinkScriptPath;
        } else if (key === 'new_jlinkScript_Path' && iniInfo?.debug?.tool === 'jlink') {
          config.new_jlinkScript_Path = iniInfo?.debug?.new_jlinkScript_Path;
        } else if (key === 'toolchainBinDir') {
          config.toolchainBinDir = getLaunchToolChainBinDir(iniInfo?.compile?.tool_chain);
        } else if (config.request === 'launch' && iniInfo?.information?.project_type === 'MCU' &&
          key === 'loadFiles') {
            Command.setBurnCommand(iniInfo, config, workspaceFolderPath);
        } else {
          return;
        }
      });
      if (!allCanChange) {
        if (!extension.messageModalManage) {
          extension.messageModalManage = {};
        }
        if (!extension.messageModalManage[modalType.launchJsonMissingField]) {
          extension.messageModalManage[modalType.launchJsonMissingField] = true;
          await asyncShowMessageModal({
            content: `${res('fileMissingFields', [launchPath])}${res('impactOfLaunchJsonMissingFields')}`,
            btn: [res('confirm')],
            cb: (btn: string) => {
              if (btn === res('confirm')) {
                reCreLaunchJsonFile(jsonGetParam, workspaceFolderPath);
              }
              if (extension?.messageModalManage?.[modalType.launchJsonMissingField]) {
                extension.messageModalManage[modalType.launchJsonMissingField] = false;
              }
            },
          });
        }
        return;
      }
      writeWithcheckRight(launchPath, JSON.stringify(launch, null, 4), {
        unExpectModal: modalType.launchJsonUnExpectErrW,
        wErrModal: modalType.launchJsonNoRightToW,
      });
    }
  }

  static saveUiSetting(iniInfo: any, iniPath: string, section: string, data: any): void {
    if (section && data) {
      for (const key of Object.keys(data)) {
        if (!iniInfo[section]) {
          iniInfo[section] = {};
        }
        iniInfo[section][key] = data[key];
      }
      writeWithcheckRight(iniPath, ini.stringify(iniInfo), {
        unExpectModal: modalType.hiprojUnExpectErrW,
        wErrModal: modalType.hiprojNoRightToW,
      }, {
        unExpectMsg: res('noRightToW', [iniPath]),
        wErrMsg: res('noRightToW', [iniPath]),
      });
    }
  }

  static async ShowWarning(msg: any): Promise<void> {
    showMessageModal(msg);
  }

  static async getUsbValueList(): Promise<void> {
    try {
      const toolsPath: string = getToolsPath();
      const exePath = extension.isCustomIDE ?
        path.join(vscode.env.appRoot, '..', '..', 'tools', 'cfbb', 'BurnTool', 'BurnTool.exe') :
        path.join(toolsPath, 'tools', 'cfbb', 'BurnTool', 'BurnTool.exe');
      const usblistArg = '-gethiddevice';
      const { spawnSync } = require('child_process');
      const result = spawnSync(exePath, [usblistArg], { encoding: 'utf-8' });
      const usbValueListInfo = result.output[1].toString();
      if (usbValueListInfo) {
          // 将字符串分割成数组
          const usbDevices = usbValueListInfo.split('\n').filter(Boolean);
          if (usbDevices) {
            const usbValueList = usbDevices.map((usbDevice: any) => {
              // 使用正则表达式解析设备信息
              const nameMatch = usbDevice.match(/Name:(?<name>[\s\S]*?),/);
              const pidMatch = usbDevice.match(/PID:(?<pid>.*?),/);
              const vidMatch = usbDevice.match(/VID:(?<vid>.*?),/);
              const usageMatch = usbDevice.match(/Usage:(?<usage>.*?),/);
              const usagePageMatch = usbDevice.match(/UsagePage:(?<usagePage>.*?)\r/);
              return {
                name: nameMatch ? nameMatch[1] : '',
                pid: pidMatch ? pidMatch[1] : '',
                vid: vidMatch ? vidMatch[1] : '',
                usage: usageMatch ? usageMatch[1] : '',
                usagePage: usagePageMatch ? usagePageMatch[1] : '',
              };
            });
            const getUsbValueListInfoCallbackMessage: GetInfoCallBack = {
              method: ApiMethod.GET_INFO_CALLBAK,
              params: {
                data: usbValueList,
                key: 'usbValueList',
              },
            };
            extension.settingPanel?.postMessage(getUsbValueListInfoCallbackMessage);
          }
        }
    } catch {
      vscode.window.showErrorMessage('Fail to get get Usb Device List');
    }
  }

  static async getSerialPorts(): Promise<void> {
    try {
      const portsInfo = await SerialPort.list();
      if (portsInfo) {
        const portsList = portsInfo.map((port: any) => {
          return {
            value: port.path,
            label: port.path,
          };
        });
        const getPortsInfoCallbackMessage: GetInfoCallBack = {
          method: ApiMethod.GET_INFO_CALLBAK,
          params: {
            data: portsList,
            key: 'portsList',
          },
        };
        extension.settingPanel?.postMessage(getPortsInfoCallbackMessage);
      }
    } catch (err) {
      // If the serial port fails to be obtained, no operation is performed.
    }
  }

  static updateSdkTips(operate: any): void {
    if (operate.paramData.needValidate) {
      this.validateMcuSdkPath(operate.paramData.sdkPath);
    } else {
      this.validateCfbbSdkPath(operate.paramData.sdkPath);
    }
  }

  /**
   * 验证 cfbb 版本的 SDK 路径是否有效。
   * 通过检查必要的 JSON 配置文件是否存在且可解析来验证 SDK 路径。
   * 只要有一个文件存在且可解析，就认为 SDK 路径有效。
   *
   * @param sdkPath - 选择的 SDK 路径
   * @param chipModel - 芯片型号，用于确定 JSON 文件路径（当前未使用，可根据需要扩展）
   * @returns 如果 SDK 路径有效，返回 true；否则返回 false
   */
  static validateCfbbSdkPath(sdkPath: string): boolean {
    for (const fileName of requiredFiles) {
      let chipsJsonPath: string;

      // 根据文件名是否包含 'nb' 来决定路径构建方式
      if (fileName.includes('nb')) {
        chipsJsonPath = path.join(sdkPath, 'build', 'target_config', fileName);
      } else if (inTargetAndHasConfigChipJsons.includes(fileName)) {
        chipsJsonPath = path.join(sdkPath,
          'build',
          'config',
          'target_config',
          fileName);
      } else {
        chipsJsonPath = path.join(
          sdkPath,
          'build',
          'config',
          'target_config',
          fileName.replace('.json', ''),
          fileName
        );
      }

      // 检查文件是否存在
      if (fs.existsSync(chipsJsonPath)) {
        // 尝试读取并解析 JSON 文件
        try {
          const data = fs.readFileSync(chipsJsonPath, 'utf8');
          JSON.parse(data);
          // 文件存在且解析成功，发送成功消息并返回 true
          this.sendProjectMessage('sdkPathRight');
          return true;
        } catch (err) {
          // 读取或解析失败，继续检查下一个文件
          continue;
        }
      }
    }

    // 如果没有任何文件匹配成功，发送错误消息并返回 false
    this.sendProjectMessage('sdkPathWrong');
    return false;
  }

  static validateMcuSdkPath(sdkPath: string): void {
    if (sdkPath) {
      let arr: any[] = [];
      try {
        arr = fs.readdirSync(sdkPath);
      } catch {
        arr = [];
      }
      if (!arr.includes('chip') || !arr.includes('drivers')) {
        this.sendProjectMessage('sdkPathWrong');
      } else {
        this.sendProjectMessage('sdkPathRight');
      }
    }
  }

  static updateProjectTips(operate: any): void {
    if (operate.paramData.needValidate) {
      Command.validateProjectPath(operate.paramData.projectPath);
    } else {
      this.sendProjectMessage('projectPathRightInfo');
    }
  }

  static validateProjectPath(projectPath: string): void {
    if (projectPath) {
      if (fs.existsSync(projectPath)) {
        this.sendProjectMessage('projectPathRightInfo');
      } else {
        this.sendProjectMessage('projectPathWrongInfo');
      }
    }
  }

  static getChipListBoaedsMap(operate: any): void {
    const key: string = operate?.paramData;
    const contextpath: string = extension.extensionPath ?? '';
    const chipListBoaedsMap = getChipListBoaedsMap(contextpath);
    const callBackMessage: GetInfoCallBack = {
      method: ApiMethod.GET_INFO_CALLBAK,
      params: {
        data: chipListBoaedsMap,
        key: key,
      },
    };
    extension.settingPanel?.postMessage(callBackMessage);
  }

  static postImportFaildFile(importFailedArr: Array<ImportTableItem>, importSuccessArr: Array<ImportTableItem>, importItemArr: Array<any>): void {
    const callBackMessage: GetInfoCallBack = {
      method: ApiMethod.GET_INFO_CALLBAK,
      params: {
        data: new Date().getTime(),
        key: 'importWrongInfoOpen',
      },
    };
    extension.projectImportPanel?.postMessage(callBackMessage);
    const cBMsg: GetInfoCallBack = {
      method: ApiMethod.GET_INFO_CALLBAK,
      params: {
        data: {
          importFailedArr,
          importSuccessArr,
          importItemArr,
        },
        key: 'importWrongInfoContent',
      },
    };
    extension.projectImportPanel?.postMessage(cBMsg);
  }

  static setProgress(operate: any): void {
    const { progress } = operate;
    extension.setProgress(progress, res('wait'));
  }

  // Retrieves target data based on chip info and config script.
  static async getTargetDataFromChipInfo(): Promise<void> {
    try {
      const chipInfo = await getChipInfo();
      const configScriptPath = chipInfo?.config_script;

      if (!configScriptPath) {
        vscode.window.showErrorMessage(res('configScriptNotExist'));
        return;
      }

      const workspaceFolders = await getActiveWorkFolderPath();
      const configFilePath = path.join(workspaceFolders, configScriptPath);

      if (fs.existsSync(configFilePath)) {
        const fileContent = fs.readFileSync(configFilePath, 'utf-8');
        const targetString = configScriptParse(fileContent);
        const targetData = JSON.parse(targetString);

        const transformedData = Object.entries(targetData).map(
          ([key, value]: [string, any], index: number) => ({
            key: (index + 1).toString(),
            name: key,
            partition: value?.sector_cfg ?? '',
            nv: value?.nv_cfg ?? '',
            flashBoot: value?.flashboot_cfg ?? '',
            loaderBoot: value?.loaderboot_cfg ?? '',
            liteOS: value?.liteos_kconfig ?? '',
            targetTemplate: value?.base_target_name ?? '',
          })
        );

        // Send the transformed target data to the panel
        const message: GetInfoCallBack = {
          method: ApiMethod.GET_INFO_CALLBAK,
          params: {
            data: transformedData,
            key: 'targetData',
          },
        };
        extension.targetManagePanel?.postMessage(message);
      } else {
        vscode.window.showErrorMessage(res('configScriptNotExist'));
      }
    } catch (error) {
      vscode.window.showErrorMessage(`${res('configScriptReadFailed')}${error}`);
    }
  }

  // Updates the target data by modifying the specified field value in the config script.
  static async updateTargetData(updateData: any): Promise<void> {
    try {
      let { originalTargetName, updatedFieldName, updatedFieldValue } = updateData.paramData;

      const fieldNameMap: { [key: string]: string } = {
        partition: 'sector_cfg',
        nv: 'nv_cfg',
        flashBoot: 'flashboot_cfg',
        loaderBoot: 'loaderboot_cfg',
        liteOS: 'liteos_kconfig',
        targetTemplate: 'base_target_name',
        name: 'name',
      };

      const actualFieldName = fieldNameMap[updatedFieldName];
      const chipInfo = await getChipInfo();
      const configScriptPath = chipInfo?.config_script;
      const workspaceFolders = await getActiveWorkFolderPath();
      const configFilePath = path.join(workspaceFolders, configScriptPath);

      if (!fs.existsSync(configFilePath)) {
        vscode.window.showErrorMessage(res('configScriptNotExist'));
        return;
      }

      let fileContent = fs.readFileSync(configFilePath, 'utf-8');
      const lines = fileContent.split('\n');

      // Find target block by its name
      const targetIndexes = findTargetBlockIndexes(lines, originalTargetName);

      if (!targetIndexes) {
        vscode.window.showErrorMessage(`${res('targetNotFound')}: ${originalTargetName}`);
        return;
      }

      let [targetStartIndex, targetEndIndex] = targetIndexes;

      // If the target name is updated, rename it and update relevant files
      if (updatedFieldName === 'name' && updatedFieldValue !== originalTargetName) {
        lines[targetStartIndex] = lines[targetStartIndex].replace(
          `'${originalTargetName}'`,
          `'${updatedFieldValue}'`
        );

        await updateJsonTargetName(originalTargetName, updatedFieldValue);
        await renameConfigFiles(originalTargetName, updatedFieldValue);

        originalTargetName = updatedFieldValue;
      }

      // Update the specified field with the new value
      if (updatedFieldName !== 'name') {
        const attributeUpdated = updateField(lines, targetStartIndex, targetEndIndex, actualFieldName, updatedFieldValue);

        if (!attributeUpdated) {
          vscode.window.showErrorMessage(`${res('propertyUpdateFailed')}: ${updatedFieldName}`);
          return;
        }
      }

      fileContent = lines.join('\n');
      fs.writeFileSync(configFilePath, fileContent, 'utf-8');
    } catch (error) {
      vscode.window.showErrorMessage(`${res('configScriptUpdateFailed')}${error}`);
    }
  }

  // Retrieves available configuration options for target properties from the project files.
  static async getTargetConfigOptions(): Promise<void> {
    try {
      const chipInfo = await getChipInfo();
      const board = chipInfo?.chipName;
      const workspaceFolderPath = await getActiveWorkFolderPath();

      // Get options from various config directories
      const partitionDirPath = path.join(workspaceFolderPath, chipInfo.partition);
      const partitionOptions = fs
        .readdirSync(partitionDirPath)
        .filter((file) => file.endsWith('.json'))
        .map((file) => path.basename(file, '.json'));

      const nvDirPath = path.join(workspaceFolderPath, chipInfo.nv);
      const nvOptions = fs
        .readdirSync(nvDirPath)
        .filter((file) => fs.statSync(path.join(nvDirPath, file)).isDirectory());

      const flashBootDirPath = path.join(workspaceFolderPath, chipInfo.flash_boot);
      const flashBootOptions = fs
        .readdirSync(flashBootDirPath)
        .filter(
          (file) =>
            fs.statSync(path.join(flashBootDirPath, file)).isDirectory() &&
            file.startsWith('flashboot')
        );

      const loaderBootDirPath = path.join(workspaceFolderPath, chipInfo.loader_boot);
      const loaderBootOptions = fs
        .readdirSync(loaderBootDirPath)
        .filter(
          (file) =>
            fs.statSync(path.join(loaderBootDirPath, file)).isDirectory() &&
            file.startsWith('loaderboot')
        );

      const liteOSDirPath = path.join(workspaceFolderPath, chipInfo.liteos_kconfig);
      const liteOSOptions = fs
        .readdirSync(liteOSDirPath)
        .filter((file) => file.endsWith('.config') && file.includes(board))
        .map((file) => path.basename(file, '.config'));

      const options = {
        partitionOptions,
        nvOptions,
        flashBootOptions,
        loaderBootOptions,
        liteOSOptions,
      };

      const dynamicOptions: GetInfoCallBack = {
        method: ApiMethod.GET_INFO_CALLBAK,
        params: {
          data: options,
          key: 'dynamicOptions',
        },
      };

      extension.targetManagePanel?.postMessage(dynamicOptions);
    } catch (error) {
      vscode.window.showErrorMessage(`${res('obtainOptionsFailed')}${error}`);
    }
  }

  // Adds a new target data entry into the config script and updates relevant files.
  static async addTargetData(addData: any): Promise<void> {
    try {
      const {
        targetName,
        baseTargetName,
        partition,
        nv,
        flashBoot,
        loaderBoot,
        liteOS,
      } = addData.paramData;

      const chipInfo = await getChipInfo();
      const configScriptPath = chipInfo?.config_script;
      const workspaceFolders = await getActiveWorkFolderPath();
      const configFilePath = path.join(workspaceFolders, configScriptPath);

      if (!fs.existsSync(configFilePath)) {
        vscode.window.showErrorMessage(res('configScriptNotExist'));
        return;
      }

      let fileContent = fs.readFileSync(configFilePath, 'utf-8');
      const lines = fileContent.split('\n');

      let targetStartIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('target = {')) {
          targetStartIndex = i;
          break;
        }
      }

      if (targetStartIndex === -1) {
        vscode.window.showErrorMessage(res('targetNotDefined'));
        return;
      }

      let targetEndIndex = -1;
      let bracketCount = 1;
      for (let i = targetStartIndex + 1; i < lines.length; i++) {
        bracketCount += (lines[i].match(/{/g) ?? []).length;
        bracketCount -= (lines[i].match(/}/g) ?? []).length;
        if (bracketCount === 0) {
          targetEndIndex = i;
          break;
        }
      }

      if (targetEndIndex === -1) {
        vscode.window.showErrorMessage(res('closingCurlyBracketsNotFound'));
        return;
      }

      const newTargetString = `    '${targetName}': {
          'base_target_name': '${baseTargetName}',
          'defines': [],
          'ram_component': [],
          'liteos_kconfig': '${liteOS}',
          'loaderboot_cfg': '${loaderBoot}',
          'flashboot_cfg': '${flashBoot}',
          'sector_cfg': '${partition}',
          'upg_pkg': ['application'],
          'nv_cfg': '${nv}',
    },`;

      lines.splice(targetEndIndex, 0, newTargetString);

      fileContent = lines.join('\n');
      fs.writeFileSync(configFilePath, fileContent, 'utf-8');

      await addTargetToJson(targetName, baseTargetName);
      await copyAndModifyConfigFiles(targetName, baseTargetName);
    } catch (error) {
      vscode.window.showErrorMessage(`${res('addTargetFailed')}${error}`);
    }
  }

  // Deletes a target from the config script.
  static async deleteTarget(operateData: any): Promise<void> {
    try {
      const { targetName } = operateData.paramData;

      showMessageModal({
        content: res('ifDeleteTarget', [targetName]),
        btn: [res('confirm')],
        cb: async (selectedOption: any) => {
          if (selectedOption !== res('confirm')) {
            return;
          }

          const chipInfo = await getChipInfo();
          const configScriptPath = chipInfo?.config_script;
          const workspaceFolders = await getActiveWorkFolderPath();
          const configFilePath = path.join(workspaceFolders, configScriptPath);

          if (!fs.existsSync(configFilePath)) {
            vscode.window.showErrorMessage(res('configScriptNotExist'));
            return;
          }

          let fileContent = fs.readFileSync(configFilePath, 'utf-8');
          const lines = fileContent.split('\n');

          let targetStartIndex = -1;
          let targetEndIndex = -1;
          let bracketCount = 0;

          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(`'${targetName}': {`)) {
              targetStartIndex = i;
              bracketCount = 1;
              for (let j = i + 1; j < lines.length; j++) {
                bracketCount += (lines[j].match(/{/g) ?? []).length;
                bracketCount -= (lines[j].match(/}/g) ?? []).length;
                if (bracketCount === 0) {
                  targetEndIndex = j;
                  break;
                }
              }
              break;
            }
          }

          if (targetStartIndex === -1 || targetEndIndex === -1) {
            vscode.window.showErrorMessage(`${res('targetNotFound')}: ${targetName}`);
            return;
          }

          lines.splice(targetStartIndex, targetEndIndex - targetStartIndex + 1);

          fileContent = lines.join('\n');
          fs.writeFileSync(configFilePath, fileContent, 'utf-8');

          await deleteTargetFromJson(targetName);
          await deleteConfigFiles(targetName);

          const message: GetInfoCallBack = {
            method: ApiMethod.GET_INFO_CALLBAK,
            params: {
              data: targetName,
              key: 'deletedTargetName',
            },
          };
          extension.targetManagePanel?.postMessage(message);
        },
      });
    } catch (error) {
      vscode.window.showErrorMessage(res('targetDeleteFailed'));
    }
  }

  // Retrieves the target preset information from a JSON file.
  static async getTargetPreset(): Promise<void> {
    try {
      const jsonFilePath = await jsonPathGet();

      if (!fs.existsSync(jsonFilePath)) {
        vscode.window.showErrorMessage(res('jsonFileNotExist'));
        return;
      }

      const data = fs.readFileSync(jsonFilePath, 'utf8');
      const jsonData = JSON.parse(data);

      const targetPreset = jsonData.target_preset || [];

      const message: GetInfoCallBack = {
        method: ApiMethod.GET_INFO_CALLBAK,
        params: {
          data: targetPreset,
          key: 'targetPreset',
        },
      };

      extension.targetManagePanel?.postMessage(message);
    } catch (error) {
      vscode.window.showErrorMessage(`${res('targetPresetNotFound')}: ${error}`);
    }
  }

  // Executes a command.
  static executeCommand(operateData: any): void {
    vscode.commands.executeCommand(operateData.paramData);
  }
}
