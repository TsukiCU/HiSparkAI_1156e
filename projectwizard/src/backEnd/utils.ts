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
import * as ini from 'ini';
import { promisify } from 'util';
import { exec } from 'child_process';
import { jsonTypeGet, creCCppConfigJson, creProIniFile, creMcuLaunchJsonFile, creCfbbLaunchJsonFile } from './creProjFile';
import { res } from '../i18n/backEndTrans';
import { extension, getExtensionContext } from '../extension';
import type { GetJsonParam, AccessAllRights, TipsArr, CbArr, PaeseFileType, ConfigReturn, ModalManageObj, ModalManageWrite, MsgObj, JsonGetParam, FailedFileChildren, ImportTableItem, launchJsonParam } from './interface/model';
import { Command } from './command';
import type { launchJsonConfig, ProjectData} from './interface/model';
// allinone
import { getResource } from './resourceManage/resourceManager';
import { chip } from './resourceManage/resourcePath';
import { getToolsPath } from '../pythonUtils';

export const SUFFIX_PROJECT_LIST = '../../../projectlist.json';
export const SUFFIX_LATEST_LIST = '../../../latestlist.json';
export const SUFFIX_USER_CONFIG = '../../userconfig.json';

export const addGenerateAllinoneBin = ['3065HRPIRZ', '3061HRPIKZ', '3065HRPICZ', 'AU302PDF51', 'AU302NDF51', 'AU301LDF51'];
export const flash152 = ['3065HRPIRZ', '3061HRPIKZ', '3065HRPICZ', 'AU302PDF51', 'AU302NDF51', 'AU301LDF51'];
export const flash128 = ['3061MNPICA', '3061MNPIKA'];
export const inTargetAndHasConfigChipJsons = [
  'hi2113.json',
  'hi2131.json',
  'hi2131c.json',
];
export const inTargetAndHasConfigChips = [
  'hi2113',
  'hi2131',
  'hi2131c',
];

let multiModevalue: string = 'singleDebugMode';
export function setMultiModevalue(value: string): void {
  if (value === '' || value === undefined) {
    multiModevalue = 'singleDebugMode';
  }
  multiModevalue = value;
}

export function isInAcoreChipArr(board: string): boolean {
  const acoreArr: string[] = ['hi2131', 'hi2131c', 'nb18', 'nb17e', '3322'];
  return acoreArr.indexOf(board) !== -1;
}

let configValue: launchJsonConfig[] = [];
let configElfValue: launchJsonConfig[] = [];
let defaultScriptPathValue: string = '';
let defaultElfPathValue: string = '';
const acoreString: string = 'Acore';
const pcoreString: string = 'Pcore';
const multicoreString: string = 'multicore';

export function findConfigScriptPath(config: any, iniInfo: any): string {
  let configValueIndex: launchJsonConfig = {
    name: '',
    value: '',
  };
  let len = configValue.length;
  if (config.name.includes(acoreString)) {
    let pathStr = '';
    if (iniInfo?.debug?.jlinkScriptPath?.includes(acoreString)) {
      pathStr = iniInfo?.debug?.jlinkScriptPath;
    } else if (iniInfo?.debug?.new_jlinkScript_Path?.includes(acoreString)) {
      pathStr = iniInfo?.debug?.new_jlinkScript_Path;
    } else {
      // 防止读取空值
      pathStr = iniInfo?.debug?.jlinkScriptPath;
      return pathStr;
    }
    configValueIndex.name = config.name;
    configValueIndex.value = pathStr;
    configValue.push(configValueIndex);
    return pathStr;
  } else if (config.name.includes(pcoreString)) {
    let pathStr = '';
    if (iniInfo?.debug?.jlinkScriptPath?.includes(pcoreString)) {
      pathStr = iniInfo?.debug?.jlinkScriptPath;
    } else if (iniInfo?.debug?.new_jlinkScript_Path?.includes(pcoreString)) {
      pathStr = iniInfo?.debug?.new_jlinkScript_Path;
    } else {
      // 防止读取空值
      pathStr = iniInfo?.debug?.jlinkScriptPath;
      return pathStr;
    }
    configValueIndex.name = config.name;
    configValueIndex.value = pathStr;
    configValue.push(configValueIndex);
    return pathStr;
  } else if (config.name.includes(multicoreString)) {
    for (let i = 0; i < len; i++) {
      if (configValue[i].name.includes(pcoreString)) {
        if (configValue[i].value === '') {
          continue;
        }
        return configValue[i].value;
      }
    }
  } else {
    for (let i = 0; i < len; i++) {
      if (configValue[i].name === config.name) {
        // 当传入的参数没有匹配的时候，此步骤主要用于从configElfValue中提取之前存入的脚本路径
        if (configValue[i].value === '') {
          continue;
        }
        return configValue[i].value;
      }
    }
  }
  return iniInfo?.debug?.jlinkScriptPath;
}

export function findConfigElf(config: any, iniInfo: any): string {
  let configValueIndex: launchJsonConfig = {
    name: '',
    value: '',
  };
  let len = configElfValue.length;
  if (config.name.includes(acoreString) && iniInfo.debug?.elf_path.includes('application')) {
    configValueIndex.name = config.name;
    configValueIndex.value = iniInfo.debug?.elf_path;
    defaultElfPathValue = (iniInfo.debug?.elf_path);
    configElfValue.push(configValueIndex);
    return iniInfo.debug?.elf_path;
  } else if (config.name.includes(pcoreString) && iniInfo.debug?.elf_path.includes('protocol')) {
    configValueIndex.name = config.name;
    configValueIndex.value = iniInfo.debug?.elf_path;
    configElfValue.push(configValueIndex);
    return iniInfo.debug?.elf_path;
  } else if (config.name.includes(multicoreString)) {
    for (let i = 0; i < len; i++) {
      if (configElfValue[i].name.includes(pcoreString)) {
        return configElfValue[i].value;
      }
    }
  } else {
    for (let i = 0; i < len; i++) {
      if (configElfValue[i].name === config.name) {
        // 当传入的参数没有匹配的时候，此步骤主要用于从configElfValue中提取之前存入的elf路径
        return configElfValue[i].value;
      }
    }
  }
  return iniInfo.debug?.elf_path;
}

export const modalType = {
  launchJsonFErr: 'updateLaunchFErr',
  launchJsonRErr: 'updateLaunchRErr',
  launchJsonParseErr: 'updateLaunchParseErr',
  launchJsonUnExpectErrW: 'launchJsonUnExpaectdErrWhenWrite',
  launchJsonNoRightToW: 'launchJsonNoRightToWrite',
  creLaunchParamWrong: 'creLaunchJsonButParamWrong',
  launchJsonMissingField: 'launchJsonMissingField',

  cppJsonFErr: 'getCppPropertiesJsonFErr',
  cppJsonRErr: 'getCppPropertiesJsonRErr',
  cppJsonParseErr: 'getCppPropertiesJsonParseErr',
  cppJsonUnExpectErrW: 'cppJsonUnExpaectdErrWhenWrite',
  cppJsonNoRightToW: 'cppJsonNoRightToWrite',
  creCppJsonParamWrong: 'cppJsonGetHiprojWrong',

  usercfgJsonFErr: 'getUserconfigJsonFErr',
  usercfgJsonRErr: 'getUserconfigJsonRErr',
  usercfgJsonParseErr: 'getUserconfigJsonParseErr',
  usercfgJsonUnExpectErrW: 'usercfgJsonUnExpaectdErrWhenWrite',
  usercfgJsonNoRightToW: 'usercfgJsonNoRightToWrite',

  launchInitUnExpectErrW: 'launchInitUnExpaectdErrWhenWrite',
  launchInitNoRightToW: 'launchInitNoRightToWrite',

  attachInitUnExpectErrW: 'attachInitUnExpaectdErrWhenWrite',
  attachInitNoRightToW: 'attachInitNoRightToWrite',

  hiprojFErr: 'getHiprojFErr',
  hiprojRErr: 'getHiprojRErr',
  hiprojParseErr: 'getHiprojParseErr',
  hiprojUnExpectErrW: 'hiprojUnExpaectdErrWhenWrite',
  hiprojNoRightToW: 'hiprojNoRightToWrite',
  hiprojReCreErrByNoJson: 'hiprojReCreFailedBecaseNoChipJson',
};

export const failedType = {
  withoutWRight: res('withoutWRight'),
  withoutRRight: res('withoutRRight'),
  parseFailed: res('parseFailed'),
  wrongContent: res('wrongContent'),
  notProject: res('notProject'),
  launchJsonUpdateFailed: res('launchJsonUpdateFailed'),
};

export const hiprojKey = {
  isEdit: 'is_edit',
  basePageByte: 'base_page_byte',
  staticLibraryEnable: 'static_library_enable',
};

export const IMPORT_LOADING_NUM = 60;

const execs = promisify(exec);

export function addItemsToProList(importItemsArr: any[], globalStorageUri?: string): void {
  let importItemArr = importItemsArr;
  if (!globalStorageUri) {
    showMessageModal({
      content: res('obtainCachePathFailed'),
    });
    return;
  }
  if (!importItemArr || !isArray(importItemArr)) {
    return;
  }
  let projListPath = path.join(globalStorageUri, SUFFIX_PROJECT_LIST);

  if (fs.existsSync(projListPath)) {
    let oldProList: Array<any> = [];
    try {
      oldProList = JSON.parse(fs.readFileSync(projListPath).toString());
    } catch {
      oldProList = [];
    }
    let dict: any = {};
    importItemArr.forEach((item: any) => {
      dict[item.path] = true;
    });
    oldProList = oldProList.filter((ele: any) => !dict[ele.path]);

    importItemArr = toUpper(importItemArr);
    importItemArr = [...importItemArr, ...oldProList];
  }
  fs.writeFileSync(projListPath, JSON.stringify(importItemArr));
}

export function updateMultiProjectList(projectData: ProjectData, cpu0IniInfo: any, cpu1IniInfo: any, cpu2IniInfo: any): void {
  const newCpu0ProItemArr = [{
    name: projectData.cpu0Name,
    path: cpu0IniInfo?.path,
    chip: cpu0IniInfo?.chip,
    board: cpu0IniInfo?.board,
    time: (new Date()).toLocaleString('zh-CN'),
  }];
  const newCpu1ProItemArr = [{
    name: projectData.cpu1Name,
    path: cpu1IniInfo?.path,
    chip: cpu1IniInfo?.chip,
    board: cpu1IniInfo?.board,
    time: (new Date()).toLocaleString('zh-CN'),
  }];
  const newCpu2ProItemArr = [{
    name: projectData.cpu2Name,
    path: cpu2IniInfo?.path,
    chip: cpu2IniInfo?.chip,
    board: cpu2IniInfo?.board,
    time: (new Date()).toLocaleString('zh-CN'),
  }];
  addItemsToProList(newCpu0ProItemArr, extension.globalStoragePath);
  addItemsToProList(newCpu1ProItemArr, extension.globalStoragePath);
  addItemsToProList(newCpu2ProItemArr, extension.globalStoragePath);
}

export function updateOneItemToLatestList(theImportItem: any, globalStorageUri?: string): void {
  if (!globalStorageUri) {
    showMessageModal({
      content: res('obtainCachePathFailed'),
    });
    return;
  }
  let latestListPath = path.join(globalStorageUri, SUFFIX_LATEST_LIST);
  let importItem = toUpper(theImportItem);
  let newProList = [importItem];

  if (fs.existsSync(latestListPath)) {
    let oldProList: Array<any> = [];
    try {
      oldProList = JSON.parse(fs.readFileSync(latestListPath).toString());
    } catch {
      oldProList = [];
    }

    for (let item of oldProList) {
      if (newProList.length >= 10) {
        break;
      }
      if (item?.path !== importItem?.path) {
        newProList.push(item);
      }
    }
  }
  fs.writeFileSync(latestListPath, JSON.stringify(newProList));
}

