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
import type { ProjectData, ProjectIniSection, launchJsonParam, ProjectCache} from './interface/model';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { res } from '../i18n/backEndTrans';
import * as ini from 'ini';
import {
  showMessageModal,
  addGenerateAllinoneBin,
  getCppCompilePath,
  getHiprojContent,
  pathAccessFOk,
  writeWithcheckRight,
  getLaunchAndAttachInfo,
  modalType,
  fileAccessROk,
  findHiprojFileSync,
  getActiveIniPath,
  getTarget,
  getOpenOcdDebugInterface,
  isInAcoreChipArr,
  inTargetAndHasConfigChips,
  getCppIncludePath
} from './utils';
import { extension, getExtensionContext } from '../extension';
import type { launchJsonConfig } from './interface/model';
// allinone
import { getResource } from './resourceManage/resourceManager';
import { chip } from './resourceManage/resourcePath';
import { spawn } from 'child_process';

let modeLaunchArr: launchJsonConfig[] = []; // 记录launch模式所有的target
let modeAttachArr: launchJsonConfig[] = []; // 记录attach模式所有的target

export const launchReqNameDir: any = {
  launch: 'GDB Launch (Download and Reset Program)',
  attach: 'GDB Attach (Attach to Running Program)',
};

const openocdExeArr: any = ['3071MNNICE', '3071MNPIRE'];
export function checkProjectDataJsonExists(): void {
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
}

export function updateProjectDataJson(hiProjPath: string): void {
  // check projectdata.json
  checkProjectDataJsonExists();

  // read projectdata.json
  const storageDir = path.dirname(getExtensionContext().globalStorageUri.fsPath);
  const cachePath = path.join(storageDir, 'projectdata.json');
  const projectDataContent = JSON.parse(fs.readFileSync(cachePath, 'utf8'));

  // parse xxx.hiproj
  const hiProjectContent = getHiprojContent(hiProjPath);
  const sdkPath = hiProjectContent?.information?.sdk_path;
  const projectType = hiProjectContent?.information?.project_type;

  // write projectdata.json
  let isFound = false;
  if (projectType === 'CFBB') {
    projectDataContent.forEach((item: ProjectCache) => {
      if (item.SDK === sdkPath) {
        item.active = hiProjPath;
        if (!item.project.includes(hiProjPath)) {
          item.project.push(hiProjPath);
        }
        isFound = true;
      }
    });
    if (!isFound) {
      const newProjectCache: ProjectCache = {
        SDK: sdkPath,
        project: [hiProjPath],
        active: hiProjPath,
      };
      projectDataContent.push(newProjectCache);
    }
    fs.writeFileSync(cachePath, JSON.stringify(projectDataContent, null, 2));
  }
}

export function creProIniFile(projectData: ProjectData, projectPath: string, cpuType?: string): any {
  let projectIniPath: string;
  
  switch (cpuType) {
    case 'CPU0':
      projectIniPath = path.join(projectPath, `${projectData.cpu0Name}.hiproj`);
      break;
    case 'CPU1':
      projectIniPath = path.join(projectPath, `${projectData.cpu1Name}.hiproj`);
      break;
    case 'CPU2':
      projectIniPath = path.join(projectPath, `${projectData.cpu2Name}.hiproj`);
      break;
    default:
      projectIniPath = path.join(projectPath, `${projectData.projectName}.hiproj`);
      break;
  }
  
  let dataContent: Array<ProjectIniSection> = [];
  getProIniInfo(dataContent, projectData, cpuType);
  if (dataContent.length === 0) {
    showMessageModal({
      content: res('generateHiprojFailed'),
      infoType: 'err',
    });
    return null;
  }
  let totalStr = '';
  let chip = '';
  let board = '';
  for (let i = 0; i < dataContent.length; ++i) {
    totalStr += `${dataContent[i].partName}\n`;
    for (let pair of dataContent[i].partMap.entries()) {
      totalStr += `${pair[0]} = ${pair[1]}\n`;
      if (dataContent[i].partName === '[information]' && pair[0] === 'board_build.mcu') {
        [, chip] = pair;
      }
      if (dataContent[i].partName === '[information]' && pair[0] === 'board') {
        [, board] = pair;
      }
    }
    totalStr += '\n';
  }
  const finallyDone = writeWithcheckRight(projectIniPath, totalStr, {
    unExpectModal: modalType.hiprojUnExpectErrW,
    wErrModal: modalType.hiprojNoRightToW,
  });
  if (finallyDone) {
    return {
      path: projectIniPath,
      chip,
      board,
    };
  } else {
    return null;
  }
}

export function creDevecoFile(projectData: ProjectData, projectPath: string): void {
  let filePath = path.join(projectPath, '.deveco');
  fs.mkdirSync(filePath);
  let devecoStruct: any = {
    name: '',
    map: new Map<string, string>(),
  };
  devecoStruct.name = `[env:${projectData.board}]\n`;
  mapKeyValueSet(devecoStruct.map, 'platform', 'quark_vendorhm');
  mapKeyValueSet(devecoStruct.map, 'board', projectData.board);
  mapKeyValueSet(devecoStruct.map, 'chip_package_path', projectData.sdkPath);
  const numSeries: string = projectData.board.replace(/\D/g, '');
  mapKeyValueSet(devecoStruct.map, 'series_name', `${numSeries}H`);
  mapKeyValueSet(devecoStruct.map, 'board_build.mcu', projectData.board.toUpperCase());
  let totalStr =
    `; DevEco Project Configuration File${os.EOL}; Version: 3.0.2${os.EOL}` + `; Core Version: 0.0.1${os.EOL}${os.EOL}`;
  totalStr += devecoStruct.name;
  for (let pair of devecoStruct.map.entries()) {
    totalStr += `${pair[0]} = ${pair[1]}\n`;
  }
  fs.writeFileSync(path.join(filePath, 'deveco.ini'), totalStr);
}

export async function creMcuLaunchJsonFile(projectData: launchJsonParam, projectPath: string, cpuNumber?: string): Promise<boolean> {
  const filePath = path.join(projectPath, '.vscode');
  if (!pathAccessFOk(filePath)) {
    try {
      fs.mkdirSync(filePath);
    } catch {
      // Preventing Accidents
    }
  }
  const launchConfiguration = await getConfiguration('launch', projectData, projectPath, cpuNumber);
  const attachConfiguration = await getConfiguration('attach', projectData, projectPath, cpuNumber);
  if (launchConfiguration && attachConfiguration) {
    const configurations = [launchConfiguration, attachConfiguration];
    const finallyDone = writeWithcheckRight(
      path.join(filePath, 'launch.json'),
      JSON.stringify({ configurations }, null, 4),
      {
        unExpectModal: modalType.launchJsonUnExpectErrW,
        wErrModal: modalType.launchJsonNoRightToW,
      }
    );
    return finallyDone;
  } else {
    return false;
  }
}

// create c_cpp_properties.json, which provide some configurations for C/C++ plugin
export function creCCppConfigJson(projectPath: string, toolChainString: any, seriesName: string): boolean {
  const filePath = path.join(projectPath, '.vscode');

  let compilerPath = getCppCompilePath(seriesName, toolChainString);
  let includePath = getCppIncludePath(toolChainString);
  let mode = '';
  if (toolChainString === 'BiSheng') {
    mode = 'linux-clang-arm';
  } else if (toolChainString === 'gcc_arm') {
    mode = 'linux-gcc-arm';
  }

  if (!fs.existsSync(filePath)) {
    try {
      fs.mkdirSync(filePath);
    } catch {
      // Preventing Accidents
    }
  }
  const config = Object.create(null);
  config.configurations = [
    {
      name: 'c/cpp plugin configurations',
      compilerPath: compilerPath,
      includePath: includePath,
      browse: {
        limitSymbolsToIncludedHeaders: true,
        path: ['${workspaceFolder}/**'],
      },
      intelliSenseMode: mode,
    },
  ];
  config.version = 4;
  let finallyDone = writeWithcheckRight(path.join(filePath, 'c_cpp_properties.json'), JSON.stringify(config, null, 4), {
    unExpectModal: modalType.cppJsonUnExpectErrW,
    wErrModal: modalType.cppJsonNoRightToW,
  });
  if (finallyDone) {
    return config;
  } else {
    return false;
  }
}

// create debug init file
export function creDebugInitFile(workspaceFolderPath: string, debugTool: string, projectType: string): boolean {
  const { launchInit, attachInit, launchInitPath, attachInitPath } = getLaunchAndAttachInfo(
    workspaceFolderPath,
    debugTool,
    projectType
  );

  const finallyDone1: boolean = writeWithcheckRight(launchInitPath, launchInit, {
    unExpectModal: modalType.launchInitUnExpectErrW,
    wErrModal: modalType.launchInitNoRightToW,
  });

  const finallyDone2: boolean = writeWithcheckRight(attachInitPath, attachInit, {
    unExpectModal: modalType.attachInitUnExpectErrW,
    wErrModal: modalType.attachInitNoRightToW,
  });

  return finallyDone1 && finallyDone2;
}

export function creEmptyProject(projectData:ProjectData, projectPath:string): void {
  const buildPath = path.join(projectData.sdkPath, 'build');
  const flashPath = path.join(projectData.sdkPath, 'chip', projectData.seriesName, 'flashdefault.lds');
  const projectIniPath: string = path.join(projectPath, `${projectData.projectName}.hiproj`);
  const hiProjectContent = getHiprojContent(projectIniPath);
  const floatType = hiProjectContent?.compile?.float_type;
  const userconfigPath = path.join(projectData.sdkPath, 'build', 'config', `bisheng_${floatType}`, 'userconfig.json');
  const rootPath = path.resolve(__dirname, '..');
  const mainPath = extension.isCustomIDE ? 
    path.join(rootPath, 'resources', 'chips', 'main.c') : 
    path.join(getResource.get(chip.config), 'main.c');

  const destinationChipPath = path.join(projectPath, 'chip');
  const destinationSeriesPath = path.join(destinationChipPath, projectData.seriesName);
  const destinationTargetPath = path.join(destinationChipPath, 'target');
  const destinationBuildPath = path.join(projectPath, 'build');
  const destinationFlashPath = path.join(destinationSeriesPath, 'flash.lds');
  const destinationUserconfigPath = path.join(destinationChipPath, 'target', 'userconfig.json');
  const destinationUserPath = path.join(projectPath, 'user');
  const destinationMainPath = path.join(destinationUserPath, 'main.c');

  // 复制 flash.lds 文件
  if (fs.existsSync(flashPath)) {
    fs.mkdirSync(destinationSeriesPath, { recursive: true });
    fs.copyFileSync(flashPath, destinationFlashPath);
  }

  // 复制 userconfig.json 文件
  if (fs.existsSync(userconfigPath)) {
    fs.mkdirSync(destinationTargetPath, { recursive: true });
    fs.copyFileSync(userconfigPath, destinationUserconfigPath);
  }

  // 复制 main.c 文件
  fs.mkdirSync(destinationUserPath, { recursive: true });
  fs.copyFileSync(mainPath, destinationMainPath);

  const mainContent = fs.readFileSync(destinationMainPath, 'utf8');
  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleString('sv-SE').replace(' ', 'T').slice(0, 19).replace('T', ' ');
  const newContent = mainContent.replace('yyyy-mm-dd hh:mm:ss', formattedDate);
  fs.writeFileSync(destinationMainPath, newContent, 'utf8');

  // 复制 build 文件夹
  if (fs.existsSync(buildPath)) {
    fs.mkdirSync(destinationChipPath, { recursive: true });
    copyFolderRecursiveSync(buildPath, destinationBuildPath);
  }
}

export function copyFolderRecursiveSync(source: string, destination: string): void {
  fs.mkdirSync(destination, { recursive: true });
  for (const file of fs.readdirSync(source)) {
    const srcFile = path.join(source, file);
    const destFile = path.join(destination, file);
    if (fs.lstatSync(srcFile).isDirectory()) {
      copyFolderRecursiveSync(srcFile, destFile);
    } else {
      fs.copyFileSync(srcFile, destFile);
    }
  }
}