export function generateLatestListMenu(globalStorageUri?: string): void {
  if (!extension.isCustomIDE) {
    return;
  }
  if (!globalStorageUri) {
    showMessageModal({
      content: res('obtainCachePathFailed'),
    });
    return;
  }
  let latestListPath = path.join(globalStorageUri, SUFFIX_LATEST_LIST);
  if (fs.existsSync(latestListPath)) {
    let oldProList: Array<any> = [];
    try {
      oldProList = JSON.parse(fs.readFileSync(latestListPath).toString());
    } catch {
      oldProList = [];
    }
    for (let i = 0; i < oldProList.length; i++) {
      let item = oldProList[i];
      if (item?.path) {
        (vscode.window as any).registerMenu('projectSubmenu', {
          command: {
            id: 'openProjectByPath',
            title: item.path,
          },
          args: [item.path, 'projectSubMenu'],
          group: '9_latest',
          order: i,
        });
      }
    }
  }
}

export function deleteFromProjectList(deletePath: string, globalStorageUri?: string): void {
  deleteFromList(deletePath, SUFFIX_PROJECT_LIST, globalStorageUri);
}

export function deleteFromLatestList(deletePath: string, globalStorageUri?: string): void {
  deleteFromList(deletePath, SUFFIX_LATEST_LIST, globalStorageUri);
}

export function deleteProjectList( deleteName?:string, deleteTime?: string, globalStorageUri?: string): void {
  if (!globalStorageUri) {
    showMessageModal({
      content: res('obtainCachePathFailed'),
    });
    return;
  }
  let listPath = path.join(globalStorageUri, SUFFIX_PROJECT_LIST);
     
  if (listPath && fs.existsSync(listPath)) {
    let listContent = [];
    try {
      listContent = JSON.parse(fs.readFileSync(listPath).toString());
    } catch (e) {
      listContent = [];
    }
    let newListContent = listContent.filter((item: any) => !(item.name === deleteName && item.time === deleteTime));
    try {
      fs.writeFileSync(listPath, JSON.stringify(newListContent));
    } catch {
      // unexpected condition.
    }
  }
}

function deleteFromList(deletePath: string, suffix: string, globalStorageUri?: string): void {
  if (!globalStorageUri) {
    showMessageModal({
      content: res('obtainCachePathFailed'),
    });
    return;
  }
  let listPath = path.join(globalStorageUri, suffix);
  if (deletePath && fs.existsSync(listPath)) {
    let listContent = [];
    try {
      listContent = JSON.parse(fs.readFileSync(listPath).toString());
    } catch (e) {
      listContent = [];
    }
    let newListContent = listContent.filter((item: any) => item.path !== deletePath);
    try {
      fs.writeFileSync(listPath, JSON.stringify(newListContent));
    } catch {
      // unexpected condition.
    }
  }
}

function toUpper(importItem: any): any {
  const contextpath: string = extension.extensionPath ?? '';
  const chipListBoaedsMap = getChipListBoaedsMap(contextpath);
  if (isArray(importItem)) {
    importItem.forEach((value: any, index: number) => {
      importItem[index].chip = importItem[index]?.chip?.toUpperCase();
      let oldBoard = importItem[index]?.board;
      let newBoard = chipListBoaedsMap?.[oldBoard] ?? oldBoard;
      importItem[index].board = newBoard?.toUpperCase();
    });
  } else if (isObjectNotArr(importItem)) {
    importItem.chip = importItem?.chip?.toUpperCase();
    let oldBoard = importItem?.board;
    let newBoard = chipListBoaedsMap?.[oldBoard] ?? oldBoard;
    importItem.board = newBoard?.toUpperCase();
  } else {
    return importItem;
  }
  return importItem;
}

export function isArray(obj: any): boolean {
  if (Object.prototype.toString.call(obj) === '[object Array]') {
    return true;
  } else {
    return false;
  }
}

export function isObjectNotArr(obj: any): boolean {
  if (Object.prototype.toString.call(obj) === '[object Object]') {
    return true;
  } else {
    return false;
  }
}

export function editUserConfigJson(obj: any, globalStorageUri?: string): void {
  if (!globalStorageUri) {
    showMessageModal({
      content: res('obtainCachePathFailed'),
    });
    return;
  }
  let userConfigPath = path.join(globalStorageUri, SUFFIX_USER_CONFIG);
  let userconfigContent: any = {};
  if (fs.existsSync(userConfigPath)) {
    try {
      userconfigContent = JSON.parse(fs.readFileSync(userConfigPath).toString());
    } catch {
      userconfigContent = {};
    }
  }
  Object.keys(obj).forEach((key: string) => {
    userconfigContent[key] = obj[key];
  });
  fs.writeFileSync(userConfigPath, JSON.stringify(userconfigContent));
}

export function readUserConfigJson(globalStorageUri?: string): any {
  if (!globalStorageUri) {
    return {};
  }
  let userConfigPath = path.join(globalStorageUri, SUFFIX_USER_CONFIG);
  let userconfigContent: any = {};
  if (fs.existsSync(userConfigPath)) {
    try {
      userconfigContent = JSON.parse(fs.readFileSync(userConfigPath).toString());
    } catch {
      userconfigContent = {};
    }
  }
  return userconfigContent;
}

export function getLatestProjectInfo(globalStorageUri?: string): any {
  if (!globalStorageUri) {
    showMessageModal({
      content: res('obtainCachePathFailed'),
    });
    return null;
  }
  let latestListPath = path.join(globalStorageUri, SUFFIX_LATEST_LIST);

  let latestProList: Array<any> = [];

  if (fs.existsSync(latestListPath)) {
    try {
      latestProList = JSON.parse(fs.readFileSync(latestListPath).toString());
    } catch {
      latestProList = [];
    }
  }
  return {
    content: latestProList,
    path: latestListPath,
  };
}

export async function getActiveWorkFolderPath(): Promise<any> {
  const window = (vscode.window as any);
  const activeProjPath = (window && typeof (window.hiGetProjectValue) === 'function') ?
    await (vscode.window as any).hiGetProjectValue('hispark.extension.activeHiproj') :
    undefined;
  const projectPath = vscode.workspace.workspaceFolders;
  // MCU芯片活动工程或者多核工程返回当前最新工作区路径;
  if (activeProjPath && projectPath) {
    const isMatchingPath = projectPath?.some((folder: any) => folder.uri.fsPath === activeProjPath);
    if (isMatchingPath) {
      return activeProjPath;
    }
  }

  // FBB芯片工程虽然存在.hiproj和工作区分离,但是和MCU芯片普通工程一样,工作区只有当下一个;
  if (!projectPath || !Array.isArray(projectPath) || !projectPath[0]?.uri?.fsPath) {
    return undefined;
  } else {
    return projectPath[0].uri.fsPath;
  }
}

export const updatePathList = (list: any, children: any, proPath: any): Array<any> =>
  list.map((node: any) => {
    return updatePathListMap(node, children, proPath);
  }
  );

function updatePathListMap(node: any, children: any, proPath: any): any {
  if (node.path === proPath) {
    return {
      ...node,
      children,
    };
  }
  if (node.children) {
    return {
      ...node,
      children: updatePathList(node.children, children, proPath),
    };
  }
  return node;
}

export async function importLaunchJson(projPath: string, newIniContent: any, failedFileChildren: Array<FailedFileChildren>, isHormony: boolean): Promise<void> {
  let folderToOpen = '';
  if (pathIsHiproj(projPath)) {
    const hiProjectContent = getHiprojContent(projPath);
    folderToOpen = hiProjectContent?.information?.sdk_path;
  } else {
    folderToOpen = projPath;
  }
  await showFolder(path.join(folderToOpen, '.vscode'));

  let launchPath = path.join(folderToOpen, '.vscode', 'launch.json');
  let projectType = '';
  projectType = getProjectType(newIniContent);

  await getOldLaunchBeforeWrite(newIniContent, launchPath, failedFileChildren, isHormony);
  checkDebugInit(['jlink', 'HiSpark-Trace', 'HiSpark-Link', 'HiSparkLinkPro'], newIniContent?.debug?.tool, projPath, failedFileChildren, projectType);
  unlinkTasksJson(folderToOpen);
}

function checkDebugInit(debugToolArr: Array<string>, hiprojContentDebugToolArr: Array<any>,
  projPath: string, failedFileChildren: Array<FailedFileChildren>, projectType: string): void {
  debugToolArr.forEach((item: string) => {
    if (hiprojContentDebugToolArr?.includes(item)) {
      const { launchInit, attachInit, launchInitPath, attachInitPath } = getLaunchAndAttachInfo(projPath, item, projectType);
      try {
        fs.writeFileSync(launchInitPath, launchInit);
      } catch {
        failedFileChildren.push({
          path: launchInitPath,
          status: failedType.withoutWRight,
        });
      }
      try {
        fs.writeFileSync(attachInitPath, attachInit);
      } catch {
        failedFileChildren.push({
          path: attachInitPath,
          status: failedType.withoutWRight,
        });
      }
    }
  });
}

function unlinkTasksJson(projPath: string): void {
  try {
    fs.unlinkSync(path.join(projPath, '.vscode', 'tasks.json'));
  } catch {
    // skip.
  }
}

async function getOldLaunchBeforeWrite(newIniContent: any, launchPath: string, failedFileChildren: Array<FailedFileChildren>,
  isHormony: boolean): Promise<void> {
  let launchContent = null;
  let projectPath = path.dirname(path.dirname(launchPath));
  let launchJsonData = {
    soc: newIniContent?.information?.['board_build.mcu'],
    boardJsonPath: newIniContent?.information?.json_path,
    sdkPath: newIniContent?.information?.sdk_path,
    seriesName: newIniContent?.information?.series_name,
    toolChain: newIniContent?.compile?.tool_chain,
  };
  try {
    launchContent = JSON.parse(fs.readFileSync(launchPath).toString());
  } catch {
    launchContent = null;
  }
  
  if (!isArray(launchContent?.configurations) || launchContent?.configurations?.length === 0 || isHormony === true) {
    if (!await creLaunchJsonFile(launchJsonData, projectPath)) {
      failedFileChildren.push({
        path: launchPath,
        status: failedType.launchJsonUpdateFailed,
      });
    }
  } else {
    launchContent?.configurations?.forEach((config: any) => {
      config.toolchainBinDir = path.join('${command:toolsPath}', 'Windows', 'cc_riscv32_musl_fp_win', 'bin');
    });
    const finallyDone = writeWithcheckRight(launchPath, JSON.stringify(launchContent, null, 4), {
      unExpectModal: modalType.launchJsonUnExpectErrW,
      wErrModal: modalType.launchJsonNoRightToW,
    });
  }
}

function getServerPathAndArgs(newIniContent: any): any {
  const debugSpeed = newIniContent?.debug?.speed;
  const debugPort = newIniContent?.debug?.port;
  let jlinkServerPath: any;
  let serverArgs: Array<any> = [];
  if (newIniContent?.debug?.tool === 'jlink') {
    jlinkServerPath = newIniContent?.debug?.jlinkServerPath;
    serverArgs = [
      '-singlerun',
      '-if', newIniContent?.debug?.interface,
      '-select', 'USB',
      '-device', newIniContent?.information?.['board_build.mcu'],
      '-port', debugPort ? debugPort.toString() : '3333',
      '-speed', debugSpeed ? debugSpeed.toString() : '5000',
    ];
  } else {
    jlinkServerPath = path.join('${command:toolsPath}', 'hw_openocd', 'bin', 'openocd.exe');
    serverArgs = [
      '-c', `adapter speed ${debugSpeed ? debugSpeed : 5000}`,
      '-c', `gdb_port ${debugPort ? debugPort : 3333}`,
      '-s', path.join('${command:toolsPath}', 'hw_openocd'),
      '-f', `${getInterface(newIniContent?.debug?.interface, newIniContent?.debug?.tool)}`,
      '-f', `${getTarget(newIniContent?.debug?.interface, newIniContent?.information?.['board_build.mcu'])}`,
    ];
  }
  return {
    jlinkServerPath,
    serverArgs,
  };
}