export function checkEmptyProject(projectPath: string, configType: string): void {
  const destinationChipPath = path.join(projectPath, 'chip');
  const destinationBuildPath = path.join(projectPath, 'build');
  const destinationUserconfigPath = path.join(destinationChipPath, 'target', 'userconfig.json');
  let noBuild = '';
  let noFlash = '';
  let noUserconfig = '';
  if (fs.existsSync(destinationChipPath)) {
    const files = fs.readdirSync(destinationChipPath);
    if (files.length === 0) {
        noFlash = 'chip/chipname/flashdefault.lds';
    } else {
        let flashFileFound = false;

        files.forEach(file => {
            const subFolderPath = path.join(destinationChipPath, file);
            if (fs.statSync(subFolderPath).isDirectory()) {
                const flashFilePath = path.join(subFolderPath, 'flash.lds');
                if (fs.existsSync(flashFilePath)) {
                    flashFileFound = true;
                }
            }
        });

        if (!flashFileFound) {
            noFlash = 'chip/chipname/flashdefault.lds';
        }
    }
  } else {
    noFlash = 'chip/chipname/flashdefault.lds';
  }
  if (!fs.existsSync(destinationBuildPath)) {
    noBuild = 'build';
  }
  if (!fs.existsSync(destinationUserconfigPath)) {
    noUserconfig = `build/config/bisheng_${configType}/userconfig.json`;
  }
  if ((noBuild !== '') || (noFlash !== '') || (noUserconfig !== '')) {
    let messageParts = []; // 初始化消息数组
    if (noBuild) {
      messageParts.push(noBuild);
    }
    if (noFlash) {
      messageParts.push(noFlash);
    }
    if (noUserconfig) {
      messageParts.push(noUserconfig);
    }
    let message = messageParts.join(' ');
    showMessageModal({
      content: res('noPath', [message]),
      infoType: 'tips',
    });
  }
}

function getProIniInfo(proIniData: any, projectData: ProjectData, cpuType?: string): void {
  const config = jsonTypeGet(projectData);
  if (Object.keys(config).length > 0) {
    // [information] PART
    creInformationPart(proIniData, projectData, config, cpuType);

    // [chipconfig] PART
    creChipConfigPart(proIniData, projectData, config);

    // [variabletrace] PART
    creVariableTracePart(proIniData, projectData, config);

    // [conpile] PART
    creCompilePart(proIniData, projectData, config);

    // [debug] PART
    creDebugPart(proIniData, projectData, config);

    // [upload] PART
    creUploadPart(proIniData, projectData, config, cpuType);

    // [qemu] PART
    creQemuPart(proIniData, projectData, config);

    // [analysis] PART
    creAnalysis(proIniData, config);

    // [kConfig] PART
    creKConfig(proIniData, config);

    // [gui] PART
    creGui(proIniData, config);

    // [multiCore] PART
    creMultiCore(proIniData, projectData);
  }
}

function creInformationPart(proIniData: any, projectData: ProjectData, config: any, cpuType?: string): void {
  let information: ProjectIniSection = {
    partName: '[information]',
    partMap: new Map(),
  };
  mapKeyValueSet(information.partMap, 'series_name', projectData.seriesName);
  mapKeyValueSet(information.partMap, 'board', projectData.board);
  mapKeyValueSet(information.partMap, 'sdk_path', projectData.sdkPath);
  mapKeyValueSet(information.partMap, 'flash', config?.information?.flash);
  if (projectData.projectType === 'MCU' && (projectData.projectNewType === 'commonProject' || projectData.projectNewType === 'multiCoreProject')) {
    mapKeyValueSet(information.partMap, 'generate_code', true);
  }
  mapKeyValueSet(information.partMap, 'board_build.mcu', projectData.soc);
  mapKeyValueSet(information.partMap, 'platform', projectData.platform);
  mapKeyValueSet(information.partMap, 'json_path', projectData.boardJsonPath);
  mapKeyValueSet(information.partMap, 'project_type', projectData.projectType);
  mapKeyValueSet(information.partMap, 'project_new_type', projectData.projectNewType);
  if (projectData.projectType === 'MCU' && projectData.projectNewType === 'emptyProject') {
    mapKeyValueSet(information.partMap, 'check_empty_type', true);
  }
  if (projectData.projectType === 'MCU' && projectData.projectNewType === 'multiCoreProject') {
    mapKeyValueSet(information.partMap, 'currentCPU', cpuType ?? '');
  }
  if (config?.target_default) {
    mapKeyValueSet(information.partMap, 'target', config?.target_default);
  }
  proIniData.push(information);
}

function creChipConfigPart(proIniData: any, projectData: ProjectData, config: any): void {
  let chipconfig: ProjectIniSection = {
    partName: '[chipconfig]',
    partMap: new Map(),
  };
  mapKeyValueSet(chipconfig.partMap, 'chipconfig', config?.chip_config);
  proIniData.push(chipconfig);
}

function creVariableTracePart(proIniData: any, projectData: ProjectData, config: any): void {
  let variabletrace: ProjectIniSection = {
    partName: '[variabletrace]',
    partMap: new Map(),
  };
  mapKeyValueSet(variabletrace.partMap, 'variabletrace', config?.variabletrace);
  proIniData.push(variabletrace);
}

function creDebugPart(proIniData: any, projectData: ProjectData, config: any): void {
  let debug: ProjectIniSection = {
    partName: '[debug]',
    partMap: new Map(),
  };
  if (projectData.projectType === 'MCU' || projectData.projectType === 'CFBB') {
    mapKeyValueSet(debug.partMap, 'elf_path', config?.debug?.elf_path);
  } else {
    mapKeyValueSet(debug.partMap, 'elf_path', path.join(projectData.sdkPath, config?.debug?.elf_path));
  }
  mapKeyValueSet(debug.partMap, 'breakpoints_limitation', config?.debug?.breakpoints_limitation);
  mapKeyValueSet(debug.partMap, 'client', config?.debug?.client?.[0]);
  mapKeyValueSet(debug.partMap, 'tool', config?.debug?.tool?.[0]);
  mapKeyValueSet(
    debug.partMap,
    'interface',
    config.debug?.params ? config.debug.params?.[0]?.param?.interface?.[0] : ''
  );
  mapKeyValueSet(debug.partMap, 'speed', config?.debug?.params ? config.debug.params?.[0]?.param?.speed : '');
  mapKeyValueSet(debug.partMap, 'openocd_interface_file', '');
  mapKeyValueSet(debug.partMap, 'openocd_target_file', '');
  mapKeyValueSet(debug.partMap, 'timeout', config?.debug?.timeout_default);
  const customIdePath = path.join(path.resolve(__dirname, '..'), 'resources', 'connect');
  if (projectData.projectType === 'CFBB' && config.debug) {
    if (isInAcoreChipArr(projectData.board)) {
      mapKeyValueSet(
        debug.partMap,
        'jlinkScriptPath',
        path.join(
          extension.isCustomIDE ? customIdePath : getResource.get(chip.connectFile),
          projectData.projectType,
          projectData.board,
          'Acore',
          'connectCore.JLinkScript'
        )
      );
    } else {
      mapKeyValueSet(
        debug.partMap,
        'jlinkScriptPath',
        path.join(
          extension.isCustomIDE ? customIdePath : getResource.get(chip.connectFile),
          projectData.projectType,
          projectData.board,
          'connectCore.JLinkScript'
        )
      );
    }
  }
  mapKeyValueSet(debug.partMap, 'stop_debug_state', config?.debug?.stop_debug_state);
  proIniData.push(debug);
}

function creUploadPart(proIniData: any, projectData: ProjectData, config: any, cpuType: any): void {
  let upload: ProjectIniSection = {
    partName: '[upload]',
    partMap: new Map(),
  };
  if (projectData.projectType === 'MCU' || projectData.projectType === 'CFBB') {
    mapKeyValueSet(upload.partMap, 'bin_path', config?.upload?.bin_path);
  } else {
    mapKeyValueSet(upload.partMap, 'bin_path', path.join(projectData.sdkPath, config?.upload?.bin_path));
  }
  mapKeyValueSet(upload.partMap, 'protocol', config?.upload?.protocol?.[2] || config.upload?.protocol?.[0]);
  mapKeyValueSet(upload.partMap, 'reset', config?.upload?.reset);
  mapKeyValueSet(upload.partMap, 'burn_verification', config?.upload?.burn_verification);
  if (config?.upload?.flash_region !== undefined) {
    mapKeyValueSet(upload.partMap, 'flash_region', config?.upload?.flash_region);
  }
  if (config?.upload?.loadFiles !== undefined) {
    mapKeyValueSet(upload.partMap, 'loadFiles', config?.upload?.loadFiles);
  }
  if (config?.upload?.is_edit !== undefined) {
    mapKeyValueSet(upload.partMap, 'is_edit', config?.upload?.is_edit);
  }
  if (config?.upload?.base_page_byte !== undefined) {
    mapKeyValueSet(upload.partMap, 'base_page_byte', config?.upload?.base_page_byte);
  }
  if (config?.upload?.protocol.includes('usb')) {
    mapKeyValueSet(upload.partMap, 'usb_value', '');
    mapKeyValueSet(upload.partMap, 'pid_value', '');
    mapKeyValueSet(upload.partMap, 'vid_value', '');
    mapKeyValueSet(upload.partMap, 'usage', '');
    mapKeyValueSet(upload.partMap, 'usage_page', '');
  }
  if (config.upload?.protocol?.[2]) {
    Object.keys(config.upload?.params?.[2].param).forEach((key) => {
      if (typeof config.upload?.params?.[2].param?.[key] === 'string') {
        mapKeyValueSet(upload.partMap, key, config?.upload?.params?.[2]?.param?.[key]);
      } else {
        mapKeyValueSet(upload.partMap, key, config?.upload?.params?.[2]?.param?.[key]?.[0]);
      }
    });
  } else if (config.upload?.protocol?.[0]) {
    Object.keys(config.upload?.params?.[0]?.param).forEach((key) => {
      if (typeof config.upload?.params?.[0]?.param?.[key] === 'string') {
        mapKeyValueSet(upload.partMap, key, config?.upload?.params?.[0]?.param?.[key]);
      } else {
        mapKeyValueSet(upload.partMap, key, config?.upload?.params?.[0]?.param?.[key]?.[0]);
      }
    });
  } else {
    // In this case, no operation is required.
  }
  // 多核场景下不同CPU对应FLASH的开始地址和长度
  if (projectData.projectNewType === 'multiCoreProject' && config.upload?.multiCore) {
    Object.keys(config.upload?.multiCore).forEach((key) => {
      if (key === cpuType) {
        const cpuUploadConfig = config.upload?.multiCore[key];
        mapKeyValueSet(upload.partMap, 'address', cpuUploadConfig.address);
        mapKeyValueSet(upload.partMap, 'partition_length', cpuUploadConfig.partition_length);
        return;
      }
    });
  }
  if (config.upload?.params?.[0]?.param.inside_protocol !== undefined) {
    mapKeyValueSet(upload.partMap, 'inside_protocol', config?.upload?.params?.[0]?.param.inside_protocol);
  }
  proIniData.push(upload);
}

function creKConfig(proIniData: any, config: any): void {
  if (config?.kConfig) {
    const kConfig: ProjectIniSection = {
      partName: '[kConfig]',
      partMap: new Map(),
    };
    if (config.kConfig?.menu_config_file_path !== undefined) {
      mapKeyValueSet(kConfig.partMap, 'menu_config_file_path', config?.kConfig?.menu_config_file_path);
    }
    if (config.kConfig?.menu_config_build_target !== undefined) {
      mapKeyValueSet(kConfig.partMap, 'menu_config_build_target', config?.kConfig?.menu_config_build_target);
    }
    if (config.kConfig?.menu_config_core !== undefined) {
      mapKeyValueSet(kConfig.partMap, 'menu_config_core', config?.kConfig?.menu_config_core);
    }
    if (config.kConfig?.menu_config_target_path !== undefined) {
      mapKeyValueSet(kConfig.partMap, 'menu_config_target_path', config?.kConfig?.menu_config_target_path);
    }
    proIniData.push(kConfig);
  }
}

function creGui(proIniData: any, config: any): void {
  if (config?.gui) {
    const gui: ProjectIniSection = {
      partName: '[gui]',
      partMap: new Map(),
    };
    if (config?.gui?.appDir && config?.gui?.simulatorDir) {
      mapKeyValueSet(gui.partMap, 'appDir', config?.gui?.appDir);
      mapKeyValueSet(gui.partMap, 'simulatorDir', config?.gui?.simulatorDir);
    }
    if (config?.gui?.guiDir) {
      mapKeyValueSet(gui.partMap, 'guiDir', config?.gui?.guiDir);
    }
    proIniData.push(gui);
  }
}

function creMultiCore(proIniData: any, projectData: ProjectData): void {
  const multiCore: ProjectIniSection = {
    partName: '[multiCore]',
    partMap: new Map(),
  };
  if (projectData.projectNewType === 'multiCoreProject') {
    mapKeyValueSet(multiCore.partMap, 'CPU0Name', projectData.cpu0Name);
    mapKeyValueSet(multiCore.partMap, 'CPU1Name', projectData.cpu1Name);
    mapKeyValueSet(multiCore.partMap, 'CPU2Name', projectData.cpu2Name);
  }
  proIniData.push(multiCore);
}