function getInterface(debugInterface: string, debugBoard: string): string {
  if (debugBoard === 'HiSpark-Trace') {
    return path.join('interface', 'cmsis-dap.cfg');
  }
  if (debugBoard === 'HiSpark-Link') {
    if (debugInterface === 'jtag') {
      return path.join('interface', 'ft2232h-ftdi-jtag.cfg');
    } else if (debugInterface === 'swd') {
      return path.join('interface', 'ft2232h-ftdi-swd.cfg');
    } else {
      return '';
    }
  }
  return '';
}

function extractIdentifier(filePath: string): string | null {
  const regex = /target[\\/](?<identifier>[a-zA-Z0-9]+)-(?<interface>swd|jtag)\.cfg/;
  const match = filePath.match(regex);
  return match ? match[1] : null;
}

export function getOpenOcdDebugInterface(debugInterface: string, debugBoard: string,
  seriesName: string): string {
  if (debugBoard === 'HiSpark-Trace') {
    return path.join('interface', 'cmsis-dap.cfg');
  }
  if (debugBoard === 'HiSpark-Link' || debugBoard === 'HiSparkLinkPro') {
    if (debugInterface !== 'jtag' && debugInterface !== 'swd') {
      return '';
    }
    /* In the CFBB scenario, the getInterface interface needs to return the cmsis-dap.cfg file. */
    if (seriesName === 'cfbb') {
      return path.join('interface', 'cmsis-dap.cfg');
    } else {
      if (debugInterface === 'jtag') {
        return path.join('interface', 'ft2232h-ftdi-jtag.cfg');
      } else if (debugInterface === 'swd') {
        return path.join('interface', 'ft2232h-ftdi-swd.cfg');
      } else {
        // do nothing
      }
    }
  }
  return '';
}

export function getTarget(debugInterface: string, socName: string): string {
  return path.join('target', `${socName?.toLocaleUpperCase()}-${debugInterface?.toLocaleLowerCase()}.cfg`);
}

export function checkCppProperties(hiPath: string, workspaceFolderPath: string): void {
  const hiprojPath = hiPath;
  const projFolderPath = workspaceFolderPath;
  const cppPropertiesPath = path.join(projFolderPath, '.vscode', 'c_cpp_properties.json');
  let content = getCCppJsonContent(cppPropertiesPath, projFolderPath);

  const hiprojContent = getHiprojContent(hiprojPath);
  if (content && hiprojContent) {
    if (hiprojContent.information?.series_name) {
      if (Array.isArray(content?.configurations) && content?.configurations.length > 0) {
        let flag = true;
        content?.configurations.some((item: any) => {
          if (!isObjectNotArr(item)) {
            flag = false;
          }
          return !flag;
        });
        if (flag) {
          handleUpdateCCppCompilerPath(content, cppPropertiesPath, hiprojContent?.compile?.tool_chain, hiprojContent.information?.series_name);
        } else {
          showMessageModal({
            content: `${res('parseErrWhetherGenerate', [cppPropertiesPath])}${res('impactOfParseErrCCppJson')}`,
            btn: [res('confirm')],
            cb: (btn: string) => {
              if (btn === res('confirm')) {
                creAndUpdateCCpp(projFolderPath, cppPropertiesPath, hiprojContent.information?.series_name, hiprojContent?.compile?.tool_chain);
              }
            },
          });
        }
      } else {
        showMessageModal({
          content: `${res('parseErrWhetherGenerate', [cppPropertiesPath])}${res('impactOfParseErrCCppJson')}`,
          btn: [res('confirm')],
          cb: (btn: string) => {
            if (btn === res('confirm')) {
              creAndUpdateCCpp(projFolderPath, cppPropertiesPath, hiprojContent.information?.series_name, hiprojContent?.compile?.tool_chain);
            }
          },
        });
      }
    } else {
      if (!extension.messageModalManage) {
        extension.messageModalManage = {};
      }
      if (!extension.messageModalManage[modalType.creCppJsonParamWrong]) {
        extension.messageModalManage[modalType.creCppJsonParamWrong] = true;
        showMessageModal({
          content: res('creCppJsonParamWrong'),
          cb: (btn: string) => {
            if (extension.messageModalManage?.[modalType.creCppJsonParamWrong]) {
              extension.messageModalManage[modalType.creCppJsonParamWrong] = false;
            }
          },
        });
      }
    }
  }
}

function creAndUpdateCCpp(projFolderPath: string, cppPropertiesPath: string, seriesName: string, toolChain: string): void {
  const tempCont = creCCppConfigJson(projFolderPath, toolChain, seriesName);
  handleUpdateCCppCompilerPath(tempCont, cppPropertiesPath, toolChain, seriesName);
}

function handleUpdateCCppCompilerPath(cCppContent: any, cCppPath: string, toolChain: string, seriesName: string): void {
  cCppContent.configurations.forEach((item: any, index: number) => {
    if (!fs.existsSync(item.compilerPath)) {
      cCppContent.configurations[index].compilerPath = getCppCompilePath(seriesName, toolChain);
    }
    item.name = 'c/cpp plugin configurations';
  });
  writeWithcheckRight(cCppPath, JSON.stringify(cCppContent, null, 4), {
    unExpectModal: modalType.cppJsonUnExpectErrW,
    wErrModal: modalType.cppJsonNoRightToW,
  });
}

function mcuImportHiproj(oldHiprojContent: any): any {
  let config: any = jsonTypeGet({
    soc: oldHiprojContent?.information?.['board_build.mcu'],
    sdkPath: oldHiprojContent?.information?.sdk_path,
    boardJsonPath: `${oldHiprojContent?.information?.board}.json`,
    seriesName: oldHiprojContent?.information?.series_name,
  });
  let newHiprojContent: any = Object.assign({}, oldHiprojContent);
  if (config.chip_config !== undefined) {
    newHiprojContent.chipconfig = getIniContentChipConfig(oldHiprojContent, config);
  }
  if (newHiprojContent.upload.usbValue === undefined && config?.upload?.protocol?.includes('usb')) {
    newHiprojContent.upload.usb_value = '';
    newHiprojContent.upload.pid_value = '';
    newHiprojContent.upload.vid_value = '';
    newHiprojContent.upload.usage = '';
    newHiprojContent.upload.usage_page = '';
  }

  if (config.variabletrace !== undefined) {
    newHiprojContent.variabletrace = getIniContentVariableTrace(config);
  }
  if (!newHiprojContent.upload) {
    newHiprojContent.upload = {};
  }
  if (config?.upload?.is_edit !== undefined) {
    newHiprojContent.upload.is_edit = config?.upload?.is_edit;
  }
  if (config?.upload?.base_page_byte !== undefined) {
    newHiprojContent.upload.base_page_byte = config?.upload?.base_page_byte;
  }
  if (newHiprojContent.information.project_type === 'CFBB' && !fs.existsSync(config?.debug?.jlinkScriptPath)) {
    newHiprojContent.debug = getCfbbIniContentDebug(oldHiprojContent);
  }
  if (newHiprojContent.information.project_type === 'CFBB' && config?.target_default) {
    newHiprojContent.information = getCfbbInitContentInformation(oldHiprojContent, config);
  }
  return newHiprojContent;
}

function getCfbbInitContentInformation(oldHiprojContent: any, config: any): any {
  const information = oldHiprojContent?.information ?? {};
  if (information.target !== config.target_default) {
    information.target = config.target_default;
  }
  return information;
}

export function getNewIniContent(oldIniSection2: any): any {
  let config: any = jsonTypeGet({
    soc: oldIniSection2?.['board_build.mcu'],
    sdkPath: oldIniSection2?.chip_package_path,
    boardJsonPath: `${oldIniSection2?.board}.json`,
    seriesName: oldIniSection2?.series_name?.toLowerCase(),
  });

  const information = getIniContentInformation(oldIniSection2, config);
  let newIniContet: any = {
    information: information,
    compile: getIniContentCompile(oldIniSection2, information, config),
    debug: getIniContentDebug(oldIniSection2, config),
    upload: getIniContentUpload(oldIniSection2, config),
    console: getIniContentConsole(oldIniSection2, config),
  };

  if (config.chip_config !== undefined) {
    newIniContet.chipconfig = getIniContentChipConfig(oldIniSection2, config);
  }
  return newIniContet;
}

function getIniContentInformation(oldIniSection2: any, config: any): any {
  let boardMcuValue = oldIniSection2['board_build.mcu'] ? oldIniSection2['board_build.mcu'] : '';
  let flashValue = config?.information?.flash;
  if (!flashValue) {
    if (flash152.includes(boardMcuValue)) {
      flashValue = 155648;
    } else if (flash128.includes(boardMcuValue)) {
      flashValue = 131072;
    } else {
      flashValue = '';
    }
  }
  return {
    series_name: oldIniSection2.series_name ? oldIniSection2.series_name.toLowerCase() : '',
    board: oldIniSection2.board ? oldIniSection2.board : '',
    sdk_path: oldIniSection2.chip_package_path ? oldIniSection2.chip_package_path : '',
    'board_build.mcu': boardMcuValue,
    platform: oldIniSection2.platform ? oldIniSection2.platform : '',
    json_path: oldIniSection2.board ? `${oldIniSection2.board}.json` : '',
    flash: flashValue,
  };
}

function getIniContentChipConfig(oldIniSection2: any, config: any): any {
  return {
    chipconfig: config.chip_config ?? false,
  };
}

function getIniContentVariableTrace(config: any): any {
  return {
    variabletrace: config.variabletrace ?? false,
  };
}