function creAnalysis(proIniData: any, config: any): void {
  if (config.analysis) {
    const analysis: ProjectIniSection = {
      partName: '[analysis]',
      partMap: new Map(),
    };
    if (config.analysis?.elf_path !== undefined) {
      mapKeyValueSet(analysis.partMap, 'elf_path', config?.analysis?.elf_path);
    }
    if (config.analysis?.map_path !== undefined) {
      mapKeyValueSet(analysis.partMap, 'map_path', config?.analysis?.map_path);
    }
    if (config.analysis?.tool_path !== undefined) {
      let toolPath = config?.analysis?.tool_path;
      if (process.platform === 'linux') {
        toolPath = toolPath.replace(/(_win|-win)/g, '');
      }
      mapKeyValueSet(analysis.partMap, 'tool_path', toolPath);
    }
    proIniData.push(analysis);
  }
}

export async function getArmGcc(): Promise<string> {
  return new Promise(async (resolve) => {
    const paths = path.resolve(__dirname, '..', 'resources', 'getArmGcc.bat');
    const armGccBat = spawn('cmd.exe', ['/c', paths]);
    let stdout = '';
    armGccBat.stdout.on('data', (data: any) => {
      stdout += data.toString();
    });

    armGccBat.on('close', (code: number) => {
      if (code === 0) {
        const armGccPath = stdout.trim();
        const compilerDirPath = path.dirname(armGccPath);
        resolve(compilerDirPath);
      } else {
        showMessageModal({
          content: res('noArmGcc'),
          infoType: 'tips',
        });
        resolve('');
      }
    });
  });
}

function creQemuPart(proIniData: any, projectData: ProjectData, config: any): void {
  if (config.qemu) {
    let qemu: ProjectIniSection = {
      partName: '[qemu]',
      partMap: new Map(),
    };
    mapKeyValueSet(qemu.partMap, 'emulator_type', config?.qemu?.emulator_type?.[0]);
    mapKeyValueSet(qemu.partMap, 'enable_graphic', config?.qemu?.enable_graphic);
    mapKeyValueSet(qemu.partMap, 'debug_port', config?.qemu?.debug_port);
    mapKeyValueSet(qemu.partMap, 'ram_size', config?.qemu?.ram_size);
    mapKeyValueSet(qemu.partMap, 'custom_parameter', ' ');
    proIniData.push(qemu);
  }
}

export function getToolChainString(projectData: any): string {
  const config = jsonTypeGet(projectData);
  if (projectData.projectType !== 'MCU') {
    return config?.compile?.tool_chain?.[0];
  }
  const versionMdPath = path.join(projectData.sdkPath, 'Version.md');
  if (!fileAccessROk(versionMdPath)) {
    return '';
  }
  const versionString = fs.readFileSync(versionMdPath).toString().replace(/\s+/g, '').match(/Version:\S+/g)?.[0];
  if (!versionString || !versionString.startsWith('Version:SolarA2_')) {
    return config?.compile?.tool_chain?.[0];
  }
  const versionNumStr = versionString.replace('Version:SolarA2_', '');
  // 定义过滤数组
  const excludeConditions = [
    { condition: () => projectData.seriesName === '3071' },
    { condition: () => versionNumStr.startsWith('1.0.0') },
    { condition: () => versionNumStr.startsWith('1.0.1') },
  ];
  for (const condition of excludeConditions) {
    if (condition.condition()) {
      return config?.compile?.tool_chain?.[0];
    }
  }

  return 'BiSheng';
}

function creCompilePart(proIniData: any, projectData: ProjectData, config: any): void {
  // [compile] PART
  let compile: ProjectIniSection = {
    partName: '[compile]',
    partMap: new Map(),
  };
  mapKeyValueSet(compile.partMap, 'tool_chain', getToolChainString(projectData));
  mapKeyValueSet(compile.partMap, 'link_c_library_in_toolchain', 'yes');
  mapKeyValueSet(compile.partMap, 'link_c_library_in_compilationchain', 'yes');
  if (projectData.projectType === 'MCU') {
    mapKeyValueSet(compile.partMap, 'float_type', config?.compile?.float_type);
    mapKeyValueSet(compile.partMap, 'custom_build_command', `${config.compile?.custom_build_command} -d FLOAT_SUPPORT`);
  } else {
    mapKeyValueSet(compile.partMap, 'custom_build_command', `${config.compile?.custom_build_command}`);
  }
  mapKeyValueSet(compile.partMap, 'custom_clean_command', config?.compile?.custom_clean_command);
  if (projectData.projectType === 'MCU' || projectData.projectType === 'CFBB') {
    mapKeyValueSet(compile.partMap, 'map_path', config?.compile?.map_path);
  } else {
    mapKeyValueSet(compile.partMap, 'map_path', path.join(projectData.sdkPath, config?.compile?.map_path));
  }
  mapKeyValueSet(compile.partMap, 'compile_type', 'debug');
  mapKeyValueSet(compile.partMap, 'constant_type', config?.compile?.constant_type ?? 'float');
  mapKeyValueSet(compile.partMap, 'optimization', 'O0');
  mapKeyValueSet(compile.partMap, 'warning', 'yes');
  mapKeyValueSet(compile.partMap, 'werror', 'no');
  mapKeyValueSet(compile.partMap, 'wno_unused_function', 'no');
  mapKeyValueSet(compile.partMap, 'wno_unused_label', 'no');
  mapKeyValueSet(compile.partMap, 'wno_unused_parameter', 'no');
  mapKeyValueSet(compile.partMap, 'wno_unused_variable', 'no');
  mapKeyValueSet(compile.partMap, 'wno_missing_prototypes', 'no');
  mapKeyValueSet(compile.partMap, 'werr_implicit_func', 'yes');
  mapKeyValueSet(compile.partMap, 'static_library_enable', 'no');
  mapKeyValueSet(compile.partMap, 'static_library_import', 'no');
  mapKeyValueSet(compile.partMap, 'static_library_name ', '');
  mapKeyValueSet(compile.partMap, 'wno_burned_file', 'no');
  mapKeyValueSet(compile.partMap, 'burned_file_name', '[$proj]_[$date]([$time])_[macro]_([$CRC])');
  mapKeyValueSet(compile.partMap, 'static_library_dependency_header_file', '');
  mapKeyValueSet(compile.partMap, 'static_library_source_file', '');
  mapKeyValueSet(compile.partMap, 'static_library_path', '');
  mapKeyValueSet(compile.partMap, 'fstack_protector_strong', 'no');
  mapKeyValueSet(compile.partMap, 'extern_staticlib_path', '');
  mapKeyValueSet(compile.partMap, 'extern_staticlib_include', '');
  if (projectData.projectType === 'MCU') {
    mapKeyValueSet(compile.partMap, 'global_macro_definition', JSON.stringify({ FLOAT_SUPPORT: '' }));
  } else {
    mapKeyValueSet(compile.partMap, 'global_macro_definition', '');
  }
  mapKeyValueSet(compile.partMap, 'generate_crc', 'no');
  mapKeyValueSet(compile.partMap, 'generate_checksum', 'no');
  mapKeyValueSet(compile.partMap, 'generate_symboltable', 'yes');
  if (addGenerateAllinoneBin.includes(projectData?.soc)) {
    mapKeyValueSet(compile.partMap, 'generate_allinone_bin', 'yes');
  }
  mapKeyValueSet(compile.partMap, 'generate_target_hex', 'yes');
  mapKeyValueSet(compile.partMap, 'parse_elf_for_livewatch', 'no');
  mapKeyValueSet(compile.partMap, 'enable_perf', 'no');
  mapKeyValueSet(compile.partMap, 'parse_analysis_json', 'yes');
  mapKeyValueSet(compile.partMap, 'enable_build_problem', 'yes');
  mapKeyValueSet(compile.partMap, 'add_nhso_build_parameter', 'yes');
  mapKeyValueSet(compile.partMap, 'padding', 'no');

  // 3071编译参数的独特处理
  if (projectData.seriesName === '3071') {
    mapKeyValueSet(compile.partMap, 'global_macro_definition', JSON.stringify({ CHIP_3071: '' }));
    mapKeyValueSet(compile.partMap, 'link_c_library_in_toolchain', 'no');
    mapKeyValueSet(compile.partMap, 'link_c_library_in_compilationchain', 'no');
    mapKeyValueSet(compile.partMap, 'constant_type', 'double');
    mapKeyValueSet(compile.partMap, 'generate_symboltable', 'no');
    mapKeyValueSet(compile.partMap, 'optimization', 'Os');
    mapKeyValueSet(compile.partMap, 'wno_missing_prototypes', 'yes');
  }

  // FBB工程默认不打开栈分析镜像分析、性能分析、编译问题分析功能
  if (projectData.projectType === 'CFBB') {
    mapKeyValueSet(compile.partMap, 'parse_analysis_json', 'no');
    mapKeyValueSet(compile.partMap, 'enable_build_problem', 'no');
  }

  // 3322和3321默认开启nhso的编译参数
  if (projectData.board === '3322' || projectData.board === 'brandy') {
    mapKeyValueSet(compile.partMap, 'add_nhso_build_parameter', 'yes');
  }
  proIniData.push(compile);
}