function getCfbbIniContentDebug(oldHiprojContent: any): any {
  const debug = oldHiprojContent?.debug ?? {};
  const board = oldHiprojContent?.information?.board;
  const projectType = oldHiprojContent?.information?.project_type;
  const customIdePath = path.join(path.resolve(__dirname, '..'), 'resources', 'connect');
  if (board && projectType) {
    let boardStr = (JSON.stringify(board)).replace(/"/g, '');
    let projectTypeStr = (JSON.stringify(projectType)).replace(/"/g, '');
    if (isInAcoreChipArr(board)) {
      debug.jlinkScriptPath = path.join(
        extension.isCustomIDE ? customIdePath : getResource.get(chip.connectFile),
        projectTypeStr,
        boardStr,
        'Acore',
        'connectCore.JLinkScript'
      );
    } else {
      debug.jlinkScriptPath = path.join(
        extension.isCustomIDE ? customIdePath : getResource.get(chip.connectFile),
        projectTypeStr,
        boardStr,
        'connectCore.JLinkScript'
      );
    }
  }
  return debug;
}

function getIniContentCompile(oldIniSection2: any, information: any, config: any): any {
  return {
    tool_chain: oldIniSection2.compiler || config?.compile?.tool_chain?.[0] || '',
    link_c_library_in_toolchain: oldIniSection2.link_c_library_in_toolchain ? oldIniSection2.link_c_library_in_toolchain : 'yes',
    link_c_library_in_compilationchain: oldIniSection2.link_c_library_in_compilationchain ? oldIniSection2.link_c_library_in_compilationchain : 'yes',
    map_path: config?.compile?.map_path || `out/bin/target.map`,
    compile_type: oldIniSection2.build_type ? oldIniSection2.build_type : 'debug',
    optimization: oldIniSection2.optimization ? oldIniSection2.optimization : 'O0',

    ...getIniContentCompileWarning(oldIniSection2),

    [hiprojKey.staticLibraryEnable]: oldIniSection2.static_library_enable ? oldIniSection2.static_library_enable : 'no',
    static_library_import: oldIniSection2.static_library_import ? oldIniSection2.static_library_import : 'no',
    generate_crc: oldIniSection2.generate_crc ? oldIniSection2.generate_crc : 'no',
    generate_checksum: oldIniSection2.generate_checksum ? oldIniSection2.generate_checksum : 'no',
    generate_symboltable: oldIniSection2.generate_symboltable ? oldIniSection2.generate_symboltable : 'yes',
    padding: oldIniSection2.padding ? oldIniSection2.padding : 'no',

    static_library_name: oldIniSection2.static_library_name ? oldIniSection2.static_library_name : '',
    static_library_dependency_header_file: oldIniSection2.static_library_dependency_header_file ? oldIniSection2.static_library_dependency_header_file : '',
    static_library_source_file: oldIniSection2.static_library_source_file ? oldIniSection2.static_library_source_file : '',
    static_library_path: oldIniSection2.static_library_path ? oldIniSection2.static_library_path : '',
    fstack_protector_strong: oldIniSection2.fstack_protector_strong ? oldIniSection2.fstack_protector_strong : 'no',
    extern_staticlib_path: oldIniSection2.extern_staticlib_path ? oldIniSection2.extern_staticlib_path : '',
    extern_staticlib_include: oldIniSection2.extern_staticlib_include ? oldIniSection2.extern_staticlib_include : '',

    global_macro_definition: JSON.stringify({ FLOAT_SUPPORT: '' }),
    burned_file_name: '[$proj]_[$date]([$time])_[macro]_([$CRC])',

    ...getIniContentBuildOutControl(oldIniSection2, information),
  };
}

function getIniContentCompileWarning(oldIniSection2: any): any {
  return {
    warning: oldIniSection2.warning ? oldIniSection2.warning : 'no',
    werror: oldIniSection2.werror ? oldIniSection2.werror : 'no',
    wno_unused_function: oldIniSection2.wno_unused_function ? oldIniSection2.wno_unused_function : 'no',
    wno_unused_label: oldIniSection2.wno_unused_label ? oldIniSection2.wno_unused_label : 'no',
    wno_unused_parameter: oldIniSection2.wno_unused_parameter ? oldIniSection2.wno_unused_parameter : 'no',
    wno_burned_file: oldIniSection2.wno_burned_file ? oldIniSection2.wno_burned_file : 'no',
    wno_unused_variable: oldIniSection2.wno_unused_variable ? oldIniSection2.wno_unused_variable : 'no',
    wno_missing_prototypes: oldIniSection2.wno_missing_prototypes ? oldIniSection2.wno_missing_prototypes : 'no',
  };
}

function getIniContentBuildOutControl(oldIniSection2: any, information: any): any {
  let result: any = {
    generate_target_hex: oldIniSection2.generate_target_hex ? oldIniSection2.generate_target_hex : 'yes',
    parse_elf_for_livewatch: oldIniSection2.parse_elf_for_livewatch ? oldIniSection2.parse_elf_for_livewatch : 'no',
    enable_perf: oldIniSection2.enable_perf ? oldIniSection2.enable_perf : 'no',
    enable_build_problem: oldIniSection2.enable_build_problem ? oldIniSection2.enable_build_problem : 'yes',
    parse_analysis_json: oldIniSection2.parse_analysis_json ? oldIniSection2.parse_analysis_json : 'yes',
    add_nhso_build_parameter: oldIniSection2.add_nhso_build_parameter ? oldIniSection2.add_nhso_build_parameter : 'yes',
  };

  if (information?.['board_build.mcu'] && addGenerateAllinoneBin.includes(information['board_build.mcu'])) {
    result.generate_allinone_bin = oldIniSection2.generate_allinone_bin ? oldIniSection2.generate_allinone_bin : 'yes';
  }

  return result;
}

function getIniContentDebug(oldIniSection2: any, config: any): any {
  const debugToolObj: any = {
    jlink: 'jlink',
    'openocd(HiSpark-Link/FT2232H Debugger)': 'HiSpark-Link',
    'openocd(HiSpark-Trace)': 'HiSpark-Trace',
  };
  let toolValue = config?.debug?.tool?.[0] || 'HiSpark-Trace';
  if (oldIniSection2.debug_tool && debugToolObj[oldIniSection2.debug_tool]) {
    toolValue = debugToolObj[oldIniSection2.debug_tool];
  }
  let interfaceValue = '';
  if (oldIniSection2.debug_interface) {
    interfaceValue = oldIniSection2.debug_interface;
  } else if (config?.debug?.params && config?.debug?.params?.[0]?.param?.interface?.[0]) {
    [interfaceValue] = config?.debug?.params?.[0]?.param?.interface;
  } else {
    interfaceValue = 'swd';
  }
  let speedValue = '';
  if (oldIniSection2.debug_speed) {
    speedValue = oldIniSection2.debug_speed;
  } else if (config?.debug?.params && config?.debug?.params?.[0]?.param?.speed) {
    speedValue = config?.debug?.params?.[0]?.param?.speed;
  } else {
    speedValue = '10000';
  }
  return {
    elf_path: oldIniSection2.debug_elf || config?.debug?.elf_path || `./out/bin/target.elf`,
    breakpoints_limitation: oldIniSection2.breakpoints_limitation || config?.debug?.breakpoints_limitation || `./out/bin/target.elf`,
    client: oldIniSection2.debug_client || config?.debug?.client?.[0] || 'gdb',
    tool: toolValue,
    interface: interfaceValue,
    speed: speedValue,
    port: oldIniSection2.debug_port ? oldIniSection2.debug_port : '3333',
    timeout: oldIniSection2.timeout || config?.debug?.timeout_default || '60000',
  };
}

function getIniContentUpload(oldIniSection2: any, config: any): any {
  let protocolValue = getProtocolValue(oldIniSection2, config);

  let uploadParamsObj: any = getUploadParamsObj(oldIniSection2, config);

  let debugBoardValue = 'HiSpark-Trace';
  if (uploadParamsObj[protocolValue]?.param?.debug_board &&
    uploadParamsObj[protocolValue]?.param?.debug_board[0]) {
    debugBoardValue = uploadParamsObj[protocolValue]?.param?.debug_board[0];
  }

  return {
    bin_path: oldIniSection2.upload_bin_file || config?.upload?.bin_path || `./out/bin/target.bin`,
    protocol: protocolValue,
    baud: oldIniSection2.upload_speed || uploadParamsObj.serial?.param?.baud || '115200',
    stop_bit: uploadParamsObj.serial?.param?.stop_bit || 0,
    parity: uploadParamsObj.serial?.param?.parity || 'N',
    port: oldIniSection2.upload_port || uploadParamsObj.serial?.param?.port || '',
    debug_board: debugBoardValue,
    frequency: uploadParamsObj[protocolValue]?.param?.frequency || '5000',
    address: uploadParamsObj[protocolValue]?.param?.address || '0x3000000',
    reset: config?.upload?.reset || 1,
    burn_verification: config?.upload?.burn_verification || 0,
    [hiprojKey.isEdit]: config?.upload?.is_edit || 'yes',
    [hiprojKey.basePageByte]: config?.upload?.base_page_byte || 1024,
  };
}

function getProtocolValue(oldIniSection2: any, config: any): any {
  const protocolObj: any = {
    'burn-serial': 'serial',
  };
  let protocolValue = '';
  if (oldIniSection2.upload_protocol && protocolObj[oldIniSection2.upload_protocol]) {
    protocolValue = protocolObj[oldIniSection2.upload_protocol];
  } else if (config?.upload?.protocol?.[2]) {
    [, , protocolValue] = config?.upload?.protocol;
  } else if (config?.upload?.protocol?.[0]) {
    [protocolValue] = config?.upload?.protocol;
  } else {
    protocolValue = 'serial';
  }
  return protocolValue;
}

function getUploadParamsObj(oldIniSection2: any, config: any): any {
  let uploadParamsObj: any = {};
  if (config?.upload?.params && Array.isArray(config.upload?.params)) {
    config?.upload?.params?.forEach((item: any) => {
      if (item?.name) {
        uploadParamsObj[item?.name] = item;
      }
    });
  }
  return uploadParamsObj;
}

function getIniContentConsole(oldIniSection2: any, config: any): any {
  return {
    port: oldIniSection2.upload_port || config?.console?.port || '',
    baud: oldIniSection2.baud || config?.console?.baud || '115200',
    stop_bit: config?.console?.stop_bit || 0,
    parity: config?.console?.parity || 'N',
  };
}

export function showMessageModal({
  title,
  content = '',
  btn = [],
  cb = (): void => { },
  infoType = 'tips',
}: any): void {
  if (infoType === 'err') {
    vscode.window.showErrorMessage(title ?? res('err'), {
      modal: true,
      detail: content,
    }, ...btn).then(cb);
  } else {
    vscode.window.showInformationMessage(title ?? res('tips'), {
      modal: true,
      detail: content,
    }, ...btn).then(cb);
  }
}

export async function asyncShowMessageModal({
  title,
  content = '',
  btn = [],
  cb = (): void => { },
  infoType = 'tips',
}: any): Promise<void> {
  if (infoType === 'err') {
    vscode.window.showErrorMessage(title ?? res('err'), {
      modal: true,
      detail: content,
    }, ...btn).then(cb);
  } else {
    vscode.window.showInformationMessage(title ?? res('tips'), {
      modal: true,
      detail: content,
    }, ...btn).then(cb);
  }
}

export function pathIsHormonyDir(dirPath: string): any {
  if (pathIsDir(dirPath)) {
    let iniPath = path.join(dirPath, '.deveco', 'deveco.ini');
    if (fs.existsSync(iniPath)) {
      return iniPath;
    }
  }
  return false;
}

export function pathIsHiproj(targetPath: string): boolean {
  return pathTypeJudge(targetPath, '.hiproj');
}

export function pathIsHimpw(targetPath: string): boolean {
  return pathTypeJudge(targetPath, '.himpw');
}

function pathTypeJudge(targetPath: string, extName: string): boolean {
  if (pathIsFile(targetPath)) {
    if (path.extname(targetPath) === extName) {
      return true;
    }
  }
  return false;
}

export function pathIsDir(targetPath: string): boolean {
  if (!targetPath) {
    return false;
  }
  let stat = null;
  try {
    stat = fs.statSync(targetPath);
  } catch {
    // No permission. Skip.
  }
  if (stat?.isDirectory()) {
    return true;
  } else {
    return false;
  }
}

export function pathIsFile(targetPath: string): boolean {
  if (!targetPath) {
    return false;
  }
  let stat = null;
  try {
    stat = fs.statSync(targetPath);
  } catch {
    // No permission. Skip.
  }
  if (stat?.isFile()) {
    return true;
  } else {
    return false;
  }
}

export function rmJsonComment(str: string): string {
  return str.replace(/\/\/.*$/gm, '');
}

export function getChipListBoaedsMap(contextpath: string, fileName: string = 'chiplist.json'): any {
  const chipsJsonPath = extension.isCustomIDE ? 
    path.join(`${contextpath}`, 'resources', 'chips', fileName) :
    path.join(getResource.get(chip.config), fileName);

  if (!fs.existsSync(chipsJsonPath)) {
    return {};
  }
  let config;
  try {
    const data = fs.readFileSync(chipsJsonPath, 'utf8');
    // parse JSON string to JSON object
    config = JSON.parse(data);
  } catch (err) {
    return {};
  }
  let result: any = {};
  if (isArray(config)) {
    for (const series of config) {
      for (const type of series.children) {
        if (type.boardsMap) {
          Object.keys(type.boardsMap).forEach((key: string) => {
            result[key] = type.boardsMap[key];
          });
        }
      }
    }
  }
  return result;
}

export async function showFolder(folderPath: string): Promise<void> {
  if (fs.existsSync(folderPath)) {
    try {
      await execs(`attrib -h ${folderPath}/* /s /d`);
    } catch (err) {
      // show folder failed
    }
  }
}

export function getUserconfigAndSubsystem(userconfigPath: string, iniP: string, cb = (): void => { }): ConfigReturn | undefined {
  let userconfig = getUserconfigContent(userconfigPath, userconfigPath, iniP);
  const subsystem = userconfig?.system?.[0]?.subsystem;
  if (userconfig) {
    if (!subsystem || !Array.isArray(subsystem)) {
      showMessageModal({
        content: `${res('parseErrWhetherGenerate', [userconfigPath])}${res('impactOfParseErrUserconfig')}`,
        btn: [res('confirm')],
        cb: async (btn: string) => {
          if (btn === res('confirm')) {
            await creDefaultUserconfig(userconfigPath, iniP);
          }
        },
      });
      cb();
    }
  } else {
    cb();
  }

  return {
    userconfig,
    subsystem,
  };
}

export function pathAccessFOk(targetPath: string): boolean {
  let result = true;
  try {
    fs.accessSync(targetPath, fs.constants.F_OK);
  } catch {
    result = false;
  }
  return result;
}

export function fileAccessROk(targetPath: string): boolean {
  let result = true;
  try {
    fs.readFileSync(targetPath);
  } catch {
    result = false;
  }
  return result;
}

export function pathAccessWOk(targetPath: string): boolean {
  let result = true;
  try {
    fs.accessSync(targetPath, fs.constants.W_OK);
  } catch {
    result = false;
  }
  return result;
}

export function fileAccessAllRights(targetPath: string): AccessAllRights {
  return {
    fOk: pathAccessFOk(targetPath),
    rOk: fileAccessROk(targetPath),
    wOk: pathAccessWOk(targetPath),
  };
}

export function canRecreateHiproj(hiprojContent: any): boolean {
  const board = hiprojContent?.information?.board;
  const chip = hiprojContent?.information?.['board_build.mcu'];
  const sdkPath = hiprojContent?.information?.sdk_path;
  const seriesName = hiprojContent?.information?.series_name;

  if (board && chip && seriesName) {
    const fileName = getRealBoardJsonName(seriesName, chip, board);
    const contextpath = extension.extensionPath;
    let chipsJsonPath = extension.isCustomIDE ?
      path.join(`${contextpath}`, 'resources', 'chips', fileName) :
      path.join(getResource.get(chip.config), fileName);
    if (fs.existsSync(chipsJsonPath)) {
      return true;
    } else if (fs.existsSync(sdkPath)) {
      chipsJsonPath = path.join(sdkPath, 'build', 'config', 'target_config', fileName.replace('.json', ''), fileName);
      if (fs.existsSync(chipsJsonPath)) {
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  } else {
    return false;
  }
}

export function getChipJsonContent(param: GetJsonParam): any {
  let { sdkPath, fileName } = param;
  if (!fileName) {
    return null;
  }
  if (fileName === 'chiplist.json' && extension.isCustomIDE) {
    fileName = 'chiplist-custom.json';
  }
  const contextpath = extension.extensionPath;
  let chipsJsonPath = extension.isCustomIDE ?
    path.join(`${contextpath}`, 'resources', 'chips', fileName) :
    path.join(getResource.get(chip.config), fileName);
  // for cfbb
  if (!fs.existsSync(chipsJsonPath)) {
    if (sdkPath !== undefined && sdkPath !== '') {
      if (fileName.includes('nb')) {
        chipsJsonPath = path.join(sdkPath, 'build', 'target_config', fileName);
      } else if (inTargetAndHasConfigChipJsons.includes(fileName)) {
        chipsJsonPath = path.join(sdkPath, 'build', 'config', 'target_config', fileName);
      } else {
        chipsJsonPath = path.join(sdkPath, 'build', 'config', 'target_config', fileName.replace('.json', ''), fileName);
      }
      if (!fs.existsSync(chipsJsonPath)) {
        return null;
      }
    } else {
      return null;
    }
  }
  let config;
  try {
    const data = fs.readFileSync(chipsJsonPath, 'utf8');
    // parse JSON string to JSON object
    config = JSON.parse(data);
  } catch (err) {
    return null;
  }
  return config;
}

export async function recreateHiproj(hiprojContent: any, projFolderPath: string): Promise<void> {
  const board = hiprojContent?.information?.board;
  const chip = hiprojContent?.information?.['board_build.mcu'];
  const sdkPath = hiprojContent?.information?.sdk_path;
  const seriesName = hiprojContent?.information?.series_name;
  // get the content of chiplist.json
  const boardJsonName = getRealBoardJsonName(seriesName, chip, board);

  const config = getChipJsonContent({
    fileName: boardJsonName,
    sdkPath: sdkPath,
  });
  if (config) {
    let projectType = '';
    if (config?.project_type && config?.project_type?.length > 0) {
      projectType = config.project_type[0].name.toUpperCase();
    }
    let iniInfo = creProIniFile({
      seriesName: seriesName,
      soc: chip,
      board,
      projectName: path.basename(projFolderPath),
      projectPath: path.dirname(projFolderPath),
      himpwName: '',
      cpu0Name: '',
      cpu1Name: '',
      cpu2Name: '',
      projectType,
      sdkPath,
      needSdk: config?.need_sdk,
      needProjectPath: config?.need_project_path,
      boardJsonPath: boardJsonName,
      chipConfig: config?.chip_config,
      platform: config?.platform,
      projectNewType: '',
      checkEmptyProject: '',
      samplePath: '',
      sampleNameSelect: '',
    }, projFolderPath);
    if (iniInfo) {
      reFreshSettingIfOpen();
    }
  } else {
    if (!extension.messageModalManage) {
      extension.messageModalManage = {};
    }
    if (!extension.messageModalManage[modalType.hiprojReCreErrByNoJson]) {
      extension.messageModalManage[modalType.hiprojReCreErrByNoJson] = true;
      showMessageModal({
        content: res('creHiprojFailedByNoJson'),
        btn: [res('confirm')],
        cb: (btn: string) => {
          if (extension.messageModalManage?.[modalType.hiprojReCreErrByNoJson]) {
            extension.messageModalManage[modalType.hiprojReCreErrByNoJson] = false;
          }
        },
      });
    }
  }
}

export function getRealBoardJsonName(seriesName: string, chip: string, board: string): string {
  return `${board}.json`;
}

export function getHiprojContent(hiprojPath: string): any {
  if (!extension.messageModalManage) {
    extension.messageModalManage = {};
  }
  let hiAllRights = fileAccessAllRights(hiprojPath);
  if (!hiAllRights.fOk) {
    showHiprojFErrModal(hiprojPath);
    return false;
  } else if (!hiAllRights.rOk) {
    showHiprojRErrModal(hiprojPath);
    return false;
  } else {
    let hiprojContent: any = {};
    try {
      hiprojContent = ini.parse(fs.readFileSync(hiprojPath).toString());
    } catch {
      showHiprojParseErrModal(hiprojPath);
      return false;
    }
    return hiprojContent;
  }
}

export function getExFileContent(targetPath: string, fileType: PaeseFileType, tipsObj: TipsArr, cbObj: CbArr, modalManageObj: ModalManageObj): any {
  if (!extension.messageModalManage) {
    extension.messageModalManage = {};
  }
  const { fErrModal, rErrModal, parseErrModal } = modalManageObj;
  let cCppAllRights = fileAccessAllRights(targetPath);
  if (!cCppAllRights.fOk) {
    if (!extension.messageModalManage[fErrModal]) {
      extension.messageModalManage[fErrModal] = true;
      showMessageModal({
        content: tipsObj.fErr,
        btn: [res('confirm')],
        cb: (btn: string) => {
          if (extension.messageModalManage?.[fErrModal]) {
            extension.messageModalManage[fErrModal] = false;
          }
          if (btn === res('confirm')) {
            cbObj.fErr();
          }
        },
      });
    }
    return false;
  } else if (!cCppAllRights.rOk) {
    if (!extension.messageModalManage[rErrModal]) {
      extension.messageModalManage[rErrModal] = true;
      showMessageModal({
        content: tipsObj.rErr,
        cb: (btn: string) => {
          if (extension.messageModalManage?.[rErrModal]) {
            extension.messageModalManage[rErrModal] = false;
          }
        },
      });
    }
    return false;
  } else {
    let content: any;
    try {
      if (fileType === 'ini') {
        content = ini.parse(fs.readFileSync(targetPath).toString());
      } else {
        content = JSON.parse(fs.readFileSync(targetPath).toString());
      }
    } catch {
      if (!extension.messageModalManage[parseErrModal]) {
        extension.messageModalManage[parseErrModal] = true;
        showMessageModal({
          content: tipsObj.parseErr,
          btn: [res('confirm')],
          cb: (btn: string) => {
            if (extension.messageModalManage?.[parseErrModal]) {
              extension.messageModalManage[parseErrModal] = false;
            }
            if (btn === res('confirm')) {
              cbObj.parseErr();
            }
          },
        });
      }

      return false;
    }
    return content;
  }
}

export function writeWithcheckRight(targetPath: string, content: any, modalmanageWrite: ModalManageWrite,
  msgObj?: MsgObj): boolean {
  let finallyDone = false;
  if (!extension.messageModalManage) {
    extension.messageModalManage = {};
  }
  const { unExpectModal, wErrModal } = modalmanageWrite;
  const { fOk, wOk } = fileAccessAllRights(targetPath);
  if (wOk || !fOk) {
    try {
      fs.writeFileSync(targetPath, content);
      finallyDone = true;
    } catch {
      if (!extension.messageModalManage[unExpectModal]) {
        extension.messageModalManage[unExpectModal] = true;
        showMessageModal({
          content: msgObj?.unExpectMsg ?? res('unexpectedErrWhenW', [targetPath]),
          cb: () => {
            if (extension.messageModalManage?.[unExpectModal]) {
              extension.messageModalManage[unExpectModal] = false;
            }
          },
        });
      }
    }
  } else {
    if (!extension.messageModalManage[wErrModal]) {
      extension.messageModalManage[wErrModal] = true;
      showMessageModal({
        content: msgObj?.wErrMsg ?? res('noRightToW', [targetPath]),
        cb: () => {
          if (extension.messageModalManage?.[wErrModal]) {
            extension.messageModalManage[wErrModal] = false;
          }
        },
      });
    }
  }
  return finallyDone;
}

export async function creDefaultUserconfig(userconfigPath: string, hiprojPath: string): Promise<void> {
  let hiproj = getHiprojContent(hiprojPath);
  const sdkPath = hiproj?.information?.sdk_path;
  let finallyDone: boolean = false;
  if (sdkPath) {
    const userDefaultPath = path.join(sdkPath, 'build', 'config', `bisheng_${hiproj?.compile?.float_type}`, 'userconfig.json');
    const userDefaultROk = fileAccessROk(userDefaultPath);
    if (userDefaultROk) {
      const { wOk, fOk } = fileAccessAllRights(userconfigPath);
      if (wOk || !fOk) {
        try {
          fs.copyFileSync(userDefaultPath, userconfigPath);
          finallyDone = true;
        } catch {
          showMessageModal({
            content: res('unexpectedErrWhenW', [userconfigPath]),
          });
        }
      } else {
        showMessageModal({
          content: res('noRightToW', [userconfigPath]),
        });
      }
    } else {
      showMessageModal({
        content: res('pleaseSetRightSdk'),
      });
    }
  } else {
    showMessageModal({
      content: res('pleaseSetRightSdk'),
    });
  }
  if (finallyDone) {
    reFreshSettingIfOpen('independentConfig');
  }
}

export function getLaunchAndAttachInfo(workspaceFolderPath: string, type: string, projectType: string): any {
  let launchTplPath = extension.isCustomIDE ?
    path.join(__dirname, '..', 'resources', 'debug', type, projectType.toUpperCase(), 'launchinit.txt') :
    path.join(getResource.get(chip.debugFile), type, projectType.toUpperCase(), 'launchinit.txt');
  let attachTplPath = extension.isCustomIDE ?
    path.join(__dirname, '..', 'resources', 'debug', type, projectType.toUpperCase(), 'attachinit.txt') :
    path.join(getResource.get(chip.debugFile), type, projectType.toUpperCase(), 'attachinit.txt');

  if (!pathIsHiproj(workspaceFolderPath)) {
    const iniFile = findIniFile(workspaceFolderPath);
    if (iniFile) {
      const hiProjectContent = getHiprojContent(iniFile);
      const newType = hiProjectContent?.information?.project_new_type;
      const currentCpu = hiProjectContent?.information?.currentCPU;
      if (newType === 'multiCoreProject' && currentCpu && type === 'HiSpark-Trace' ) {
        const lastChar = currentCpu.slice(-1);
        let mcuType: string;
        if (lastChar === '0') {
          mcuType = 'MCU0';
        } else if (lastChar === '1') {
          mcuType = 'MCU1';
        } else if (lastChar === '2') {
          mcuType = 'MCU2';
        } else {
          mcuType = 'MCU';
        }
        launchTplPath = path.join(__dirname, '..', 'resources', 'debug', type, mcuType, 'launchinit.txt');
        attachTplPath = path.join(__dirname, '..', 'resources', 'debug', type, mcuType, 'attachinit.txt');
      }
    }
  }

  const launchInit = fs.readFileSync(launchTplPath, { encoding: 'utf8' });
  const attachInit = fs.readFileSync(attachTplPath, { encoding: 'utf8' });

  let launchInitPath: string;
  let attachInitPath: string;
  let folderToOpen = '';
  if (pathIsHiproj(workspaceFolderPath)) {
    const hiProjectContent = getHiprojContent(workspaceFolderPath);
    folderToOpen = hiProjectContent?.information?.sdk_path;
  } else {
    folderToOpen = workspaceFolderPath;
  }
  launchInitPath = path.join(folderToOpen, '.vscode', '.launchinit');
  attachInitPath = path.join(folderToOpen, '.vscode', '.attachinit');

  return {
    launchInit,
    attachInit,
    launchInitPath,
    attachInitPath,
  };
}

export function getCCppJsonContent(cCppPath: string, pathNeedByCreCCppJson: string): any {
  let content = getExFileContent(cCppPath, 'json', {
    fErr: `${res('noPathWhetherGenerate', [cCppPath])}${res('impactOfMissingCCppJson')}`,
    rErr: `${res('noRightToR', [cCppPath])}${res('impactOfUnupdateCCppJson')}`,
    parseErr: `${res('parseErrWhetherGenerate', [cCppPath])}${res('impactOfParseErrCCppJson')}`,
  }, {
    fErr: async () => await reCreCCppConfigJson(pathNeedByCreCCppJson),
    parseErr: async () => await reCreCCppConfigJson(pathNeedByCreCCppJson),
  }, {
    fErrModal: modalType.cppJsonFErr,
    rErrModal: modalType.cppJsonRErr,
    parseErrModal: modalType.cppJsonParseErr,
  });
  return content;
}

export function getUserconfigContent(cCppPath: string, pathNeedByCreUserconfig: string, iniP: string): any {
  let content = getExFileContent(cCppPath, 'json', {
    fErr: `${res('noPathWhetherGenerate', [cCppPath])}${res('impactOfMissingUserconfig')}`,
    rErr: `${res('noRightToR', [cCppPath])}${res('impactOfRErrUserconfig')}`,
    parseErr: `${res('parseErrWhetherGenerate', [cCppPath])}${res('impactOfParseErrUserconfig')}`,
  }, {
    fErr: async () => await creDefaultUserconfig(pathNeedByCreUserconfig, iniP),
    parseErr: async () => await creDefaultUserconfig(pathNeedByCreUserconfig, iniP),
  }, {
    fErrModal: modalType.usercfgJsonFErr,
    rErrModal: modalType.usercfgJsonRErr,
    parseErrModal: modalType.usercfgJsonParseErr,
  });
  return content;
}

export async function getBurnParamFilePath(isInfoFlash: any): Promise<string> {
  if (isInfoFlash === '' || isInfoFlash === undefined || isInfoFlash === null) {
    return '';
  }
  const workspaceFolderPath = await getActiveWorkFolderPath();
  const launchJsonPath = path.join(workspaceFolderPath, '.vscode', 'launch.json');
  const launchData = fs.readFileSync(launchJsonPath, 'utf8');
  const launch = JSON.parse(launchData);
  let filePath: string = '';
  if (launch?.configurations) {
    let rootPath = path.join(vscode.env.appRoot, '..', '..', 'tools');
    let toolsPath = launch.configurations[0].serverArgs[5];
    let cfgPath = extractIdentifier(launch.configurations[0].serverArgs[9]);
    filePath = path.join(
      `${toolsPath.replace('${command:toolsPath}', rootPath)}`,
      'target',
      `${cfgPath}.txt`);
  }
  return filePath;
}

export async function creLaunchJsonFile(projectData: launchJsonParam, projectPath: string, isOpenProj?: boolean, cpuNumber?: string): Promise<boolean> {
  if (!extension.messageModalManage) {
    extension.messageModalManage = {};
  }
  let flag = projectData?.soc && projectData?.sdkPath &&
    projectData?.boardJsonPath && projectData?.seriesName;
  if (!flag) {
    extension.messageModalManage[modalType.creLaunchParamWrong] = true;
    showMessageModal({
      content: res('creLaunchJsonParamWrong'),
      cb: (btn: string) => {
        if (extension.messageModalManage?.[modalType.creLaunchParamWrong]) {
          extension.messageModalManage[modalType.creLaunchParamWrong] = false;
        }
      },
    });
    return false;
  }
  if (projectData.seriesName === 'cfbb') {
    return await creCfbbLaunchJsonFile(projectData, projectPath, multiModevalue, isOpenProj);
  } else {
    return creMcuLaunchJsonFile(projectData, projectPath, cpuNumber); // different json need different modelFile
  }
}

export async function reCreLaunchJsonFile(projectData: launchJsonParam, projectPath: string, isReloadWindow: boolean = false): Promise<void> {
  if (await creLaunchJsonFile(projectData, projectPath)) {
    if (isReloadWindow) {
      vscode.commands.executeCommand('workbench.action.reloadWindow');
    } else {
      reFreshSettingIfOpen();
    }
  }
}

export function showHiprojParseErrModal(hiprojPath: string): void {
  if (!extension.messageModalManage) {
    extension.messageModalManage = {};
  }
  if (extension.messageModalManage[modalType.hiprojParseErr]) {
    extension.messageModalManage[modalType.hiprojParseErr] = true;
    showMessageModal({
      content: `${res('paeseErrHiprojRecreate', [hiprojPath])}${res('impactOfMissingHiproj')}`,
      cb: (btn: string) => {
        if (extension.messageModalManage?.[modalType.hiprojParseErr]) {
          extension.messageModalManage[modalType.hiprojParseErr] = false;
        }
      },
    });
  }
}

export function showHiprojRErrModal(hiprojPath: string): void {
  if (!extension.messageModalManage) {
    extension.messageModalManage = {};
  }
  if (!extension.messageModalManage[modalType.hiprojRErr]) {
    extension.messageModalManage[modalType.hiprojRErr] = true;
    showMessageModal({
      content: res('noRightToR', [hiprojPath]),
      cb: (btn: string) => {
        if (extension.messageModalManage?.[modalType.hiprojRErr]) {
          extension.messageModalManage[modalType.hiprojRErr] = false;
        }
      },
    });
  }
}

export function showHiprojFErrModal(hiprojPath: string): void {
  if (!extension.messageModalManage) {
    extension.messageModalManage = {};
  }
  if (!extension.messageModalManage[modalType.hiprojFErr]) {
    extension.messageModalManage[modalType.hiprojFErr] = true;
    showMessageModal({
      content: res('noHiprojWhetherRecreate', [hiprojPath]),
      cb: (btn: string) => {
        if (extension.messageModalManage?.[modalType.hiprojFErr]) {
          extension.messageModalManage[modalType.hiprojFErr] = false;
        }
      },
    });
  }
}

export async function reCreCCppConfigJson(ccppPropertiesJsonPath: string): Promise<void> {
  const iniPath = await getActiveIniPath();
  const hiprojContent = getHiprojContent(iniPath);
  if (hiprojContent) {
    if (hiprojContent.information?.series_name) {
      creCCppConfigJson(ccppPropertiesJsonPath, hiprojContent.compile?.tool_chain, hiprojContent.information?.series_name);
    } else {
      if (!extension.messageModalManage) {
        extension.messageModalManage = {};
      }
      if (!extension.messageModalManage[modalType.creCppJsonParamWrong]) {
        extension.messageModalManage[modalType.creCppJsonParamWrong] = true;
        showMessageModal({
          content: res('creCppJsonParamWrong'),
          cb: (btn: string) => {
            if (extension.messageModalManage?.[modalType.creCppJsonParamWrong]) {
              extension.messageModalManage[modalType.creCppJsonParamWrong] = false;
            }
          },
        });
      }
    }
  }
}

export async function getActiveIniPath(): Promise<string> {
  // MCU芯片活动工程或者多核工程返回当前最新的活动.hiproj路径;
  const window = (vscode.window as any);
  const activeProjPath = (window && typeof (window.hiGetProjectValue) === 'function') ?
    await (vscode.window as any).hiGetProjectValue('hispark.extension.activeHiproj') :
    undefined;
  const projectPath = vscode.workspace.workspaceFolders;
  if (activeProjPath && projectPath) {
    const isMatchingPath = projectPath?.some((folder: any) => folder.uri.fsPath === activeProjPath);
    if (isMatchingPath) {
      const iniFile = findIniFile(activeProjPath);
      if (iniFile) {
        return iniFile;
      }
    }
  }

  let isActiveProjectFound = false;
  const workspaceFolderPath = await getActiveWorkFolderPath();
  let iniPath: any;
  const storageDir = path.dirname(getExtensionContext().globalStorageUri.fsPath);
  const cachePath = path.join(storageDir, 'projectdata.json');
  const initialContent = JSON.stringify([], null, 2);
  if (!fs.existsSync(cachePath)) {
    try {
      fs.writeFileSync(cachePath, initialContent);
    } catch (err) {
      const error = err as Error;
      vscode.window.showErrorMessage(res('writeFailed', [cachePath, error.message]));
    }
  }
  const projectDataContent = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  // FBB芯片工程支持.hiproj和工作区分离,根据projectdata.json返回当前为active的.hiproj路径;
  for (const item of projectDataContent) {
    if (item.SDK === workspaceFolderPath && item.active) {
      iniPath = item.active;
      isActiveProjectFound = true;
      break;
    }
  }
  // 返回MCU普通工程的.hiproj文件,它必在当前工作区下,且只有一个;
  if (!isActiveProjectFound) {
    iniPath = findHiprojFileSync(workspaceFolderPath);
  }

  return iniPath;
}

// 查找 .hiproj 文件
function findIniFile(activeProjPath: string): string | undefined {
  const files = fs.readdirSync(activeProjPath);
  for (const file of files) {
    if (file.endsWith('.hiproj')) {
      return path.join(activeProjPath, file);
    }
  }
  return undefined; // 如果没有找到 .hiproj 文件，则返回 undefined
}

export async function convertHormony(param: {
  item: any;
  iniPath: string;
  importSuccessArr: Array<ImportTableItem>;
  importFailedArr: Array<ImportTableItem>;
  importTableItem: ImportTableItem;
  failedFileChildren: Array<FailedFileChildren>;
}): Promise<{ importOk: boolean; newIniPath: string; newChip: string; board: string }> {
  const { item, iniPath, importSuccessArr, importFailedArr, importTableItem, failedFileChildren } = param;
  let newIniPath = item.path;
  let newChip = '';
  let board = '';
  // Converting Feature Files
  let oldIniContent: any = {};

  let oldIniString = '';
  try {
    oldIniString = fs.readFileSync(iniPath).toString();
  } catch {
    failedFileChildren.push({
      path: iniPath,
      status: failedType.withoutRRight,
    });
    importTableItem.path = item.path;
    importTableItem.key = item.path;
    importTableItem.status = res('importFailed');
    importFailedArr.push(importTableItem);
    return { importOk: false, newIniPath, newChip, board };
  }
  try {
    oldIniContent = ini.parse(oldIniString);
  } catch {
    failedFileChildren.push({
      path: iniPath,
      status: failedType.parseFailed,
    });
    importTableItem.path = item.path;
    importTableItem.key = item.path;
    importTableItem.status = res('importFailed');
    importFailedArr.push(importTableItem);
    return { importOk: false, newIniPath, newChip, board };
  }
  let oldIniSection2: any = {};
  if (Object.keys(oldIniContent)[1] && oldIniContent[Object.keys(oldIniContent)[1]]) {
    oldIniSection2 = oldIniContent[Object.keys(oldIniContent)[1]];
  }
  let newIniContet = getNewIniContent(oldIniSection2);
  let tempNewIniPath = path.join(item.path, `${path.basename(item.path)}.hiproj`);
  newChip = newIniContet?.information?.['board_build.mcu'];
  ({ board } = newIniContet?.information);
  if (!newChip || !board) {
    failedFileChildren.push({
      path: iniPath,
      status: failedType.wrongContent,
    });
    importTableItem.path = item.path;
    importTableItem.key = item.path;
    importTableItem.status = res('importFailed');
    importFailedArr.push(importTableItem);
    return { importOk: false, newIniPath, newChip, board };
  }
  try {
    fs.writeFileSync(tempNewIniPath, ini.stringify(newIniContet));
    newIniPath = tempNewIniPath;
  } catch {
    failedFileChildren.push({
      path: tempNewIniPath,
      status: failedType.withoutWRight,
    });
    importTableItem.path = item.path;
    importTableItem.key = item.path;
    importTableItem.status = res('importFailed');
    importFailedArr.push(importTableItem);
    return { importOk: false, newIniPath, newChip, board };
  }
  await importLaunchJson(item.path, newIniContet, failedFileChildren, true);
  if (failedFileChildren.length > 0) {
    importTableItem.path = item.path;
    importTableItem.key = item.path;
    importTableItem.status = res('importSuccess');
    importSuccessArr.push(importTableItem);
  }
  return { importOk: true, newIniPath, newChip, board };
}

export async function importMcuProj(param: {
  item: any;
  iniPath: string;
  importSuccessArr: Array<ImportTableItem>;
  importFailedArr: Array<ImportTableItem>;
  importTableItem: ImportTableItem;
  failedFileChildren: Array<FailedFileChildren>;
}): Promise<{ importOk: boolean; newIniPath: string; newChip: string; board: string }> {
  const { item, iniPath, importSuccessArr, importFailedArr, importTableItem, failedFileChildren } = param;
  let newIniPath = item.path;
  let newChip = '';
  let board = '';
  // Converting Feature Files
  let iniContent: any = {};
  let iniString = '';
  const hiprojPath = item.path;
  try {
    iniString = fs.readFileSync(hiprojPath).toString();
  } catch {
    failedFileChildren.push({
      path: hiprojPath,
      status: failedType.withoutRRight,
    });
    importTableItem.path = hiprojPath;
    importTableItem.key = hiprojPath;
    importTableItem.status = res('importFailed');
    importFailedArr.push(importTableItem);
    return { importOk: false, newIniPath, newChip, board };
  }
  try {
    iniContent = ini.parse(iniString);
  } catch {
    failedFileChildren.push({
      path: hiprojPath,
      status: failedType.parseFailed,
    });
    importTableItem.path = hiprojPath;
    importTableItem.key = hiprojPath;
    importTableItem.status = res('importFailed');
    importFailedArr.push(importTableItem);
    return { importOk: false, newIniPath, newChip, board };
  }

  if (iniContent?.information && iniContent.information['board_build.mcu']) {
    newChip = iniContent.information['board_build.mcu'];
  }
  board = iniContent?.information?.board;
  if (!newChip || !board) {
    failedFileChildren.push({
      path: hiprojPath,
      status: failedType.wrongContent,
    });
    importTableItem.path = hiprojPath;
    importTableItem.key = hiprojPath;
    importTableItem.status = res('importFailed');
    importFailedArr.push(importTableItem);
    return { importOk: false, newIniPath, newChip, board };
  }

  let newHiprojContet = mcuImportHiproj(iniContent);
  try {
    fs.writeFileSync(hiprojPath, ini.stringify(newHiprojContet));
  } catch {
    failedFileChildren.push({
      path: hiprojPath,
      status: failedType.withoutWRight,
    });
    importTableItem.path = hiprojPath;
    importTableItem.key = hiprojPath;
    importTableItem.status = res('importFailed');
    importFailedArr.push(importTableItem);
    return { importOk: false, newIniPath, newChip, board };
  }

  const hiprojContent = getHiprojContent(hiprojPath);
  if (hiprojContent?.information?.project_type === 'MCU') {
    await importLaunchJson(path.dirname(hiprojPath), iniContent, failedFileChildren, false);
  } else {
    await importLaunchJson(hiprojPath, iniContent, failedFileChildren, false);
  }
  if (failedFileChildren.length > 0) {
    importTableItem.path = hiprojPath;
    importTableItem.key = hiprojPath;
    importTableItem.status = res('importSuccess');
    importSuccessArr.push(importTableItem);
  }
  return { importOk: true, newIniPath, newChip, board };
}

export function reFreshSettingIfOpen(type?: string): void {
  if (extension.settingPanel) {
    if (type === 'independentConfig') {
      const folderPath = extension.settingPanel.path;
      Command.closeProjectSettings();
      vscode.commands.executeCommand('showProjectSetting', 'independentConfig', folderPath);
    } else {
      Command.closeProjectSettings();
      vscode.commands.executeCommand('showProjectSetting');
    }
  }
}

export function getCppCompilePath(seriesName: string, toolChain: string): string {
  if (toolChain === 'gcc_arm' || seriesName === 'cfbb') {
    return '';
  }

  const tool: string = toolChain ?? 'cc_riscv32_musl_fp_win';
  let compilerPath = '';
  if (extension.isCustomIDE) {
    compilerPath = (toolChain === 'BiSheng') ?
      path.join(vscode.env.appRoot, '..', '..', 'tools', 'Windows', 'linx-llvm-binary-release-win-musl', 'bin', 'clang.exe') :
      path.join(vscode.env.appRoot, '..', '..', 'tools', 'Windows', tool, 'bin', 'riscv32-linux-musl-gcc.exe');
  } else {
    const toolsPath: string = getToolsPath();
    compilerPath = path.join(toolsPath, 'tools', 'Windows', tool, 'bin', 'riscv32-linux-musl-gcc.exe');
  }

  return compilerPath;
}

export function getCppIncludePath(toolChain: string): string[] {
  let includePath;
  if (toolChain === 'BiSheng') {
    includePath = path.join(vscode.env.appRoot, '..', '..', 'tools', 'Windows', 'linx-llvm-binary-release-win-musl', 'riscv32-elf', 'lib-lld', 'include');
    return [includePath, '${workspaceFolder}/**'];
  }
  return ['${workspaceFolder}/**'];
}

export function getProjectType(hiProjectContent: any): string {
  const fileName = `${hiProjectContent?.information?.board}.json`;
  const sdkPath = hiProjectContent?.information?.sdk_path;
  const config = getChipJsonContent({
    fileName: fileName,
    sdkPath: sdkPath,
  });

  let projectType = '';
  if (config?.project_type[0]?.name) {
    projectType = config.project_type[0].name;
  }

  return projectType;
}

export function findHiprojFileSync(dirPath: string): string | null {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const filePath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      const found = findHiprojFileSync(filePath);
      if (found) {
        return found;
      }
    }

    if (entry.isFile() && entry.name.endsWith('.hiproj')) {
      return filePath;
    }
  }

  return null;
}

// Get chip information
export async function getChipInfo(): Promise<any> {
  const hiprojPath = await getActiveIniPath();
  const content = fs.readFileSync(hiprojPath, 'utf-8');
  const parsedData = ini.parse(content);
  const workspaceFolderPath = await getActiveWorkFolderPath();
  const board = parsedData?.information?.board;
  const jsonGetParam = {
    soc: board,
    boardJsonPath: `${board}.json`,
    sdkPath: workspaceFolderPath,
  };
  const jsonData = jsonTypeGet(jsonGetParam);
  return jsonData;
}

// Parse python script and extract target content
export function configScriptParse(dictString: string): string {
  let targetStartIndex = dictString.indexOf('target = {');
  if (targetStartIndex === -1) {
    throw new Error('Failed to find valid target content.');
  }

  targetStartIndex = dictString.indexOf('{', targetStartIndex);
  if (targetStartIndex === -1) {
    throw new Error('Failed to find the starting curly brace for target.');
  }

  let bracketCount = 1;
  let targetEndIndex = targetStartIndex + 1;

  // Find the matching closing brace for the target
  while (bracketCount > 0 && targetEndIndex < dictString.length) {
    const character = dictString[targetEndIndex];
    if (character === '{') {
      bracketCount++;
    } else if (character === '}') {
      bracketCount--;
    } else {
      // do nothing
    }
    targetEndIndex++;
  }

  if (bracketCount !== 0) {
    throw new Error('Failed to find matching target closing braces.');
  }

  let targetString = dictString.slice(targetStartIndex, targetEndIndex);

  // Clean up the extracted target string
  targetString = targetString
    .replace(/#.*$/gm, '') // Remove comments
    .replace(/'/g, '"') // Convert single quotes to double quotes
    .replace(/,\s*}/g, '}') // Remove trailing commas before closing braces
    .replace(/,\s*]/g, ']') // Remove trailing commas before closing brackets
    .replace(/: True/g, ': "True"') // Convert boolean True to string "True"
    .replace(/: False/g, ': "False"'); // Convert boolean False to string "False"

  return targetString;
}

// Get the path to the JSON file
export async function jsonPathGet(): Promise<any> {
  const hiprojPath = await getActiveIniPath();
  const content = fs.readFileSync(hiprojPath, 'utf-8');
  const parsedData = ini.parse(content);
  const workspaceFolderPath = await getActiveWorkFolderPath();
  const board = parsedData?.information?.board;
  const jsonGetParam = {
    soc: board,
    boardJsonPath: `${board}.json`,
    sdkPath: workspaceFolderPath,
  };
  const rootPath = path.resolve(__dirname, '..');
  let chipsJsonPath = extension.isCustomIDE ? 
    path.join(rootPath, 'resources', 'chips', jsonGetParam?.boardJsonPath) :
    path.join(getResource.get(chip.config), jsonGetParam?.boardJsonPath);
  if (!fs.existsSync(chipsJsonPath) && jsonGetParam?.soc && jsonGetParam?.sdkPath) {
    if (jsonGetParam?.soc?.includes('nb')) {
      chipsJsonPath = path.join(jsonGetParam?.sdkPath, 'build', 'target_config', `${jsonGetParam?.soc}.json`);
    } else {
      chipsJsonPath = path.join(
        jsonGetParam?.sdkPath,
        'build',
        'config',
        'target_config',
        jsonGetParam?.soc,
        `${jsonGetParam?.soc}.json`
      );
    }
  }
  return chipsJsonPath;
}

// Add a new target to the JSON configuration file
export async function addTargetToJson(targetName: string, baseTargetName: string): Promise<void> {
  const jsonFilePath = await jsonPathGet();

  if (!fs.existsSync(jsonFilePath)) {
    vscode.window.showErrorMessage(res('jsonFileNotExist'));
    return;
  }

  const data = fs.readFileSync(jsonFilePath, 'utf8');
  const jsonData = JSON.parse(data);

  let baseTargetData: any = null;
  let targetsKey: string = '';
  let baseTargetKey: string = '';

  // Search for the base target data
  for (const [key, targetsGroup] of Object.entries(jsonData.target)) {
    for (const [targetKey, targetValue] of Object.entries(targetsGroup as any)) {
      const buildArgv = (targetValue as any)?.cmake?.build?.build_argv;
      if (buildArgv === baseTargetName) {
        baseTargetData = JSON.parse(JSON.stringify(targetValue));
        targetsKey = key;
        baseTargetKey = targetKey;
        break;
      }
    }
    if (baseTargetData) {
      break;
    }
  }

  if (!baseTargetData) {
    vscode.window.showErrorMessage(`${res('baseTargetNotFound')}: ${baseTargetName}`);
    return;
  }

  const originalBuildArgv = baseTargetData.cmake.build.build_argv;
  const newBuildArgv = targetName.toLowerCase();

  const baseTargetDataString = JSON.stringify(baseTargetData);
  const replacedTargetDataString = baseTargetDataString.replace(
    new RegExp(originalBuildArgv, 'g'),
    newBuildArgv
  );

  const newTargetData = JSON.parse(replacedTargetDataString);
  const targetNameUpper = targetName.toUpperCase();
  (jsonData.target[targetsKey] as any)[targetNameUpper] = newTargetData;

  fs.writeFileSync(jsonFilePath, JSON.stringify(jsonData, null, 4), 'utf-8');
}

// Update the target name in the JSON configuration
export async function updateJsonTargetName(originalName: string, updatedName: string): Promise<void> {
  const jsonFilePath = await jsonPathGet();

  if (!fs.existsSync(jsonFilePath)) {
    vscode.window.showErrorMessage(res('jsonFileNotExist'));
    return;
  }

  const data = fs.readFileSync(jsonFilePath, 'utf8');
  const jsonData = JSON.parse(data);

  let targetFound = false;
  let targetsKey: string = '';
  let targetKey: string = '';
  let targetData: any = null;

  // Search for the original target name
  for (const [key, targetsGroup] of Object.entries(jsonData.target)) {
    for (const [tk, tv] of Object.entries(targetsGroup as any)) {
      if (tk === originalName.toUpperCase()) {
        targetFound = true;
        targetsKey = key;
        targetKey = tk;
        targetData = tv;
        break;
      }
    }
    if (targetFound) {
      break;
    }
  }

  if (!targetFound) {
    vscode.window.showErrorMessage(`${res('targetNotFound')}: ${originalName}`);
    return;
  }

  const originalBuildArgv = targetData.cmake.build.build_argv;

  // Update target name and replace in configuration
  const updatedNameUpper = updatedName.toUpperCase();
  (jsonData.target[targetsKey] as any)[updatedNameUpper] = targetData;
  delete (jsonData.target[targetsKey] as any)[targetKey];

  const targetDataString = JSON.stringify(targetData);
  const replacedTargetDataString = targetDataString.replace(
    new RegExp(originalBuildArgv, 'g'),
    updatedName.toLowerCase()
  );
  (jsonData.target[targetsKey] as any)[updatedNameUpper] = JSON.parse(replacedTargetDataString);

  fs.writeFileSync(jsonFilePath, JSON.stringify(jsonData, null, 4), 'utf-8');
}

// Delete a target from the JSON configuration
export async function deleteTargetFromJson(targetName: string): Promise<void> {
  const jsonFilePath = await jsonPathGet();

  if (!fs.existsSync(jsonFilePath)) {
    vscode.window.showErrorMessage(res('jsonFileNotExist'));
    return;
  }

  const data = fs.readFileSync(jsonFilePath, 'utf8');
  const jsonData = JSON.parse(data);

  let targetFound = false;
  let targetsKey: string = '';

  // Search for the target to delete
  for (const [key, targetsGroup] of Object.entries(jsonData.target)) {
    if ((targetsGroup as any)[targetName.toUpperCase()]) {
      targetFound = true;
      targetsKey = key;
      break;
    }
  }

  if (!targetFound) {
    vscode.window.showErrorMessage(`${res('targetNotFound')}: ${targetName}`);
    return;
  }

  // Delete the target from JSON
  delete (jsonData.target[targetsKey] as any)[targetName.toUpperCase()];
  fs.writeFileSync(jsonFilePath, JSON.stringify(jsonData, null, 4), 'utf-8');
}

// Copy and modify configuration files for the new target
export async function copyAndModifyConfigFiles(targetName: string, baseTargetName: string): Promise<void> {
  const chipInfo = await getChipInfo();
  const workspaceFolders = await getActiveWorkFolderPath();

  const signConfigRelativePath = chipInfo.sign_config;
  const signConfigFullPath = path.join(workspaceFolders, signConfigRelativePath);
  const signConfigDir = path.dirname(signConfigFullPath);
  const baseSignConfigName = `${baseTargetName.replace(/-/g, '_')}.cfg`;
  const baseSignConfigFullPath = path.join(signConfigDir, baseSignConfigName);

  if (!fs.existsSync(baseSignConfigFullPath)) {
    vscode.window.showErrorMessage(`${res('signConfigNotFound')}: ${baseSignConfigName}`);
    return;
  }

  // Copy the sign config file and modify it
  const newSignConfigName = `${targetName.replace(/-/g, '_')}.cfg`;
  const newSignConfigFullPath = path.join(signConfigDir, newSignConfigName);
  fs.copyFileSync(baseSignConfigFullPath, newSignConfigFullPath);

  let signConfigContent = fs.readFileSync(newSignConfigFullPath, 'utf-8');
  const originalBuildArgv = baseTargetName.toLowerCase();
  signConfigContent = signConfigContent.replace(
    new RegExp(originalBuildArgv, 'g'),
    targetName.toLowerCase()
  );
  fs.writeFileSync(newSignConfigFullPath, signConfigContent, 'utf-8');

  const menuConfigRelativePath = chipInfo.menuconfig;
  const menuConfigFullPath = path.join(workspaceFolders, menuConfigRelativePath);
  const menuConfigDir = path.dirname(menuConfigFullPath);
  const baseMenuConfigName = `${baseTargetName.replace(/-/g, '_')}.config`;
  const baseMenuConfigFullPath = path.join(menuConfigDir, baseMenuConfigName);

  if (!fs.existsSync(baseMenuConfigFullPath)) {
    vscode.window.showErrorMessage(`${res('menuConfigNotFound')}: ${baseMenuConfigName}`);
    return;
  }

  // Copy the menu config file
  const newMenuConfigName = `${targetName.replace(/-/g, '_')}.config`;
  const newMenuConfigFullPath = path.join(menuConfigDir, newMenuConfigName);
  fs.copyFileSync(baseMenuConfigFullPath, newMenuConfigFullPath);
}

// Rename configuration files when target name is updated
export async function renameConfigFiles(originalName: string, updatedName: string): Promise<void> {
  const chipInfo = await getChipInfo();
  const workspaceFolders = await getActiveWorkFolderPath();

  const signConfigRelativePath = chipInfo.sign_config;
  const signConfigDir = path.dirname(path.join(workspaceFolders, signConfigRelativePath));
  const originalSignConfigName = `${originalName.replace(/-/g, '_')}.cfg`;
  const updatedSignConfigName = `${updatedName.replace(/-/g, '_')}.cfg`;

  const originalSignConfigFullPath = path.join(signConfigDir, originalSignConfigName);
  const updatedSignConfigFullPath = path.join(signConfigDir, updatedSignConfigName);

  // Rename the sign config file if it exists
  if (fs.existsSync(originalSignConfigFullPath)) {
    fs.renameSync(originalSignConfigFullPath, updatedSignConfigFullPath);

    let signConfigContent = fs.readFileSync(updatedSignConfigFullPath, 'utf-8');
    signConfigContent = signConfigContent.replace(
      new RegExp(originalName.toLowerCase(), 'g'),
      updatedName.toLowerCase()
    );
    fs.writeFileSync(updatedSignConfigFullPath, signConfigContent, 'utf-8');
  }

  const menuConfigRelativePath = chipInfo.menuconfig;
  const menuConfigDir = path.dirname(path.join(workspaceFolders, menuConfigRelativePath));
  const originalMenuConfigName = `${originalName.replace(/-/g, '_')}.config`;
  const updatedMenuConfigName = `${updatedName.replace(/-/g, '_')}.config`;

  const originalMenuConfigFullPath = path.join(menuConfigDir, originalMenuConfigName);
  const updatedMenuConfigFullPath = path.join(menuConfigDir, updatedMenuConfigName);

  // Rename the menu config file if it exists
  if (fs.existsSync(originalMenuConfigFullPath)) {
    fs.renameSync(originalMenuConfigFullPath, updatedMenuConfigFullPath);
  }
}

// Delete the configuration files for a target
export async function deleteConfigFiles(targetName: string): Promise<void> {
  const chipInfo = await getChipInfo();
  const workspaceFolders = await getActiveWorkFolderPath();

  const signConfigRelativePath = chipInfo.sign_config;
  const signConfigDir = path.dirname(path.join(workspaceFolders, signConfigRelativePath));
  const signConfigName = `${targetName.replace(/-/g, '_')}.cfg`;
  const signConfigFullPath = path.join(signConfigDir, signConfigName);

  if (fs.existsSync(signConfigFullPath)) {
    fs.unlinkSync(signConfigFullPath);
  }

  const menuConfigRelativePath = chipInfo.menuconfig;
  const menuConfigDir = path.dirname(path.join(workspaceFolders, menuConfigRelativePath));
  const menuConfigName = `${targetName.replace(/-/g, '_')}.config`;
  const menuConfigFullPath = path.join(menuConfigDir, menuConfigName);

  // Delete the menu config file if it exists
  if (fs.existsSync(menuConfigFullPath)) {
    fs.unlinkSync(menuConfigFullPath);
  }
}

// Find target block start and end indexes
export function findTargetBlockIndexes(lines: string[], targetName: string): [number, number] | null {
  let targetStartIndex = -1;
  let targetEndIndex = -1;
  const stack: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`'${targetName}': {`)) {
      targetStartIndex = i;
      stack.push('{');
    } else if (targetStartIndex !== -1 && stack.length > 0) {
      // Track brackets using stack
      const openingBrackets = (lines[i].match(/{/g) ?? []).length;
      const closingBrackets = (lines[i].match(/}/g) ?? []).length;

      for (let j = 0; j < openingBrackets; j++) {
        stack.push('{');
      }
      
      for (let j = 0; j < closingBrackets; j++) {
        stack.pop();
      }

      if (stack.length === 0) {
        targetEndIndex = i;
        break;
      }
    } else {
      // do nothing
    }
  }

  return targetStartIndex !== -1 && targetEndIndex !== -1 ? [targetStartIndex, targetEndIndex] : null;
}
  
// Update a specific field within the target block
export function updateField(lines: string[], startIdx: number, endIdx: number, fieldName: string, newValue: string): boolean {
  for (let i = startIdx; i <= endIdx; i++) {
    const regex = new RegExp(`('${fieldName}'\\s*:\\s*)['"]?[^'"]*['"]?`);
    if (regex.test(lines[i])) {
      lines[i] = lines[i].replace(regex, `$1'${newValue}'`);
      return true;
    }
  }
  return false;
}