export function jsonTypeGet(jsonGetParam: any): any {
  const rootPath = path.resolve(__dirname, '..');
  let chipsJsonPath = extension.isCustomIDE ? 
    path.join(rootPath, 'resources', 'chips', jsonGetParam?.boardJsonPath) :
    path.join(getResource.get(chip.config), jsonGetParam?.boardJsonPath);
  if (!fs.existsSync(chipsJsonPath) && jsonGetParam?.soc && jsonGetParam?.sdkPath) {
    if (jsonGetParam?.soc?.includes('nb')) {
      chipsJsonPath = path.join(jsonGetParam?.sdkPath, 'build', 'target_config', `${jsonGetParam?.soc}.json`);
    } else if (inTargetAndHasConfigChips.includes(jsonGetParam?.soc)) {
      chipsJsonPath = path.join(jsonGetParam?.sdkPath, 'build', 'config', 'target_config', `${jsonGetParam?.soc}.json`);
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
  let config = {};
  if (fs.existsSync(chipsJsonPath)) {
    const data = fs.readFileSync(chipsJsonPath, 'utf8');
    config = JSON.parse(data);
  }
  return config;
}

function mapKeyValueSet(
  targetMap: Map<string, string | boolean | Array<string>>,
  targetKey: string,
  targetValue: string | boolean | Array<string>
): void {
  targetMap.set(targetKey, targetValue);
}

function setConfigElement(target: any, targetKey: string, targetValue: string | boolean | Array<string> | number): void {
  if (targetValue || targetValue === false) {
    target[targetKey] = targetValue;
  }
}

export async function getLaunchToolChainBinDir(toolChain: string, jsonData?: any): Promise<string> {
  if (jsonData?.seriesName === '3071') {
    let parentPath = await getArmGcc();
    return parentPath;
  }

  if (toolChain === 'BiSheng') {
    return path.join('${command:toolsPath}', 'Windows', 'linx-llvm-binary-release-win-musl', 'bin', 'riscv32');
  } else {
    return path.join('${command:toolsPath}', 'Windows', toolChain, 'bin');
  }
}

async function getConfiguration(type: string, launchJsonData: launchJsonParam | any, projectPath: string, cpuNumber?: string): Promise<any> {
  const obj = Object.create(null);
  const config = jsonTypeGet(launchJsonData);
  // 通过调试器名称选择对应的配置下标
  let index = config?.debug?.tool?.findIndex((p: string) => p === launchJsonData?.tool);
  index = index !== -1 ? index : 0; 

  const openocdInterfaceFile = config?.debug?.params?.[index]?.param.openocd_interface_file ?? '';
  let openocdTargetFile = config?.debug?.params?.[index]?.param.openocd_target_file ?? '';
  if (openocdTargetFile && cpuNumber) {
    let dashIndex = openocdTargetFile.indexOf('-');
    if (dashIndex !== -1) {
      openocdTargetFile = openocdTargetFile.slice(0, dashIndex) + cpuNumber + openocdTargetFile.slice(dashIndex);
    }
  }
  const isSupportMultiChip = (launchJsonData.seriesName === '3066h') || (launchJsonData.seriesName === '3067m');
  if (openocdTargetFile && isSupportMultiChip && !cpuNumber) {
    let dashIndex = openocdTargetFile.indexOf('-');
    if (dashIndex !== -1) {
      openocdTargetFile = `${openocdTargetFile.slice(0, dashIndex)}0${openocdTargetFile.slice(dashIndex)}`;
    }
  }
  let openocdExe: string = 'openocd.exe';
  const hiprojPath = findHiprojFileSync(projectPath);
  const parsedData = getHiprojContent(hiprojPath ? hiprojPath : await getActiveIniPath());
  let serverArgs: any[] = [
    '-c',
    'adapter speed 5000',
    '-c',
    'gdb_port 3333',
    '-s',
    path.join('${command:toolsPath}', 'hw_openocd'),
    '-f',
    path.join('interface', openocdInterfaceFile),
    '-f',
    path.join('target', openocdTargetFile),
  ];
  if (parsedData?.upload?.flash_region !== undefined) {
    let tPath = path.join(`${'${command:toolsPath}'}`, 'hw_openocd', 'target', `${parsedData?.information?.board}.txt`);
    serverArgs.push('-p');
    serverArgs.push(tPath);
  }
  
  if (parsedData?.information?.board.includes('3071')) {
    openocdExe = 'openocd_connect.exe';
    let targetBinPath: string = config?.debug?.target_bin_path;
    serverArgs = [
      '-c',
      'adapter speed 5000',
      '-c',
      'gdb_port 3333',
      '-s',
      path.join('${command:toolsPath}', 'hw_openocd'),
      '-f',
      path.join('interface', openocdInterfaceFile),
      '-f',
      path.join('target', openocdTargetFile),
      '-b',
      targetBinPath,
    ];
  }
  
  const toolPathStr: string = path.join('${command:toolsPath}', 'hw_openocd', 'bin', '');
  let openocdExeStr: string = toolPathStr.concat('', openocdExe);
  if (config?.debug?.elf_path && openocdInterfaceFile && openocdTargetFile) {
    setConfigElement(obj, 'type', 'deveco-device-tool-debug');
    setConfigElement(obj, 'request', type);
    setConfigElement(obj, 'name', launchReqNameDir[type]);
    setConfigElement(obj, 'debugInitPath', '${workspaceFolder}/.vscode');
    setConfigElement(obj, 'servertype', `openocd(${launchJsonData.tool})`);
    setConfigElement(obj, 'executable', config?.debug?.elf_path);
    const toolchainBin = await getLaunchToolChainBinDir(launchJsonData.toolChain, launchJsonData);
    setConfigElement(obj, 'toolchainBinDir', toolchainBin); 
    setConfigElement(obj, 'internalConsoleOptions', 'openOnSessionStart');
    setConfigElement(obj, 'serverpath', openocdExeStr);
    setConfigElement(obj, 'serverArgs', serverArgs);
    if (!parsedData?.information?.board.includes('3071') && type === 'launch') {
      if (parsedData?.upload?.loadFiles && parsedData?.upload?.flash_region) {
        let fileHeadName: string = 'PART_MAIN_RGN';
        let uploadStart = parsedData?.upload?.editAddress ? parsedData.upload.editAddress : parsedData?.upload?.address;
        let seriesName: string = parsedData?.information?.series_name.toUpperCase();
        let loadFiles: any[] = [
          parsedData?.upload?.bin_path,
          path.join('${command:toolsPath}', 'hw_openocd', 'bin', 'burn_flash_algo', 'online_burn', `CHIP_${seriesName}`, fileHeadName, 'FlashAlgo.elf'),
          uploadStart,
        ];
        setConfigElement(obj, 'loadFiles', loadFiles);
      }
    }
    if (!openocdExeArr.includes(launchJsonData.soc)) {
      setConfigElement(
        obj,
        'svdFile',
        path.join('${command:projectWizardExtensionPath}', 'resources', 'debug', 'svd', `${launchJsonData.soc}.svd`)
      );
    }
    return obj;
  } else {
    return false;
  }
}

function getFbbActiveHiprojectPath(projectPath: string): string {
  let hiProjectPath: any;
  let isActiveProjectFound = false;
  const storageDir = path.dirname(getExtensionContext().globalStorageUri.fsPath);
  const cachePath = path.join(storageDir, 'projectdata.json');
  checkProjectDataJsonExists();
  const projectDataContent = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  for (const item of projectDataContent) {
    if (item.SDK === projectPath && item.active) {
      hiProjectPath = item.active;
      isActiveProjectFound = true;
      break;
    }
  }
  if (!isActiveProjectFound) {
    hiProjectPath = findHiprojFileSync(projectPath);
  }
  return hiProjectPath;
}

function getMultiCoreJlinkScriptPath(obj: any, hiprojContent: any, multiCoreValue: string,
  isMasterCore: boolean): void {
  let pathStr = '';
  if (isMasterCore) {
    pathStr = hiprojContent?.debug?.jlinkScriptPath;
  } else {
    pathStr = hiprojContent?.debug?.new_jlinkScript_Path;
  }
  if (multiCoreValue !== 'singleMultiCoreDebugMode') {
    pathStr = hiprojContent?.debug?.jlinkScriptPath;
  }
  const noGuiArg = hiprojContent.information?.board?.includes('3322');
  setConfigElement(obj, 'serverArgs', [
    '-singlerun',
    ...(noGuiArg ? [] : ['-nogui']),
    '-if',
    'swd',
    '-port',
    '3333',
    '-swoport',
    '50001',
    '-telnetport',
    '50002',
    '-device',
    'RISC-V',
    '-jlinkscriptfile',
    pathStr,
  ]);
}

function creaMultiConfigLaunchJsonFile(configuration:any, modeArr:launchJsonConfig[]): void {
  let type = 'launch';
  if (modeArr[0].name.includes('Launch')) {
    type = 'GDB Launch';
  }
  if (modeArr[0].name.includes('Attach')) {
    type = 'GDB Attach';
  }
  let len = modeArr.length;
  setConfigElement(configuration, 'name', `${type}(multicore)`);
  setConfigElement(configuration, 'executable', modeArr[1].value);
  if (modeArr[1].name.includes('Pcore')) {
    setConfigElement(configuration, 'runToEntryPoint', 'pcore_main');
  }
  if (modeArr[1].name.includes('Acore')) {
    setConfigElement(configuration, 'runToEntryPoint', 'acore_main');
  }
  const obj = Object.create(null);
  setConfigElement(obj, 'enabled', true);
  setConfigElement(obj, 'waitOnEvent', 'postInit');
  setConfigElement(obj, 'detached', true);
  setConfigElement(obj, 'delayMs', 5000); // 5秒后启动其余核调试
  setConfigElement(obj, 'lifecycleManagedByParent', true);
  let arr:any[] = [];
  for (let index = 0; index < len - 1; index++) {
    const objIndex = Object.create(null);
    setConfigElement(objIndex, 'name', modeArr[index].name);
    setConfigElement(objIndex, 'folder', '${workspaceFolder}');
    arr.push(objIndex);
  }
  setConfigElement(obj, 'launches', arr);
  setConfigElement(configuration, 'chainedConfigurations', obj);
}

export async function creCfbbLaunchJsonFile(chipConfig: launchJsonParam, projectPath: string, multiCoreValue: string, isOpenProj?: boolean): Promise<boolean> {
  modeLaunchArr = [];
  modeAttachArr = [];
  const filePath = path.join(projectPath, '.vscode');
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(filePath);
  }
  const config = jsonTypeGet(chipConfig);
  let elfPathValue = config?.debug?.elf_path;
  if (isOpenProj) {
    const hiprojPath = await getActiveIniPath();
    const content = fs.readFileSync(hiprojPath, 'utf-8');
    const parsedData = ini.parse(content);
    elfPathValue = parsedData.debug.elf_path;
  }
  let configurations = [];
  let hiProjectPath = getFbbActiveHiprojectPath(projectPath);
  let hiprojContent = ini.parse(fs.readFileSync(hiProjectPath).toString());
  if (config?.debug?.arg && typeof config.debug.arg === 'object' && !Array.isArray(config.debug.arg)) {
    for (const [key, value] of Object.entries(config.debug.arg)) {
      let configValue: launchJsonConfig = {
        name: '',
        value: '',
      };
      configValue.name = key;
      configValue.value = value as string;
      let type = 'launch';
      if (key.includes('Launch')) {
        type = 'launch';
      }
      if (key.includes('Attach')) {
        type = 'attach';
      }

      const configuration = await getCfbbConfiguration(type, projectPath, chipConfig.toolChain);
      setConfigElement(configuration, 'name', key);
      if (type === 'launch') {
        modeLaunchArr.push(configValue);
      } else {
        modeAttachArr.push(configValue);
      }
      setConfigElement(configuration, 'executable', value as string);
      if ((multiCoreValue === 'multiProjectMultiCoreDebugMode')) {
        setConfigElement(configuration, 'multi_core', true);
      }

      if (key.includes('Pcore')) {
        getMultiCoreJlinkScriptPath(configuration, hiprojContent, multiCoreValue, true);
        setConfigElement(configuration, 'runToEntryPoint', 'pcore_main');
      }
      if (key.includes('Acore')) {
        getMultiCoreJlinkScriptPath(configuration, hiprojContent, multiCoreValue, false);
        setConfigElement(configuration, 'runToEntryPoint', 'acore_main');
      }

      configurations.push(configuration);
    }
    if (multiCoreValue !== undefined && multiCoreValue === 'singleMultiCoreDebugMode') { // 需要区分多核的模式，防止后续的接口访问异常数据
      const launchConfiguration = await getCfbbConfiguration('launch', projectPath, chipConfig.toolChain);
      const attachConfiguration = await getCfbbConfiguration('attach', projectPath, chipConfig.toolChain);
      creaMultiConfigLaunchJsonFile(launchConfiguration, modeLaunchArr);
      creaMultiConfigLaunchJsonFile(attachConfiguration, modeAttachArr);
      configurations.push(launchConfiguration);
      configurations.push(attachConfiguration);
    }
  } else {
    const configurationLaunch = await getCfbbConfiguration('launch', projectPath, chipConfig.toolChain);
    setConfigElement(configurationLaunch, 'name', launchReqNameDir?.launch);
    setConfigElement(configurationLaunch, 'executable', elfPathValue);

    if (config?.debug?.entry_point) {
      setConfigElement(configurationLaunch, 'runToEntryPoint', config?.debug?.entry_point);
    } else {
      setConfigElement(configurationLaunch, 'runToEntryPoint', 'main');
    }

    const configurationAttach = await getCfbbConfiguration('attach', projectPath, chipConfig.toolChain);
    setConfigElement(configurationAttach, 'name', launchReqNameDir?.attach);
    setConfigElement(configurationAttach, 'executable', elfPathValue);

    configurations = [configurationLaunch, configurationAttach];
  }
  const finallyDone = writeWithcheckRight(
    path.join(filePath, 'launch.json'),
    JSON.stringify({ configurations }, null, 4),
    {
      unExpectModal: modalType.launchJsonUnExpectErrW,
      wErrModal: modalType.launchJsonNoRightToW,
    }
  );
  return finallyDone;
}

async function getCfbbConfiguration(type: string, projectPath: string, toolChain: string): Promise<any> {
  const obj = Object.create(null);
  let hiProjectPath = getFbbActiveHiprojectPath(projectPath);
  let hiprojContent = getHiprojContent(hiProjectPath);
  const noGuiArg = hiprojContent.information?.board?.includes('3322');

  setConfigElement(obj, 'type', 'deveco-device-tool-debug');
  setConfigElement(obj, 'request', type);
  setConfigElement(obj, 'debugInitPath', '${workspaceFolder}/.vscode');
  setConfigElement(obj, 'servertype', 'jlink');
  setConfigElement(obj, 'toolchainBinDir', await getLaunchToolChainBinDir(toolChain));
  setConfigElement(obj, 'internalConsoleOptions', 'openOnSessionStart');
  if (hiprojContent.debug.tool !== 'jlink') {
    setConfigElement(obj, 'servertype', `openocd(${hiprojContent.debug.tool})`);
    let chipType: string = hiprojContent.information['board_build.mcu'];
    if (hiprojContent.information.board.includes('nb')) {
      if (hiprojContent.debug.elf_path.includes('protocol')) {
        chipType = 'nb18-pcore';
      } else {
        chipType = 'nb18-acore';
      }
    }
    setConfigElement(obj, 'serverArgs', [
      '-c', `adapter speed ${hiprojContent.debug.speed}`,
      '-c', 'gdb_port 3333',
      '-s', path.join('${command:toolsPath}', 'hw_openocd'),
      '-f', `${getOpenOcdDebugInterface(hiprojContent.debug.interface, hiprojContent.debug.tool, hiprojContent.information.series_name)}`,
      '-f', `${getTarget(hiprojContent.debug.interface, chipType)}`,
    ]);
    setConfigElement(obj, 'serverpath', path.join('${command:toolsPath}', 'hw_openocd', 'bin', 'openocd_connect.exe'));
  } else {
    setConfigElement(obj, 'serverArgs', [
      '-singlerun',
      ...(noGuiArg ? [] : ['-nogui']),
      '-if',
      'swd',
      '-port',
      '3333',
      '-swoport',
      '50001',
      '-telnetport',
      '50002',
      '-device',
      'RISC-V',
      '-jlinkscriptfile',
      hiprojContent?.debug?.jlinkScriptPath,
    ]);

    if (hiprojContent?.debug?.jlinkServerPath) {
      setConfigElement(obj, 'serverpath', hiprojContent?.debug?.jlinkServerPath);
    }
  }

  return obj;
}
