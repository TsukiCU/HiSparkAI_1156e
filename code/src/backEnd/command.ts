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
import { extension } from '../extension';
import * as ini from 'ini';
import { spawn } from 'child_process';
import type {
  Log4jsMessage,
  ConfigMessage,
  SetMockLocalStorageMessage,
  SetMockLocalStorageCallbackMessage,
  GetMockLocalStorageMessage,
  GetMockLocalStorageCallbackMessage,
  Message,
  FrontEndConfigMessage,
  CommandMsg,
  GetHistoryCallbackMessage,
  GetResultHistoryCallbackMessage,
  UserGuideWebsiteCallbackMessage,
  ReleaseCallbackMessage,
} from './interface/api';
import type { Target } from './panels/panel';
import { ApiMethod } from './interface/apiMethod';
import { logger } from './log4js';
import { deepCopy, timestampToDateTime, arrayToObject } from '@src/frontEnd/util';
import * as path from 'path';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as os from 'os';
import { getUserGuidePath } from './file/modelConfig';
import { PanelType } from '@src/backEnd/interface/model';
import type { HistoryInfo, Release } from '@src/backEnd/interface/model';
import { GlobalModel, remoteRootDir, DEFAULT_WSL_DISTRO, remotePython, getRemotePython, LAST_SELECTED_PATH } from './storage/Global';
import { CHIP_CONFIG } from './storage/ChipConfigMap';
import type { ChipName } from './storage/ChipConfigMap';

import { res } from '@src/i18n/backEndTrans';
import * as common from './common';
import { pickerType, Source } from './types';
import { OutputChannelManager } from './output/channelManager';
import { Logger } from './output/outputLogger';
import { QuantContext, ConvertContext } from './context/TaskContext';
import { RemoteHeartbeatWatcher } from './watchers/RemoteHeartbeatWatcher';
import { SerialPortWatcher } from './watchers/SerialPortWatcher';
import { LocalIpWatcher } from './watchers/LocalIpWatcher';
import { extractTarFile } from './utils/downloadToolChains';

/**
 * deal with requests from webview
 */
// 文件大小限制
const MAX_FILE_SIZE = 256 * 1024 * 1024;

interface GenerateOptions {
  compBase?: any[];
  convBase?: any[];
  persist?: boolean; // whether save to localStorage.
};

interface exeCmdRetType {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export class Command {
  // Logger in output channel by the name of 'HiSpark Studio AI'.
  private static readonly channelName = 'HiSpark Studio AI';
  private static readonly outputLogger = new Logger(OutputChannelManager.get(this.channelName));

  private static readonly defaultQuantItems = {
    page: 'quant',
    group: 'Quantization',
    disabled: false,
  } as const;

  private static readonly defaultConvertItems = {
    page: 'convert',
    group: 'Convert',
    disabled: false,
  } as const;

  private static readonly npuBaseQuantItems = { ...this.defaultQuantItems, target: 'npu', type: 'ptq' } as const;
  private static readonly cpuBaseQuantItems = { ...this.defaultQuantItems, target: 'cpu' } as const;

  // Process tracking — one variable per feature, no sharing.
  private static quantChildProcess: any = null;
  private static quantAbortRequested = false;
  private static quantSource: Source | null = null;
  private static quantPidFilePath = '/tmp/hispark_quant.pid';

  private static convertChildProcess: any = null;
  private static wslConvertChildProcess: any = null;
  private static convertAbortRequested = false;
  private static convertSource: Source | null = null;
  private static convertPidFilePath = '/tmp/hispark_convert.pid';

  private static profilingChildProcess: any = null;
  private static flashChildProcess: any = null;
  private static buildChildProcess: any = null;
  private static buildChip: ChipName = 'NONE'; // tracks which chip is currently building.

  // 1156e remote build constants.
  private static readonly BUILD_1156E_PID_FILE = '/tmp/hispark_1156e_build.pid';
  private static readonly BUILD_1156E_FILES_TO_CHECK = [
    'hi_uboot_origin.bin', 'hi_esbc.bin', 'hi_uboot.bin', 'kernel.images', 'rootfs.rw.img',
  ];

  private static readonly npuBaseConvertItems = { ...this.defaultConvertItems, target: 'npu' } as const;
  private static readonly cpuBaseConvertItems = { ...this.defaultConvertItems, target: 'cpu' } as const;

  // Command library from Remote Build Extension.
  private static remoteCmdLib = {
    revealCmd: 'remoteBuild.revealOutput', // Reveal 'Remote Build' output panel.
    connectCmd: 'remoteBuild.connectLite', // Connect to remote server.
    browseFileCmd: 'remoteBuild.api.browseRemoteFile', // Select a file on remote server.
    browseDirCmd: 'remoteBuild.api.browseRemoteDirectory', // Select a folder on remote server.
    uploadCmd: 'remoteBuild.api.uploadFile', // Upload a file to remote server.
    uploadMultiCmd: 'remoteBuild.api.uploadFiles', // Upload a folder to remote server.
    downloadCmd: 'remoteBuild.api.downloadFile', // Download a file from remote server.
    downloadMultiCmd: 'remoteBuild.api.downloadFiles', // Download a folder from remote server.
    executeCmd: 'remoteBuild.api.executeCommand', // Execute a command on remote server.
    silentExecuteCmd: 'remoteBuild.executeCommandSilent', // Execute commands but print no output.
  };

  static setLog4jsMessage(log4jsMessage: Log4jsMessage): void {
    const { level, data } = log4jsMessage.params.log4jsData;
    logger[level](data);
  }

  static setMockLocalStorage(message: SetMockLocalStorageMessage): void {
    const { key, value, panelType } = message.params.data;
    let ret;
    ret = extension.mockLocalStorage?.setItem(key, value);
    if (ret === undefined) {
      ret = false;
    }
    const setMockLocalStorageCallbackMessage: SetMockLocalStorageCallbackMessage = {
      method: ApiMethod.SET_MOCKLOCALSTORAGE_CALLBACK,
      params: {
        data: ret,
      },
    };
    if (panelType === PanelType.CHIPCONFIG) {
      extension.chipConfigPanel?.postMessage(setMockLocalStorageCallbackMessage);
    }
  }

  static isValidRemoteHome(input: string): boolean {
    if (!input) {
      return false;
    }

    // Shell meta characters not allowed.
    if (/[;&|`$<>]/.test(input)) {
      return false;
    }

    // '../' not allowed.
    const normalized = path.posix.normalize(input);

    // Valid remoteHome is either '/root' or '/home/username'
    const allowedHomeBase = '/root';
    const allowedRootBase = '/home';
    return normalized.startsWith(allowedHomeBase) || normalized.startsWith(allowedRootBase);
  }

  static parseModelPath(remoteModel: string, delimiter: any): any {
    if (!remoteModel) {
      return { modelName: null, modelEndsWith: null };
    }

    const last = remoteModel.split(delimiter).pop() ?? '';
    const parts = last.split('.');

    if (parts.length < 2) {
      return { modelName: null, modelEndsWith: null };
    }

    const modelEndsWith = (parts.pop() ?? '').toLowerCase();
    const modelName = parts.join('.');

    return { modelName, modelEndsWith };
  }

  static getMockLocalStorage(message: GetMockLocalStorageMessage): void {
    const { key, panelType: panelType } = message.params.data;
    const ret = extension.mockLocalStorage?.getItem(key);
    if (ret === undefined) {
      logger.info('后端获取key值失败');
    }
    const getMockLocalStorageCallbackmessage: GetMockLocalStorageCallbackMessage = {
      method: ApiMethod.GET_MOCKLOCALSTORAGE_CALLBACK,
      params: {
        data: ret,
      },
    };
    if (panelType === PanelType.CHIPCONFIG) {
      extension.chipConfigPanel?.postMessage(getMockLocalStorageCallbackmessage);
    }
  }

  static async uploadScripts(target: Target, folder: string, rootDir: any): Promise<void> {
    const remoteHome = GlobalModel.instance?.remoteHome;
    if (!remoteHome) { return; } // unlikely

    // Check if stage is valid.
    const validStages = ['model_select', 'quant', 'convert', 'common'];
    if (!validStages.includes(folder)) { return; } // unlikely.

    const localFolder = path.join(__dirname, `../resources/scripts/${target.toLowerCase()}/${folder}`);
    const remoteFolder = `${remoteHome}/${rootDir}/scripts/${folder}`;

    try {
      await vscode.commands.executeCommand(this.remoteCmdLib.uploadMultiCmd, localFolder, remoteFolder);
    } catch (err) {
      throw new Error(`Failed to upload scripts: ${folder}`);
    }
  }

  static updateConfigItems(target: Target, inputs: any[], options: GenerateOptions = {}): {
    compMerged?: any[];
    convMerged?: any[];
  } {
    const dispatchByPlatform = {
      NONE: () => ({}),
      NPU: this.mergeNpuItems.bind(this),
      CPU: this.mergeCpuItems.bind(this),
    } as const;

    return dispatchByPlatform[target](inputs, options);
  }

  static mergeNpuItems(inputs: any[], options: GenerateOptions = {}): {
    compMerged?: any[];
    convMerged?: any[];
  } {
    const { compBase, convBase, persist = true } = options;

    let compMerged: any[] | undefined;
    let convMerged: any[] | undefined;
    const compNewItems: any[] = [];
    const convNewItems: any[] = [];

    for (let i = 0; i < inputs.length; i++) {
      const x = i + 1;
      const shapeStr = String(inputs[i]?.Shape ?? '');
      const nameStr = String(inputs[i]?.Name ?? '');
      const convertStr = String(inputs[i].SupportConvertType ?? '');
      const dataTypeStr = String(inputs[i]?.DataType.toLowerCase() ?? '');
      const convertTypes = common.parseToLowerArray(convertStr);

      // Create a new item.
      const createQuantItem = (item: any): any => compNewItems.push({ ...this.npuBaseQuantItems, ...item });
      const createConvertItem = (item: any): any => convNewItems.push({ ...this.npuBaseConvertItems, ...item });

      // ************** Quant **************
      // 1) cali_input_namex
      createQuantItem({
        kind: 'file',
        key: `${nameStr}/${x}`,
        title: nameStr,
        content: ' ',
        defaultValue: ' ',
        folder: true,
      });

      // 2) shapex —— based on Inputs[i].Shape
      createQuantItem({
        kind: 'input',
        key: `npu_quant_shape${x}`,
        title: '',
        content: [shapeStr],
        defaultValue: shapeStr,
      });

      // 3) typex
      createQuantItem({
        kind: 'select',
        key: `npu_quant_type${x}`,
        title: '',
        content: [dataTypeStr],
        defaultValue: 'float32',
      });

      // 4) validation_inputx
      createQuantItem({
        kind: 'file',
        key: `validation_input${x}`,
        title: nameStr,
        content: ' ',
        defaultValue: ' ',
        folder: true,
      });

      // ************** Convert **************
      createConvertItem({
        kind: 'input',
        key: `${nameStr}/${x}`,
        title: nameStr,
        content: [shapeStr],
        defaultValue: shapeStr,
      });

      createConvertItem({
        kind: 'select',
        key: `npu_convert_type${x}`,
        title: '',
        content: convertTypes,
        defaultValue: 'float16',
      });
    }

    if (compBase) {
      compMerged = [...compBase, ...compNewItems];
      if (persist) {
        extension.mockLocalStorage?.setItem('compressionData', compMerged);
      }
    }

    if (convBase) {
      convMerged = [...convBase, ...convNewItems];
      if (persist) {
        extension.mockLocalStorage?.setItem('convertData', convMerged);
      }
    }

    return { compMerged, convMerged };
  }

  static mergeCpuItems(inputs: any[], options: GenerateOptions = {}): {
    compMerged?: any[];
    convMerged?: any[];
  } {
    const { compBase, convBase, persist = true } = options;

    // Create a new item.
    const createQuantItem = (item: any): any => compNewItems.push({ ...this.cpuBaseQuantItems, ...item });
    const createConvertItem = (item: any): any => convNewItems.push({ ...this.cpuBaseConvertItems, ...item });

    let compMerged: any[] | undefined;
    let convMerged: any[] | undefined;
    const compNewItems: any[] = [];
    const convNewItems: any[] = [];
    const TYPE_OPTIONS = ['float32'];

    for (let i = 0; i < inputs.length; i++) {
      const x = i + 1;
      const shapeStr = String(inputs[i]?.Shape ?? '');
      const nameStr = String(inputs[i]?.Name ?? '');

      // ************** CPU Quantization **************
      // 1) validation input.
      createQuantItem({
        kind: 'file',
        key: `${nameStr}/${x}`,
        title: nameStr,
        content: ' ',
        defaultValue: ' ',
        folder: true,
      });

      // 2) cali_input_shapeX —— based on Inputs[i].Shape
      createQuantItem({
        kind: 'input',
        key: `cali_input_shape${x}`,
        title: '',
        content: [shapeStr],
        defaultValue: shapeStr,
      });

      // 3) validation output.
      createQuantItem({
        kind: 'file',
        key: `validation_input${x}`,
        title: nameStr,
        content: ' ',
        defaultValue: ' ',
        folder: true,
      });

      // ************** CPU Convert **************
      createConvertItem({
        kind: 'input',
        key: `input_name${x}`,
        title: nameStr,
        content: [shapeStr],
        defaultValue: shapeStr,
      });

      createConvertItem({
        kind: 'select',
        key: `npu_convert_type${x}`,
        title: '',
        content: TYPE_OPTIONS,
        defaultValue: 'float32',
      });
    }

    if (compBase) {
      compMerged = [...compBase, ...compNewItems];
      if (persist) {
        extension.mockLocalStorage?.setItem('compressionData', compMerged);
      }
    }

    if (convBase) {
      convMerged = [...convBase, ...convNewItems];
      if (persist) {
        extension.mockLocalStorage?.setItem('convertData', convMerged);
      }
    }

    return { compMerged, convMerged };
  }

  static generateConfigDataJson(filePath: any, name: string): void {
    // 生成配置文件
    const quantConfigPath = path.join(filePath, 'nowConfig.json');
    let layerConfigData = [];
    let configData = [];
    if (!fs.existsSync(quantConfigPath)) {
      logger.info(`${name} history config not found.`);
    } else {
      const files: any = fs.readFileSync(quantConfigPath, 'utf8');
      try {
        configData = JSON.parse(files);
      } catch (err) {
        this.logAndReportError(`${name} history config parse error: ${this.handleError(err)}`);
        return;
      }
    }
    if (name === 'compressionData' && configData.length > 0) {
      const quantLayerConfigPath = path.join(filePath, 'nowLayerConfig.json');
      // 获取advanced状态
      if (!fs.existsSync(quantLayerConfigPath)) {
        logger.info(`LayerConfig history config not found.`); // 历史模型不打印
      } else {
        const files: any = fs.readFileSync(quantLayerConfigPath, 'utf8');
        try {
          layerConfigData = JSON.parse(files);
        } catch (err) {
          this.logAndReportError(`LayerConfig history config parse error: ${this.handleError(err)}`);
          return;
        }
      }
    }
    let config = [{ key: name, value: configData }];
    if (configData.length === 0) {
      // 没有配置时 直接返回  不读取存的配置  否则读取配置失败 读取初始配置
      let nowData = common.parseArray(extension.mockLocalStorage?.getItem(name)) || [];
      // 修改pt模型linux切wsl初始数据未清除
      nowData = nowData.map(item => {
        if (item.kind === 'file') {
          return {
            ...item,
            content: ' ',
          };
        }
        return item;
      });
      extension.mockLocalStorage?.setItem(name, JSON.stringify(nowData));
      config = [
        { key: name, value: nowData },
      ];
    }
    if (name === 'compressionData') {
      config = [
        ...config,
        { key: 'layerwiseData', value: layerConfigData },
      ];
    }
    const frontEndConfigCallbackMessage: ConfigMessage = {
      method: ApiMethod.SAVE_CONFIG_CALLBACK,
      params: { config },
    };
    extension.chipConfigPanel?.postMessage(frontEndConfigCallbackMessage);
  }

  static async prepareQATNetStructLinux(): Promise<void> {
    const target = 'NPU';
    await this.uploadScripts(target, 'quant', remoteRootDir);
    await this.uploadScripts(target, 'common', remoteRootDir);
  }

  static async checkNetStruct(input: string, source: Source): Promise<boolean> {
    // Basic check for the uploaded python file. Not implemented for now.
    if (source !== 'linux' && source !== 'wsl') { return false; }

    return true;
  }

  static async showNetStruct(msg: any): Promise<void> {
    const input = msg.params?.input ?? '';
    const source = GlobalModel.instance?.source;
    const dateTime = Date.now();
    const historyRootDir = GlobalModel.instance?.aiCacheDir;
    if (!historyRootDir || !source) { return; } // unlikely
    const tempDir = path.join(historyRootDir, 'tmp');
    if (!fs.existsSync(tempDir)) { fs.mkdirSync(tempDir, { recursive: true }); }

    if (!await this.checkNetStruct(input, source)) {
      common.showErrorOnce('Must upload a python file.');
      return;
    }

    // Write model_parser_validation.json.
    extension.mockLocalStorage?.setItem('lastQuantTS', dateTime);
    const realLinuxCache = source === 'wsl' ? await this.convertPathIfNeeded(tempDir, 'wsl') : `${remoteRootDir}/.cache/ai/temp`;
    const realInputPyPath = await this.convertPathIfNeeded(input, source);
    const netStructInfo = {
      networkStructure: realInputPyPath,
      tools: { linuxCache: realLinuxCache },
    };
    const jsonDir = path.join(historyRootDir, 'Json');
    if (!fs.existsSync(jsonDir)) { fs.mkdirSync(jsonDir, { recursive: true }); }
    const localJsonPath = path.join(jsonDir, 'model_parser_validation.json');
    fs.writeFileSync(localJsonPath, JSON.stringify(netStructInfo, null, 2), 'utf-8');

    // Run model_arch_parse_torch.py
    if (source === 'linux') {
      await this.prepareQATNetStructLinux();
      await vscode.commands.executeCommand(this.remoteCmdLib.uploadCmd, localJsonPath, `${realLinuxCache}/model_parser_validation.json`);

      const python = remotePython.NPU; // This should only occur on NPU.
      const remoteJsonPath = `${realLinuxCache}/model_parser_validation.json`;
      const scriptLinux = `${remoteRootDir}/scripts/quant/model_arch_parse_torch.py`;
      const parseCmd = `${python} ${scriptLinux} --input_json '${remoteJsonPath.replace(/'/g, `'\\''`)}'`;
      try {
        await vscode.commands.executeCommand(this.remoteCmdLib.executeCmd, parseCmd);
      } catch (err) {
        this.logAndReportError(`Failed to execute ${parseCmd} on the remote server : ${this.handleError(err)}`);
        return;
      };

      // Get results.
      try {
        const remoteResultPath = `${realLinuxCache}/layerwise_config.json`;
        const localResultPath = path.join(historyRootDir, 'tmp', 'layerwise_config.json');
        await vscode.commands.executeCommand(this.remoteCmdLib.downloadCmd, remoteResultPath, localResultPath);
      } catch (err) {
        this.logAndReportError(`Failed to download layerwise_config.json due to : ${this.handleError(err)}`);
      }
    } else {
      const wslDistro = GlobalModel.instance?.wslDistro ?? '';
      const wslPython = await this.getWSLPython(wslDistro);
      let quantJsonPath = path.join(__dirname, '../resources/scripts/npu/quant/model_parser_validation.json');

      const scriptWin = path.join(__dirname, '../resources/scripts/npu/quant/model_arch_parse_torch.py');
      const scriptWsl = await common.winToLinuxPathForWsl(wslDistro, scriptWin, common.exeRunner);
      const quantJsonWsl = await common.winToLinuxPathForWsl(wslDistro, quantJsonPath, common.exeRunner);
      if (!scriptWsl || !quantJsonWsl) {
        throw new Error(`Failed to network paths.`);
      }

      const wslJsonPath = await this.convertPathIfNeeded(localJsonPath, 'wsl');
      const cmd = `${wslPython} ${common.shQuote(scriptWsl)} --input_json ${wslJsonPath}`;
      this.outputLogger.info(`Start running ${cmd}`);
      const ret = await common.exeRunner({
        exe: 'wsl.exe',
        args: ['-d', wslDistro, '--', 'bash', '-lc', cmd],
        mode: 'utf8',
        logger: this.outputLogger,
        python: true,
      });
    }

    // update layerwise config.
    const layerWiseConfigJsonPath = path.join(tempDir, 'layerwise_config.json');
    const layerWiseItem = await this.setLayerWiseFromJsonFile(layerWiseConfigJsonPath);
    const config = [{ key: 'layerwiseData', value: layerWiseItem }];
    extension.chipConfigPanel?.postMessage({ method: ApiMethod.SAVE_CONFIG_CALLBACK, params: { config: config } });
  }

  static getCompressDataConfigInfo(msg: any): void {
    const params = (msg?.params && typeof msg.params === 'object') ? msg.params : {};
    const { timeStamp = '', target = '', nextPage = '', activeTab = '', preUUId = '' } = params;
    const historyRootDir: any = GlobalModel.instance.aiCacheDir;
    if (nextPage === '../deploy') {
      // 执行convert 生成图
      const time = timeStamp !== '' ? timeStamp : extension.mockLocalStorage?.getItem('lastConvertTS');
      const localDir = path.join(historyRootDir, `Convert/convert_${timeStamp}`);
      // 清空初始图
      this.updateChart({}, 'convert', ApiMethod.UPDATE_CONSTARK);
      const lastQuantTS = extension.mockLocalStorage?.getItem('lastQuantTS');
      let fileData;
      if (target === 'NPU') {
        const filePath = `${localDir}/convertOutput.json`;
        if (!fs.existsSync(filePath)) {
          return;
        }
        try {
          // 读取并解析convertOutput.json文件
          const convertFileStr = fs.readFileSync(filePath, 'utf8');
          const convertJsonData = JSON.parse(convertFileStr);

          // 处理hasUnsupportedParams（不可修改的参数）
          const unsupportedParams = convertJsonData.hasUnsupportedParams || [];
          if (Array.isArray(unsupportedParams) && unsupportedParams.length > 0) {
            this.showWarnToast(`检测到您输入了不可被修改的参数：${unsupportedParams.join('、')}，请注意参数有效性`);
          }

          // 处理hasConflictedUIParams（与UI配置冲突的参数）
          const conflictedParams = convertJsonData.hasConflictedUIParams || [];
          if (Array.isArray(conflictedParams) && conflictedParams.length > 0) {
            this.showWarnToast(`检测到您输入的参数${conflictedParams.join('、')}已在UI界面配置，输入值将覆盖UI配置值，可能引发参数冲突问题`);
          }
        } catch (e) {
          this.logAndReportError(`解析convertOutput.json参数校验字段失败：${e}`);
        }
        const exeomFile = path.join(localDir, 'convert.exeom');
        const dbgFile = path.join(localDir, 'convert.dbg');
        fileData = {
          type: 'fileSize',
          exeomSize: this.getFileSizeInKB(exeomFile),
          dbgSize: this.getFileSizeInKB(dbgFile),
        };
      } else {
        // 2. target platform is CPU → analyze ram and flash from json files.
        const filePathCPU = `${localDir}/convert_plot.json`;
        if (!fs.existsSync(filePathCPU)) {
          return;
        }
        const fileString = fs.readFileSync(filePathCPU, 'utf8');
        const jsonData = JSON.parse(fileString);
        fileData = {
          ...jsonData,
          type: 'ramFlash',
        };
      }
      // 确保 preUUId 是可转为数字的
      if (preUUId == null) {
        return;
      }

      const preUUIdNum = Number(preUUId);
      if (isNaN(preUUIdNum)) {
        return;
      }

      const lastQuantTSNum = parseInt(lastQuantTS, 10);
      if (isNaN(lastQuantTSNum)) {
        return;
      }
      // All set. Notify front end to update the plot area.
      if (lastQuantTSNum === preUUIdNum) {
        this.generateConfigDataJson(localDir, 'convertData');
        this.updateChart(fileData, 'convert', ApiMethod.UPDATE_CONSTARK);
      }
      return;
    }
    const quantTime = timeStamp !== '' ? timeStamp : extension.mockLocalStorage?.getItem('lastQuantTS');
    const localDirQuant = target === 'CPU'
      ? path.join(historyRootDir, `Quant/quant_${quantTime}`)
      : path.join(historyRootDir, `Quant/quant_${quantTime}/${activeTab.toLowerCase()}`);
    let fileNameQuant;
    if (target === 'CPU') {
      fileNameQuant = path.join(localDirQuant, 'quant_plot.json');
    } else {
      fileNameQuant = path.join(localDirQuant, activeTab === 'QAT' ? 'quantQatOutput.json' : 'precision_output.json');
    }
    this.generateConfigDataJson(localDirQuant, 'compressionData');
    const stage = nextPage === 'none' ? 'profiling' : 'compression';
    if (!fs.existsSync(fileNameQuant)) {
      this.updateChart([], stage, ApiMethod.UPDATE_HISGRAPH);
      return;
    }
    // 重新生成compression及profiling的图
    try {
      const { fileData } = this.profParseResults({
        filePath: fileNameQuant,
        listUpdateStatus: true,
      });
      const normalizedData = this.normalizePercentageToDecimal(fileData);
      this.updateChart(normalizedData, stage, ApiMethod.UPDATE_HISGRAPH);
    } catch (err) {
      this.logAndReportError(`importHisGraph failed : ${this.handleError(err)}`);
    }
  }

  static updateChart(fileData: any, stage: string, method: any): void {
    const hisGraphMsg: FrontEndConfigMessage = {
      method,
      params: {
        data: { fileData, stage },
      },
    };
    extension.chipConfigPanel?.postMessage(hisGraphMsg);
  }

  static generateConfig(target: Target, ext: any, mode: 'full' | 'lite', connect?: boolean): string | undefined {
    if (mode === 'full') {
      return this.generateConfigFull(target, ext, connect);
    }
    return this.generateConfigLite();
  }

  static generateConfigLite(): string | undefined {
    const historyRootDir = GlobalModel.instance.aiCacheDir;
    if (!historyRootDir) { return 'History folder.'; } // History folder exist as verified previously.
    const parsedModel = path.join(historyRootDir, '/selectmodel/parsedModel.json');
    if (!fs.existsSync(parsedModel)) { return 'ParsedModel.json not found!'; }

    const rawData = fs.readFileSync(parsedModel, 'utf8');
    const inputs = JSON.parse(rawData).Inputs || [];
    if (!Array.isArray(inputs)) { return 'Invalid Inputs.'; }

    // Benchmark(Profiling) setup.
    const profilingItems = [];
    const len = inputs.length;
    for (let i = 0; i < len; ++i) {
      const x = i + 1;
      const nameStr = String(inputs[i]?.Name ?? '');
      profilingItems.push({
        key: `${nameStr}/profiling/${x}`,
        title: `${nameStr}`,
        content: ' ',
        folder: true,
        disabled: false,
      });
    }
    profilingItems.push({
      target: 'NPU', key: 'provali', title: '', content: ' ', disabled: false, folder: false,
    });
    // 保存初始化的profilingData
    extension.mockLocalStorage?.setItem('profilingItems', profilingItems);

    if (!extension.mockLocalStorage?.setItem('profilingData', profilingItems)) {
      return 'generate profiling config falied.';
    }

    // We only need backup for convertData.
    let convMerged;
    const convForNow = common.parseArray(extension.mockLocalStorage?.getItem('convDataBackup'));
    const option: GenerateOptions = { convBase: convForNow };
    const configRet = this.updateConfigItems('NPU', inputs, option);
    if (!configRet) {
      return 'Generate config failed : generateConfigLite';
    }
    ({ convMerged } = configRet);

    // Refresh Redux store.
    const config = [
      { key: 'convertData', value: convMerged },
      { key: 'profilingData', value: profilingItems },
    ];

    const frontEndConfigCallbackMessage: ConfigMessage = {
      method: ApiMethod.SAVE_CONFIG_CALLBACK,
      params: { config: config },
    };
    extension.chipConfigPanel?.postMessage(frontEndConfigCallbackMessage);

    return undefined;
  }

  static async setLayerWiseFromJsonFile(jsonPath: string): Promise<any> {
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const jsonData = JSON.parse(rawData);

    return this.setLayerWiseFromJson(jsonData);
  }

  static setLayerWiseFromJson(jsonData: any): any {
    let nodes = jsonData.Nodes || [];
    nodes = nodes.filter((item: { isQuantizable: string }) => item.isQuantizable === 'yes');
    const layerWiseItem = nodes.map((node: { Name: string; OpType: string }) => ({
      name: node.Name,
      opType: node.OpType,
      dataType: 'default',
    }));
    extension.mockLocalStorage?.setItem('layerwiseData', layerWiseItem);
    return layerWiseItem;
  }

  static generateConfigFull(target: Target, ext: any, connect?: boolean): string | undefined {
    const historyRootDir = GlobalModel.instance?.aiCacheDir;
    if (!historyRootDir) {
      return 'History folder for the current operation not found!';
    }

    const parsedModel = path.join(historyRootDir, '/selectmodel/parsedModel.json');
    if (!fs.existsSync(parsedModel)) {
      return ((ext === 'onnx' || ext === 'tflite')) ? 'ParsedModel.json Not found!' : undefined;
    }
    // 读取并解析 Outputs 的 Name 字段
    let outputNames: string[] = [];
    try {
      const rawData = fs.readFileSync(parsedModel, 'utf8');
      const jsonData = JSON.parse(rawData);
      const outputs = jsonData.Outputs || [];
      if (Array.isArray(outputs)) {
        outputNames = outputs.map(output => output?.Name || '').filter(Boolean);
      }
    } catch (error) {
      this.logAndReportError(`解析ParsedModel.json失败`);
    }

    // get inputs and outputs section on which added items are based.
    const rawData = fs.readFileSync(parsedModel, 'utf8');
    const jsonData = JSON.parse(rawData);
    const inputs = jsonData.Inputs || [];
    if (!Array.isArray(inputs)) {
      return 'Invalid Inputs.';
    }

    // LayerwiseConfig setup.
    const layerWiseItem = this.setLayerWiseFromJson(jsonData);

    // Benchmark(Profiling) setup.
    const profilingItems = [];
    const len = inputs.length;
    for (let i = 0; i < len; ++i) {
      const x = i + 1;
      const nameStr = String(inputs[i]?.Name ?? '');
      profilingItems.push({
        key: `${nameStr}/benchmark/${x}`,
        title: `${nameStr}`,
        content: ' ',
        folder: true,
        disabled: false,
      });
    }
    profilingItems.push({
      kind: 'select',
      key: 'validation_labels',
      target: target,
      page: 'benchmark',
      group: 'validation',
      title: 'Validation Labels',
      content: ['None', 'Choose from File System'],
      defaultValue: 'None',
      disabled: false,
    });
    profilingItems.push({
      target: target, key: 'provali', title: '', content: ' ', disabled: false, folder: false,
    });
    // 保存初始化的profilingData
    extension.mockLocalStorage?.setItem('profilingItems', profilingItems);

    if (!extension.mockLocalStorage?.setItem('profilingData', profilingItems) ||
      !extension.mockLocalStorage?.setItem('psramEnabled', false)) {
      return 'Generating benchmark config falied.';
    }

    // Get the backup because compressionData and convertData might have been updated.
    const convForNow = common.parseArray(extension.mockLocalStorage?.getItem('convDataBackup'));
    const compForNow = common.parseArray(extension.mockLocalStorage?.getItem('compDataBackup'));

    // Update config for both steps.
    let compMerged;
    let convMerged;
    const options: GenerateOptions = {
      compBase: compForNow,
      convBase: convForNow,
      persist: true,
    };
    const configRet = this.updateConfigItems(target, inputs, options);
    if (!configRet) {
      return `Generate config for ${target} failed.`;
    }
    ({ compMerged, convMerged } = configRet);

    // refresh Redux store.
    const config = [
      // General setup.
      { key: 'compressionData', value: compMerged },
      { key: 'convertData', value: convMerged },
      { key: 'layerwiseData', value: layerWiseItem },
      { key: 'profilingData', value: profilingItems },

      { key: 'modelOutputNames', value: outputNames },

      // Flashing flags.
      { key: 'isFlashed', value: false },
      { key: 'skipFlashing', value: false },

      // Benchmark results.
      { key: 'dbgSize', value: undefined },
      { key: 'modelSize', value: undefined },
      { key: 'inferenceTime', value: undefined },
      { key: 'timeValue', value: undefined },
      { key: 'ramValue', value: undefined },
      { key: 'flashValue', value: undefined },
    ];

    // connect is set to true if generateConfig is called at the connecting stage (select model page).
    if (connect) { config.push({ key: 'isConnected', value: false }); }

    const frontEndConfigCallbackMessage: ConfigMessage = {
      method: ApiMethod.SAVE_CONFIG_CALLBACK,
      params: { config: config },
    };
    extension.chipConfigPanel?.postMessage(frontEndConfigCallbackMessage);

    return undefined;
  }

  static saveConfig(message: Message): void {
    const { key, data: value } = message.params ?? {};
    if (message.params?.config) {
      this.updateFrontEndStorage(message.params?.config);
      return;
    }
    if (typeof key !== 'string') {
      logger.error('key not found.');
      return;
    }

    const errorMap: Record<string, string> = {
      layerwiseData: 'Layer',
      compressionData: 'Quant',
      convertData: 'Convert',
      profilingData: 'Benchmark',
    };
    if (!errorMap[key]) {
      logger.error('saveConfig failed: Unknown key.');
      return;
    }
    if (!extension.mockLocalStorage?.setItem(key, value)) {
      logger.error(`saveConfig failed: ${errorMap[key]}`);
      return;
    }

    // refresh Redux store.
    const config = [{ key: key, value: value }];
    const frontEndConfigCallbackMessage: ConfigMessage = {
      method: ApiMethod.SAVE_CONFIG_CALLBACK,
      params: { config: config },
    };
    extension.chipConfigPanel?.postMessage(frontEndConfigCallbackMessage);
  }

  static async filePickerLocalGeneral(folder: any, targetKey: any, input: any, fileExt: any): Promise<void> {
    if (!targetKey) { return; }

    if (input || input === '') {
      const filePath = input.trim();
      extension.chipConfigPanel?.postMessage({
        method: ApiMethod.SHOW_FILE_PICKER_CALLBACK,
        params: { path: filePath, targetKey },
      });
      return;
    }

    const getDefaultUri = (lastPath: string): vscode.Uri | undefined => {
      if (!lastPath) { return undefined; }
      try {
        return folder ? vscode.Uri.file(lastPath) : vscode.Uri.file(path.dirname(lastPath));
      } catch {
        return undefined;
      }
    };

    const folderOptions: vscode.OpenDialogOptions = {
      openLabel: 'Select a folder',
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      defaultUri: getDefaultUri(LAST_SELECTED_PATH.general),
    };
    let supportedExt;
    if (Array.isArray(fileExt)) {
      supportedExt = fileExt;
    } else {
      supportedExt = fileExt ? [fileExt] : [];
    }
    const fileOptions: vscode.OpenDialogOptions = {
      openLabel: `Select a .${fileExt} file`,
      canSelectMany: false,
      filters: supportedExt.length ? { Extensions: supportedExt } : undefined,
      defaultUri: getDefaultUri(LAST_SELECTED_PATH.general),
    };
    const options = folder ? folderOptions : fileOptions;
    if (!folder && !fileExt) { return; } // unlikely.

    const uri = await vscode.window.showOpenDialog(options);
    if (!uri?.length) { return; }

    const filePath = uri[0].fsPath;
    this.outputLogger.handleLogInfo(`\nSelected: ${filePath}\n`, 'info');

    if (!filePath) {
      extension.chipConfigPanel?.postMessage({
        method: ApiMethod.SHOW_FILE_PICKER_CALLBACK,
        params: { cancelled: true, targetKey },
      });
      return;
    }

    // Record selected path.
    LAST_SELECTED_PATH.general = filePath;

    extension.chipConfigPanel?.postMessage({
      method: ApiMethod.SHOW_FILE_PICKER_CALLBACK,
      params: { path: filePath, targetKey },
    });
  }

  // ── 1156e: skip source-selection dialog, do connection health check instead ──

  static async newModelFor1156e(target: string): Promise<void> {
    const source    = GlobalModel.instance.source;
    const watcher   = RemoteHeartbeatWatcher.getInstance();

    if (source === 'linux') {
      const rbPath = path.join(common.getWorkFolderPath(), '.vscode', 'remote-build.json');

      // Case 1: remote-build.json was deleted — must reconnect from scratch.
      if (!fs.existsSync(rbPath)) {
        vscode.window.showWarningMessage(
          'Remote connection config not found (.vscode/remote-build.json was deleted). Please reconnect.',
        );
        extension.chipConfigPanel?.postMessage({ type: 'ConnectToRemote' });
        return;
      }

      // Case 2: connection not established this session (fresh window) — remoteHome is unset.
      const remoteHome = GlobalModel.instance.remoteHome;
      if (!remoteHome) {
        vscode.window.showWarningMessage('Remote server not connected. Reconnecting…');
        extension.chipConfigPanel?.postMessage({ type: 'ConnectToRemote' });
        return;
      }

      // Case 3: heartbeat watcher is running — probe the server once.
      if (watcher.isRunning) {
        Command.outputLogger.handleLogInfo('[1156e] Checking Linux server connection (heartbeat)...', 'info');
        const alive = await watcher.checkOnce();
        if (alive) {
          Command.outputLogger.handleLogInfo('[1156e] Server is alive.', 'info');
        } else {
          vscode.window.showWarningMessage('Remote server unreachable. Please reconnect.');
          extension.chipConfigPanel?.postMessage({ type: 'ConnectToRemote' });
          return;
        }
      }

      // All checks passed — go directly to the remote file picker.
      Command.outputLogger.handleLogInfo('[1156e] Connection verified — opening remote file picker.', 'info');
      await Command.filePickerSelectModel();

    } else if (source === 'wsl') {
      const distro = GlobalModel.instance.wslDistro ?? '';
      let distroOk = false;
      try {
        const list = await Command.getWslLists();
        distroOk = list.includes(distro);
      } catch { /* distroOk stays false */ }

      if (!distroOk) {
        vscode.window.showWarningMessage(
          `WSL distro '${distro}' is not available. Please reconnect.`,
        );
        extension.chipConfigPanel?.postMessage({ type: 'ConnectToWsl' });
        return;
      }

      // Distro is available — go directly to the WSL file picker.
      await Command.filePickerWslSelectModel();
    } else {
      // Fallback: source not set yet, use normal picker.
      await Command.newModelPicker({ target });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────

  static async newModelPicker(message: any): Promise<void> {
    const { target } = message;

    // 1156e projects have their connection type pre-set at project creation.
    // Skip the "Choose from remote / WSL / local" dialog and use a health check instead.
    if (GlobalModel.instance.soc === '1156e') {
      await Command.newModelFor1156e(target);
      return;
    }

    const filePickItems: Record<string, vscode.QuickPickItem[]> = {
      CPU: [
        { label: 'Choose files from remote', detail: '' },
        { label: 'Choose files from local', detail: '' },
      ],
      NPU: [
        { label: 'Choose files from remote', detail: '' },
        { label: 'Choose files from WSL', detail: '' },
      ],
    };

    const filePickOptions = { placeHolder: 'Select an action', canPickMany: false };
    const item = await vscode.window.showQuickPick(filePickItems[target], filePickOptions);
    if (!item) { return; }

    let msgType: string | undefined;
    switch (item.label) {
      case 'Choose files from remote':
        msgType = 'ConnectToRemote';
        break;

      case 'Choose files from WSL':
        msgType = 'ConnectToWsl';
        break;

      case 'Choose files from local':
        await this.windowsBasicSetup('newmodel');
        msgType = 'LocalNewModel';
        break;

      default:
        return;
    }

    extension.chipConfigPanel?.postMessage({ type: msgType });
  }

  static async filePickerLocalSelectModel(): Promise<void> {
    return this.filePickerSelectModelUnified('windows');
  }

  static async filePickerSelectModel(): Promise<void> {
    return this.filePickerSelectModelUnified('linux');
  }

  static async filePickerWslSelectModel(): Promise<void> {
    return this.filePickerSelectModelUnified('wsl');
  }

  static async filePickerSelectModelUnified(source: Source): Promise<void> {
    const target = extension.chipConfigPanel?.target;
    const chipName = GlobalModel.instance.chipName;
    if (!target || !chipName) { return; }

    let selectedPath = ''; // selected path for pipeline. On Linux: remote home, on wsl : linux path.
    let pickedFsPath: string | undefined; // wsl: windows/unc path for fs.stat/copy
    let fileNameForUi = '';

    // file picker.
    const supportedModels = { NPU: ['onnx', 'pt', 'pth'], CPU: ['onnx', 'tflite'] };

    // defaultUri
    const getDefaultUri = (lastPath: string): vscode.Uri | undefined => {
      if (!lastPath) { return undefined; }

      try {
        return vscode.Uri.file(path.dirname(lastPath));
      } catch {
        return undefined;
      }
    };

    const options: vscode.OpenDialogOptions = {
      openLabel: 'Select a model',
      canSelectMany: false,
      canSelectFiles: true,
      canSelectFolders: false,
      defaultUri: getDefaultUri(LAST_SELECTED_PATH.model),
    };

    if (source === 'linux') {
      const remoteHome = GlobalModel.instance?.remoteHome;
      if (!remoteHome) { return; }

      try {
        selectedPath = await vscode.commands.executeCommand(this.remoteCmdLib.browseFileCmd, remoteHome);
      } catch (err) {
        this.logAndReportError(`Failed to execute ${this.remoteCmdLib.browseFileCmd} : ${this.handleError(err)}`);
        return;
      }

      fileNameForUi = path.basename(selectedPath);
    } else if (source === 'wsl') {
      const wslOptions: vscode.OpenDialogOptions = {
        ...options,
        filters: { Extensions: supportedModels.NPU },
        defaultUri: getDefaultUri(LAST_SELECTED_PATH.model),
      };

      const uri = await vscode.window.showOpenDialog(wslOptions);
      if (!uri?.length) { return; }

      pickedFsPath = uri[0].fsPath;
      fileNameForUi = path.basename(pickedFsPath);

      let info;
      try {
        info = common.toLinuxPath(pickedFsPath); // { linuxPath, distro?, source }
      } catch (err) {
        this.logAndReportError(`Failed to convert paths. ${this.handleError(err)}`);
        return;
      }

      if (!info?.linuxPath) {
        vscode.window.showErrorMessage(`Unrecognized path: ${pickedFsPath}`);
        return;
      }

      selectedPath = info.linuxPath;
      LAST_SELECTED_PATH.model = pickedFsPath;
    } else {
      const winOptions: vscode.OpenDialogOptions = {
        ...options,
        filters: { Extensions: supportedModels.CPU },
        defaultUri: getDefaultUri(LAST_SELECTED_PATH.model),
      };

      const uri = await vscode.window.showOpenDialog(winOptions);
      if (!uri?.length) { return; }

      // Record currently selected file
      selectedPath = uri[0].fsPath;
      fileNameForUi = path.basename(selectedPath);
      LAST_SELECTED_PATH.model = selectedPath;
    }

    // Validate model.
    let errMsg = await this.validateModel(target, selectedPath);
    if (errMsg !== undefined) {
      this.logAndReportError(errMsg);
      return;
    }

    // Parse selected model.
    const delimeter = source === 'windows' ? '\\' : '/';
    const { modelName, modelEndsWith } = this.parseModelPath(selectedPath, delimeter);
    if (!modelName || !modelEndsWith) { return; }

    // Setup local cache dirs.
    // aicache now lives inside xxx_hiproj/ folder, not in the SDK workspace folder.
    const dateTime = (new Date()).getTime();
    const aiCacheModelDir = path.join(GlobalModel.instance.hiprojDir!, 'aicache', `${modelName}.${modelEndsWith}_${dateTime}`);
    const localModelDir = path.join(aiCacheModelDir, `selectmodel`);
    if (!fs.existsSync(localModelDir)) {
      fs.mkdirSync(localModelDir, { recursive: true });
    }
    const localModelPath = path.join(localModelDir, `${modelName}.${modelEndsWith}`);

    // GlobalModel setup for both linux and wsl.
    GlobalModel.instance.selectedFile = selectedPath; // remote: remotePath; wsl: linuxPath
    GlobalModel.instance.localFile = localModelPath;
    GlobalModel.instance.aiCacheDir = aiCacheModelDir;

    // Write global.txt
    const globalFile = path.join(aiCacheModelDir, 'global.txt');
    const globalData: any = { selectedFile: selectedPath, source: source };
    if (source === 'wsl') {
      globalData.selectedFsPath = pickedFsPath;
      globalData.wslDistro = GlobalModel.instance.wslDistro;
    }
    fs.writeFileSync(globalFile, JSON.stringify(globalData, null, 2), 'utf-8');

    // Certain stages are disabled on NPU platform.
    this.setStageDisabled(modelEndsWith);

    // Clear local directory before downloading.
    await this.deleteAllFiles(localModelDir);

    // File size check and fetch model into local cache.
    try {
      await this.sizeCheckAndCopy(source, localModelPath, pickedFsPath, selectedPath);
    } catch (err) {
      this.logAndReportError(`${this.handleError(err)}`);
      return;
    }

    extension.chipConfigPanel?.postMessage({
      type: 'modelChosen',
      params: { fileName: fileNameForUi },
    });

    // ParseModel if uploaded model is either .onnx or .tflite.
    if (modelEndsWith === 'onnx' || modelEndsWith === 'tflite') {
      const scriptWin = path.join(__dirname, '../resources/scripts/npu/model_select/model_arch_parse.py');
      const parsedJson = path.join(localModelDir, 'parsedModel.json'); // place where output json is stored.

      if (source === 'linux') {
        const remoteHome = GlobalModel.instance?.remoteHome;
        if (!remoteHome || (target !== 'NPU' && target !== 'CPU')) { return; } // unlikely

        const rootDir = remoteRootDir;
        const stage = 'model_select';
        await this.uploadScripts('NPU', stage, rootDir); // model parsing scripts is placed under npu/

        const baseCmd = `cd ${remoteHome}/${rootDir}/ && `;
        const python = getRemotePython(target, GlobalModel.instance.soc);
        const parseModelCmd = `${baseCmd} ${python} ./scripts/model_select/model_arch_parse.py ` + `--model ${selectedPath} `
           + `--chip ${chipName} ` + `--platform ${this.getPlatform(chipName, target)} ` + `--output_path .cache/ai/parsedModel/parsedModel.json`;

        let ret: exeCmdRetType;
        try {
          ret = await vscode.commands.executeCommand(this.remoteCmdLib.executeCmd, parseModelCmd);
        } catch (err) {
          this.logAndReportError(`Failed to execute ${parseModelCmd} on the remote server : ${this.handleError(err)}`);
          return;
        }
        if (ret.exitCode) {
          this.logAndReportError(`Error when executing parse.py, exit code ${ret.exitCode}, ${ret.stderr}`);
          return;
        }

        // Download parsedModel.json
        const localPath = parsedJson;
        const remotePath = `${remoteHome}/${rootDir}/.cache/ai/parsedModel/parsedModel.json`;
        try {
          await vscode.commands.executeCommand(this.remoteCmdLib.downloadCmd, remotePath, localPath);
        } catch (err) {
          this.logAndReportError(`Failed to execute ${this.remoteCmdLib.downloadCmd} : ${this.handleError(err)}`);
        }
      } else if (source === 'wsl') {
        const distro = GlobalModel.instance.wslDistro;
        if (!distro) { throw new Error('Global WSL distro not set. '); } // unlikely but fatal, throw.

        // map to path format that wsl recognizes.
        const scriptWsl = await common.winToLinuxPathForWsl(distro, scriptWin, common.exeRunner);

        // Run parse against cached model path (stable)
        const modelLinuxForRun = await common.winToLinuxPathForWsl(distro, localModelPath, common.exeRunner);
        const parsedJsonWsl = await common.winToLinuxPathForWsl(distro, parsedJson, common.exeRunner);
        if (!scriptWsl || !parsedJsonWsl || !modelLinuxForRun) {
          this.logAndReportError(`Cannot map parsedModel.json path to WSL linux path: ${parsedJson}`);
          return;
        }

        // Output to local parsedModel.json via /mnt/.. mapping
        const parsedLocal = path.join(localModelDir, 'parsedModel.json');
        const parsedLinux = await common.winToLinuxPathForWsl(distro, parsedLocal, common.exeRunner);
        if (!parsedLinux) {
          this.logAndReportError(`Cannot map parsedModel.json path to WSL linux path: ${parsedLocal}`);
          return;
        }

        // Run model parsing script.
        const wslPython = await this.getWSLPython(distro);
        const parseCmd = `${wslPython} ${common.shQuote(scriptWsl)} ` + `--model ${common.shQuote(modelLinuxForRun)} ` + `--output_path ${common.shQuote(parsedJsonWsl)}`;
        this.outputLogger.handleLogInfo(`Start running: ${parseCmd} \n`, 'info');
        const ret = await common.exeRunner({
          exe: 'wsl.exe',
          args: ['-d', distro, '--', 'bash', '-lc', parseCmd],
          mode: 'utf8',
          logger: this.outputLogger,
          python: true,
        });

        if (ret.code !== 0) {
          this.logAndReportError(`Error when executing quantization scripts, exit code ${ret.code}`);
          return;
        }
      } else {
        const toolRootPath = common.getToolsPath();
        const python = path.join(toolRootPath, 'tools/python/python.exe');
        if (target !== 'CPU') { throw new Error('Script is running locally but it\'s on NPU platform'); } // unlikely but fatal.
        const pythonRootPath = path.join(__dirname, `../resources/scripts/${target.toLowerCase()}/profiling`); // CPU only.

        const parseCmd = `${python} ${scriptWin} --model ${localModelPath} --output_path ${parsedJson}`;
        const args = [scriptWin, '--model', localModelPath, '--output_path', parsedJson];
        try {
          await this.runProcess(python, args, pythonRootPath, { cmd: parseCmd });
        } catch (err) {
          this.logAndReportError(this.handleError(`Failed to parse model: ${err}`));
          return;
        }
      }
    }

    errMsg = this.generateConfig(target, modelEndsWith, 'full', true);
    if (errMsg !== undefined) {
      this.logAndReportError(errMsg);
      return;
    }

    // Create history folder for current model.
    this.createHistoryFolder(localModelPath, modelName, modelEndsWith, dateTime);

    // 1156e: quantize step is skipped — write a placeholder quant history entry so the
    // history chain (quant → convert → deploy → benchmark) works normally downstream.
    const is1156e = GlobalModel.instance.soc === '1156e';
    if (is1156e) {
      extension.mockLocalStorage?.setItem('skipQuantize', true);
      extension.mockLocalStorage?.setItem('lastQuantTS', dateTime);
      this.writeSkippedQuantHistory(dateTime, `${modelName}.${modelEndsWith}`, source);
    }

    // Watchers.
    this.clearAllWatchers(); // Clear all watchers first.
    if (source === 'linux') {
      this.watchers({ serial: true, heartbeat: true }); // enbale serial port watcher and heartbeat watcher.
    } else {
      this.watchers({ serial: true, heartbeat: false }); // Only enable serial port watcher
    }

    // All done. Notify front end.
    const skipQuantize = is1156e ? true : undefined;
    extension.chipConfigPanel?.postMessage({ type: 'AllDone', params: { source, skipQuantize } });
  }

  static async sizeCheckAndCopy(source: Source, localModelPath: any, pickedFsPath: any, selectedPath: any): Promise<void> {
    // Windows
    if (source === 'windows') {
      if (!selectedPath) { throw new Error('Selected file path not found.'); }

      // Size check
      let fileSize = 0;
      try {
        fileSize = fs.statSync(selectedPath).size;
      } catch (err) {
        throw new Error(`Failed to read file size: ${this.handleError(err)}`);
      }

      const maxSize = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
      if (fileSize > MAX_FILE_SIZE) {
        const currentSize = (fileSize / (1024 * 1024)).toFixed(2);
        throw new Error(`Model too large. Maximum size: ${maxSize}MiB. Got ${currentSize}MiB.`);
      }

      // Copy to local cache
      try {
        await fs.promises.copyFile(selectedPath, localModelPath);
      } catch (err) {
        throw new Error(`Failed to copy model to cache: ${this.handleError(err)}`);
      }
      return;
    }

    // Linux
    if (source === 'linux') {
      // Download selected file into local cache.
      try {
        await vscode.commands.executeCommand(this.remoteCmdLib.downloadCmd, selectedPath, localModelPath);
      } catch (err) {
        throw new Error(`Failed to execute ${this.remoteCmdLib.downloadCmd} : ${this.handleError(err)}`);
      }

      const remoteHome = GlobalModel.instance?.remoteHome;
      if (!remoteHome) { return; }

      const getRemoteFileSizeCmd = `du -b "${selectedPath}" | awk '{print $1}'`;
      let sizeResult: { exitCode: number; stdout: string; stderr: string };
      try {
        sizeResult = await vscode.commands.executeCommand(this.remoteCmdLib.executeCmd, getRemoteFileSizeCmd);
      } catch (err) {
        throw new Error(`${getRemoteFileSizeCmd} failed to execute on the remote server : ${this.handleError(err)}`);
      }
      if (sizeResult.exitCode !== 0) {
        throw new Error(`Failed to get remote file size: ${sizeResult.stderr}`);
      }

      const fileSize = parseInt(sizeResult.stdout.trim(), 10);
      const maxSize = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
      if (isNaN(fileSize) || fileSize > MAX_FILE_SIZE) {
        const currentSize = isNaN(fileSize) ? 'unknown' : (fileSize / (1024 * 1024)).toFixed(2);
        throw new Error(`Uploaded model is too large! Maximum size: ${maxSize}MiB. Got ${currentSize}MiB.`);
      }
      return;
    }

    // WSL
    if (!pickedFsPath) { return; }

    const isWslLocalhost = String(pickedFsPath).toLowerCase().startsWith('\\\\wsl.localhost\\');
    const wslDistro = GlobalModel.instance?.wslDistro;
    const linuxPath = GlobalModel.instance?.selectedFile;

    if (!wslDistro) { throw new Error('Distribution for wsl not found.'); }
    if (!linuxPath) { throw new Error('Model path on wsl not found.'); }

    // Size check
    let fileSize = 0;
    if (isWslLocalhost) {
      const sizeRet = await common.exeRunner({
        exe: 'wsl.exe',
        args: ['-d', wslDistro, '--', 'bash', '-lc', `stat -c%s ${common.shQuote(linuxPath)}`],
        mode: 'utf8', logger: this.outputLogger, silent: true,
      });
      const sizeText = (sizeRet.stdout || '').replace(/\u0000/g, '').trim();
      fileSize = parseInt(sizeText, 10);
      if (sizeRet.code !== 0 || isNaN(fileSize)) {
        const out = (sizeRet.stderr || sizeRet.stdout || '').replace(/\u0000/g, '').trim();
        throw new Error(`Failed to read WSL file size: ${out || '(no output)'}`);
      }
    } else {
      // Windows path.
      fileSize = fs.statSync(pickedFsPath).size;
    }

    const maxSize = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
    if (fileSize > MAX_FILE_SIZE) {
      const currentSize = (fileSize / (1024 * 1024)).toFixed(2);
      throw new Error(`Model too large. Maximum size: ${maxSize}MiB. Got ${currentSize}MiB.`);
    }

    // Copy to local cache.
    if (isWslLocalhost) {
      // fs.copyFile not available.
      const destLinux = await common.winToLinuxPathForWsl(wslDistro, localModelPath, common.exeRunner);
      if (!destLinux) {
        throw new Error(`Cannot map local cache path to WSL linux path: ${localModelPath}`);
      }

      const cpRet = await common.exeRunner({
        exe: 'wsl.exe',
        args: ['-d', wslDistro, '--', 'bash', '-lc', `cp ${common.shQuote(linuxPath)} ${common.shQuote(destLinux)}`],
        mode: 'utf16le',
        logger: this.outputLogger,
        silent: true,
      });
      if (cpRet.code !== 0) {
        const out = (cpRet.stderr || cpRet.stdout || '').replace(/\u0000/g, '').trim();
        throw new Error(`Failed to copy model inside WSL: ${out || '(no output)'}`);
      }
    } else {
      try {
        await fs.promises.copyFile(pickedFsPath, localModelPath);
      } catch (err) {
        throw new Error(`Failed to copy model to cache: ${this.handleError(err)}`);
      }
    }
  }

  static async showFilePicker(data: any): Promise<void> {
    const { type, targetKey, folder, input, fileExt } = data.params as {
      type: pickerType;
      targetKey?: string;
      folder?: boolean;
      input?: string;
      fileExt?: string;
    };

    switch (type) {
      case 'linux':
        await this.filePickerLinuxGeneral(folder, targetKey, input);
        break;

      case 'local':
        await this.filePickerLocalGeneral(folder, targetKey, input, fileExt);
        break;

      case 'wslNewModel':
        await this.filePickerWslSelectModel();
        break;

      case 'remoteNewModel':
        await this.filePickerSelectModel();
        break;

      case 'localNewModel':
        await this.filePickerLocalSelectModel();
        break;

      default:
        this.logAndReportError('Unknown type in showFilePicker.');
        break;
    }
  }

  // 下载示例配置文件（quant_config.cfg）
  static async downloadSampleConfig(data: any): Promise<void> {
    const { fileName } = data.params as { fileName: string };

    if (!fileName) {
      logger.error('downloadSampleConfig: fileName is required');
      vscode.window.showErrorMessage('下载失败：缺少文件名参数');
      return;
    }

    try {
      // 获取插件根目录
      const extensionPath = vscode.extensions.getExtension('HiSpark.hisparkai')?.extensionPath;
      if (!extensionPath) {
        vscode.window.showErrorMessage('无法获取插件目录，请重启插件！');
        return;
      }

      const sampleFilePath = path.join(extensionPath, 'resources', 'scripts', 'npu', 'quant', fileName);
      if (!fs.existsSync(sampleFilePath)) {
        vscode.window.showErrorMessage(`示例文件 ${fileName} 不存在！路径：${sampleFilePath}`);
        return;
      }

      // 弹出保存对话框
      const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(path.join(os.homedir(), 'Downloads', fileName)),
        filters: {
          configurationFile: ['cfg'],
          allFiles: ['*'],
        },
      });

      // 用户取消保存
      if (!saveUri) {
        logger.info('downloadSampleConfig: 用户取消保存');
        return;
      }

      // 复制文件到目标路径
      fs.copyFileSync(sampleFilePath, saveUri.fsPath);

      // 提示成功
      vscode.window.showInformationMessage(
        `示例文件 ${fileName} 已下载到：${saveUri.fsPath}`,
        '打开文件'
      ).then(selection => {
        if (selection === '打开文件') {
          vscode.commands.executeCommand('vscode.open', saveUri);
        }
      });
    } catch (err) {
      vscode.window.showErrorMessage(`下载失败：${this.handleError(err)}`);
    }
  }

  // General filePicker in Quantize and Convert.
  static async filePickerLinuxGeneral(folder?: boolean, targetKey?: string, input?: string): Promise<void> {
    if (!targetKey) { return; }

    if (input || input === '') {
      const filePath = input.trim();
      extension.chipConfigPanel?.postMessage({
        method: ApiMethod.SHOW_FILE_PICKER_CALLBACK,
        params: { path: filePath, targetKey },
      });
      return;
    }

    const browseCmd = folder ? this.remoteCmdLib.browseDirCmd : this.remoteCmdLib.browseFileCmd;
    try {
      let filePath;
      if (folder) {
        filePath = await vscode.commands.executeCommand<string | undefined>(browseCmd, GlobalModel.instance.remoteHome);
      } else {
        filePath = await vscode.commands.executeCommand<string | undefined>(browseCmd, GlobalModel.instance.remoteHome);
      }

      if (!filePath) {
        extension.chipConfigPanel?.postMessage({
          method: ApiMethod.SHOW_FILE_PICKER_CALLBACK,
          params: { cancelled: true, targetKey },
        });
        return;
      }

      extension.chipConfigPanel?.postMessage({
        method: ApiMethod.SHOW_FILE_PICKER_CALLBACK,
        params: { path: filePath, targetKey },
      });
    } catch (err) {
      this.logAndReportError(`Failed to execute ${browseCmd}: ${this.handleError(err)}`);
    }
  }

  // Delete all files, folders recursively.
  static async deleteAllFiles(dir: string): Promise<void> {
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await fs.promises.rm(fullPath, { recursive: true, force: true });
        } else {
          await fs.promises.unlink(fullPath);
        }
      }
    } catch (err) {
      logger.error('clearDirectory error:', err);
    }
  }

  static async clearHistory(): Promise<void> {
    // ******** Clear results display. ********
    let stage;
    let clearMsg: FrontEndConfigMessage;

    // Clear quantize results.
    stage = 'compression';
    clearMsg = {
      method: ApiMethod.UPDATE_HISGRAPH,
      params: { data: { fileData: undefined, stage } },
    };
    extension.chipConfigPanel?.postMessage(clearMsg);

    // Clear convert results.
    stage = 'convert';
    clearMsg = {
      method: ApiMethod.UPDATE_CONSTARK,
      params: { data: { fileData: undefined, stage } },
    };
    extension.chipConfigPanel?.postMessage(clearMsg);

    // Clear benchmark results.
    stage = 'profiling';
    clearMsg = {
      method: ApiMethod.UPDATE_HISGRAPH,
      params: { data: { fileData: undefined, stage } },
    };
    extension.chipConfigPanel?.postMessage(clearMsg);

    // ******** Other clearing steps. ********
  }

  static setStageDisabled(ext: any): void {
    // ext can only be 'onnx', 'pt', 'pth', 'tflite'.
    let ptq = true;
    let qat = true;
    let convert = true;

    switch (ext) {
      case 'onnx':
        qat = false;
        break;
      case 'pt':
        ptq = false;
        break;
      case 'pth':
        ptq = false;
        break;
      case 'exeom':
        ptq = false;
        qat = false;
        convert = false;
        break;
      case 'tflite':
        ptq = false;
        qat = false;
        break;
      default:
        this.logAndReportError('not supported file chosen');
        break;
    }
    const config = [
      { key: 'ptq', value: ptq },
      { key: 'qat', value: qat },
      { key: 'convert', value: convert },
    ];
    const compMessage: ConfigMessage = {
      method: ApiMethod.SAVE_CONFIG_CALLBACK,
      params: { config: config },
    };
    extension.chipConfigPanel?.postMessage(compMessage);
    extension.mockLocalStorage?.setItem('ptq', ptq);
    extension.mockLocalStorage?.setItem('qat', qat);
    extension.mockLocalStorage?.setItem('convert', convert);
  }

  static async validateModel(target: Target, remoteModel: any): Promise<string | undefined> {
    if (!remoteModel) { return undefined; }

    let errMsg;
    const { modelName, modelEndsWith } = this.parseModelPath(remoteModel, '/');
    if (!target || (target !== 'CPU' && target !== 'NPU')) { return 'target not recognized!'; }

    // 1156e only accepts ONNX (no quantization step, model goes directly to Convert).
    const is1156e = GlobalModel.instance.soc === '1156e';
    const supportedFiles: Record<string, string[]> = is1156e
      ? { NPU: ['onnx'], CPU: ['onnx'] }
      : { NPU: ['onnx', 'pt', 'pth'], CPU: ['onnx', 'tflite'] };
    if (!supportedFiles[target]?.includes(modelEndsWith)) {
      errMsg = is1156e
        ? 'Only ONNX models are supported for 1156e.'
        : 'Selected file format not supported!';
      return errMsg;
    }

    if (modelEndsWith === 'exeom') { // legacy. exeom not supported for now.
      const remoteDir = path.posix.dirname(remoteModel);
      const dbgSearchCmd = `find . -type f -name "${modelName}.dbg" | wc -l`;
      const baseCmd = ` cd ${remoteDir} && `;
      const fullCmd = baseCmd + dbgSearchCmd;

      let sizeResult: { exitCode: number; stdout: string; stderr: string };
      try {
        sizeResult = await vscode.commands.executeCommand(this.remoteCmdLib.executeCmd, fullCmd);
      } catch (err) {
        this.logAndReportError(`Failed to execute ${fullCmd} on the remote server: ${this.handleError(err)}`);
        errMsg = 'Failed to execute command';
        return errMsg;
      }

      // dbgFilesFound can only be 0 or 1.
      const dbgFilesFound = parseInt(sizeResult.stdout.trim(), 10);
      if (dbgFilesFound === 0) {
        errMsg = 'An exeom file was chosen, but no related dbg file is found under the same directory.';
        return errMsg;
      } else if (dbgFilesFound > 1) {
        errMsg = 'An unknown error occured.';
        return errMsg;
      }
    }

    return undefined;
  }

  static updateConvertDataFromModelData(modelDataJsonPath: string): void {
    if (!fs.existsSync(modelDataJsonPath)) {
      throw new Error('modelData.json missing, check if quantization runs successfully.');
    }
    try {
      interface Input { Name: string; Shape: string }
      interface ModelData { inputs: Input[] }
      const modelData: ModelData = JSON.parse(fs.readFileSync(modelDataJsonPath, 'utf-8'));

      if (!modelData.inputs || !Array.isArray(modelData.inputs)) {
        throw new Error('Invalid modelData.json format.');
      }

      const inputs = modelData.inputs;
      let convertData = extension.mockLocalStorage?.getItem('convertData');
      if (convertData === undefined) { throw new Error('convertData not exists'); } // unlikely
      convertData = common.parseArray(convertData); // Make sure convertData is Array.
      if (convertData.length % 2 === 0) {
        throw new Error('Invalid configure for convert.'); // unlikely.
      }

      const nodeNum = (convertData.length - 1) / 2;
      for (let i = 0; i < nodeNum && i < inputs.length; ++i) {
        const idx = (2 * i) + 1;
        if (!convertData[idx]) { continue; }
        convertData[idx].content = [inputs[i].Shape];
      }

      // Refresh Redux store
      const config = [{ key: 'convertData', value: convertData }];
      extension.chipConfigPanel?.postMessage({
        method: ApiMethod.SAVE_CONFIG_CALLBACK,
        params: { config },
      });
    } catch (err) {
      throw new Error(`Unable to configure convert initialization data for convert due to: ${this.handleError(err)}`);
    }
  }

  static updateConfig(message: Message): void {
    const target = message.params?.target;
    const stage = message.params?.stage;
    const lastQuantTS = message.params?.lastQuantTS;
    const historyRootDir = GlobalModel.instance.aiCacheDir;
    if (stage !== 'quant' && stage !== 'convert') { return; }
    if (target !== 'NPU' && target !== 'CPU') { return; }
    if (!historyRootDir) { return; }

    const model = path.join(historyRootDir, 'selectmodel/parsedModel.json');
    if (!fs.existsSync(model)) { return; }
    const { modelEndsWith } = this.parseModelPath(model, '/');

    // Update quant config.
    if (stage === 'quant') {
      const errMsg = this.generateConfig(target, modelEndsWith, 'full');
      if (errMsg !== undefined) { this.logAndReportError(errMsg); }
      return;
    }

    // This is useful because models can be dynamic, so we parse modelData.json to determine the valid shape.
    const localDir = path.join(historyRootDir, 'Quant', `quant_${lastQuantTS}`);
    const modelDataJsonPath = path.join(localDir, 'ptq', 'modelData.json');
    try {
      this.updateConvertDataFromModelData(modelDataJsonPath);
    } catch (err) {
      this.logAndReportError(this.handleError(err));
    }
  }

  static getHistoryFilePath(): [any[], string] {
    // history.json is stored inside the xxx_hiproj/aicache/ folder.
    const filePath: string = path.join(GlobalModel.instance.hiprojDir!, 'aicache', 'history.json');
    if (!fs.existsSync(filePath)) {
      return [[], filePath];
    }

    const fileStats = fs.statSync(filePath);
    const fileSize = fileStats.size;
    if (fileSize === 0) {
      return [[], filePath];
    }

    try {
      const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return [json, filePath];
    } catch (err) {
      this.logAndReportError(`history.json parsing error: ${this.handleError(err)}`);
      return [[], filePath];
    }
  }

  static createHistoryFolder(modelPath: any, name: any, ext: any, time: any): void {
    const aicacheDir = GlobalModel.instance.aiCacheDir;
    const source = GlobalModel.instance.source;
    if (!aicacheDir || !source) { return; } // unlikely.

    if (!fs.existsSync(modelPath)) {
      extension.chipConfigPanel?.postMessage({
        type: 'Error',
        params: { description: 'Failed to generate history folder: File not exists.' },
      });
      return;
    }

    const [_, filePath] = this.getHistoryFilePath();
    const historySize = fs.statSync(modelPath);
    GlobalModel.instance.aiCacheDir = aicacheDir;
    fs.mkdirSync(aicacheDir, { recursive: true });
    fs.mkdirSync(`${aicacheDir}/history`, { recursive: true });

    // Generate history folders for each step.
    const compressionArr = this.getCompressionConvertHistoryFilePath('quantize');
    const convertArr = this.getCompressionConvertHistoryFilePath('convert');
    const deployArr = this.getCompressionConvertHistoryFilePath('deploy');
    const profilingArr = this.getCompressionConvertHistoryFilePath('benchmark');
    this.generateJsonWriteContent(compressionArr[1]);
    this.generateJsonWriteContent(convertArr[1]);
    this.generateJsonWriteContent(deployArr[1]);
    this.generateJsonWriteContent(profilingArr[1]);
    let serversInfo;
    if (source === 'linux') {
      const remoteBuildDir = path.join(common.getWorkFolderPath(), `/.vscode/remote-build.json`);
      if (!fs.existsSync(remoteBuildDir)) {
        extension.chipConfigPanel?.postMessage({
          type: 'Error',
          params: { description: 'Failed to generate history folder: remote-build not exists.' },
        });
        return;
      }
      try {
        const remoteBuildData = fs.readFileSync(remoteBuildDir, 'utf-8');
        if (remoteBuildData) {
          serversInfo = JSON.parse(remoteBuildData);
        }
      } catch (error) {
        this.logAndReportError(`${this.handleError(error)}`);
      }
    }
    const { host, port, username } = serversInfo?.servers ?? {};

    // History info for model select page.
    const historyInfo: HistoryInfo = {
      source: source,
      modelName: `${name}.${ext}`,
      contentLength: historySize.size,
      updateTime: time,
      accuracy: '----',
      avgSim: '----',
      mse: '----',
      ram: '----',
      flash: '----',
      time: '----',
      host: host ?? '----',
      port: port ?? 22,
      username: username ?? 'root',
    };
    let historyList: HistoryInfo[] = [];
    const historyData = fs.readFileSync(filePath, 'utf-8');
    if (historyData) {
      historyList = JSON.parse(historyData);
    }
    historyList.push(historyInfo);
    fs.writeFileSync(filePath, JSON.stringify(historyList), 'utf8');
  }

  // Write a placeholder quant history entry for 1156e (quantize step is skipped).
  // This allows the quant → convert → deploy → benchmark history chain to work normally.
  static writeSkippedQuantHistory(dateTime: number, modelName: string, source: Source): void {
    const [quantJson, quantFilePath] = this.getCompressionConvertHistoryFilePath('quantize');
    const entry: Partial<HistoryInfo> = {
      source,
      modelName,
      contentLength: 0,
      updateTime: dateTime,
      accuracy: '----',
      avgSim: '----',
      mse: '----',
      ram: '----',
      flash: '----',
      time: '----',
    };
    quantJson.push(entry);
    fs.writeFileSync(quantFilePath, JSON.stringify(quantJson), 'utf8');
  }

  // 生成json并写入内容
  static generateJsonWriteContent(filePath: string): void {
    let historyList: HistoryInfo[] = [];
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(historyList), 'utf8');
    } else {
      const historyData = fs.readFileSync(filePath, 'utf-8');
      if (historyData) {
        historyList = JSON.parse(historyData);
      }
      fs.writeFileSync(filePath, JSON.stringify(historyList), 'utf8');
    }
  }

  // 获取量化结果历史记录
  static getCompressionConvertHistoryFilePath(val: string): [any[], string] {
    const nowPath = `${GlobalModel.instance.aiCacheDir}/history/${val}.json`;
    const filePath: string = path.join(nowPath);
    if (!fs.existsSync(filePath)) {
      return [[], filePath];
    }

    const fileStats = fs.statSync(filePath);
    const fileSize = fileStats.size;
    if (fileSize === 0) {
      return [[], filePath];
    }

    try {
      const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return [json, filePath];
    } catch (err) {
      this.logAndReportError(`/${val}.json parse error: ${this.handleError(err)}`);
      return [[], filePath];
    }
  }

  // 查询量化记录
  static getCompressionHistoryInfo(message: any): void {
    const [newFileJson] = this.getCompressionConvertHistoryFilePath('quantize');
    const getResultHistoryCallbackMessage: GetResultHistoryCallbackMessage = {
      method: ApiMethod.GET_COMPRESSION_HISTORY_INFO_BACK,
      params: { data: newFileJson },
    };
    extension.chipConfigPanel?.postMessage(getResultHistoryCallbackMessage);
  }

  // 删除某一条量化记录
  static deleteCompressionHistoryInfo(message: any): void {
    const { params: { timeStamp } } = message;
    const [newFileJson, filePath] = this.getCompressionConvertHistoryFilePath('quantize');
    const len = newFileJson ? newFileJson.length : 0;
    if (len === 0) { return; }
    const newHistoryList = newFileJson.filter((item: HistoryInfo) => item.updateTime !== timeStamp);
    const workFolder: string = GlobalModel.instance.aiCacheDir || '';
    const modelName = newFileJson.filter((item: HistoryInfo) => item.updateTime === timeStamp);
    const nowLen = modelName.length > 0 ? modelName.length : 0;
    if (nowLen === 0) {
      this.logAndReportError('Quantization history not found.');
      return;
    }
    const homePath = path.join(workFolder, `/Quant/quant_${timeStamp}`);
    if (!fs.existsSync(homePath)) {
      logger.info('Quantization directory not found.');
      return;
    }
    const covertArr = this.getCompressionConvertHistoryFilePath('convert');
    if (covertArr[0].length > 0) {
      const quantConvert = covertArr[0].filter((item: any) => item.quantUUId === timeStamp);
      const quantConvertChange = covertArr[0].filter((item: any) => item.quantUUId !== timeStamp);
      fs.writeFileSync(covertArr[1], JSON.stringify(quantConvertChange), 'utf8');
      quantConvert.forEach((item: any) => {
        const convertPath = path.join(workFolder, `/Convert/convert_${item.updateTime}`);
        if (!fs.existsSync(convertPath)) {
          logger.info('Compression directory not found.');
          return;
        }
        common.deleteFolder(convertPath);
      });
    }
    common.deleteFolder(homePath);
    if (newHistoryList.length === 0) {
      this.updateChart([], 'compression', ApiMethod.UPDATE_HISGRAPH);
    }
    fs.writeFileSync(filePath, JSON.stringify(newHistoryList), 'utf8');
  }

  // 查询转化记录
  static getConvertHistoryInfo(message: any): void {
    const [newFileJson] = this.getCompressionConvertHistoryFilePath('convert');
    const lastQuantTS = extension.mockLocalStorage?.getItem('lastQuantTS');
    let fileJson = [];
    if (lastQuantTS) {
      fileJson = newFileJson.filter(item => item.quantUUId === parseInt(lastQuantTS));
    }
    const getResultHistoryCallbackMessage: GetResultHistoryCallbackMessage = {
      method: ApiMethod.GET_CONVERT_HISTORY_INFO_BACK,
      params: { data: fileJson },
    };
    extension.chipConfigPanel?.postMessage(getResultHistoryCallbackMessage);
  }

  // 删除某一条转化记录
  static deleteConvertHistoryInfo(message: any): void {
    const { params: { timeStamp } } = message;
    const [newFileJson, filePath] = this.getCompressionConvertHistoryFilePath('convert');
    const benchmarkFile = this.getCompressionConvertHistoryFilePath('benchmark');
    const len = newFileJson ? newFileJson.length : 0;
    if (len === 0) { return; }
    const lastQuantTS = extension.mockLocalStorage?.getItem('lastQuantTS');
    let nowList: any = [];
    if (lastQuantTS) {
      nowList = newFileJson.filter(item => item.updateTime !== timeStamp && item.quantUUId === parseInt(lastQuantTS));
    }
    const newHistoryList = newFileJson.filter((item: HistoryInfo) => item.updateTime !== timeStamp);
    const workFolder: string = GlobalModel.instance.aiCacheDir || '';
    const modelName = newFileJson.filter((item: HistoryInfo) => item.updateTime === timeStamp);
    const nowLen = modelName ? modelName.length : 0;
    if (nowLen === 0) {
      this.logAndReportError('History Convert not found.');
      return;
    }
    const homePath = path.join(workFolder, `/Convert/convert_${timeStamp}`);

    if (!fs.existsSync(homePath)) {
      logger.info('Convert directory not found.');
      return;
    }
    const profilingPath = benchmarkFile[0].filter(item => {
      return item.convertUUId === parseInt(timeStamp);
    });
    try {
      profilingPath.forEach(item => { common.deleteFolder(`/Benchmark/benchmark_${item.updateTime}`) });
    } catch (error) {
      logger.info('Benchmark directory not found.');
    }

    common.deleteFolder(homePath);
    if (nowList.length === 0) {
      this.updateChart([], 'convert', ApiMethod.UPDATE_CONSTARK);
    }
    fs.writeFileSync(filePath, JSON.stringify(newHistoryList), 'utf8');
  }

  // 查询benchmark记录
  static getProfilingHistoryInfo(message: any): void {
    const [newFileJson] = this.getCompressionConvertHistoryFilePath('benchmark');
    const lastConvertTS = extension.mockLocalStorage?.getItem('lastConvertTS');
    let fileJson: any = [];
    if (lastConvertTS) {
      fileJson = newFileJson.filter(item => item.convertUUId === parseInt(lastConvertTS));
    }
    // 发消息到前端更新选中数据
    // 提取最新的 profiling 和 accuracy 数据
    const profilingArr = this.sortAndFilterStage(fileJson, 'profiling');
    const accArr = this.sortAndFilterStage(fileJson, 'accuracy');
    this.updateResultStatus(profilingArr, accArr);

    const getResultHistoryCallbackMessage: GetResultHistoryCallbackMessage = {
      method: ApiMethod.GET_PROFILING_HISTORY_INFO_BACK,
      params: { data: fileJson },
    };
    extension.chipConfigPanel?.postMessage(getResultHistoryCallbackMessage);
  }

  // 删除选定的benchmark记录
  static deleteProfilingHistoryInfo(message: any): void {
    const { params: { timeStamp } } = message;

    const [newFileJson, filePath] = this.getCompressionConvertHistoryFilePath('benchmark');
    const len = newFileJson.length ? newFileJson.length : 0;
    if (len === 0) {
      this.logAndReportError('Benchmark history folder missing.');
      return;
    }
    const newHistoryList = newFileJson.filter((item: HistoryInfo) => !timeStamp.includes(item.updateTime));
    this.deleteProfilingFolder(timeStamp);
    fs.writeFileSync(filePath, JSON.stringify(newHistoryList), 'utf8');
  }

  static deleteProfilingFolder(arr: any): void {
    const workFolder = GlobalModel.instance.aiCacheDir;
    if (!workFolder) {
      return;
    }
    arr.forEach((one: any) => {
      const homePath = path.join(workFolder, `/Benchmark/benchmark_${one}`);
      if (!fs.existsSync(homePath)) {
        logger.info('Benchmark directory not found.');
        return;
      }
      common.deleteFolder(homePath);
    });
  }

  // 查询历史记录
  static getSelectModelHistoryInfo(message: any): void {
    const { params: { page } } = message;
    const [newFileJson] = this.getHistoryFilePath();
    const len = newFileJson ? newFileJson.length : 0;
    const queryData = newFileJson.slice((page - 1) * 5, ((page - 1) * 5) + 5); // show five items at front page.
    const getHistoryCallbackMessage: GetHistoryCallbackMessage = {
      method: ApiMethod.GET_SELECT_MODEL_HISTORY_INFO_BACK,
      params: { data: page === -1 ? newFileJson : queryData, totalData: len },
    };
    extension.chipConfigPanel?.postMessage(getHistoryCallbackMessage);
  }

  // 删除某一条历史记录
  static deleteSelectModelHistoryInfo(message: any): void {
    const { params: { timeStamp } } = message;
    const [newFileJson, filePath] = this.getHistoryFilePath();
    const len = newFileJson ? newFileJson.length : 0;
    if (len === 0) {
      this.logAndReportError('History entries not found.');
      return;
    }
    const newHistoryList = newFileJson.filter((item: HistoryInfo) => item.updateTime !== timeStamp);
    const modelName = newFileJson.filter((item: HistoryInfo) => item.updateTime === timeStamp);
    const nowLen = modelName ? modelName.length : 0;
    if (nowLen === 0) {
      this.logAndReportError('History Info not found.');
      return;
    }
    // Resolve the model cache folder under xxx_hiproj/aicache/.
    const homePath = path.join(GlobalModel.instance.hiprojDir!, 'aicache', `${modelName[0].modelName}_${timeStamp}`);
    if (!fs.existsSync(homePath)) {
      logger.info('History directory not found.');
      return;
    }
    common.deleteFolder(homePath);
    fs.writeFileSync(filePath, JSON.stringify(newHistoryList), 'utf8');
  }

  // 历史记录排序
  static sortSelectModelHistoryInfo(message: any): void {
    const { params: { sortType = 'Date', sortByInfo = 'desc' } } = message ?? {};
    const [newFileJson, filePath] = this.getHistoryFilePath();
    const len = newFileJson ? newFileJson.length : 0;
    if (len === 0) { return; }
    const newHistoryList = newFileJson.sort((a: HistoryInfo, b: HistoryInfo): any => {
      switch (sortType) {
        case 'Date':
          return sortByInfo === 'desc' ? b.updateTime - a.updateTime : a.updateTime - b.updateTime;
        case 'Name':
          return sortByInfo === 'desc' ? (b.modelName).charCodeAt(0) - (a.modelName).charCodeAt(0) : (a.modelName).charCodeAt(0) - (b.modelName).charCodeAt(0);
        case 'Size':
          return sortByInfo === 'desc' ? b.contentLength - a.contentLength : a.contentLength - b.contentLength;
        default:
          logger.error('Unknown sortType.');
          break;
      }
      return undefined;
    });
    fs.writeFileSync(filePath, JSON.stringify(newHistoryList), 'utf8');
  }

  static async setCurrentModelHistory(message: any): Promise<void> {
    let lastWslDistro;
    const { timeStamp, target, isConnected = false } = message.params ?? {};

    // aicache lives inside xxx_hiproj/ folder, not in the SDK workspace folder.
    const workFolder = path.join(GlobalModel.instance.hiprojDir!, 'aicache');
    if (!fs.existsSync(workFolder)) {
      this.logAndReportError('check if /aicache has been deleted.'); return; // unlikely
    }

    // Get dir name and model name by keyword (timestamp)
    const entries = fs.readdirSync(workFolder, { withFileTypes: true });
    const cacheDir = entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .find(dirName => dirName.includes(timeStamp));
    if (!cacheDir) {
      this.logAndReportError('check if history folder has been deleted.');
      return;
    }
    const modelName = cacheDir.replace(`_${timeStamp}`, '');

    // Get History root directory.
    const historyRootDir = path.join(workFolder, cacheDir);
    if (!fs.existsSync(historyRootDir)) {
      this.logAndReportError('check if history folder has been deleted.');
      return;
    }

    // Get remote model and source by reading global.txt.
    let remoteModel;
    let source: Source;
    const globalFile = path.join(historyRootDir, 'global.txt');
    try {
      const jsonData = fs.readFileSync(globalFile, 'utf-8');
      const parsedItems = JSON.parse(jsonData);
      remoteModel = parsedItems.selectedFile;
      source = parsedItems?.source ?? 'linux';
      if (source === 'wsl') {
        lastWslDistro = parsedItems.wslDistro;
        if (!lastWslDistro) { throw new Error('wslDistro field not found.') } // unlikely.
        GlobalModel.instance.wslDistro = lastWslDistro;
      }
    } catch (err) {
      this.logAndReportError(`Error when reading global.txt: ${this.handleError(err)}`);
      return;
    }
    if (target === 'NPU') {
      vscode.window.showInformationMessage(`Entering from a record on ${source === 'linux' ? 'Linux' : 'WSL'}`);
    }

    // in case there's change of source.
    extension.chipConfigPanel?.postMessage({ type: 'Source', params: { source: source } });

    // Global instance. remoteHome will be set when connecting to the server.
    GlobalModel.instance.selectedFile = remoteModel;
    GlobalModel.instance.aiCacheDir = historyRootDir;
    GlobalModel.instance.localFile = path.join(historyRootDir, 'selectmodel', modelName);

    // For onnx and tflite files, read parsedModel.json
    const { modelEndsWith } = this.parseModelPath(remoteModel, '/');
    if (modelEndsWith === 'onnx' || modelEndsWith === 'tflite') {
      if (modelEndsWith === 'tflite' && target !== 'CPU') {
        this.logAndReportError('Not supported on this platform!');
        return;
      }
      const errMsg = this.generateConfig(target, modelEndsWith, 'full');
      if (errMsg !== undefined) {
        this.logAndReportError(errMsg);
        return;
      }
    }

    // Set the corresponding stage disabled.
    this.setStageDisabled(modelEndsWith);

    // 1156e: restore skipQuantize flag and lastQuantTS from the placeholder quant entry.
    if (GlobalModel.instance.soc === '1156e') {
      extension.mockLocalStorage?.setItem('skipQuantize', true);
      const [quantJson] = this.getCompressionConvertHistoryFilePath('quantize');
      if (quantJson.length > 0) {
        const latestQuantTs = Math.max(...quantJson.map((e: any) => e.updateTime));
        extension.mockLocalStorage?.setItem('lastQuantTS', latestQuantTs);
      }
    }

    // Clear history before proceeding.
    await this.clearHistory();

    // Connect to server / check wsl connectivity based on source.
    if (source === 'wsl') {
      GlobalModel.instance.source = 'wsl';
      try {
        await this.ensureWslReady(lastWslDistro, 'core');
      } catch (err) {
        this.logAndReportError(this.handleError(err)); return;
      }
    } else if (source === 'linux') {
      await this.connectToServer({
        type: 'core',
        params: {
          target, source, connected: isConnected,
          data: { name: `${modelName}_${timeStamp}`, timeStamp },
        },
      });
    } else {
      await this.windowsBasicSetup('core');
    }

    // Watchers.
    this.clearAllWatchers(); // Clear all watchers first.
    if (source === 'linux') {
      this.watchers({ serial: true, heartbeat: true }); // enbale serial port watcher and heartbeat watcher.
    } else {
      this.watchers({ serial: true, heartbeat: false }); // Only enable serial port watcher
    }
  }

  static async windowsBasicSetup(mode: 'core' | 'newmodel'): Promise<void> {
    if (mode === 'newmodel') { await this.newModelSetup(); }
    GlobalModel.instance.source = 'windows';
    extension.chipConfigPanel?.postMessage({ type: 'Source', params: { source: 'windows' } });
    if (mode === 'core') {
      const skipQuantize = GlobalModel.instance.soc === '1156e' ? true : undefined;
      const msg: Message = { type: 'AllDone', params: { source: 'windows', skipQuantize } };
      extension.chipConfigPanel?.postMessage(msg);
    }
  }

  // Generate aicache folder that stores outputs and history info.
  // aicache is now placed inside xxx_hiproj/ folder, not in the SDK workspace folder.
  static async generateFolders(): Promise<void> {
    const workFolder = path.join(GlobalModel.instance.hiprojDir!, 'aicache');
    fs.mkdirSync(workFolder, { recursive: true });
    const historyPath = path.join(workFolder, 'history.json');
    if (!fs.existsSync(historyPath)) {
      fs.writeFileSync(historyPath, '[]', 'utf-8');
      logger.info('Created history.json.');
    }
  }

  static async connectToServer(message: Message): Promise<void> {
    GlobalModel.instance.source = 'linux'; // won't enter this function on wsl.
    extension.chipConfigPanel?.postMessage({ type: 'Source', params: { source: 'linux' } });

    const type = message.type;
    const { target, nextData } = message.params ?? {};
    const connected = extension.isConnected();
    const remoteBuildPath = path.join(common.getWorkFolderPath(), '.vscode', 'remote-build.json');

    if (!connected) {
      const availableCmds = await vscode.commands.getCommands(true);

      let ret;
      if (availableCmds.includes(this.remoteCmdLib.connectCmd)) {
        ret = await vscode.commands.executeCommand(this.remoteCmdLib.connectCmd);
      } else {
        vscode.window.showWarningMessage(
          `Command ${this.remoteCmdLib.connectCmd} not found, make sure HiSpark Studio is activated and up to date.`
        );
        const connectCmdFallback = 'remoteBuild.connect';
        ret = await vscode.commands.executeCommand(connectCmdFallback);
      }
      if (!ret) {
        vscode.window.showErrorMessage('Not connected to remote server.');
        return;
      }

      if (!fs.existsSync(remoteBuildPath)) {
        const msg = 'remote-build.json: File not found.';
        extension.chipConfigPanel?.postMessage({ type: 'Error', params: { description: msg } });
        return;
      }

      // Connected to Linux server.
      extension.setConnected(true);
    }

    // Set up global remoteHome
    const data = fs.readFileSync(remoteBuildPath, 'utf-8');
    const jsonData = JSON.parse(data);
    const username = jsonData.servers?.[0]?.username;
    if (typeof username !== 'string') {
      const msg = 'Invalid server or username';
      extension.chipConfigPanel?.postMessage({ type: 'Error', params: { description: msg } });
      return;
    }
    GlobalModel.instance.remoteHome = (username === 'root') ? '/root' : `/home/${username || 'default'}`;

    // Create folder based on linuxCache.
    if (target !== 'NPU' && target !== 'CPU') { return; }
    const remoteHome = GlobalModel.instance?.remoteHome;
    if (!remoteHome || !this.isValidRemoteHome(remoteHome)) {
      const msg = `Invalid remoteHome path: ${remoteHome}`;
      extension.chipConfigPanel?.postMessage({ type: 'Error', params: { description: msg } });
      return;
    }

    const setupCmd = [`cd "${remoteHome}"`, `mkdir -p "${remoteRootDir}"`].join(' && ');
    let returnValue: { exitCode: number; stdout: string; stderr: string };
    try {
      returnValue = await vscode.commands.executeCommand(this.remoteCmdLib.executeCmd, setupCmd);
    } catch (err) {
      this.logAndReportError(`Create folder on linux server failed. ${this.handleError(err)}`);
      return;
    }
    if (returnValue.exitCode) {
      this.logAndReportError(`Create folder on linux server failed. ${returnValue.stderr}`);
      return;
    }

    // Connected.
    let connectedMsg: Message;
    if (type === 'newmodel') {
      connectedMsg = { type: 'Connected' };
      await this.newModelSetup();
    } else if (type === 'core') {
      const skipQuantize = GlobalModel.instance.soc === '1156e' ? true : undefined;
      connectedMsg = { type: 'AllDone', params: { source: 'linux', skipQuantize } };
    } else {
      this.logAndReportError('Unknown type when connecting to server.');
      return;
    }

    // 生成当前选择模型的路径
    let connectNextMsg: any;
    connectNextMsg = connectedMsg;
    if (nextData) {
      const modelStatusPath = this.getModelStatusPath(nextData);
      connectNextMsg = { ...connectNextMsg, data: modelStatusPath };
    }
    extension.chipConfigPanel?.postMessage(connectNextMsg);
  }

  static async connectToWSL(): Promise<void> {
    let distro; // distro which user decides to pick.
    let distroList;

    try {
      distroList = await this.getWslLists();
    } catch (err) {
      this.logAndReportError(this.handleError(err));
      return;
    }

    const choice = await vscode.window.showQuickPick([
      { label: 'Connect to default WSL' },
      { label: 'Connect to a specific WSL Distro' },
    ]);
    if (!choice) { return; }

    if (choice.label === 'Connect to default WSL') {
      distro = DEFAULT_WSL_DISTRO;
    } else {
      const selected = await vscode.window.showQuickPick(
        distroList.map((name, index) => ({
          label: name,
          description: index === 0 ? 'Default distro' : undefined,
        })),
        { placeHolder: 'Available WSL distro list' },
      );
      if (!selected) { return; }
      distro = selected.label;
    }

    try {
      await this.ensureWslReady(distro, 'newmodel');
    } catch (err) {
      this.logAndReportError(`WSL distro not available : ${this.handleError(err)}`);
    }
  }

  static async ensureWslReady(distro: string, mode: 'core' | 'newmodel'): Promise<void> {
    let distroList;
    GlobalModel.instance.source = 'wsl';
    extension.chipConfigPanel?.postMessage({ type: 'Source', params: { source: 'wsl' } });

    OutputChannelManager.show(this.channelName, true);
    this.outputLogger.clear();
    this.outputLogger.handleLogInfo('Start checking WSL availability...\n\n', 'info');
    try {
      distroList = await this.getWslLists();
    } catch (err) { throw err; }
    if (!distroList.includes(distro)) {
      throw new Error(`WSL distro not found: ${distro}`);
    }
    this.outputLogger.handleLogInfo(`Success. Running with: ${distro}\n`, 'info');

    if (mode === 'newmodel') {
      await this.newModelSetup();
    }

    GlobalModel.instance.wslDistro = distro; // set global wsldistro before notifying front end.
    const skipQuantize = GlobalModel.instance.soc === '1156e' ? true : undefined;
    const msg: Message = mode === 'newmodel'
      ? { type: 'WSLReady' }
      : { type: 'AllDone', params: { source: 'wsl', skipQuantize } };

    extension.chipConfigPanel?.postMessage(msg);
    this.outputLogger.handleLogInfo('WSL is ready to use', 'info');
  }

  static getModelStatusPath(data: any): readonly string[] {
    const workFolder = path.join(GlobalModel.instance.hiprojDir!, 'aicache', data.name, 'history');
    if (!fs.existsSync(workFolder)) { return this.NAV.AT_COMPRESS; }

    const quantData   = this.getModelStatusHistoryFilePath(workFolder, 'quantize');
    const convertData = this.getModelStatusHistoryFilePath(workFolder, 'convert');
    const deployData  = this.getModelStatusHistoryFilePath(workFolder, 'deploy');
    const benchData   = this.getModelStatusHistoryFilePath(workFolder, 'benchmark');

    if (!quantData.length) {
      this.clearConfig();
      return this.NAV.AT_COMPRESS;
    }

    const quantTime = Math.max(...quantData.map((i: any) => i.updateTime));
    const linked = convertData.filter((i: any) => i.quantUUId === quantTime);
    if (!linked.length) { return this.NAV.AT_CONVERT; }

    const convertTime = Math.max(...linked.map((i: any) => i.updateTime));
    return this.navAfterConvert(convertTime, deployData, benchData);
  }

  static async clearConfig(): Promise<void> {
    const target: Target = extension.chipConfigPanel?.target ?? 'CPU';
    if (!GlobalModel.instance.selectedFile) {
      return;
    }
    const model: any = path.basename(GlobalModel.instance.selectedFile ?? '');
    const modelEndsWith = path.extname(model);
    if (!modelEndsWith) {
      return;
    }
    const errMsg = this.generateConfig(target, modelEndsWith, 'full', true);
    if (errMsg !== undefined) {
      this.logAndReportError(errMsg);
      return;
    }
    const compForNow = common.parseArray(extension.mockLocalStorage?.getItem('compressionData'));
    const convForNow = common.parseArray(extension.mockLocalStorage?.getItem('convertData'));

    const config = [
      { key: 'compressionData', value: compForNow },
      { key: 'convertData', value: convForNow },
    ];
    const frontEndConfigCallbackMessage: ConfigMessage = {
      method: ApiMethod.SAVE_CONFIG_CALLBACK,
      params: { config },
    };
    extension.chipConfigPanel?.postMessage(frontEndConfigCallbackMessage);
  }

  static getModelStatusHistoryFilePath(workFolder: string, val: string): any[] {
    let nowPath = `${workFolder}/${val}.json`;
    const filePath: string = path.join(nowPath);
    if (!fs.existsSync(filePath)) {
      return [];
    }

    const fileStats = fs.statSync(filePath);
    const fileSize = fileStats.size;
    if (fileSize === 0) {
      return [];
    }

    try {
      const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return json;
    } catch (err) {
      this.logAndReportError(`${this.handleError(err)}`);
      return [];
    }
  }

  static mergeCPUQuant(cpuValue: any, modelInfo: any, toolsInfo: any, skip: boolean): any {
    const compDataBackup = extension.mockLocalStorage?.getItem('compDataBackup');
    const selectedOutput = cpuValue.find((item: { type: string }) =>
      item.type === 'output',
    )?.defaultValue;

    if (!compDataBackup || !(compDataBackup instanceof Array)) { return {}; }

    const baseSize = compDataBackup.length;
    const setLen = (cpuValue.length - baseSize - 1) / 3;
    if (!(Number.isInteger(setLen))) {
      this.logAndReportError('Quantization misconfigured: CPU');
      return {};
    }

    const caliInputList = [];
    const valiInputList = [];
    for (let i = 0; i < setLen; ++i) {
      const caliInputPath = cpuValue[baseSize + (i * 3)].content;

      caliInputList.push({
        name: (cpuValue[baseSize + (i * 3)]?.key?.split('/')?.[0]) ?? 'Input',
        shape: cpuValue[baseSize + 1 + (i * 3)].content,
        path: caliInputPath,
      });
      valiInputList.push({
        name: (cpuValue[baseSize + (i * 3)]?.key?.split('/')?.[0]) ?? 'Input',
        shape: cpuValue[baseSize + 1 + (i * 3)].content,
        path: cpuValue[baseSize + 2 + (i * 3)].content,
      });
    }

    const bitNumMap: Record<string, number> = { int8: 8, float16: 16, 8: 8 }; // Temporary map for "quantized data type" transition

    // cpuValue[4] = validation_labels_cpu select (defaultValue = 'None' | 'Choose from File System')
    // cpuValue[5] = val_out_cpu file picker (content = actual .csv path chosen by user)
    const validationLabelSel  = cpuValue[4]?.defaultValue ?? 'None';
    const validationLabelPath = validationLabelSel === 'Choose from File System'
      ? (String(cpuValue[5]?.content ?? '').trim())
      : '';

    const quantConfig = {
      quantConfig: {
        validation: cpuValue[1].defaultValue ?? 'validation',
        bitNum: bitNumMap[cpuValue[2].defaultValue] ?? 'bitNum',
        quantType: cpuValue[3].defaultValue ?? 'quantType',
        caliInputs: caliInputList,
        valiInputs: valiInputList,
        valiOutputs: {
          name: selectedOutput,
          path: validationLabelPath,
        },
      },
    };

    const skipQuantOpt = { quant: skip ? '0' : '1' };
    return { ...modelInfo, ...quantConfig, ...skipQuantOpt, ...toolsInfo };
  }

  static async mergePTQQuant(combinedData: any, source: Source, modelInfo: any, toolsInfo: any): Promise<any> {
    const { compressionData } = combinedData;
    const selectedOutput = compressionData.find((item: { type: string }) => item.type === 'output')?.defaultValue;
    const ptqValue = compressionData.filter((item: { type: string }) => item.type.toLowerCase() === 'ptq');
    if (!ptqValue) { return {}; }
    const setLen = (ptqValue.length - 5) / 4;
    if (!(Number.isInteger(setLen))) {
      this.postStatusMsg('QuantFailed');
      return {};
    }
    const caliInputList = [];
    const valiInputList = [];

    // Get real paths (Convert paths if on wsl).
    let valiOutputsPath = ptqValue[4].content;
    try {
      valiOutputsPath = await this.convertPathIfNeeded(valiOutputsPath, source);
    } catch (err) {
      this.postStatusMsg('QuantFailed');
      this.logAndReportError(`${this.handleError(err)}`);
      return {};
    }

    for (let i = 0; i < setLen; ++i) {
      let caliInputPath = ptqValue[5 + (i * 4)].content;
      let valiInputPath = ptqValue[8 + (i * 4)].content;
      try {
        caliInputPath = await this.convertPathIfNeeded(caliInputPath, source);
        valiInputPath = await this.convertPathIfNeeded(valiInputPath, source);
      } catch (err) {
        this.postStatusMsg('QuantFailed');
        this.logAndReportError(`${this.handleError(err)}`);
        return {};
      }

      const rawShape = ptqValue[6 + (i * 4)].content;
      const parsedShape = typeof rawShape[0] === 'string'
        ? rawShape[0].split(',').map(s => Number(s.trim()))
        : rawShape;
      caliInputList.push({
        name: (ptqValue[5 + (i * 4)]?.key?.split('/')?.[0]) ?? 'Input',
        shape: parsedShape ?? 'shape',
        type: ptqValue[7 + (i * 4)].defaultValue,
        path: caliInputPath,
      });
      valiInputList.push({
        name: (ptqValue[5 + (i * 4)]?.key?.split('/')?.[0]) ?? 'Input',
        path: valiInputPath,
      });
    }
    const switchStatusItemPTQ = compressionData.find((item: { key: string }) => item.key === 'switch_status');
    const advancedOptionsataPTQ = switchStatusItemPTQ.defaultValue;
    const advancedOptionsataInfoPTQ = { advanced: advancedOptionsataPTQ };
    const switchInputItemPTQ = compressionData.find((item: { key: string }) => item.key === 'switch_input_value');
    let additionalArgumentsPTQ = advancedOptionsataPTQ === false ? '' : switchInputItemPTQ.defaultValue;
    additionalArgumentsPTQ = await this.convertPathIfNeeded(additionalArgumentsPTQ, source);
    const additionalArgumentsInfoPTQ = { ascendConfig: additionalArgumentsPTQ };
    interface LayerItem {
      name: string;
      opType: string;
      dataType: string;
    };
    const layerData: LayerItem[] = extension.mockLocalStorage?.getItem('layerwiseData');
    if (layerData === undefined) {
      this.logAndReportError('Layerwise Config not found.');
      return {};
    }
    const filterdLayerData = layerData.filter(
      item => item.dataType !== 'default'
    );
    const layerwiseConfig = filterdLayerData.map((item) => ({
      ...item,
      dataType: item.dataType === 'default' ? 'none' : item.dataType,
    }));
    const quantConfig = {
      quantConfig: {
        bitNum: ptqValue[2].defaultValue ?? 'bitNum',
        validation: ptqValue[1].defaultValue ?? 'validation',
        caliInputs: caliInputList,
        valiInputs: valiInputList,
        valiOutputs: {
          name: selectedOutput,
          path: valiOutputsPath,
        },
        layerwiseConfig: layerwiseConfig,
        ...advancedOptionsataInfoPTQ,
        ...additionalArgumentsInfoPTQ,
      },
    };
    return { ...modelInfo, ...quantConfig, ...toolsInfo };
  }

  static async mergeQATQuant(combinedData: any, source: Source, modelInfo: any, toolsInfo: any): Promise<any> {
    const { compressionData, layerData } = combinedData;
    const qatItems: any[] = compressionData.filter((item: any) => item.type?.toLowerCase() === 'qat');
    if (!qatItems.length) { return {}; }

    // Key-based lookup — independent of insertion order.
    const byKey = (k: string): any => qatItems.find((item: any) => item.key === k);
    let networkStructure = byKey('network_structure')?.content;
    let retrainInputs    = byKey('retrain_inputs')?.content;
    let validationInputs = byKey('validation_inputs')?.content;
    let retrainOutputs   = byKey('retrain_output')?.content;
    let validationOutput = byKey('valid_output')?.content;
    const epochNum       = Number(byKey('epoch_num')?.content);
    const batchSize      = Number(byKey('batch_size')?.content);
    const learningRate   = Number(byKey('learning_rate')?.content);

    if (source === 'wsl') {
      try {
        const wslDistro = GlobalModel.instance?.wslDistro;
        if (!wslDistro) {
          throw new Error('wslDistro not found: mergeNPUQuant');
        }

        retrainInputs = await common.winToLinuxPathForWsl(wslDistro, retrainInputs, common.exeRunner);
        validationInputs = await common.winToLinuxPathForWsl(wslDistro, validationInputs, common.exeRunner);
        retrainOutputs = await common.winToLinuxPathForWsl(wslDistro, retrainOutputs, common.exeRunner);
        validationOutput = await common.winToLinuxPathForWsl(wslDistro, validationOutput, common.exeRunner);
        networkStructure = await common.winToLinuxPathForWsl(wslDistro, networkStructure, common.exeRunner);
      } catch (err) {
        this.postStatusMsg('QuantFailed');
        this.logAndReportError(`Failed to convert path: ${this.handleError(err)}`);
        return {};
      }
    }

    const switchStatusItemPTQ = combinedData.compressionData.find((item: { key: string }) => item.key === 'switch_status');
    const advancedEnabled = switchStatusItemPTQ?.defaultValue ?? false;
    const advancedOptionsataInfoQAT = { advanced: advancedEnabled };
    const switchInputItemPTQ = combinedData.compressionData.find((item: { key: string }) => item.key === 'switch_input_value');
    let additionalArgumentsPTQ = advancedEnabled ? switchInputItemPTQ.defaultValue : '';
    additionalArgumentsPTQ = await this.convertPathIfNeeded(additionalArgumentsPTQ, source);
    const additionalArgumentsInfoQAT = { ascendConfig: additionalArgumentsPTQ };

    const filterdLayerData = layerData.filter((item: any) => item.dataType !== 'default');
    const layerwiseConfig = filterdLayerData.map((item: any) => ({ ...item, dataType: item.dataType === 'default' ? 'none' : item.dataType }));
    const quantConfig = {
      networkStructure: networkStructure ?? 'networkStructure',
      quantConfig: {
        epochNum: epochNum ?? 'epochNum',
        batchSize: batchSize ?? 'batchSize',
        learningRate: learningRate ?? 'learningRate',
        retrainInputs: retrainInputs ?? 'retrainInputs',
        retrainOutputs: retrainOutputs ?? 'retrainOutputs',
        validationInputs: validationInputs ?? 'validationInputs',
        validationOutput: validationOutput ?? 'validationOutput',
        layerwiseConfig: advancedEnabled ? [] : layerwiseConfig,
        ...advancedOptionsataInfoQAT,
        ...additionalArgumentsInfoQAT,
      },
    };

    return { ...modelInfo, ...quantConfig, ...toolsInfo };
  }

  static async mergeNPUQuant(type: any, source: Source, combinedData: any, modelInfo: any, toolsInfo: any): Promise<any> {
    if (type.toUpperCase() === 'PTQ') {
      return this.mergePTQQuant(combinedData, source, modelInfo, toolsInfo);
    } else if (type.toUpperCase() === 'QAT') {
      return this.mergeQATQuant(combinedData, source, modelInfo, toolsInfo);
    } else {
      return {};
    }
  }

  static async prepareQuantEnvironment(ctx: QuantContext): Promise<void> {
    if (ctx.source === 'linux') {
      let folder = 'quant';
      await this.uploadScripts(ctx.target, folder, ctx.rootDir);

      if (!ctx.isCPU) {
        folder = 'common';
        await this.uploadScripts(ctx.target, folder, ctx.rootDir);

        folder = 'model_select';
        await this.uploadScripts(ctx.target, folder, ctx.rootDir);
      }
    }
  }

  static async writeQuantInputs(ctx: QuantContext): Promise<void> {
    const { quantJsonPath, retrainCfgPath, remoteJsonDir } = ctx.paths;

    // Check if paths are valid.
    const stage = ctx.isQAT ? 'qat' : 'ptq';
    try {
      await this.checkIfPathValid(stage, ctx.mergedData, ctx.source);
    } catch (err) {
      throw new Error(this.handleError(err));
    }

    try {
      const jsonData = JSON.stringify(ctx.mergedData, null, 2);
      fs.writeFileSync(quantJsonPath, jsonData, 'utf8');
      if (ctx.source === 'linux') {
        // Upload retrain.cfg
        if (ctx.isQAT) {
          await vscode.commands.executeCommand(
            this.remoteCmdLib.uploadCmd,
            retrainCfgPath,
            `${remoteJsonDir}/retrain.cfg`
          );
        }

        // Upload quant.json to Linux server.
        await vscode.commands.executeCommand(
          this.remoteCmdLib.uploadCmd,
          quantJsonPath,
          `${remoteJsonDir}/quant.json`
        );
      }
    } catch (err: any) {
      throw new Error(`Failed to write quant.json: ${this.handleError(err)}`);
    }
  }

  static async runQuantScript(ctx: QuantContext): Promise<void> {
    vscode.window.showInformationMessage('Start running quantization script. Check the output panel for details.');
    // Will throw immediately once failed.
    if (ctx.source === 'wsl') {
      await this.runQuantOnWSL(ctx);
    } else if (ctx.source === 'linux') {
      await this.runQuantOnLinux(ctx);
    } else {
      await this.runQuantonWindows(ctx);
    }
    vscode.window.showInformationMessage('Quantization script ran successfully.');
  }

  static async runQuantonWindows(ctx: QuantContext): Promise<void> {
    try {
      const { paths } = ctx;
      const toolsPath = common.getToolsPath();
      const python = path.join(toolsPath, 'tools', 'python', 'python.exe');
      if (!fs.existsSync(python)) {
        throw new Error('Check if python is installed');
      }
      const scriptPath = path.join(__dirname, '../resources/scripts/cpu/quant/quant.py');

      // basic environment setup (mindspore-lite)
      const currentDir = this.getMindSporeLitePath();
      if (!currentDir || !fs.existsSync(currentDir)) {
        throw new Error('Missing dependency: Mindspore-lite. Please reinstall the tool chain.');
      }
      const extraPath1 = path.join(currentDir, 'tools', 'converter', 'lib');
      const extraPath2 = path.join(currentDir, 'tools', 'converter', 'converter');
      const extraPath3 = path.join(currentDir, 'tools', 'benchmark');
      const extraPath4 = path.join(currentDir, 'runtime', 'lib');
      const extraPath5 = path.join(toolsPath, 'tools', 'Windows', 'cc_riscv32_musl_win', 'riscv32-linux-musl', 'bin');

      const env = {
        ...process.env,
        PATH: `${extraPath1};${extraPath2};${extraPath3};${extraPath4};${extraPath5};${process.env.PATH}`,
      };

      if (!fs.existsSync(scriptPath)) {
        throw new Error(`Quant script not found: ${scriptPath}`);
      }

      if (!fs.existsSync(paths.quantJsonPath)) {
        throw new Error(`Quant json not found: ${paths.quantJsonPath}`);
      }

      const cmd = `${python} ${scriptPath} --input_json ${paths.quantJsonPath}`;
      const args = [scriptPath, '--input_json', paths.quantJsonPath];
      await this.runProcess(python, args, currentDir, { cmd: cmd, customEnv: env }, (p) => { this.quantChildProcess = p; });
    } catch (err) {
      throw new Error(`${this.handleError(err)}`);
    }
  }

  static async runQuantOnWSL(ctx: QuantContext): Promise<void> {
    const { wslDistro, paths } = ctx;
    if (!wslDistro) { return; }

    try {
      const wslPython = await this.getWSLPython(wslDistro);

      // this context will never be running on CPU.
      let scriptWin = ctx.isQAT
        ? path.join(__dirname, '../resources/scripts/npu/quant/quant_qat.py')
        : path.join(__dirname, '../resources/scripts/npu/quant/quant_ptq.py');

      const scriptWsl = await common.winToLinuxPathForWsl(wslDistro, scriptWin, common.exeRunner);
      const quantJsonWsl = await common.winToLinuxPathForWsl(wslDistro, paths.quantJsonPath, common.exeRunner);
      if (!scriptWsl || !quantJsonWsl) {
        throw new Error(`Failed to convert paths.`);
      }

      const cmd = ctx.isQAT
        ? `${wslPython} ${common.shQuote(scriptWsl)} --input_json ${common.shQuote(quantJsonWsl)} --device=cpu`
        : `${wslPython} ${common.shQuote(scriptWsl)} --input_json ${common.shQuote(quantJsonWsl)}`;
      const fullArgs = ['-d', wslDistro, '--', 'bash', '-lc', cmd];
      this.outputLogger.handleLogInfo(`Start running: wsl.exe ${fullArgs.join(' ')}\n`, 'info');

      const ret = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
        const child = spawn('wsl.exe', fullArgs, { windowsHide: true });
        this.quantChildProcess = child;
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (data) => {
          stdout += data;
          this.outputLogger.raw(data);
        });
        child.stderr.on('data', (data) => {
          stderr += data;
          this.outputLogger.raw(data);
        });
        child.on('error', (err) => {
          this.quantChildProcess = null;
          resolve({ code: -1, stdout, stderr: String(err) });
        });
        child.on('close', (code) => {
          this.quantChildProcess = null;
          resolve({ code: code ?? -1, stdout, stderr });
        });
      });

      if (ret.code !== 0) {
        throw new Error(`Quantization script failed with exit code: ${ret.code}`);
      }
    } catch (err) {
      throw new Error(`${this.handleError(err)}`);
    }
  }

  static async runQuantOnLinux(ctx: QuantContext): Promise<void> {
    const { remoteHome, rootDir, target, type } = ctx;
    const { remoteJsonDir, remoteQuantDir } = ctx.paths;
    if (!type) { return; }

    const python = getRemotePython(target, GlobalModel.instance.soc);
    const baseCmd = `cd ${remoteHome}/${rootDir}/scripts && `;

    const quantCmdLib = {
      CPU: `${python} ${remoteQuantDir}/quant.py --input_json ${remoteJsonDir}/quant.json`,
      NPU: {
        PTQ: `${python} ${remoteQuantDir}/quant_ptq.py --input_json ${remoteJsonDir}/quant.json`,
        QAT: `${python} ${remoteQuantDir}/quant_qat.py --input_json ${remoteJsonDir}/quant.json --device=cpu`,
      },
    } as const;

    const pythonCmd = target === 'CPU' ? quantCmdLib.CPU : quantCmdLib.NPU[type.toUpperCase() as 'PTQ' | 'QAT'];

    const remoteQuantCacheDir = `${remoteHome}/${rootDir}/.cache/ai`;
    const clearCmd = `[ -d "${remoteQuantCacheDir}/quant" ] && rm -rf "${remoteQuantCacheDir}/quant" || true && `;

    // Disable not found notification temporarily.
    await common.safeExecuteCommand(this.remoteCmdLib.revealCmd, []);
    let ret: { exitCode: number; stdout: string; stderr: string };
    const wrappedCmd = `bash -c 'echo $$ > ${this.quantPidFilePath} && exec ${pythonCmd}'`;
    ret = await vscode.commands.executeCommand(this.remoteCmdLib.executeCmd, clearCmd + baseCmd + wrappedCmd);
    if (this.quantAbortRequested) { return; }
    if (ret.exitCode) {
      throw new Error(`Quantization script failed with exit code: ${ret.exitCode}`);
    }
  }

  static async collectQuantOutputs(ctx: QuantContext): Promise<void> {
    const localDir = ctx.paths.localOutputDir;

    if (!ctx.type) {
      throw new Error('Failed to collect quant outputs due to quant context\'s incompleteness.'); // unlikely.
    }

    try {
      if (ctx.source === 'linux') {
        const remoteDir = ctx.isCPU
          ? ctx.linuxCacheRoot
          : `${ctx.linuxCacheRoot}/${ctx.type?.toLowerCase()}/quant`;
        try {
          // Compress result files and download.
          const tarCmd = `cd ${remoteDir} && tar -czf ../quant.tar.gz .`;
          const remoteTarPath = `${remoteDir}/../quant.tar.gz`;
          const localTarPath = path.join(ctx.paths.localOutputDir, 'quant.tar.gz');
          await vscode.commands.executeCommand(this.remoteCmdLib.executeCmd, tarCmd);
          await vscode.commands.executeCommand(this.remoteCmdLib.downloadCmd, remoteTarPath, localTarPath);

          // Untar quant.tar.gz. Keep quant.tar.gz.
          if (fs.existsSync(localTarPath)) {
            await extractTarFile(localTarPath, ctx.paths.localOutputDir);
          } else {
            throw new Error('Failed to download quant.tar.gz');
          }
        } catch (err) {
          this.handleError(`Failed to compress files: ${err}`);
        }
      } else if (ctx.source === 'windows') {
        // do nothing for now.
      } else {
        // linuxCache was already correct, but there's an extra quant/ under the output folder on WSL. (inevitable unfortunately)
        // We need to move everything up and get rid of this unwanted quant/ directory for a consistent layout.
        this.flattenDir(localDir, 'quant');
      }

      // Save quant config snapshot
      this.configSnapshot(localDir, ctx.compressionData, 'quant');
      this.configSnapshot(localDir, ctx.layerData, 'layer');
    } catch (err) {
      throw new Error(`Failed to collect quant outputs. ${this.handleError(err)}`);
    }
  }

  static async finalizeQuant(ctx: QuantContext): Promise<void> {
    if (!ctx.type) { return; }

    const timeStamp = ctx.timeStamp;
    const localDir = ctx.paths.localOutputDir;
    let fileToDisplay = path.join(localDir, ctx.isQAT ? 'quantQatOutput.json' : 'precision_output.json');
    if (ctx.isCPU) {
      fileToDisplay = path.join(localDir, 'quant_plot.json');
    }
    if (ctx.skipQuant) {
      this.updateHistoryRecord({}, timeStamp);
      // Post success message before navigating to convert page (where messages from quant pages will not be received)
      this.postStatusMsg('QuantSuccess');
      extension.chipConfigPanel?.postMessage({ type: 'UpdateSkipHistory', params: { timeStamp } });
    } else {
      this.importHisGraph(fileToDisplay, 'compression', timeStamp); // display histogram results
      await this.postCompression(ctx);
    }
    this.postStatusMsg('QuantSuccess');
  }

  static async handleQuantRemote(ctx: QuantContext): Promise<void> {
    try {
      // Upload quant scripts if running on Linux.
      await this.prepareQuantEnvironment(ctx);
      if (this.quantAbortRequested) { return; }

      // Write ctx.mergedData to quant.json which then will be used when executing quant script.
      await this.writeQuantInputs(ctx);
      if (this.quantAbortRequested) { return; }

      // Run quant script on either WSL or Linux.
      await this.runQuantScript(ctx);
      if (this.quantAbortRequested) { return; }

      // Collect outputs.
      await this.collectQuantOutputs(ctx);
      if (this.quantAbortRequested) { return; }

      // Display quant outputs, and other post-comp ops.
      await this.finalizeQuant(ctx);
    } catch (err) {
      this.postStatusMsg('QuantFailed');
      this.logAndReportError(`Failed to compress, cause: ${this.handleError(err)}`);
    }
  }

  static paramsConfig(historyRootDir: any, remoteHome: any, type: 'quant' | 'convert'): any {
    // Json file (local and remote)
    const JsonFolder = path.join(historyRootDir, 'Json');
    const JsonPath = path.join(JsonFolder, `${type}.json`);
    const remoteJsonDir = `${remoteHome}/${remoteRootDir}/scripts/Json`;
    const remoteDir = `${remoteHome}/${remoteRootDir}/scripts/${type}`;

    // Locally stored files.
    if (type === 'quant') {
      const retrainCfgPath = path.join(__dirname, '../resources/retrain.cfg');
      const quantJsonFolder = JsonFolder;
      const quantJsonPath = JsonPath;
      const remoteQuantDir = remoteDir;
      if (!fs.existsSync(quantJsonFolder)) {
        fs.mkdirSync(quantJsonFolder, { recursive: true });
      }
      return { quantJsonFolder, quantJsonPath, remoteJsonDir, remoteQuantDir, retrainCfgPath };
    } else {
      const convertJsonFolder = JsonFolder;
      const convertJsonPath = JsonPath;
      const remoteConvertDir = remoteDir;
      // Ensure the Json folder exists (not guaranteed when quantize was skipped, e.g. 1156e).
      if (!fs.existsSync(convertJsonFolder)) {
        fs.mkdirSync(convertJsonFolder, { recursive: true });
      }
      return { convertJsonFolder, convertJsonPath, remoteJsonDir, remoteConvertDir };
    }
  }

  static configSnapshot(localDir: string, rawData: any, type: 'quant' | 'convert' | 'layer'): void {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    let backupData;
    if (type === 'quant') {
      backupData = extension.mockLocalStorage?.getItem('compressionData');
    } else if (type === 'layer') {
      backupData = extension.mockLocalStorage?.getItem('layerwiseData');
    } else {
      backupData = extension.mockLocalStorage?.getItem('convertData');
    }
    let data = rawData ?? backupData;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { data = []; }
    }
    data = Array.isArray(data) ? data : [];
    if (type === 'layer') {
      fs.writeFileSync(path.join(localDir, 'nowLayerConfig.json'), JSON.stringify(data), 'utf8');
    } else { fs.writeFileSync(path.join(localDir, 'nowConfig.json'), JSON.stringify(data), 'utf8'); }
  }

  static async postCompression(ctx: QuantContext): Promise<void> {
    if (ctx.isCPU) { return; }

    const remoteDir = ctx.linuxCacheRoot;
    const localDir = ctx.paths.localOutputDir;
    const model = ctx.selectedFile;
    const remoteHome = ctx.remoteHome;
    const historyRootDir = ctx.historyRootDir;
    const localModelPath = path.join(historyRootDir, `/selectmodel/parsedModel.json`);

    // Read and display window message.
    const windowMsgPath = path.join(ctx.paths.localOutputDir, 'WindowMessage.json');
    this.showWindowMessages(windowMsgPath);

    if (!ctx.isQAT) {
      try {
        const modelDataJsonPath = path.join(localDir, 'modelData.json');
        this.updateConvertDataFromModelData(modelDataJsonPath);
      } catch (err) { throw new Error(this.handleError(err)); }

      return;
    }

    // fake.onnx
    const files = fs.readdirSync(localDir);
    const fakeOnnxFile = files.find(f =>
      f.endsWith('.onnx') &&
      f.toLowerCase().includes('fake')
    );
    if (!fakeOnnxFile) { throw new Error('Cannot access to quant output.'); }

    const fakeOnnxPath = ctx.isWSL ? path.join(localDir, fakeOnnxFile) : `${remoteDir}/qat/quant/${fakeOnnxFile}`;

    // Parse the fake onnx file (quant output).
    if (ctx.isWSL) {
      const distro = ctx.wslDistro;
      if (!distro) { return; } // unlikely.

      const scriptWin = path.join(__dirname, '../resources/scripts/npu/model_select/model_arch_parse.py');
      const scriptWsl = await common.winToLinuxPathForWsl(distro, scriptWin, common.exeRunner);
      const fakeOnnxPathWsl = await common.winToLinuxPathForWsl(distro, fakeOnnxPath, common.exeRunner);
      const localModelPathWsl = await common.winToLinuxPathForWsl(distro, localModelPath, common.exeRunner);
      if (!scriptWsl || !fakeOnnxPathWsl || !localModelPathWsl) {
        throw new Error('Post compression failed. Cannot map script path to WSL linux path');
      }

      // Run parse.py
      const wslPython = await this.getWSLPython(distro);
      const parseCmd = `${wslPython} ${common.shQuote(scriptWsl)} ` + `--model ${common.shQuote(fakeOnnxPathWsl)} ` + `--output_path ${common.shQuote(localModelPathWsl)}`;
      const ret = await common.exeRunner({ exe: 'wsl.exe', args: ['-d', distro, '--', 'bash', '-lc', parseCmd], mode: 'utf8', logger: this.outputLogger, python: true });
      if (ret.code !== 0) { throw new Error(`Post compression failed when analyzing .onnx file, exit code ${ret.code}`); }
    } else {
      // Upload select_model folder in case it hasn't been done yet.
      const rootDir = remoteRootDir;
      const python = getRemotePython(ctx.target, GlobalModel.instance.soc);
      const folder = 'model_select';
      await this.uploadScripts('NPU', folder, rootDir);

      const baseCmd = `cd ${remoteHome}/${rootDir}/ && `;
      const parseModelCmd = `${baseCmd} ${python} ./scripts/model_select/model_arch_parse.py ` +
        `--model ${fakeOnnxPath} --output_path .cache/ai/parsedModel/parsedModel.json`;

      // Run parse.py
      let retValue: { exitCode: number; stdout: string; stderr: string };
      try {
        retValue = await vscode.commands.executeCommand(this.remoteCmdLib.executeCmd, parseModelCmd);
      } catch (err) {
        throw new Error(`Failed to execute ${parseModelCmd} on the remote server : ${this.handleError(err)}`);
      }
      if (retValue.exitCode) { throw new Error(`Post compression failed when analyzing .onnx file. exit code ${retValue.exitCode}`); }

      // Download parsedModel.json.
      const remotePath = `${remoteHome}/${rootDir}/.cache/ai/parsedModel/parsedModel.json`;
      try {
        await vscode.commands.executeCommand(this.remoteCmdLib.downloadCmd, remotePath, localModelPath);
      } catch (err) {
        throw new Error(`Failed to execute ${this.remoteCmdLib.downloadCmd} : ${this.handleError(err)}`);
      }

      if (!fs.existsSync(localModelPath)) {
        throw new Error('Cannot access to parsedModel.json');
      }
    }

    // Update config (lite).
    const { modelEndsWith } = this.parseModelPath(model, '/');
    const errMsg = this.generateConfig(ctx.target, modelEndsWith, 'lite');
    if (errMsg !== undefined) { throw new Error(`postCompression failed : ${this.handleError(errMsg)}`); }
  }

  static showWindowMessages(windowMsgPath: string): void {
    if (!fs.existsSync(windowMsgPath)) {
      return;
    }
    try {
      // Read and parse JSON file
      const raw = fs.readFileSync(windowMsgPath, 'utf-8');
      const json = JSON.parse(raw);

      // WindowMessage must exist
      if (!json || typeof json !== 'object' || !json.WindowMessage) {
        throw new Error('WindowMessage field is missing in JSON file.');
      }

      const wm = json.WindowMessage;

      // Safely normalize to string array
      const safeArray = (val: any): string[] => {
        if (!Array.isArray(val)) {
          return [];
        }
        return val.filter(item => typeof item === 'string');
      };

      // Extract message groups
      const errors = safeArray(wm.Error);
      const warnings = safeArray(wm.Warning);
      const infos = safeArray(wm.Info);

      // Display in order: Error -> Warning -> Info
      for (const msg of errors) {
        vscode.window.showErrorMessage(msg);
      }

      for (const msg of warnings) {
        vscode.window.showWarningMessage(msg);
      }

      for (const msg of infos) {
        vscode.window.showInformationMessage(msg);
      }
    } catch (err) {
      // Propagate error to caller
      throw err;
    }
  }

  static async handleConvertRemote(ctx: ConvertContext): Promise<void> {
    try {
      // Upload convert scripts if running on Linux.
      await this.prepareConvertEnvironment(ctx);
      if (this.convertAbortRequested) { return; }

      // Write ctx.mergedData to convert.json which then will be used when executing convert script.
      await this.writeConvertInputs(ctx);
      if (this.convertAbortRequested) { return; }

      // Run convert script on either WSL or Linux.
      await this.runConvertScript(ctx);
      if (this.convertAbortRequested) { return; }

      // Collect outputs.
      await this.collectConvertOutputs(ctx);
      if (this.convertAbortRequested) { return; }

      // Display convert outputs.
      await this.finalizeConvert(ctx);
    } catch (err) {
      this.postStatusMsg('ConvertFailed');
      this.logAndReportError(this.handleError(err));
    }
  }

  static async prepareConvertEnvironment(ctx: ConvertContext): Promise<void> {
    if (ctx.source === 'linux') {
      const rootDir = remoteRootDir;

      let folder = 'convert';
      await this.uploadScripts(ctx.target, folder, rootDir);

      if (!ctx.isCPU) {
        folder = 'common';
        await this.uploadScripts(ctx.target, folder, rootDir);
      }
    }
  }

  static async writeConvertInputs(ctx: ConvertContext): Promise<void> {
    const { convertJsonPath, remoteJsonDir } = ctx.paths;

    try {
      const jsonData = JSON.stringify(ctx.mergedData, null, 2);
      fs.writeFileSync(convertJsonPath, jsonData, 'utf8');

      if (ctx.source === 'linux') {
        await vscode.commands.executeCommand(
          this.remoteCmdLib.uploadCmd,
          convertJsonPath,
          `${remoteJsonDir}/convert.json`
        );
      }
    } catch (err: any) {
      throw new Error(`Failed to write convert.json: ${this.handleError(err)}`);
    }
  }

  static async runConvertScript(ctx: ConvertContext): Promise<void> {
    vscode.window.showInformationMessage('Start running conversion script. Check the output panel for details.');
    if (ctx.source === 'wsl') { await this.runConvertOnWSL(ctx); }
    if (ctx.source === 'linux') { await this.runConvertOnLinux(ctx); }
    if (ctx.source === 'windows') { await this.runConvertOnWindows(ctx); }
    vscode.window.showInformationMessage('Conversion script ran successfully.');
  }

  static async runConvertOnWSL(ctx: ConvertContext): Promise<void> {
    const distro = GlobalModel.instance.wslDistro;
    if (!distro) { return; } // unlikely

    try {
      const python = await this.getWSLPython(distro);
      const scriptWin = path.join(__dirname, '../resources/scripts/npu/convert/convert.py');

      const scriptWsl = await common.winToLinuxPathForWsl(distro, scriptWin, common.exeRunner);
      const jsonWsl = await common.winToLinuxPathForWsl(distro, ctx.paths.convertJsonPath, common.exeRunner);
      if (!scriptWsl || !jsonWsl) {
        throw new Error(`Failed to convert paths.`);
      }

      const cmd = `${python} ${common.shQuote(scriptWsl)} --input_json ${common.shQuote(jsonWsl)}`;
      const fullArgs = ['-d', distro, '--', 'bash', '-lc', cmd];
      this.outputLogger.handleLogInfo(`Start running: wsl.exe ${fullArgs.join(' ')}\n`, 'info');

      const ret = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
        const child = spawn('wsl.exe', fullArgs, { windowsHide: true });
        this.wslConvertChildProcess = child;
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (data) => {
          stdout += data;
          this.outputLogger.raw(data);
        });
        child.stderr.on('data', (data) => {
          stderr += data;
          this.outputLogger.raw(data);
        });
        child.on('error', (err) => {
          this.wslConvertChildProcess = null;
          resolve({ code: -1, stdout, stderr: String(err) });
        });
        child.on('close', (code) => {
          this.wslConvertChildProcess = null;
          resolve({ code: code ?? -1, stdout, stderr });
        });
      });

      if (ret.code !== 0) {
        throw new Error(`Conversion script failed with exit code: ${ret.code}`);
      }
    } catch (err) {
      throw new Error(`${this.handleError(err)}`);
    }
  }

  static async runConvertOnLinux(ctx: ConvertContext): Promise<void> {
    const { target } = ctx;
    const remoteHome = GlobalModel.instance?.remoteHome;
    if (!remoteHome) { return; }

    const python = getRemotePython(target, GlobalModel.instance.soc);
    const rootDir = remoteRootDir;
    const isCPU = target === 'CPU';

    const baseCmd = isCPU
      ? `cd ${remoteHome}/${rootDir}/scripts && `
      : `source /usr/local/hisparkai/Ascend/latest/bin/setenv.bash && cd ${remoteHome}/${rootDir}/scripts && `;

    const pythonCmd =
      `${python} ${ctx.paths.remoteConvertDir}/convert.py ` +
      `--input_json ${ctx.paths.remoteJsonDir}/convert.json`;
    const wrappedCmd = `bash -c 'echo $$ > ${this.convertPidFilePath} && exec ${pythonCmd}'`;

    // Disable not found notification temporarily.
    await common.safeExecuteCommand(this.remoteCmdLib.revealCmd, []);
    let ret: { exitCode: number; stdout: string; stderr: string };
    ret = await vscode.commands.executeCommand(this.remoteCmdLib.executeCmd, baseCmd + wrappedCmd);
    if (this.convertAbortRequested) { return; }
    if (ret.exitCode) {
      throw new Error(`Converion script failed with exit code: ${ret.exitCode}`);
    }
  }

  static async runConvertOnWindows(ctx: ConvertContext): Promise<void> {
    try {
      const { paths } = ctx;
      const toolsPath = common.getToolsPath();
      const python = path.join(toolsPath, 'tools', 'python', 'python.exe');
      if (!fs.existsSync(python)) {
        throw new Error('Check if python is installed');
      }
      const scriptPath = path.join(__dirname, '../resources/scripts/cpu/convert/convert.py');

      // basic environment setup (mindspore-lite)
      const currentDir = this.getMindSporeLitePath();
      if (!currentDir || !fs.existsSync(currentDir)) {
        throw new Error('Missing dependency: Mindspore-lite. Please reinstall the tool chain.');
      }
      const extraPath1 = path.join(currentDir, 'tools', 'converter', 'lib');
      const extraPath2 = path.join(currentDir, 'tools', 'converter', 'converter');
      const extraPath3 = path.join(toolsPath, 'tools', 'Windows', 'cc_riscv32_musl_win', 'bin');
      const extraPath4 = path.join(toolsPath, 'tools', 'Windows', 'cc_riscv32_musl_win', 'riscv32-linux-musl', 'bin');

      const env = {
        ...process.env,
        PATH: `${extraPath1};${extraPath2};${extraPath3};${extraPath4};${process.env.PATH}`,
      };

      if (!fs.existsSync(scriptPath)) {
        throw new Error(`Convert script not found: ${scriptPath}`);
      }

      if (!fs.existsSync(paths.convertJsonPath)) {
        throw new Error(`Convert json not found: ${paths.convertJsonPath}`);
      }

      const cmd = `${python} ${scriptPath} --input_json ${paths.convertJsonPath}`;
      const args = [scriptPath, '--input_json', paths.convertJsonPath];
      await this.runProcess(python, args, currentDir, { cmd: cmd, customEnv: env }, (p) => { this.convertChildProcess = p; });
    } catch (err) {
      throw new Error(`${this.handleError(err)}`);
    }
  }

  static async collectConvertOutputs(ctx: ConvertContext): Promise<void> {
    const localDir = ctx.paths.localOutputDir;

    if (ctx.source === 'linux') {
      try {
        await vscode.commands.executeCommand(
          this.remoteCmdLib.downloadMultiCmd,
          ctx.linuxCacheRoot,
          localDir
        );
      } catch (err) {
        throw new Error('Failed to collect convert outputs.');
      }
    }
  }

  static async finalizeConvert(ctx: ConvertContext): Promise<void> {
    const stage = 'convert';
    const dir = ctx.paths.localOutputDir;

    const files = fs.readdirSync(dir);
    const jsonFiles = files.filter(f => path.extname(f).toLowerCase() === '.json');

    const targetFile =
      jsonFiles.length > 0
        ? path.join(dir, jsonFiles[0])
        : path.join(dir, 'convert.exeom');

    await this.importConStark(stage, targetFile, ctx.timeStamp);

    this.postStatusMsg('ConvertSuccess');
  }

  static async applyDataQuantize(target: Target, combinedData: any, source: Source, type: string, skipQuant: boolean): Promise<void> {
    const { compressionData, layerData } = combinedData;
    if (target !== 'CPU' && target !== 'NPU') { return; } // unlikely.

    const isCPU = target === 'CPU';
    const model = GlobalModel.instance.selectedFile;
    const remoteHome = GlobalModel.instance?.remoteHome;
    if (!remoteHome && source === 'linux') {
      this.postStatusMsg('QuantFailed', { description: 'remoteHome not found' });
      return;
    }

    // Generate merged data for this context.
    const dateTime = Date.now();
    extension.mockLocalStorage?.setItem('lastQuantTS', dateTime);
    const historyRootDir = GlobalModel.instance?.aiCacheDir;
    if (!historyRootDir) { return; } // unlikely

    const localDir = isCPU
      ? path.join(historyRootDir, `Quant/quant_${dateTime}`)
      : path.join(historyRootDir, `Quant/quant_${dateTime}/${type.toLowerCase()}`);
    fs.mkdirSync(localDir, { recursive: true });

    // QAT specific: copy layerwise_config.json (under /tmp) to localDir, which will be used to update layerWiseData.
    if (type === 'QAT') {
      const layerWiseConfigJsonPath = path.join(historyRootDir, 'tmp', 'layerwise_config.json');
      if (!fs.existsSync(layerWiseConfigJsonPath)) {
        this.postStatusMsg('QuantFailed', { description: 'layerwise_config.json not found. Upload network structure file' });
        return;
      }
      try {
        await common.copyFileToFolder(layerWiseConfigJsonPath, localDir);
      } catch (err) {
        this.postStatusMsg('QuantFailed', { description: err });
        return;
      }
    }

    let mergedData = {};
    const modelInfo = { modelSelected: model };
    const linuxCacheRoot = `${remoteHome}/${remoteRootDir}/.cache/ai/quant`; // remoteRootDir: hisparkai
    let realLinuxCache;
    if (source === 'linux') {
      realLinuxCache = (type === 'PTQ') ? `${linuxCacheRoot}/ptq` : `${linuxCacheRoot}/qat`;
    } else {
      try {
        realLinuxCache = await this.convertPathIfNeeded(localDir, source);
      } catch (err) {
        this.postStatusMsg('QuantFailed'); return;
      }
    }

    const toolsInfo = {
      CPU: {
        tools: {
          linuxCache: source === 'windows' ? realLinuxCache : linuxCacheRoot,
          mindSporeLitePath: undefined as string | undefined,
        },
      },
      NPU: {
        tools: {
          linuxCache: realLinuxCache,
          cannPath: source === 'linux' ? '/usr/local/hisparkai/Ascend' : '/usr/local/Ascend',
        },
      },
    };
    if (source === 'windows') {
      const mindSporeLitePath = this.getMindSporeLitePath();
      if (!mindSporeLitePath || !fs.existsSync(mindSporeLitePath)) {
        throw new Error('Missing dependency: Mindspore-lite. Please reinstall the tool chain.');
      }
      toolsInfo.CPU.tools.mindSporeLitePath = mindSporeLitePath;
    }

    if (!isCPU) {
      mergedData = await this.mergeNPUQuant(type, source, combinedData, modelInfo, toolsInfo.NPU);
    } else {
      mergedData = await this.mergeCPUQuant(compressionData, modelInfo, toolsInfo.CPU, skipQuant); // next without quantization only used in CPU.
    }
    if (Object.keys(mergedData).length === 0) { return; }

    // Build context for this Quant operation.
    const ctx = this.buildQuantContext({ mergedData, compressionData, layerData, linuxCacheRoot }, target, type, source, skipQuant);
    if (!ctx) { this.postStatusMsg('QuantFailed'); return; }

    ctx.timeStamp = dateTime;
    ctx.paths.localOutputDir = localDir;

    await this.handleQuantRemote(ctx);
  }

  static updateLastTs(msg: Message): void {
    const { params } = msg;
    const timeStamp = params?.timeStamp?.toString();
    const page = params?.page?.toString();
    if (!page) { return; }
    extension.mockLocalStorage?.setItem(page, timeStamp);
    const navbarStatus = this.getNowStatusPath(params);
    const selectedFileMsg: any = { type: 'UpdateModelStatus', data: navbarStatus };
    extension.chipConfigPanel?.postMessage(selectedFileMsg);
  }

  static generateDeployTS(msg: any): void {
    const dateTime = (new Date()).getTime();
    extension.mockLocalStorage?.setItem('lastDeployTS', dateTime);
    const lastConvertTS = msg.params?.timeStamp ?? extension.mockLocalStorage?.getItem('lastConvertTS');
    const [newFileJson, filePath] = this.getCompressionConvertHistoryFilePath('deploy');
    // Save data to deploy.json
    const historyList: any = newFileJson;
    const historyInfo = {
      timeStamp: dateTime,
      convertUUId: parseInt(lastConvertTS),
    };
    historyList.push(historyInfo);
    try {
      fs.writeFileSync(filePath, JSON.stringify(historyList), 'utf8');
    } catch (err) {
      this.logAndReportError(`Generating deploy history failed! : ${this.handleError(err)}`);
    }

    const config = [
      { key: 'lastDeployTS', value: dateTime },
    ];

    this.updateFrontEndStorage(config);
  }

  static updateFrontEndStorage(config: any): void {
    const frontEndConfigCallbackMessage: ConfigMessage = {
      method: ApiMethod.SAVE_CONFIG_CALLBACK,
      params: { config },
    };
    extension.chipConfigPanel?.postMessage(frontEndConfigCallbackMessage);
  }

  // ─── Navigator status constants ──────────────────────────────────────────
  // Step order: SelectModel | Quantize | Convert | Deploy | Benchmark
  private static readonly NAV = {
    AT_COMPRESS:   ['finish', 'process', 'wait',    'wait',    'wait'   ],
    AT_CONVERT:    ['finish', 'finish',  'process', 'wait',    'wait'   ],
    AT_DEPLOY:     ['finish', 'finish',  'finish',  'process', 'wait'   ],
    AT_BENCHMARK:  ['finish', 'finish',  'finish',  'finish',  'wait'   ],
    DONE:          ['finish', 'finish',  'finish',  'finish',  'finish' ],
  } as const;

  /**
   * Given a confirmed convert timestamp, determine what step comes next by
   * checking whether deploy / benchmark history entries reference it.
   */
  private static navAfterConvert(
    convertTime: number,
    deploy: any[],
    benchmark: any[],
  ): readonly string[] {
    if (benchmark.some((i: any) => i.convertUUId === convertTime)) { return this.NAV.DONE; }
    if (deploy.some((i: any) => i.convertUUId === convertTime))    { return this.NAV.AT_BENCHMARK; }
    return this.NAV.AT_DEPLOY;
  }

  static getNowStatusPath(selectItem: any): readonly string[] {
    const { page, timeStamp } = selectItem;
    const historyRootDir = GlobalModel.instance.aiCacheDir;
    if (!historyRootDir) { return this.NAV.AT_COMPRESS; }

    const workFolder  = path.join(historyRootDir, 'history');
    const quantData   = this.getModelStatusHistoryFilePath(workFolder, 'quantize');
    const convertData = this.getModelStatusHistoryFilePath(workFolder, 'convert');
    const deployData  = this.getModelStatusHistoryFilePath(workFolder, 'deploy');
    const benchData   = this.getModelStatusHistoryFilePath(workFolder, 'benchmark');

    if (page === 'lastQuantTS') {
      const linked = convertData.filter((i: any) => i.quantUUId === timeStamp);
      if (linked.length) {
        const convertTime = Math.max(...linked.map((i: any) => i.updateTime));
        return this.navAfterConvert(convertTime, deployData, benchData);
      }
      return quantData.length ? this.NAV.AT_CONVERT : this.NAV.AT_COMPRESS;

    } else if (page === 'lastConvertTS') {
      const lastQuantTS = extension.mockLocalStorage?.getItem('lastQuantTS');
      if (lastQuantTS) {
        const linked = convertData.filter((i: any) => i.quantUUId === parseInt(lastQuantTS));
        if (linked.length) {
          return this.navAfterConvert(Number(timeStamp), deployData, benchData);
        }
        return quantData.length ? this.NAV.AT_CONVERT : this.NAV.AT_COMPRESS;
      }
      return this.NAV.AT_COMPRESS;

    } else if (page === 'Deploy') {
      const lastConvertTS = extension.mockLocalStorage?.getItem('lastConvertTS');
      if (lastConvertTS) {
        const linked = deployData.filter((i: any) => i.convertUUId === parseInt(lastConvertTS));
        if (linked.length) {
          return benchData.some((i: any) => i.convertUUId === timeStamp) ? this.NAV.DONE : this.NAV.AT_BENCHMARK;
        }
        return this.NAV.AT_DEPLOY;
      }
      return this.NAV.AT_CONVERT;

    } else {
      return this.NAV.AT_COMPRESS;
    }
  }

  static async applyDataConvert(target: Target, convertData: any, source: Source): Promise<void> {
    const remoteHome = GlobalModel.instance?.remoteHome;
    const historyRootDir = GlobalModel.instance?.aiCacheDir;
    if (!historyRootDir) { return; } // unlikely
    if (target !== 'NPU' && target !== 'CPU') { return; }

    // Generate merged data for this context.
    const dateTime = Date.now();
    extension.mockLocalStorage?.setItem('lastConvertTS', dateTime);

    const localDir = path.join(historyRootDir, `Convert/convert_${dateTime}`);
    fs.mkdirSync(localDir, { recursive: true });

    let linuxCacheRoot;
    if (source === 'linux') {
      linuxCacheRoot = `${remoteHome}/${remoteRootDir}/.cache/ai/convert`;
    } else {
      try {
        linuxCacheRoot = await this.convertPathIfNeeded(localDir, source);
      } catch (err) {
        this.postStatusMsg('QuantFailed'); return;
      }
    }

    let mergedData;
    try {
      mergedData = await this.mergeConvert(target, source, convertData, linuxCacheRoot);
    } catch (err) {
      this.postStatusMsg('ConvertFailed');
      this.logAndReportError(`Failed to generate convert items due to: ${this.handleError(err)}`);
    }

    if (Object.keys(mergedData).length === 0) { return; }

    // Build context for this Convert operation.
    const ctx = this.buildConvertContext({ mergedData, convertData, linuxCacheRoot }, target, source);
    if (!ctx) { this.postStatusMsg('ConvertFailed'); return; }

    ctx.timeStamp = dateTime;
    ctx.paths.localOutputDir = localDir;

    await this.handleConvertRemote(ctx);
  };

  static async mergeConvert(target: any, source: Source, convertData: any, linuxCacheRoot: any): Promise<any> {
    // This works because ptq and qat cannot be actiavted at the same time.
    const stage = extension.mockLocalStorage?.getItem('ptq') ? 'ptq' : 'qat';
    const isCPU = target === 'CPU';
    const skipQuantize = Boolean(extension.mockLocalStorage?.getItem('skipQuantize'));

    const model = GlobalModel.instance?.selectedFile;
    const remoteHome = GlobalModel.instance?.remoteHome;
    const historyRootDir = GlobalModel.instance?.aiCacheDir;
    if (!historyRootDir || !model) { return {}; } // unlikely

    // Get timestamp from the previous quant process.
    // For 1156e (skipQuantize), lastQuantTS is the model-selection timestamp written at import time.
    const lastQuantTS = extension.mockLocalStorage?.getItem('lastQuantTS');
    if (!lastQuantTS && !skipQuantize) { throw new Error('Must enter from a quantization result. Aborting...'); }

    const quantRootDir = isCPU
      ? path.join(historyRootDir, `Quant/quant_${lastQuantTS}/`)
      : path.join(historyRootDir, `Quant/quant_${lastQuantTS}/${stage}`);
    if (!skipQuantize && !fs.existsSync(quantRootDir)) {
      throw new Error('Output folder for last quantization not found.');
    }

    // Get deploy.onnx from quantization. (NPU only)
    // For 1156e the original model file is used directly — there is no quantized output.
    let deployOnnxPath: string | undefined;
    if (!isCPU) {
      if (skipQuantize) {
        deployOnnxPath = model; // remote/linux path of the original onnx model
      } else {
        const files = fs.readdirSync(quantRootDir);
        const deployOnnxFile = files.find(f => f.endsWith('.onnx') && f.toLowerCase().includes('deploy'));

        if (!deployOnnxFile) { throw new Error('deploy onnx file not found.'); }
        if (!convertData || convertData.length === 0) { return {}; } // unlikely

        // Upload deploy onnx file in case quant folder on Linux has been overwritten.
        try {
          if (source === 'linux') {
            const localPath = path.join(quantRootDir, deployOnnxFile);
            deployOnnxPath = `${remoteHome}/${remoteRootDir}/.cache/ai/quant/${stage}/quant/${deployOnnxFile}`;
            await vscode.commands.executeCommand(this.remoteCmdLib.uploadCmd, localPath, deployOnnxPath);
          } else {
            const deployOnnxPathWin = path.join(quantRootDir, deployOnnxFile);
            deployOnnxPath = await this.convertPathIfNeeded(deployOnnxPathWin, source);
          }
        } catch (err) {
          throw new Error(`Failed to upload scripts, cause: ${this.handleError(err)}`);
        }
      }
    }

    // Get quant config from quantization. (CPU only)
    let quantCfgPath;
    if (isCPU) {
      if (source === 'wsl') {
        // unlikely but fatal, throw immediately. wsl workflow should never enable on CPU.
        throw new Error('WSL enabled on CPU');
      } else if (source === 'linux') {
        // If running on Linux, Upload quant.tar.gz in case quant folder on Linux has been overwritten.
        const aicacheBaseDir = `${remoteHome}/${remoteRootDir}/.cache/ai`;
        quantCfgPath = `${aicacheBaseDir}/quant/quant.cfg`;
        await vscode.commands.executeCommand(this.remoteCmdLib.uploadCmd,
          path.join(quantRootDir, 'quant.tar.gz'), `${aicacheBaseDir}/quant.tar.gz`);

        // Untar at Linux server.
        const basicCmd = `rm -rf ${aicacheBaseDir}/quant && mkdir -p ${aicacheBaseDir}/quant && `;
        const untarCmd = `tar -xzf ${aicacheBaseDir}/quant.tar.gz -C ${aicacheBaseDir}/quant`;
        await vscode.commands.executeCommand(this.remoteCmdLib.executeCmd, basicCmd + untarCmd);
      } else {
        quantCfgPath = path.join(historyRootDir, `Quant/quant_${lastQuantTS}/quant.cfg`);
      }
    }

    // mergedData : { ModelInfo, modelInputs, (outputTypes), Tools }
    let outputTypesInfo = {};
    const modelInputsItems: any[] = [];
    const modelInfo = { modelSelected: isCPU ? model : deployOnnxPath };
    const toolsInfo = {
      CPU: {
        tools: {
          linuxCache: `${linuxCacheRoot}`, quantCfg: quantCfgPath, mindSporeLitePath: undefined as string | undefined,
        },
      },
      NPU: {
        tools: {
          linuxCache: `${linuxCacheRoot}`,
          cannPath: source === 'wsl' ? '/usr/local/Ascend' : '/usr/local/hisparkai/Ascend', // This needs to be confirmed!
        },
      },
    };
    if (source === 'windows') {
      const mindSporeLitePath = this.getMindSporeLitePath();
      if (!mindSporeLitePath || !fs.existsSync(mindSporeLitePath)) {
        throw new Error('Missing dependency: Mindspore-lite. Please reinstall the tool chain.');
      }
      toolsInfo.CPU.tools.mindSporeLitePath = mindSporeLitePath;
    }

    const setLen = (!isCPU) ? convertData.length - 2 : convertData.length;
    const lastIndex = (!isCPU) ? setLen - 1 : setLen;
    for (let i = 0; i < lastIndex; i += 2) {
      const rawShape = convertData[i + 1]?.content;
      const parsedShape = typeof rawShape[0] === 'string' ? rawShape[0].split(',').map(s => Number(s.trim())) : rawShape;
      modelInputsItems.push({
        name: (convertData[i + 1]?.key?.split('/')?.[0]) ?? 'Input',
        shape: parsedShape ?? 'shape',
        dataType: convertData[i + 2]?.defaultValue.toUpperCase() ?? 'dataType',
      });
    }

    const modelInputsInfo = { modelInputs: modelInputsItems };
    if (convertData[0].kind === 'select') {
      type RawOutputType = 'float16' | 'uint8' | 'int8';
      type MappedOutputType = 'FP16' | 'UINT8' | 'INT8';

      const outputTypeMap: Record<RawOutputType, MappedOutputType> = { float16: 'FP16', uint8: 'UINT8', int8: 'INT8' };
      outputTypesInfo = { outputType: outputTypeMap[convertData[0].defaultValue as RawOutputType] };
    }

    let advancedOptionsataInfo;
    let additionalArgumentsInfo;

    if (!isCPU) {
      const switchStatusItem = convertData.find((item: { key: string }) => item.key === 'switch_status');
      const advancedOptionsata = switchStatusItem.defaultValue;
      advancedOptionsataInfo = { advancedOptionsata: advancedOptionsata };

      const switchInputItem = convertData.find((item: { key: string }) => item.key === 'switch_input_value');
      const additionalArguments = advancedOptionsata === false ? '' : switchInputItem.defaultValue;
      additionalArgumentsInfo = { additionalArguments: additionalArguments };
    }

    return isCPU
      ? { ...modelInfo, ...toolsInfo.CPU }
      : { ...modelInfo, ...modelInputsInfo, ...outputTypesInfo, ...advancedOptionsataInfo, ...additionalArgumentsInfo, ...toolsInfo.NPU };
  }

  static async importConfigandTarget(): Promise<void> {
    const target = extension.chipConfigPanel?.target;
    try {
      if (!target) { this.logAndReportError('Activation failed. Target was not specified.'); return; }

      // Field defaults and layout are now defined in the frontend schema files
      // (quantizeConfig.ts / convertConfig.ts).  The backend only needs to send
      // back whatever the user previously saved to mockLocalStorage, so the
      // frontend can merge saved values on top of its own schema defaults.
      // On first run, both will be empty arrays and the frontend initialises
      // entirely from its schema.
      // On first run (nothing saved yet), seed mockLocalStorage with the minimum
      // static defaults that backend operations depend on:
      //   - compressionData: quantisation config fields (batch_num, validation, etc.)
      //   - convertData: Output_Type select (updateConvertConfig checks length parity)
      // After the user configures fields and clicks Quantize, these get overwritten
      // with the actual user values via SAVE_CONFIG.
      const tgt = target.toLowerCase();

      if (!extension.mockLocalStorage?.getItem('compressionData') ||
          common.parseArray(extension.mockLocalStorage.getItem('compressionData')).length === 0) {
        const compDefaults = tgt === 'cpu'
          ? [
              { target: 'cpu', page: 'quant', kind: 'input',  group: 'Quantization', key: 'batch_num',        title: 'batch_num',             content: '1',           defaultValue: '1',           disabled: false },
              { target: 'cpu', page: 'quant', kind: 'select', group: 'Quantization', key: 'validation_cpu',   title: 'Validation',             content: ['NONE','FILE'], defaultValue: 'NONE',       disabled: false },
              { target: 'cpu', page: 'quant', kind: 'select', group: 'Quantization', key: 'bit_num_cpu',      title: 'Quantized Data Type',    content: ['int8'],        defaultValue: 'int8',       disabled: false },
              { target: 'cpu', page: 'quant', kind: 'select', group: 'Quantization', key: 'quant_type',       title: 'Quant Type',             content: ['FULL_QUANT'],  defaultValue: 'FULL_QUANT', disabled: false },
              { target: 'cpu', page: 'quant', kind: 'select', group: 'Quantization', key: 'validation_labels_cpu', title: 'Validation Labels', content: ['None','Choose from File System'], defaultValue: 'None', disabled: false },
              { target: 'cpu', page: 'quant', kind: 'file',   group: 'Quantization', key: 'val_out_cpu',      title: '',                       content: ' ',            defaultValue: ' ',          disabled: false, folder: false },
            ]
          : [
              { target: 'npu', page: 'quant', type: 'ptq', kind: 'input',  group: 'Quantization', key: 'batch_num',          title: 'batch_num',          content: '1',              defaultValue: '1',        disabled: false },
              { target: 'npu', page: 'quant', type: 'ptq', kind: 'select', group: 'Quantization', key: 'validation_npu',     title: 'Validation',         content: ['NONE','FILE'],  defaultValue: 'NONE',     disabled: false },
              { target: 'npu', page: 'quant', type: 'ptq', kind: 'select', group: 'Quantization', key: 'bit_num_npu',        title: 'Quantized Data Type',content: ['int8','int16'], defaultValue: 'int8',     disabled: false },
              { target: 'npu', page: 'quant', type: 'ptq', kind: 'select', group: 'Quantization', key: 'validation_labels_npu', title: 'Validation Labels', content: ['None','Choose from File System'], defaultValue: 'None', disabled: false },
              { target: 'npu', page: 'quant', type: 'ptq', kind: 'file',   group: 'Quantization', key: 'vi2_file',           title: '',                   content: ' ',              defaultValue: ' ',        disabled: false, folder: false },
              { target: 'npu', page: 'quant', type: 'qat', kind: 'input',  group: 'Quantization', key: 'retrain_code',       title: 'Train Code',         content: 'import this',   defaultValue: 'import this', disabled: true  },
              { target: 'npu', page: 'quant', type: 'qat', kind: 'select', group: 'Quantization', key: 'config_file',        title: 'Config File',        content: ['Default','Custom'], defaultValue: 'Default', disabled: false },
              { target: 'npu', page: 'quant', type: 'qat', kind: 'input',  group: 'Quantization', key: 'epoch_num',          title: 'Epoch Num',          content: '1',              defaultValue: '1',        disabled: false },
              { target: 'npu', page: 'quant', type: 'qat', kind: 'input',  group: 'Quantization', key: 'batch_size',         title: 'Batch Size',         content: '4',              defaultValue: '4',        disabled: false },
              { target: 'npu', page: 'quant', type: 'qat', kind: 'input',  group: 'Quantization', key: 'learning_rate',      title: 'Learning Rate',      content: '0.00001',        defaultValue: '0.00001',  disabled: false },
            ];
        extension.mockLocalStorage?.setItem('compressionData', compDefaults);
        extension.mockLocalStorage?.setItem('compDataBackup',  compDefaults);
      }

      // Output_Type is NPU-only (QuantizeConfig.txt had target:'npu').
      // CPU: keep convertData as [] so updateConvertConfig handles the even-length
      // case the same way as before (it expects [] for CPU models).
      // NPU: seed with [Output_Type] so updateConvertConfig length parity check passes
      // (length=1 is odd, nodeNum=0, no-op loop, but avoids the "convertData not
      //  exists" error when a model is first loaded).
      if (tgt !== 'cpu' &&
          (!extension.mockLocalStorage?.getItem('convertData') ||
           common.parseArray(extension.mockLocalStorage.getItem('convertData')).length === 0)) {
        const convDefaults = [{
          target: 'npu', page: 'convert', kind: 'select', group: 'Convert',
          key: 'Output_Type', title: 'Output Type',
          content: ['float16', 'uint8', 'int8'], defaultValue: 'float16', disabled: false,
        }];
        extension.mockLocalStorage?.setItem('convertData',    convDefaults);
        extension.mockLocalStorage?.setItem('convDataBackup', convDefaults);
      }

      const compConfigArr = common.parseArray(extension.mockLocalStorage?.getItem('compressionData'));
      const convConfigArr = common.parseArray(extension.mockLocalStorage?.getItem('convertData'));

      const config = [
        { key: 'compressionData', value: compConfigArr },
        { key: 'convertData',     value: convConfigArr },
        { key: 'chipName',        value: GlobalModel.instance.chipName ?? '' },
      ];
      const frontEndConfigCallbackMessage: ConfigMessage = {
        method: ApiMethod.SAVE_CONFIG_CALLBACK,
        params: { config },
      };
      extension.chipConfigPanel?.postInitTarget(target);
      extension.chipConfigPanel?.postMessage(frontEndConfigCallbackMessage);
    } catch (err) {
      this.logAndReportError('this.importConfigandTarget failed');
    }
  }

  static handleLostConnection(): void {
    const errMsg = 'Lost connection to remote server.';
    common.showErrorOnceWithTTL(errMsg);

    // Set status to Failed by passing lost connection message.
    this.postStatusMsg('LostConnection');

    // Other steps...
  }

  static startDataQuantize(quantMsg: Message): void {
    const { target, source } = quantMsg.params?.coreParams;
    const type = quantMsg.params?.paramType;
    const data = quantMsg.params?.paramData;
    const layerConfigData = quantMsg.params?.layerData;
    let layerData = layerConfigData ?? extension.mockLocalStorage?.getItem('layerwiseData');
    let compressionData = data ?? extension.mockLocalStorage?.getItem('compressionData');
    if (compressionData === undefined || compressionData === null) {
      extension.chipConfigPanel?.postMessage({ type: 'QuantFailed' });
      return;
    }
    if (layerData === undefined || layerData === null) {
      extension.chipConfigPanel?.postMessage({ type: 'QuantFailed' });
      return;
    }
    compressionData = common.parseArray(compressionData);
    layerData = common.parseArray(layerData);
    const skipQuant = type === 'skip';
    this.quantAbortRequested = false;
    this.quantSource = source;
    this.applyDataQuantize(target, { compressionData, layerData }, source, type, skipQuant);
  }

  static stopDataQuantize(): void {
    this.quantAbortRequested = true;
    // Kill remote Linux process via PID file
    if (this.quantSource === 'linux') {
      vscode.commands.executeCommand(
        this.remoteCmdLib.executeCmd,
        `kill -TERM $(cat ${this.quantPidFilePath}) 2>/dev/null; rm -f ${this.quantPidFilePath}`
      );
    }
    // Kill local / WSL child process
    if (this.quantChildProcess) {
      try {
        this.quantChildProcess.kill('SIGTERM');
      } catch {
        // Process may have already exited
      }
      this.quantChildProcess = null;
    }
    this.postStatusMsg('QuantFailed', { description: 'Quantization aborted by user.' });
  }

  static startDataConvert(convertMsg: Message): void {
    const { target, source } = convertMsg.params?.coreParams;
    const data = convertMsg.params?.paramData;
    let convertData = data ?? extension.mockLocalStorage?.getItem('convertData');
    if (convertData === undefined || convertData === null) {
      this.postStatusMsg('ConvertFailed', { description: 'Convert data not found' });
      return;
    }
    if (!Array.isArray(convertData)) {
      convertData = JSON.parse(convertData);
    }
    this.convertAbortRequested = false;
    this.convertSource = source;
    this.applyDataConvert(target, convertData, source);
  }

  static stopDataConvert(): void {
    this.convertAbortRequested = true;
    // Kill remote Linux process via PID file
    if (this.convertSource === 'linux') {
      vscode.commands.executeCommand(
        this.remoteCmdLib.executeCmd,
        `kill -TERM $(cat ${this.convertPidFilePath}) 2>/dev/null; rm -f ${this.convertPidFilePath}`
      );
    }
    // Kill WSL convert child process.
    if (this.wslConvertChildProcess) {
      try {
        this.wslConvertChildProcess.kill('SIGTERM');
      } catch {
        // Process may have already exited
      }
      this.wslConvertChildProcess = null;
    }
    // Kill Windows convert child process.
    if (this.convertChildProcess) {
      try {
        this.convertChildProcess.kill('SIGTERM');
      } catch {
        // Process may have already exited
      }
      this.convertChildProcess = null;
    }
    this.postStatusMsg('ConvertFailed', { description: 'Conversion aborted by user.' });
  }

  // Layerwise config
  static importLayer(): void {
    const layerWiseArr = extension.mockLocalStorage?.getItem('layerwiseData');

    const config = [{ key: 'layerwiseData', value: layerWiseArr }];
    const frontEndConfigCallbackMessage: ConfigMessage = {
      method: ApiMethod.SAVE_CONFIG_CALLBACK,
      params: { config: config },
    };
    extension.chipConfigPanel?.postMessage(frontEndConfigCallbackMessage);
  }

  static async retrainConfig(): Promise<void> {
    const filePath = path.join(__dirname, '../resources/retrain.cfg');
    const fileUri = vscode.Uri.file(filePath);
    const document = await vscode.workspace.openTextDocument(fileUri);
    await vscode.window.showTextDocument(document);
  }

  static saveProfSelectItems(message: any): void {
    const { port1, port2, baudRate1, baudRate2 } = message; // port and baudRate from benchmark page.
    const config = [{ key: 'port1', value: port1 }, { key: 'port2', value: port2 }, { key: 'baudRate1', value: baudRate1 }, { key: 'baudRate2', value: baudRate2 }];

    const frontEndConfigCallbackMessage: ConfigMessage = {
      method: ApiMethod.SAVE_CONFIG_CALLBACK,
      params: { config: config },
    };
    extension.mockLocalStorage?.setItem('port1', port1);
    extension.mockLocalStorage?.setItem('port2', port2);
    extension.mockLocalStorage?.setItem('baudRate1', baudRate1);
    extension.mockLocalStorage?.setItem('baudRate2', baudRate2);
    extension.chipConfigPanel?.postMessage(frontEndConfigCallbackMessage);
  }

  static genJsonProfCPU(config: {
    profilingData: any;
    dateTime: any;
    params?: any;
  }): any {
    const { profilingData, dateTime, params } = config;
    const source = params.source;
    if (source !== 'windows' && source !== 'linux') {
      throw new Error('CPU benchmark must be running on either Linux or Windows!');
    }
    const model = GlobalModel.instance.localFile;
    const modelInfo = { modelSelected: model };
    const historyRootDir = GlobalModel.instance?.aiCacheDir;
    if (!historyRootDir) {
      this.logAndReportError('History folder not found!');
      return {};
    }

    // serial config.
    const port1 = extension.mockLocalStorage?.getItem('port1');
    const baudRate1 = extension.mockLocalStorage?.getItem('baudRate1');
    if (!baudRate1 || !port1) {
      logger.warn('Invalid port or baudRate configuration for the target.');
      return {};
    }
    const portNum = port1.slice(3); // COMxx
    const serialInfo = { serialConfig: { Port: portNum, BandRate: baudRate1 } };

    // tools.
    const rootDir = common.getWorkFolderPath();
    const lastConvertTS = extension.mockLocalStorage?.getItem('lastConvertTS');
    if (lastConvertTS === undefined) {
      this.logAndReportError('Must enter from a convert result. Aborting...');
      return {};
    }
    const profilingDir = path.join(historyRootDir, `Benchmark/benchmark_${dateTime}`);
    const lastConvertDir = path.join(historyRootDir, `Convert/convert_${lastConvertTS}`);
    const microGen = path.join(lastConvertDir, 'micro_gen');

    // Burntool and MindSpore
    const toolRootPath = common.getToolsPath();
    const burntool = path.join(toolRootPath, 'tools/cfbb/BurnTool/BurnTool.exe');
    const mindSpore = this.getMindSporeLitePath();
    const notInstalled: string[] = [];
    if (!fs.existsSync(burntool)) { notInstalled.push('burntool'); }
    if (!fs.existsSync(mindSpore)) { notInstalled.push('mindspore-lite'); }

    if (notInstalled.length > 0) {
      extension.chipConfigPanel?.postMessage({
        type: 'Failed', params: {
          description: `Missing dependencies: ${notInstalled.join(', ')}. Please reinstall the tool chain.`,
        },
      });
      return {};
    }

    const toolsInfo = {
      tools: {
        mindSporeLitePath: mindSpore,
        sdkPath: rootDir,
        microGenPath: microGen,
        burnToolPath: burntool,
        windowRepDataPath: profilingDir,
        outputJson: path.join(profilingDir, 'output.json'), // accuracy
        outputCsv: path.join(profilingDir, 'output.csv'), // accuracy
        outputProfJson: path.join(profilingDir, 'output_prof.json'), // profiling
      },
    };

    // accuracy_vali_config.
    const setLen = profilingData.length - 2;
    if (setLen <= 0) {
      logger.error('Benchmark data should have inputs length longer than 0.');
      return {};
    }
    const valiInputLists = [];
    for (let i = 0; i < setLen; ++i) {
      valiInputLists.push({
        name: (profilingData[i]?.key?.split('/')?.[0]) ?? 'Input',
        path: profilingData[i].content,
      });
    }

    const valiInfo = {
      accuracyValiConfig: {
        valiInputs: valiInputLists,
        valiOutputs: {
          name: params.selectedOutputNode,
          path: params.selectedOutputNode === 'None' ? ' ' : profilingData[setLen + 1].content,
        },
      },
    };

    const mergedData = { ...modelInfo, ...serialInfo, ...valiInfo, ...toolsInfo };
    return mergedData;
  }

  static genJsonProfNPU(config: {
    profilingData: any;
    stage: string;
    dateTime: any;
    params?: any;
  }): any {
    const {
      profilingData,
      stage,
      dateTime,
      params,
    } = config;
    const model = GlobalModel.instance.localFile;
    const remoteModel = GlobalModel.instance?.selectedFile;
    if (!remoteModel) { return {}; }

    // History root directory.
    const historyRootDir = GlobalModel.instance?.aiCacheDir;
    if (!historyRootDir) {
      this.logAndReportError('History folder not found!');
      return {};
    }

    // Get timestamp from previous steps.
    const { modelName, modelEndsWith } = this.parseModelPath(remoteModel, '/');
    const isExeom = modelEndsWith === 'exeom';

    const lastConvertTS = extension.mockLocalStorage?.getItem('lastConvertTS');
    const lastQuantTS = extension.mockLocalStorage?.getItem('lastQuantTS');
    if (lastConvertTS === undefined && !isExeom) {
      this.logAndReportError('Must enter from a convert result. Aborting...');
      return {};
    }
    if (lastQuantTS === undefined && !isExeom) {
      this.logAndReportError('lastQuantTS not found!');
      return {};
    }

    // Exeom file and dbg file.
    const exeomFile = isExeom
      ? path.join(historyRootDir, `selectmodel/${modelName}.exeom`)
      : path.join(historyRootDir, `Convert/convert_${lastConvertTS}/convert.exeom`);
    const dbgFile = isExeom
      ? path.join(historyRootDir, `selectmodel/${modelName}.dbg`)
      : path.join(historyRootDir, `Convert/convert_${lastConvertTS}/convert.dbg`);
    if (!fs.existsSync(exeomFile) || !fs.existsSync(dbgFile)) {
      this.logAndReportError('Cannot proceed. Check if convert.py has been executed correctly.');
      return {};
    }

    // Spare onnx file for QAT.
    const isQAT = extension.mockLocalStorage?.getItem('qat');
    const spareOnnxFile = path.join(historyRootDir, `Quant/quant_${lastQuantTS}/qat/${modelName}.onnx`);
    if (isQAT && !fs.existsSync(spareOnnxFile)) {
      extension.chipConfigPanel?.postMessage({ type: 'Failed', params: { description: `Golden model file not found` } });
      return {};
    }
    if (stage !== 'accuracy' && stage !== 'profiling') {
      this.logAndReportError('Unknown stage when generating json file.');
      return {};
    }

    // serial_config.
    const port1 = extension.mockLocalStorage?.getItem('port1');
    const port2 = extension.mockLocalStorage?.getItem('port2');
    const baudRate1 = extension.mockLocalStorage?.getItem('baudRate1');
    const baudRate2 = extension.mockLocalStorage?.getItem('baudRate2');
    if (!baudRate1 || !baudRate2) {
      this.logAndReportError('Port and baud rate information is incomplete.');
      return {};
    }
    if (!port1 || !port2) {
      this.logAndReportError('Invalid port configuration for the target.');
      return {};
    }
    const serialInfo = {
      serialConfig: [
        { type: 'data', port: port1, bandrate: Number(baudRate1) },
        { type: 'command', port: port2, bandrate: Number(baudRate2) },
      ],
    };

    // validation config
    let accuValiInfo;
    let valiLabelsInfo;
    if (!isExeom) {
      const setLen = profilingData.length - 2;
      const accuValiList = [];
      for (let i = 0; i < setLen; ++i) {
        accuValiList.push({
          name: (profilingData[i]?.key?.split('/')?.[0]) ?? 'Input',
          path: profilingData[i].content ?? `Validation Input${i + 1}`,
        });
      }
      accuValiInfo = { accuracyValiConfig: { valiInputs: accuValiList } };
      valiLabelsInfo = {
        valiLabels: {
          name: params.selectedOutputNode,
          path: profilingData[setLen + 1].content,
        },
      };
    }

    // DebugKits
    const toolRootPath = common.getToolsPath();
    const debugKits = path.join(toolRootPath, 'tools/cfbb/DebugKits');
    const debugKitsExe = path.join(debugKits, 'Start.exe');
    if (!fs.existsSync(debugKitsExe)) {
      this.logAndReportError('Check if DebugKits is installed.');
      return {};
    }

    const toolsInfo = {
      tools: {
        linuxCache: `${path.join(historyRootDir, `Benchmark/benchmark_${dateTime}`)}`,
        debugKitsStartPath: debugKits,
        cannPath: '~/cann_path',
      },
    };
    const modelInfo = { modelSelected: `${exeomFile}` };
    const dbgSelected = { dbgSelected: `${dbgFile}` };
    const goldenModelInfo = { goldenModelSelected: isQAT ? spareOnnxFile : model };

    const mergedData = (stage === 'profiling') ?
      { ...modelInfo, ...dbgSelected, ...serialInfo, ...toolsInfo } :
      { ...modelInfo, ...goldenModelInfo, ...dbgSelected, ...serialInfo, ...accuValiInfo, ...valiLabelsInfo, ...toolsInfo };

    return mergedData;
  }

  static generateJsonProf(config: {
    profilingData: any;
    target: Target;
    stage: string;
    dateTime: any;
    params?: any;
  }): any {
    const {
      profilingData,
      target,
      stage,
      dateTime,
      params,
    } = config;

    if (target === 'CPU') {
      return this.genJsonProfCPU({ profilingData, dateTime, params });
    }

    if (target === 'NPU') {
      return this.genJsonProfNPU({ profilingData, stage, dateTime, params });
    }

    return {};
  }

  static checkProfilingData(target: 'CPU' | 'NPU', profJsonData: any): undefined | string {
    // Check the validity of profilingData
    if (!profJsonData || Object.keys(profJsonData).length === 0) {
      return 'Failed to generate config data for the current step';
    }

    // Check the validity of accuracyValiConfig
    const config = profJsonData.accuracyValiConfig;
    if (!config) { return undefined; }

    const resolvePath = (p: string): string | undefined => {
      if (typeof p !== 'string' || !p.trim()) {
        return undefined;
      }

      // Only allow absolute paths.
      if (!path.isAbsolute(p)) { return undefined; }

      try {
        // Canonicalize the existing path to avoid ambiguity caused by symlinks, redundant separators, and so on.
        return fs.realpathSync.native ? fs.realpathSync.native(p) : fs.realpathSync(p);
      } catch {
        // Fall back to normalized absolute path for later existence check.
        return path.normalize(p);
      }
    };

    // valiInputs
    if (Array.isArray(config.valiInputs)) {
      for (let i = 0; i < config.valiInputs.length; i++) {
        const input = config.valiInputs[i];
        const p = input?.path;

        if (!p || typeof p !== 'string' || !p.trim()) {
          return `valiInputs[${i}].path is empty or invalid`;
        }

        const realPath = resolvePath(p);
        if (!realPath) {
          return `valiInputs[${i}].path must be a valid absolute path: ${p}`;
        }

        if (!fs.existsSync(realPath)) {
          return `valiInputs[${i}].path does not exist: ${p}`;
        }

        try {
          const stat = fs.statSync(realPath);
          if (!stat.isDirectory()) {
            return `valiInputs[${i}].path must be a directory: ${p}`;
          }
        } catch {
          return `Failed to access valiInputs[${i}].path: ${p}`;
        }
      }
    }

    // valiOutputs
    const outputName = target === 'CPU' ? config?.valiOutputs?.name : profJsonData.valiLabels.name;
    if (outputName === 'None') {
      return undefined; // Allowed.
    }
    const outputPath = target === 'CPU' ? config?.valiOutputs?.path : profJsonData.valiLabels.path;

    if (!outputPath || typeof outputPath !== 'string') {
      return 'Validation label is empty or invalid';
    }

    const realOutputPath = resolvePath(outputPath);
    if (!realOutputPath) {
      return `Validation label must be an absolute path: ${outputPath}`;
    }

    if (!fs.existsSync(realOutputPath)) {
      return `Validation label does not exist: ${outputPath}`;
    }

    try {
      const stat = fs.statSync(realOutputPath);
      if (!stat.isFile()) {
        return `Validation label must be a file: ${outputPath}`;
      }

      if (path.extname(realOutputPath).toLowerCase() !== '.csv') {
        return `Validation label must be a .csv file: ${outputPath}`;
      }
    } catch {
      return `Failed to access Validation label: ${outputPath}`;
    }

    return undefined;
  }

  static async startProfiling(accuMsg: CommandMsg): Promise<void> {
    const dateTime = (new Date()).getTime();
    extension.mockLocalStorage?.setItem('lastProfTS', dateTime);
    const params = accuMsg.params as {
      targetPlatform: { target: string };
      paramType: string;
      selectedOutputNode?: string;
      source: Source;
    };

    const { target } = accuMsg.params.targetPlatform;
    const stage = accuMsg.params.paramType;
    const isCPU = target === 'CPU';
    if (target === 'NONE' || (stage !== 'accuracy' && stage !== 'profiling')) { return; }
    const historyRootDir = GlobalModel.instance?.aiCacheDir;
    if (!historyRootDir) {
      extension.chipConfigPanel?.postMessage({ type: 'Failed', params: { description: 'History directory not found!' } });
      return;
    }

    let profilingData = extension.mockLocalStorage?.getItem('profilingData');
    if (!profilingData) {
      extension.chipConfigPanel?.postMessage({ type: 'Failed', params: { description: `Data for benchmark missing!` } });
      return;
    }
    if (!Array.isArray(profilingData)) {
      profilingData = JSON.parse(profilingData);
    }

    const profJsonData = this.generateJsonProf({ profilingData, target, stage, dateTime, params });
    if (Object.keys(profJsonData ?? {}).length === 0) {
      extension.chipConfigPanel?.postMessage({ type: 'Failed' });
      return;
    }
    if (stage === 'accuracy') {
      const ret = this.checkProfilingData(target, profJsonData);
      if (ret !== undefined) {
        extension.chipConfigPanel?.postMessage({ type: 'Failed' });
        vscode.window.showErrorMessage(ret);
        return;
      }
    }

    let fileName;
    if (isCPU) {
      fileName = 'rt.json';
    } else {
      fileName = (stage === 'accuracy') ? 'accuracy.json' : 'profiling.json';
    }
    const pythonRootPath = isCPU
      ? path.join(__dirname, `../resources/scripts/${target.toLowerCase()}/profiling`)
      : path.join(__dirname, `../resources/scripts/${target.toLowerCase()}/${stage}`);
    const rtJsonRootPath = path.join(historyRootDir, 'Json');
    const rtJsonPath = path.join(rtJsonRootPath, fileName);

    if (!fs.existsSync(rtJsonRootPath)) { fs.mkdirSync(rtJsonRootPath, { recursive: true }); }
    try {
      fs.writeFileSync(rtJsonPath, JSON.stringify(profJsonData, null, 2), 'utf8');
    } catch (err: any) {
      extension.chipConfigPanel?.postMessage({
        type: 'Failed', params: { description: `Failed to write ${fileName}: ${err.message}` },
      });
      return;
    }

    const toolRootPath = common.getToolsPath();
    const python = path.join(toolRootPath, 'tools/python/python.exe');
    const debugKits = path.join(toolRootPath, 'tools/cfbb/DebugKits/Start.exe');
    const mindSpore = this.getMindSporeLitePath();
    const notInstalled: string[] = [];
    if (!fs.existsSync(python)) { notInstalled.push('python'); }
    if (!isCPU && !fs.existsSync(debugKits)) { notInstalled.push('debugKits'); }
    if (isCPU && !fs.existsSync(mindSpore)) { notInstalled.push('mindspore-lite'); }

    if (notInstalled.length > 0) {
      extension.chipConfigPanel?.postMessage({
        type: 'Failed',
        params: { description: `Missing dependencies: ${notInstalled.join(', ')}. Please reinstall the tool chain.` },
      });
      return;
    }

    const scriptAccuracyCpu = path.join(pythonRootPath, 'rt_accuracy.py');
    const scriptProfilingCpu = path.join(pythonRootPath, 'rt_prof.py');
    const scriptAccuracyNpu = path.join(pythonRootPath, 'accuracy.py');
    const scriptProfilingNpu = path.join(pythonRootPath, 'profiling.py');

    const scripts = {
      CPU: {
        accuracy: {
          exe: python,
          args: [scriptAccuracyCpu, `--input_json=${rtJsonPath}`],
        },
        profiling: {
          exe: python,
          args: [scriptProfilingCpu, `--input_json=${rtJsonPath}`],
        },
      },
      NPU: {
        accuracy: {
          exe: python,
          args: [scriptAccuracyNpu, `--input_json=${rtJsonPath}`],
        },
        profiling: {
          exe: python,
          args: [scriptProfilingNpu, `--input_json=${rtJsonPath}`],
        },
      },
    };

    const { exe, args } = scripts[target][stage];
    const cmd = `${exe} ${args.map(a => `"${a}"`).join(' ')}`;

    const ret = this.cpuCheckSDKReady();
    if (isCPU && ret !== true) {
      this.logAndReportError(`Missing : ${ret}, build sdk first (available in Deploy page)`);
      return;
    }
    try {
      const pattern = 'Model size exceeds limit, enabling PSRAM.';
      await this.runProcess(python, args, pythonRootPath, {
        cmd: cmd,
        onStderr: (line) => {
          if (line.includes(pattern)) {
            extension.mockLocalStorage?.setItem('psramEnabled', true);
          }
        },
      }, (p) => { this.profilingChildProcess = p; });
      extension.chipConfigPanel?.postMessage(stage);
    } catch (err) {
      const errMsg = `Failed to execute python script : ${this.handleError(err)}`;
      extension.chipConfigPanel?.postMessage({ type: 'Failed', params: { description: errMsg } });
      this.outputLogger.handleLogInfo(errMsg, 'error');
      return;
    }

    const outputRootPath = `${path.join(historyRootDir, `Benchmark/benchmark_${dateTime}`)}`;
    if (this.postProfiling(target, stage, outputRootPath, dateTime)) {
      extension.chipConfigPanel?.postMessage({ type: 'Failed', params: { description: `Error when presenting results.` } });
      return;
    }
    this.saveProfilingData(profilingData, profJsonData.serialConfig, outputRootPath, stage);

    // Read and display window message.
    const windowMsgPath = path.join(outputRootPath, 'WindowMessage.json');
    this.showWindowMessages(windowMsgPath);

    extension.chipConfigPanel?.postMessage({ type: 'Success' });
  }

  static saveProfilingData(profilingData: any, serialConfig: any, outputRootPath: any, stage: string): void {
    if (!fs.existsSync(outputRootPath)) {
      this.logAndReportError('Post profiling failed: outputrootpath not found!');
      return;
    }
    const filePath = `${path.join(outputRootPath, 'nowConfig.json')}`;
    try {
      fs.writeFileSync(filePath, JSON.stringify(serialConfig), 'utf8');
    } catch (err: any) {
      this.logAndReportError(`nowConfig : ${err}, write failed`);
      return;
    }
    if (stage !== 'accuracy') {
      return;
    }
    const accfilePath = `${path.join(outputRootPath, 'accuracyConfig.json')}`;
    try {
      fs.writeFileSync(accfilePath, JSON.stringify(profilingData), 'utf8');
    } catch (err: any) {
      this.logAndReportError(`accuracyConfig : ${err}, write failed`);
      return;
    }
  }

  static updateResultStatus(profilingArr: any[], accArr: any[]): void {
    const selectResultRecord = [];
    if (profilingArr.length > 0) {
      selectResultRecord.push(profilingArr[0].updateTime ?? 0);
    }
    if (accArr.length > 0) {
      selectResultRecord.push(accArr[0].updateTime ?? 0);
    }
    this.updateFrontEndStorage([{ key: 'selectResultRecord', value: selectResultRecord }]);
  }

  static findBenchmarkHistoryConfig(config: any): void {
    const lastConvertTS = config.params?.data;
    const target = config.params?.target ?? '';
    const [newFileJson, filePath] = this.getCompressionConvertHistoryFilePath('benchmark');
    const historyRootDir = GlobalModel.instance?.aiCacheDir;

    // 获取并处理 profilingData
    const profilingData = this.getProfilingData();
    if (!profilingData) { return; }

    // 设置通用配置
    const commonConfig = this.createCommonConfig(profilingData);

    // 处理无时间戳的情况
    if (!lastConvertTS) {
      this.updateFrontEndStorage(commonConfig);
      this.clearProfiling();
      return;
    }

    // 过滤历史信息
    const historyInfo = this.filterHistoryInfo(newFileJson, lastConvertTS);
    if (!historyInfo.length) {
      this.updateFrontEndStorage([...commonConfig, ...this.getDefaultAccuracyConfig()]);
      this.clearProfiling();
      return;
    }

    // 提取最新的 profiling 和 accuracy 数据
    const profilingArr = this.sortAndFilterStage(historyInfo, 'profiling');
    const accArr = this.sortAndFilterStage(historyInfo, 'accuracy');

    // 更新前端存储
    if (profilingArr.length) {
      const configSetting = this.createConfigSetting(profilingArr, commonConfig);
      this.updateFrontEndStorage(configSetting);
      this.processBenchmarkDirectory(historyRootDir ?? '', profilingArr, target);
    }

    // 处理基准测试目录和配置文件
    this.processBenchmarkDirectory(historyRootDir ?? '', accArr, target);
  }

  static getProfilingData(): any {
    let profilingData = extension.mockLocalStorage?.getItem('profilingItems');
    if (!profilingData) {
      extension.chipConfigPanel?.postMessage({ type: 'Failed', params: { description: 'Data for benchmark missing!' } });
      return null;
    }
    return Array.isArray(profilingData) ? profilingData : JSON.parse(profilingData);
  }

  static createCommonConfig(profilingData: any[]): any[] {
    return [
      { key: 'dbgSize', value: undefined },
      { key: 'modelSize', value: undefined },
      { key: 'inferenceTime', value: undefined },
      { key: 'timeValue', value: undefined },
      { key: 'ramValue', value: undefined },
      { key: 'flashValue', value: undefined },
      { key: 'profilingData', value: profilingData },
      { key: 'benchmarkSelectValue', value: { port1: '', baudRate1: '', port2: '', baudRate2: '' } },
      { key: 'selectResultRecord', value: [] },
    ];
  }

  static filterHistoryInfo(history: any[], lastConvertTS: string): any[] {
    return history.filter((item: any) => item.convertUUId === parseInt(lastConvertTS));
  }

  static sortAndFilterStage(historyInfo: any[], stage: string): any[] {
    return historyInfo
      .filter((item: any) => item.stage === stage)
      .sort((a, b) => new Date(b.updateTime).getTime() - new Date(a.updateTime).getTime());
  }

  static createConfigSetting(profilingArr: any[], commonConfig: any[]): any[] {
    const { flash, ram, time, psramEnabled } = profilingArr[0] ?? {};

    return [
      ...commonConfig,
      { key: 'dbgSize', value: `${ram} KB` },
      { key: 'modelSize', value: `${flash} KB` },
      { key: 'inferenceTime', value: psramEnabled ? `${time} MS (PSRAM)` : `${time} MS` },
      { key: 'timeValue', value: `${time} MS` },
      { key: 'ramValue', value: `${ram} KB` },
      { key: 'flashValue', value: `${flash} KB` },
    ];
  }

  static getDefaultAccuracyConfig(): any[] {
    return [
      { key: 'balancedAccuracy', value: undefined },
      { key: 'cosineSimilarity', value: undefined },
    ];
  }

  static processBenchmarkDirectory(historyRootDir: string, accArr: any[], target: string): void {
    if (!historyRootDir) {
      extension.chipConfigPanel?.postMessage({ type: 'Failed', params: { description: 'History directory not found!' } });
      return;
    }

    const updateTime = accArr[0]?.updateTime;
    const benchMarkRoot = `${path.join(historyRootDir, `Benchmark/benchmark_${updateTime}`)}`;
    const accuracyConfigPath = `${path.join(benchMarkRoot, 'accuracyConfig.json')}`;
    const nowConfigPath = `${path.join(benchMarkRoot, 'nowConfig.json')}`;
    if (!fs.existsSync(nowConfigPath)) { return; }
    try {
      const serialConfig = JSON.parse(fs.readFileSync(nowConfigPath, 'utf8'));
      // 更新波特率的配置
      let port1 = '';
      let port2 = '';
      let baudRate1 = '';
      let baudRate2 = '';
      if (target === 'NPU') {
        if (Array.isArray(serialConfig)) {
          serialConfig.forEach(item => {
            if (item.type === 'data') {
              port1 = `COM${item.port}`;
              baudRate1 = item.bandrate;
            }
            if (item.type === 'command') {
              port2 = `COM${item.port}`;
              baudRate2 = item.bandrate;
            }
          });
        }
      } else {
        const { Port, BandRate } = serialConfig ?? {};
        port1 = `COM${Port}`;
        baudRate1 = BandRate;
        port2 = '';
        baudRate2 = '';
      }
      this.updateFrontEndStorage([{ key: 'benchmarkSelectValue', value: { port1, port2, baudRate1, baudRate2 } }]);
    } catch (error) {
      this.logAndReportError(`/nowConfig.json parse error: ${this.handleError(error)}`);
    }
    if (!fs.existsSync(benchMarkRoot) || !fs.existsSync(accuracyConfigPath)) { return; }

    try {
      const json = JSON.parse(fs.readFileSync(accuracyConfigPath, 'utf8'));
      this.updateFrontEndStorage([{ key: 'profilingData', value: json }]);
      this.importProGraph(target === 'NPU', benchMarkRoot, updateTime, true);
      this.importProValidation(target === 'NPU', benchMarkRoot);
    } catch (err) {
      this.logAndReportError(`/accuracyConfig.json parse error: ${this.handleError(err)}`);
    }
  }

  static clearProfiling(): void {
    this.updateProfilingChart([]);
    // All done. send message.
    const frontEndConfigCallbackMessage: FrontEndConfigMessage = {
      method: ApiMethod.IMPORT_PROVALIDATION_CALLBACK,
      params: {
        data: [],
      },
    };
    extension.chipConfigPanel?.postMessage(frontEndConfigCallbackMessage);
  }

  static stopProfiling(): void {
    const child = this.profilingChildProcess;
    if (child?.pid) {
      try {
        if (process.platform === 'win32') {
          // /T = kill process tree, /F = force terminate
          spawn('taskkill', ['/T', '/F', '/PID', String(child.pid)]);
        } else {
          child.kill('SIGTERM');
        }
      } catch {
        // Process may have already exited
      }
      this.profilingChildProcess = null;
    }
    extension.chipConfigPanel?.postMessage({ type: 'Failed', params: { description: 'Benchmark aborted by user.' } });
  }

  static postProfiling(target: any, stage: any, outputRootPath: any, dateTime: any): number {
    if (!fs.existsSync(outputRootPath)) {
      this.logAndReportError('Post profiling failed: outputrootpath not found!');
      return 0;
    }
    if (stage !== 'accuracy' && stage !== 'profiling') { return 1; }
    const isNPU = (target === 'NPU');
    const jsonName = isNPU ? 'profilingOutput.json' : 'output_prof.json';
    const profJsonPath = `${outputRootPath}/${jsonName}`;
    if (isNPU) {
      if (stage === 'profiling') {
        if (!fs.existsSync(profJsonPath)) {
          const config = [
            { key: 'dbgSize', value: undefined },
            { key: 'modelSize', value: undefined },
            { key: 'inferenceTime', value: undefined },
          ];
          this.updateFrontEndStorage(config);
          return 1;
        }
        const raw = fs.readFileSync(profJsonPath, 'utf-8');
        const json = JSON.parse(raw);
        const { dbgSize, modelSize, inferenceTime } = json;
        const dbgSizeValue = (parseFloat(dbgSize)).toFixed(2);
        const modelSizeValue = (parseFloat(modelSize)).toFixed(2);
        let inferenceTimeValue = parseFloat(inferenceTime).toFixed(2);
        const psramEnabled = extension.mockLocalStorage?.getItem('psramEnabled');
        const config = [
          { key: 'dbgSize', value: `${dbgSizeValue} KB` },
          { key: 'modelSize', value: `${modelSizeValue} KB` },
          { key: 'inferenceTime', value: psramEnabled ? `${inferenceTimeValue} MS (PSRAM)` : `${inferenceTimeValue} MS` },
        ];
        const paramsHistory = { timeValue: inferenceTimeValue, ramValue: dbgSizeValue, flashValue: modelSizeValue, dateTime, stage, psramEnabled };
        this.generateProfilingHistory(paramsHistory);
        this.updateFrontEndStorage(config);
      } else if (stage === 'accuracy') {
        // Accuracy results on NPU : accuracyOutput.csv
        let errMsg = this.importProValidation(isNPU, outputRootPath);
        if (errMsg) {
          extension.chipConfigPanel?.postMessage({ type: 'Failed', params: { description: errMsg } });
          return 1;
        }
        // Accuracy results on NPU : accuracyOutput.json
        errMsg = this.importProGraph(isNPU, outputRootPath, dateTime);
        if (errMsg) {
          extension.chipConfigPanel?.postMessage({ type: 'Failed', params: { description: errMsg } });
          return 1;
        }
      } else {
        this.logAndReportError('postProfiling failed: Unknown stage.');
        return 1;
      }
    } else {
      if (stage === 'profiling') {
        if (!fs.existsSync(profJsonPath)) {
          this.logAndReportError('Post profiling failed: Json not found!');
          return 1;
        }
        const raw = fs.readFileSync(profJsonPath, 'utf-8');
        const [{ time, ram, flash }] = JSON.parse(raw);
        const timeValue = (time).toFixed(2);
        const ramValue = (parseFloat(ram) / 1024).toFixed(2);
        const flashValue = (parseFloat(flash) / 1024).toFixed(2);
        const config = [
          { key: 'timeValue', value: `${timeValue} MS` },
          { key: 'ramValue', value: `${ramValue} KB` },
          { key: 'flashValue', value: `${flashValue} KB` },
        ];
        const paramsHistory = { timeValue, ramValue, flashValue, dateTime, stage };
        this.generateProfilingHistory(paramsHistory);
        const frontEndConfigCallbackMessage: ConfigMessage = {
          method: ApiMethod.SAVE_CONFIG_CALLBACK,
          params: { config: config },
        };
        extension.chipConfigPanel?.postMessage(frontEndConfigCallbackMessage);
      } else if (stage === 'accuracy') {
        // Accuracy results on CPU : output.csv
        let errMsg = this.importProValidation(isNPU, outputRootPath);
        if (errMsg) {
          extension.chipConfigPanel?.postMessage({ type: 'Failed', params: { description: errMsg } });
          return 1;
        }
        // Accuracy results on CPU : output.json
        errMsg = this.importProGraph(isNPU, outputRootPath, dateTime);
        if (errMsg) {
          extension.chipConfigPanel?.postMessage({ type: 'Failed', params: { description: errMsg } });
          return 1;
        }
      } else {
        logger.error('postProfiling');
        return 1;
      }
    }
    return 0;
  }

  static generateProfilingHistory(data: any): void {
    const newData = deepCopy(data);
    if (Object.keys(newData).length > 0) {
      const fileJsonCompression = this.getCompressionConvertHistoryFilePath('convert');
      const [newFileJson, filePath] = this.getCompressionConvertHistoryFilePath('benchmark');
      const lastConvertTS = extension.mockLocalStorage?.getItem('lastConvertTS');
      if (!lastConvertTS) {
        this.logAndReportError('lastConvertTS');
        return;
      }
      let [historyInfo] = fileJsonCompression[0].filter((item: any) => {
        return item.updateTime === parseInt(lastConvertTS);
      });
      const { timeValue, ramValue, flashValue, dateTime, balancedAccuracy, cosineSimilarity, stage, psramEnabled } = newData ?? {};

      const historyList = newFileJson;
      const source = GlobalModel.instance.source;
      const modelLocalPath = GlobalModel.instance.localFile;
      const nowHistoryList = newFileJson.filter(item => {
        return item.updateTime === dateTime;
      });
      if (nowHistoryList.length > 0) {
        historyList.forEach(item => {
          // 更新balancedAccuracy和cosineSimilarity
          if (item.updateTime === dateTime) {
            item.accuracyB = balancedAccuracy ?? '----';
            item.avgSimB = cosineSimilarity ?? '----';
          }
        });
      } else {
        if (!modelLocalPath || !source) { return; }
        const historySize = fs.statSync(modelLocalPath);
        historyInfo = {
          source: source,
          modelName: path.basename(modelLocalPath),
          contentLength: historySize.size,
          updateTime: dateTime,
          convertUUId: parseInt(lastConvertTS),
          accuracy: historyInfo.accuracy ?? '----',
          avgSim: historyInfo.avgSim ?? '----',
          mse: historyInfo.mse ?? '----',
          accuracyChange: historyInfo?.accuracyChange ?? '----',
          date: timestampToDateTime(dateTime) ?? '----',
          ram: ramValue ?? '----',
          flash: flashValue ?? '----',
          time: timeValue ?? '----',
          stage,
          psramEnabled,
          accuracyB: balancedAccuracy ?? '----',
          avgSimB: cosineSimilarity ?? '----',
        };
        historyList.push(historyInfo);
      }
      try {
        fs.writeFileSync(filePath, JSON.stringify(historyList), 'utf8');
      } catch (err) {
        this.logAndReportError(`Generating benchmark result history failed! : ${this.handleError(err)}`);
      }
    }
  }

  static async startBuilding(message: any): Promise<void> {
    const rootPath = common.getWorkFolderPath();
    const { buildTarget, target, chipName: rawChipName } = message;
    const isCPU = target === 'CPU';
    const chip: ChipName = rawChipName || (isCPU ? 'ws63' : '3322');
    this.buildChip = chip;

    const chipCfg = CHIP_CONFIG[chip];
    const fwpkgPath = chipCfg ? path.join(rootPath, chipCfg.fwpkgRelPath) : '';

    if (fwpkgPath && fs.existsSync(fwpkgPath)) {
      extension.chipConfigPanel?.postMessage({ type: 'Info', params: { description: 'Binary found. Skipping...' } });
      return;
    }

    // 1156e: run remote build on Linux server.
    if (chip === '1156e') {
      try {
        await this.build1156eRemote(rootPath, fwpkgPath);
        extension.chipConfigPanel?.postMessage('compileDone');
      } catch (err) {
        const errMsg = `1156e remote build failed: ${this.handleError(err)}`;
        this.outputLogger.handleLogInfo(errMsg, 'error');
        extension.chipConfigPanel?.postMessage({ type: 'compileFailed' });
      }
      return;
    }

    // ws63 / 3322: local build via python build.py.
    const toolRootPath = common.getToolsPath();
    const python = path.join(toolRootPath, 'tools/python/python.exe');
    const args = ['build.py', '-c', buildTarget];

    try {
      await this.runProcess(python, args, rootPath, undefined, (p) => { this.buildChildProcess = p; });
      extension.chipConfigPanel?.postMessage('compileDone');
    } catch (err) {
      const errMsg = `Failed to execute python script : ${this.handleError(err)}`;
      this.outputLogger.handleLogInfo(errMsg, 'error');
      extension.chipConfigPanel?.postMessage({ type: 'compileFailed' });
    }
  }

  private static async build1156eRemote(_rootPath: string, fwpkgPath: string): Promise<void> {
    const remoteHome = GlobalModel.instance.remoteHome;
    if (!remoteHome) { throw new Error('Remote server not connected.'); }

    const config = CHIP_CONFIG['1156e'];
    const remoteBuildDir  = `${remoteHome}/${config.remoteBuildDir}`;
    const remoteImagesDir = `${remoteBuildDir}/output/tiangong2_cmcc_hgu_release/images`;
    const cdBuild  = `cd "${remoteBuildDir}"`;
    const cdImages = `cd "${remoteImagesDir}"`;

    type CmdResult = { exitCode: number; stdout: string; stderr: string };
    let ret: CmdResult;

    // Step 1: clean previous output and tmp.
    await vscode.commands.executeCommand(this.remoteCmdLib.executeCmd, `${cdBuild} && rm -rf output tmp`);

    // Step 2: full build.
    extension.chipConfigPanel?.postMessage({ type: 'Info', params: { description: '1156e: Building on remote server...' } });
    const buildCmd = `${cdBuild} && bash -c 'echo $$ > ${this.BUILD_1156E_PID_FILE} && exec ./cbuild.py -c tiangong2 -p cmcc_hgu -t release'`;
    ret = await vscode.commands.executeCommand(this.remoteCmdLib.executeCmd, buildCmd);
    if (this.buildChip !== '1156e') { return; } // abort signal set by stopBuilding
    if (ret.exitCode) { throw new Error(`Build failed (exit ${ret.exitCode}): ${ret.stderr}`); }

    // Step 3: verify key output files are non-empty.
    const fileChecks = this.BUILD_1156E_FILES_TO_CHECK
      .map(f => `[ ! -s "${f}" ] && echo "EMPTY: ${f}" && exit 1`)
      .join('; ');
    const checkCmd = `${cdImages} && { ${fileChecks}; } && echo "ALL_OK"`;
    ret = await vscode.commands.executeCommand(this.remoteCmdLib.executeCmd, checkCmd);
    if (ret.exitCode || ret.stdout.includes('EMPTY:')) {
      const empty = ret.stdout.match(/EMPTY: (.+)/)?.[1] ?? 'unknown';
      throw new Error(`Build produced empty file: ${empty}`);
    }

    // Step 4: package fwpkg.
    extension.chipConfigPanel?.postMessage({ type: 'Info', params: { description: '1156e: Packaging fwpkg...' } });
    const packCmd = `${cdImages} && ./cbuild.py -c tiangong2 -p cmcc_hgu -t release -j -m build_mkp -v fwpkg`;
    ret = await vscode.commands.executeCommand(this.remoteCmdLib.executeCmd, packCmd);
    if (ret.exitCode) { throw new Error(`Packaging failed (exit ${ret.exitCode}): ${ret.stderr}`); }

    // Step 5: download fwpkg to local cache.
    extension.chipConfigPanel?.postMessage({ type: 'Info', params: { description: '1156e: Downloading fwpkg...' } });
    const remoteFwpkg = `${remoteImagesDir}/tiangong2_cmcc_hgu_release.fwpkg`;
    const localDir = path.dirname(fwpkgPath);
    if (!fs.existsSync(localDir)) { fs.mkdirSync(localDir, { recursive: true }); }
    await vscode.commands.executeCommand(this.remoteCmdLib.downloadCmd, remoteFwpkg, fwpkgPath);
    if (!fs.existsSync(fwpkgPath)) { throw new Error('Failed to download fwpkg file.'); }
  }

  static async cpuDeploySetup(message: any): Promise<void> {
    const { source } = message;
    if (source !== 'windows' && source !== 'linux') {
      throw new Error('CPU benchmark must be running on either Linux or Windows!');
    }
    try {
      const historyRoot = GlobalModel.instance.aiCacheDir;
      if (!historyRoot) { return; } // unlikely.

      const lastConvertTS = extension.mockLocalStorage?.getItem('lastConvertTS');
      if (!lastConvertTS || !/^[0-9]+$/.test(lastConvertTS)) {
        this.logAndReportError('Enter from a conversion result');
        return;
      }

      const toolsRoot = common.getToolsPath();
      const sdkPath = common.getWorkFolderPath();
      const scriptRoot = path.join(__dirname, '../resources/scripts/cpu/deploy');
      const scriptPath = path.join(scriptRoot, 'deploy.py');
      const python = path.join(toolsRoot, 'tools/python/python.exe');
      const mindSpore = this.getMindSporeLitePath();
      if (!mindSpore || !fs.existsSync(mindSpore)) {
        throw new Error('Missing dependency: Mindspore-lite. Please reinstall the tool chain.');
      }
      const microGenPath = path.join(historyRoot, `Convert/convert_${lastConvertTS}/micro_gen`);
      const deployConfig = {
        tools: {
          mindSporeLitePath: mindSpore,
          sdkPath,
          microGenPath,
        },
      };

      // Write deploy.json
      const jsonPath = path.join(historyRoot, 'Json', 'deploy.json');
      await fs.promises.writeFile(jsonPath, JSON.stringify(deployConfig, null, 4));

      // Run deploy.py
      await this.runProcess(python, [scriptPath, '--input_json', jsonPath], scriptRoot, undefined, (p) => { this.buildChildProcess = p; });

      // Build sdk
      await this.startBuilding({ buildTarget: 'ws63-liteos-app', target: 'CPU' });

      extension.chipConfigPanel?.postMessage({ type: 'Success' });
    } catch (err) {
      this.logAndReportError(`Unable to build: ${this.handleError(err)}`);
    }
  }

  static async startFlashing(message: any): Promise<void> {
    const {
      port       = '',
      baudRate   = '',
      target,
      burnType   = 'Serial',
      chipName:  rawChipName,
      ipAddr     = '',
      ipAddress  = '',
      subnetMask = '',
      gateway    = '',
      eraseTags  = [] as string[],
      emptyFlash = false,
    } = message.params ?? {};

    const isCPU    = target === 'CPU';
    const chipName = (rawChipName || (isCPU ? 'ws63' : '3322')) as ChipName;
    const chip     = CHIP_CONFIG[chipName];
    if (!chip) {
      extension.chipConfigPanel?.postMessage({ type: 'FlashFailed', params: { description: `Unknown chip: ${chipName}` } });
      return;
    }

    // Port is required for Serial; USB doesn't need it (future).
    if (!baudRate || (burnType !== 'Usb' && !port)) {
      extension.chipConfigPanel?.postMessage({ type: 'FlashFailed', params: { description: 'Cannot access to port or baudrate.' } });
      return;
    }

    const rootPath = common.getWorkFolderPath();
    const binPath  = path.join(rootPath, chip.fwpkgRelPath);

    // For local chips (ws63, 3322) the binary must already exist; 1156e downloads it from remote.
    if (chipName !== '1156e' && !fs.existsSync(binPath)) {
      extension.chipConfigPanel?.postMessage({ type: 'FlashFailed', params: { description: 'Check if SDK is compiled.' } });
      return;
    }

    const activeHiprojPath = GlobalModel.instance.hiprojPath;
    if (!activeHiprojPath || !fs.existsSync(activeHiprojPath)) {
      extension.chipConfigPanel?.postMessage({ type: 'FlashFailed', params: { description: 'hiproj file for the current project is missing.' } });
      return;
    }

    // Parse the hiproj, update the [upload] section (fall back to [compile] for older files),
    // then write it back.  ini.parse / ini.stringify preserves all other sections unchanged.
    const parsedContent: any = ini.parse(fs.readFileSync(activeHiprojPath, 'utf-8'));
    const sectionKey = parsedContent.upload !== undefined ? 'upload' : 'compile';
    if (!parsedContent[sectionKey]) { parsedContent[sectionKey] = {}; }
    const up = parsedContent[sectionKey];

    up.bin_path  = binPath;
    up.protocol  = 'serial';
    up.port      = burnType !== 'Usb' ? port : '';
    up.baud      = baudRate;

    if (chipName === '1156e') {
      up.localip     = ipAddr;
      up.ipaddr      = ipAddress;
      up.subnetmask  = subnetMask;
      up.gateway     = gateway;
      up.eraseconfig = Array.isArray(eraseTags) ? eraseTags.join(',') : '';
      up.emptyflash  = emptyFlash ? 'true' : 'false';
    }

    fs.writeFileSync(activeHiprojPath, ini.stringify(parsedContent), 'utf-8');

    const flashCmd     = 'portionOfBurn';
    const availableCmds = await vscode.commands.getCommands(true);
    if (availableCmds.includes(flashCmd)) {
      try {
        const ret = await vscode.commands.executeCommand(flashCmd);
        if (!ret) {
          extension.chipConfigPanel?.postMessage({ type: 'FlashFailed', params: { description: 'Failed to execute command portionOfBurn.' } });
        }
      } catch (err) {
        this.logAndReportError(`Failed to execute flashing command due to : ${this.handleError(err)}`);
      }
    } else {
      vscode.window.showWarningMessage(`Command ${flashCmd} not found, make sure HiSpark Studio is activated and up to date.`);
    }
  }

  static stopBuilding(): void {
    // 1156e: kill the remote build process via the PID file written by cbuild.py.
    if (this.buildChip === '1156e') {
      vscode.commands.executeCommand(
        this.remoteCmdLib.executeCmd,
        `kill -TERM $(cat ${this.BUILD_1156E_PID_FILE}) 2>/dev/null; rm -f ${this.BUILD_1156E_PID_FILE}`,
      );
      this.buildChip = 'NONE';
      extension.chipConfigPanel?.postMessage({ type: 'compileAborted' });
      return;
    }

    // ws63 / 3322: kill the local child process.
    const child = this.buildChildProcess;
    if (child?.pid) {
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/T', '/F', '/PID', String(child.pid)]);
        } else {
          child.kill('SIGTERM');
        }
      } catch {
        // Process may have already exited.
      }
      this.buildChildProcess = null;
    }
    extension.chipConfigPanel?.postMessage({ type: 'compileAborted' });
  }

  static async confirmFlash(message: any): Promise<void> {
    const { isFlashed, stage } = message;
    const options = {
      flashAgain: [
        { label: 'Yes', description: 'Flash again' },
        { label: 'No', description: 'Don\'t flash again' },
      ],
      skipFlashing: [
        { label: 'Yes', description: 'Skip Flashing' },
        { label: 'No', description: 'Don\'t skip flashing' },
      ],
    };

    if (isFlashed) {
      // Already flashed, confirm whether to flash again.
      const choice = await vscode.window.showQuickPick(
        options.flashAgain,
        { placeHolder: 'Already flashed. Flash again?' }
      );

      if (!choice || choice.label === 'No') { return; }
      if (choice.label === 'Yes') {
        extension.chipConfigPanel?.postMessage({ type: 'FlashAgain' });
      }
    } else {
      // Not yet flashed. Confirm whether to skip flashing once and for all.
      const choice = await vscode.window.showQuickPick(
        options.skipFlashing,
        { placeHolder: 'Not flashed. Skip flashing? (Flashing is available in Deploy page)' }
      );

      if (!choice || choice.label === 'No') { return; }
      if (choice.label === 'Yes') {
        extension.chipConfigPanel?.postMessage({ type: 'SkipFlashing', params: { stage: stage } });
      }
    }
  }

  static profParseResults({
    filePath,
    timestamp,
    listUpdateStatus,
  }: {
    filePath: any;
    timestamp?: any;
    listUpdateStatus?: boolean;
  }): any {
    let fileData;
    const fileString = fs.readFileSync(filePath, 'utf8');
    const newFileJson = JSON.parse(fileString);
    fileData = newFileJson;

    const metricsArr = Array.isArray(fileData.Metrics) ? fileData.Metrics : [];
    const histogramArr = Array.isArray(fileData.Histogram) ? fileData.Histogram : [];
    const mergedListArr = [...metricsArr, ...histogramArr];

    const collectedInfo = metricsArr.reduce((acc: any, curr: any) => {
      return { ...acc, ...curr };
    }, {});
    if (!listUpdateStatus) {
      this.updateHistoryRecord(collectedInfo, timestamp);
    }
    fileData = mergedListArr;
    return { fileData };
  }

  static async getUserGuideWebsite(): Promise<void> {
    const userGuidePath = getUserGuidePath();
    const userGuideInfo = JSON.parse(fs.readFileSync(userGuidePath, 'utf-8'));
    const releaseCallbackMessage: UserGuideWebsiteCallbackMessage = {
      method: ApiMethod.GET_USERGUIDE_WEBSITE_CB,
      params: {
        data: userGuideInfo,
      },
    };
    extension.chipConfigPanel?.postMessage(releaseCallbackMessage);
  }

  static async updateHistoryRecord(collect: any, timestamp: any): Promise<void> {
    const nowCollect: any = {};
    Object.assign(nowCollect, collect);
    const [newFileJson, filePath] = this.getCompressionConvertHistoryFilePath('quantize');
    const modelLocalPath = GlobalModel.instance.localFile;
    const historyRootDir = GlobalModel.instance.aiCacheDir;
    const source = GlobalModel.instance.source;
    if (!modelLocalPath || !historyRootDir || !source) { return; } // unlikely

    const parts = historyRootDir.split('_');
    const lastQuantTSStr = timestamp || extension.mockLocalStorage?.getItem('lastQuantTS');
    const selectUUIdStr = parts[parts.length - 1];
    if (selectUUIdStr == null || lastQuantTSStr == null) { return; } // unlikely
    let lastCompressionConfig = extension.mockLocalStorage?.getItem('compressionData');
    if (!lastCompressionConfig) {
      throw new Error('Generate quantization history');
    }
    lastCompressionConfig = common.parseArray(lastCompressionConfig); // make sure it's an array.
    let quantValue = '';
    const { defaultValue, key } = lastCompressionConfig.filter((item: any) => item.title === 'Quantized Data Type')[0] ?? {};
    const quantJsonPath = path.join(historyRootDir, 'Json', 'quant.json');
    if (fs.existsSync(quantJsonPath)) {
      const content = fs.readFileSync(quantJsonPath, 'utf8');
      const data = JSON.parse(content);
      quantValue = data.quant;
    }
    const dtypes = defaultValue ?? '';
    const selectUUId = Number(selectUUIdStr);
    const lastQuantTS = Number(lastQuantTSStr);
    const historySize = fs.statSync(modelLocalPath);
    const historyInfo: HistoryInfo = {
      source: source,
      modelName: path.basename(modelLocalPath),
      contentLength: historySize.size,
      updateTime: lastQuantTS,
      selectUUId: selectUUId,
      accuracy: nowCollect.Accuracy ?? '----',
      avgSim: nowCollect.CosineSimilarity ?? '----',
      mse: nowCollect.MSE ?? '----',
      ram: nowCollect.RAM ?? '----',
      accuracyChange: nowCollect?.AccuracyChange ?? '----',
      flash: nowCollect.Flash ?? '----',
      time: nowCollect.Time ?? '----',
      dtype: dtypes,
    };
    if (key === 'bit_num_cpu') {
      historyInfo.quant = quantValue;
    }
    const historyList: HistoryInfo[] = newFileJson;
    historyList.push(historyInfo);

    try {
      fs.writeFileSync(filePath, JSON.stringify(historyList), 'utf8');
    } catch (err) {
      this.logAndReportError(`Creating record failed ! : ${this.handleError(err)}`);
      return;
    }
    const selectedFileMsg: Message = { type: 'UpdateHistory' };
    extension.chipConfigPanel?.postMessage(selectedFileMsg);
  }

  static importHisGraph(filePath: any, stage: any, quanTS: any): void {
    if (!fs.existsSync(filePath)) {
      this.updateHistoryRecord({}, quanTS);
      return;
    }

    try {
      const { fileData } = this.profParseResults({
        filePath: filePath,
        timestamp: quanTS,
      });
      const normalizedData = this.normalizePercentageToDecimal(fileData);
      this.updateChart(normalizedData, stage, ApiMethod.UPDATE_HISGRAPH);
    } catch (err) {
      throw new Error(`Failed to plot results: ${this.handleError(err)}`);
    }

    return;
  }

  static normalizePercentageToDecimal(data: any): any {
    if (Array.isArray(data)) {
      return data.map(item =>
        this.normalizePercentageToDecimal(item)
      );
    }

    if (data !== null && typeof data === 'object') {
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          data[key] = this.normalizePercentageToDecimal(data[key]);
        }
      }
      return data;
    }

    if (typeof data === 'number') {
      return data;
    }

    if (typeof data === 'string') {
      const num = parseFloat(data);
      return isNaN(num) ? data : num;
    }

    return data ?? 0;
  }

  static getFileSizeInKB(filePath: string): number {
    if (!fs.existsSync(filePath)) {
      this.logAndReportError(`[Convert] file not found!: ${filePath}`);
      return 0;
    }
    const stats = fs.statSync(filePath);
    const sizeInKB = stats.size / 1024;
    return parseFloat(sizeInKB.toFixed(2));
  }

  static async importConStark(stage: any, filePath: string, timestamp: any): Promise<void> {
    try {
      let fileData: any = {};
      const convertDir = path.dirname(filePath);

      // 1. target platform is NPU. exeom and dbg file can be found. → Read file size.
      const exeomFile = path.join(convertDir, 'convert.exeom');
      const dbgFile = path.join(convertDir, 'convert.dbg');
      if (fs.existsSync(exeomFile) && fs.existsSync(dbgFile)) {
        fileData = {
          type: 'fileSize',
          exeomSize: this.getFileSizeInKB(exeomFile),
          dbgSize: this.getFileSizeInKB(dbgFile),
        };
      } else if (fs.existsSync(filePath) && path.extname(filePath).toLowerCase() === '.json') {
        // 2. target platform is CPU → analyze ram and flash from json files.
        const fileString = fs.readFileSync(filePath, 'utf8');
        const jsonData = JSON.parse(fileString);
        fileData = {
          type: 'ramFlash',
          ram: jsonData.ram || {},
          flash: jsonData.flash || {},
        };
      } else {
        throw new Error('Failed to display convert results');
      }
      fileData._convertTS = timestamp;
      // Generate convert history.
      await this.generateConvertHistory(fileData);

      // All set. Notify front end to update the plot area.
      const frontEndConfigCallbackMessage: FrontEndConfigMessage = {
        method: ApiMethod.UPDATE_CONSTARK,
        params: {
          data: { fileData, stage },
        },
      };
      extension.chipConfigPanel?.postMessage(frontEndConfigCallbackMessage);
    } catch (err) {
      throw new Error(`Failed to display convert outputs : ${this.handleError(err)}`);
    }
  }

  static async generateConvertHistory(data: any): Promise<void> {
    const newData = deepCopy(data);
    if (Object.keys(newData).length > 0) {
      const fileJsonCompression = this.getCompressionConvertHistoryFilePath('quantize');
      const [newFileJson, filePath] = this.getCompressionConvertHistoryFilePath('convert');
      const lastQuantTS = extension.mockLocalStorage?.getItem('lastQuantTS');
      if (!lastQuantTS) {
        throw new Error('Generate convert history');
      }
      let [historyInfo] = fileJsonCompression[0].filter((item: any) => {
        return item.updateTime === parseInt(lastQuantTS);
      });
      const lastConvertTS = newData._convertTS || extension.mockLocalStorage?.getItem('lastConvertTS');
      if (!lastConvertTS) {
        throw new Error('Generate convert history');
      }
      const modelLocalPath = GlobalModel.instance.localFile;
      const source = GlobalModel.instance.source;
      if (!modelLocalPath || !source) { return; }
      const historySize = fs.statSync(modelLocalPath);
      historyInfo = {
        source: source,
        modelName: path.basename(modelLocalPath),
        contentLength: historySize.size,
        updateTime: parseInt(lastConvertTS),
        quantUUId: parseInt(lastQuantTS),
        accuracy: historyInfo.accuracy ?? '----',
        avgSim: historyInfo.avgSim ?? '----',
        accuracyChange: historyInfo?.accuracyChange ?? '----',
        mse: historyInfo.mse ?? '----',
        time: historyInfo.time ?? '----',
        dtype: historyInfo.dtype ?? '----',
        quant: historyInfo.quant,
      };
      const historyList: HistoryInfo[] = newFileJson;
      if (newData.type === 'ramFlash') {
        const ramValue = Object.values(newData.ram).reduce((pre: any, cur: any) => (pre + cur));
        const flashValue = Object.values(newData.flash).reduce((pre: any, cur: any) => (pre + cur));
        historyInfo = {
          ...historyInfo,
          ram: `${ramValue}`,
          flash: `${flashValue}`,
        };
      } else {
        historyInfo = {
          ...historyInfo,
          exeomSize: `${newData.exeomSize ?? '----'}`,
          dbgSize: `${newData.dbgSize ?? '----'}`,
        };
      }
      historyList.push(historyInfo);
      try {
        fs.writeFileSync(filePath, JSON.stringify(historyList), 'utf8');
      } catch (err) {
        throw new Error(`Generate convert history: ${this.handleError(err)}`);
      }
      const selectedFileMsg: Message = { type: 'UpdateConvertHistory' };
      extension.chipConfigPanel?.postMessage(selectedFileMsg);
    }
  }

  static importProGraph(isNPU: boolean, outputRootPath: string, dateTime: number, listUpdateStatus?: boolean): string | undefined {
    let errMsg;

    try {
      let fileString;
      const filePath = isNPU ? `${outputRootPath}/accuracyOutput.json` : `${outputRootPath}/output.json`;
      if (!fs.existsSync(filePath)) {
        errMsg = 'importProGraph failed: outputRootPath not exists';
        return errMsg;
      }

      fileString = fs.readFileSync(filePath, 'utf8');
      // 异常处理  当返回JSON中存在Infinity/NaN的值时 JSON无法解析 导致报错
      fileString = fileString.replace(/Infinity/g, '\"Infinity\"');
      fileString = fileString.replace(/NaN/g, '\"NaN\"');
      const newFileJson = JSON.parse(fileString);
      fileString = newFileJson;
      let accValue;
      let cosSim;
      let initAccValue;

      if (!isNPU) {
        const metrics = newFileJson.Metrics;
        fileString = newFileJson.Histogram;
        let accuracy;

        for (const item of metrics) {
          if ('Accuracy' in item) {
            accuracy = item.Accuracy;
          }
          if ('CosineSimilarity' in item) {
            cosSim = item.CosineSimilarity;
          }
        }

        accValue = (accuracy === '-' || (typeof accuracy === 'undefined')) ? '--- %' : `${(accuracy * 100).toFixed(2)}%`;
        cosSim = (cosSim === '-' || (typeof cosSim === 'undefined')) ? '----' : `${(Number(cosSim)).toFixed(4)}`;
        initAccValue = accuracy;
        const config = [
          { key: 'balancedAccuracy', value: accValue },
          { key: 'cosineSimilarity', value: cosSim },
        ];
        const saveConfigMsg: ConfigMessage = {
          method: ApiMethod.SAVE_CONFIG_CALLBACK,
          params: { config: config },
        };
        extension.chipConfigPanel?.postMessage(saveConfigMsg);
      } else {
        const metrics = newFileJson.Metrics;
        fileString = newFileJson.Histogram;
        const accuracy = metrics[0].Accuracy;
        cosSim = metrics[0].CosineSimilarity;
        accValue = (accuracy === '-' || (typeof accuracy === 'undefined')) ? '--- %' : `${(accuracy * 100).toFixed(2)}%`;
        cosSim = (cosSim === '-' || (typeof cosSim === 'undefined')) ? '----' : `${(Number(cosSim)).toFixed(4)}`;
        initAccValue = accuracy;
        const config = [
          { key: 'balancedAccuracy', value: accValue },
          { key: 'cosineSimilarity', value: cosSim },
        ];
        const saveConfigMsg: ConfigMessage = {
          method: ApiMethod.SAVE_CONFIG_CALLBACK,
          params: { config: config },
        };
        extension.chipConfigPanel?.postMessage(saveConfigMsg);
      }
      initAccValue = (initAccValue === '-' || (typeof initAccValue === 'undefined')) ? '----' : initAccValue;
      const paramsHistory = { balancedAccuracy: initAccValue ?? '----', cosineSimilarity: cosSim ?? '----', dateTime, stage: 'accuracy' };
      if (!listUpdateStatus) {
        this.generateProfilingHistory(paramsHistory);
      }

      const frontEndConfigArr = fileString;
      this.updateProfilingChart(frontEndConfigArr);
    } catch (err) {
      errMsg = `importProGraph failed : ${this.handleError(err)}`;
      this.updateProfilingChart([]);
      return errMsg;
    }

    return undefined;
  }

  static updateProfilingChart(fileData: any): void {
    const frontEndConfigCallbackMessage: FrontEndConfigMessage = {
      method: ApiMethod.IMPORT_PROGRAPH_CALLBACK,
      params: {
        data: fileData,
      },
    };
    extension.chipConfigPanel?.postMessage(frontEndConfigCallbackMessage);
  }

  static importProValidation(isNpu: boolean, outputRootPath: string): string | undefined {
    let errMsg;

    const historyRootDir = GlobalModel.instance.aiCacheDir;
    if (!historyRootDir) {
      errMsg = 'historyRootDir not found in postprofiling!';
      return errMsg;
    }

    try {
      const filePath = isNpu
        ? `${outputRootPath}/accuracyOutput.csv`
        : `${outputRootPath}/output.csv`;
      if (!fs.existsSync(filePath)) {
        errMsg = 'csv file not foun.';
        return errMsg;
      }

      const rawCsv = fs.readFileSync(filePath, 'utf-8');
      const arr = rawCsv
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);
      if (arr.length <= 1) {
        errMsg = 'csv result files format error.';
        return errMsg;
      }

      // Parse the csv file.
      const tableHeader = arr.shift();
      const tableHeaderArr = tableHeader?.split(',') ?? [];
      const result = arr.map((item: any) => {
        const fields = common.parseCSVLine(item);
        fields.pop();
        return arrayToObject(tableHeaderArr, fields);
      });

      // All done. send message.
      const frontEndConfigCallbackMessage: FrontEndConfigMessage = {
        method: ApiMethod.IMPORT_PROVALIDATION_CALLBACK,
        params: {
          data: result,
        },
      };
      extension.chipConfigPanel?.postMessage(frontEndConfigCallbackMessage);
    } catch (err) {
      errMsg = `importProValidation failed: ${this.handleError(err)}`;
      return errMsg;
    }

    return undefined;
  }

  static showMessageModal({ title, content = '', btn = [], cb = (): void => { }, infoType = 'tips' }: any): void {
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

  static async openProject(record: any): Promise<void> {
    const { params: { project } } = record;
    const { workspace: { workspaceFolders } } = vscode;
    if (Array.isArray(workspaceFolders) && workspaceFolders.length > 0) {
      const p1 = path.normalize(path.dirname(project?.path ?? '')).toLowerCase();
      const alreadyOpenflag = workspaceFolders?.some((item: any) => path.normalize(item?.uri?.fsPath).toLowerCase() === `${p1}\\sdk` || path.normalize(item?.uri?.fsPath).toLowerCase() === p1);
      if (alreadyOpenflag) {
        vscode.commands.executeCommand('HisparkAI.switchPanel');
        return;
      }
    }
    if (project.path && fs.existsSync(project.path)) {
      const hiprojPath = project.path;
      const hiprojDir2  = path.dirname(hiprojPath);
      const projName2   = path.basename(hiprojDir2).replace(/_hiproj$/, '');
      const projPath2   = path.dirname(hiprojDir2);
      const wsFile      = path.join(projPath2, `${projName2}.code-workspace`);

      const content    = fs.readFileSync(hiprojPath, 'utf-8');
      const parsedData = ini.parse(content);
      // Prefer the workspace file (multi-root with hiproj+sdk); fall back to sdk_path
      // for legacy projects created before workspace-file support was added.
      const pathToOpen = fs.existsSync(wsFile) ? wsFile : parsedData.information.sdk_path;
      vscode.commands.executeCommand('openProjectByPath', pathToOpen, 'openAfterCreate');
    }
  }

  static deleteProject(record: any): void {
    const { params: { project } } = record;
    const configPath = extension.chipConfigPanel?.configPath;
    if (configPath && fs.existsSync(configPath)) {
      const rawData = fs.readFileSync(configPath, 'utf-8');
      const jsonRawData = JSON.parse(rawData);
      const newRawData = jsonRawData.filter((item: any) => {
        return item.name !== project.name;
      });
      fs.writeFileSync(configPath, JSON.stringify(newRawData), 'utf8');
      // 删除项目对应的文件
      if (fs.existsSync(project.path)) {
        try {
          fs.unlinkSync(project.path);
          logger.info(`File at ${project.path} has been deleted successfully.`);
        } catch (err) {
          logger.error(`Error deleting file at ${project.path}:`, err);
        }
      }
      const jsonData = newRawData.filter((item: any) => item.chip === '3322' || item.chip === 'ws63' || item.chip === 'WS63');
      const delCallbackMessage: Message = {
        method: ApiMethod.DELETE_PROJECT_CB,
        params: { data: jsonData },
      };
      extension.chipConfigPanel?.postMessage(delCallbackMessage);
    }
  }

  // Export as csv file
  static exportDataMessage(message: any): void {
    let fileName = 'analydata';
    const messageJson = JSON.parse(message.params.value.value);
    if (messageJson.parsedSampleData !== undefined) {
      fileName = 'rawData';
    }
    logger.info('exportDataMessage', message);
    try {
      vscode.window
        .showSaveDialog({ defaultUri: vscode.Uri.file(`${fileName}.${Date.now()}.csv`) })
        .then(uri => {
          if (uri) {
            const headers = {
              CPU: ['TrailID', 'ModelName', 'Accuracy', 'CosineSimilarity', 'RAM', 'Flash', 'InferenceTime', 'AccuracyQuantize', 'CosineSimilarityQuantize', 'MSE'],
              NPU: ['TrailID', 'ModelName', 'Accuracy', 'CosineSimilarity', 'DbgSize', 'ModelSize', 'InferenceTime', 'AccuracyQuantize', 'CosineSimilarityQuantize', 'MSE'],
            };
            const nowHeader = messageJson.target === 'CPU' ? headers.CPU : headers.NPU;
            const rows = messageJson.parsedSampleData as Array<Record<string, any>>;
            const esc = (v: any): string => `"${String(v ?? '').replace(/"/g, '""')}"`;
            const lines: string[] = [
              nowHeader.join(','),
              ...rows.map(r => nowHeader.map(h => esc(r[h])).join(',')),
            ];
            const csv = lines.join('\r\n');
            fs.writeFileSync(uri.fsPath, csv);
          }
        });
    } catch (err) {
      logger.error('Failed to export as csv file.');
    }
  }

  /**
   * Download files(as a zip file) in stage quantize, convert and deploy.
   * @param {Message} message
   */
  static async downloadOutputs(message: any): Promise<void> {
    const model = GlobalModel.instance?.selectedFile;
    const lastConvertTS = extension.mockLocalStorage?.getItem('lastConvertTS');
    const lastQuantTS = extension.mockLocalStorage?.getItem('lastQuantTS');

    if (!model) { return; }
    const { modelEndsWith } = this.parseModelPath(model, '/');
    const { target, nextPage, timestamp } = message.params;
    if (!target || !nextPage) {
      vscode.window.showErrorMessage('Error.');
      return;
    }
    const historyRootDir = GlobalModel.instance?.aiCacheDir;
    if (!historyRootDir) {
      this.logAndReportError('History folder for the current operation not found!');
      return;
    }

    let fileName; // Default filename (joined with timestamp to make a compelete name).
    let targetPath; // Source path where files are downloaded from.
    let deployNeedPath;
    switch (nextPage) {
      case '../convert':
        fileName = 'compression_results';
        if (target === 'CPU') {
          targetPath = `Quant/quant_${timestamp}`;
        } else {
          // onnx : qat disabled. pt/pth : ptq disabled.
          targetPath = (modelEndsWith === 'onnx')
            ? `Quant/quant_${timestamp}/ptq`
            : `Quant/quant_${timestamp}/qat`;
        }
        break;
      case '../deploy':
        fileName = 'convert_results';
        targetPath = `Convert/convert_${timestamp}`;
        break;
      case '../benchmark':
        fileName = 'deploy_models';
        targetPath = (modelEndsWith === 'exeom')
          ? 'selectmodel'
          : `Convert/convert_${lastConvertTS}`; // We do not have direct access to timestamp in History.tsx.
        if (target === 'CPU') {
          deployNeedPath = `Quant/quant_${lastQuantTS}`;
        } else {
          // onnx : qat disabled. pt/pth : ptq disabled.
          deployNeedPath = (modelEndsWith === 'onnx')
            ? `Quant/quant_${lastQuantTS}/ptq`
            : `Quant/quant_${lastQuantTS}/qat`;
        }
        break;
      default:
        vscode.window.showErrorMessage('Unknown nextPage.');
        return;
    }

    let sourcePath = this.handleSourcePath(historyRootDir, targetPath);
    let newSourcePath = '';
    const allQuantConvertPath = path.join(historyRootDir, 'deployTemp');
    if (nextPage === '../profiling') {
      newSourcePath = this.handleSourcePath(historyRootDir, deployNeedPath);
      await fsp.mkdir(allQuantConvertPath, { recursive: true });
      await this.mergeTwoFolders(sourcePath, newSourcePath, allQuantConvertPath);
      sourcePath = allQuantConvertPath;
    }

    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(`${fileName}-${Date.now()}.zip`),
    });
    if (!uri) { return; }
    const outputPath = uri.fsPath;

    // archiver initialization.
    const archiver = require('archiver');
    const archive = archiver('zip', {
      zlib: { level: 9 },
    });
    const output = fs.createWriteStream(outputPath);
    archive.pipe(output);

    // (NPU Convert): Filter to only include exeom files and dbg files.
    // (CPU Convert & Quantization): Download everything in one zip file.
    const shouldIncludeFile = (filePath: string): boolean => {
      const name = path.basename(filePath);
      if (nextPage?.includes('deploy') && target === 'NPU') {
        return name === 'convert.dbg' || name === 'convert.exeom';
      }
      return true;
    };

    const walk = (dir: string): void => {
      const files = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of files) {
        const filePath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(filePath);
        } else {
          if (shouldIncludeFile(filePath)) {
            const relativePath = path.relative(sourcePath, filePath);
            archive.append(fs.createReadStream(filePath), { name: relativePath });
          }
        }
      }
    };

    try {
      walk(sourcePath);
      archive.finalize();

      output.on('finish', () => {
        logger.info('ZIP file created successfully:', outputPath);
        vscode.window.showInformationMessage('ZIP file created successfully.');
        common.deleteFolder(allQuantConvertPath);
      });
      output.on('error', (err: any) => {
        logger.error('Failed to create ZIP file:', err);
        vscode.window.showErrorMessage('Failed to create ZIP file.');
      });
    } catch (err) {
      logger.error('Failed during zip creation:', err);
      vscode.window.showErrorMessage('Failed during zip creation.');
    }
  }

  static openReleaseNote(version: any): void {
    if (version.params === 'all') {
      vscode.commands.executeCommand('welcomePage.showReleaseNote', version.params);
    } else {
      vscode.commands.executeCommand('HisparkAI.showReleaseNote', version.params);
    }
  }

  static handleSourcePath(historyRootDir: any, targetPath: any): string {
    const sourcePath = path.join(historyRootDir, targetPath);
    if (!fs.existsSync(sourcePath)) {
      vscode.window.showErrorMessage(`Nothing to download : ${sourcePath} doesn't exist!`);
      return '';
    }
    return sourcePath;
  }

  static async copyFolderRecursive(srcPath: string, destPath: string): Promise<void> {
    try {
      // 检查源目录是否存在
      await fsp.access(srcPath);
    } catch (err) {
      logger.error(`Source directory does not exist: ${srcPath}`);
      return;
    }
    // 创建目标目录（如果不存在），recursive: true 会自动创建多级目录
    await fsp.mkdir(destPath, { recursive: true });

    // 读取源目录内容，withFileTypes 能区分文件和文件夹
    const entries = await fsp.readdir(srcPath, { withFileTypes: true });

    for (const entry of entries) {
      const srcRes = path.join(srcPath, entry.name);
      const destRes = path.join(destPath, entry.name);

      if (entry.isDirectory()) {
        // 如果是文件夹，递归调用
        await this.copyFolderRecursive(srcRes, destRes);
      } else if (entry.isFile()) {
        // 如果是文件，执行复制
        // 注意：如果目标文件已存在，此操作会覆盖它
        await fsp.copyFile(srcRes, destRes);
      } else {
        // 处理符号链接或其他特殊文件类型（可选）
        logger.warn(`Skip files that are not regular files: ${srcRes}`);
      }
    }
  }

  static async mergeTwoFolders(folder1: string, folder2: string, outputFolder: string): Promise<void> {
    try {
      // 确保目标目录存在
      await fsp.mkdir(outputFolder, { recursive: true });
      // 1. 复制第一个文件夹
      await this.copyFolderRecursive(folder1, outputFolder);
      // 2. 复制第二个文件夹
      // 策略：后复制的覆盖先复制的同名文件
      await this.copyFolderRecursive(folder2, outputFolder);
    } catch (error) {
      logger.error('A severe error has occurred:', (error as Error).message);
      process.exit(1);
    }
  }

  static calculteReleaseTime(date: string): string {
    const nowDate = new Date();
    const releaseData = new Date(date);

    const yearDiff = nowDate.getFullYear() - releaseData.getFullYear();
    const monthDiff = nowDate.getMonth() - releaseData.getMonth();
    const dayDiff = nowDate.getDate() - releaseData.getDate();

    if (yearDiff < 0) {
      return res('justNow');
    } else if (yearDiff > 0) {
      return `${res('yearAgo', [yearDiff.toString()])}`;
    } else {
      // do nothing
    }

    if (monthDiff < 0) {
      return res('justNow');
    } else if (monthDiff > 0) {
      return `${res('monthAgo', [monthDiff.toString()])}`;
    } else {
      // do nothing
    }

    if (dayDiff <= 0) {
      return res('justNow');
    }
    return `${res('dayAgo', [dayDiff.toString()])}`;
  }

  static getReleaseNotes(): void {
    const releaseInfoPath = path.resolve(extension.chipConfigPanel?.contextpath ?? '', 'resources/releasenotes.json');
    let releaseInfo: Release[] = JSON.parse(fs.readFileSync(releaseInfoPath, 'utf-8'));

    releaseInfo = releaseInfo.slice(0, 2).map((release: Release) => {
      const { version, time } = release;
      return { version, time: Command.calculteReleaseTime(time), description: res(`${version}desc`) };
    });

    const releaseCallbackMessage: ReleaseCallbackMessage = {
      method: ApiMethod.RELEASE_CALL_BACK,
      params: { data: releaseInfo },
    };
    extension.chipConfigPanel?.postMessage(releaseCallbackMessage);
  }

  // 输入框手动输入信息
  static async logManualInputToChannel(message: any): Promise<void> {
    // 判断 method 是否匹配
    if (message.method === ApiMethod.LOG_MANUAL_INPUT_TO_CHANNEL) {
      const { inputKey, manualInput, folder, title } = message.params || {};
      // 避免空值
      const inputNull = !inputKey || title === undefined || folder === undefined || !manualInput || manualInput.trim() === '';
      if (inputNull) {
        return;
      }
      const logContent = `User input ： ${manualInput?.trim()}`;
      vscode.window.showInformationMessage(`${logContent}`);
    }
  }

  private static async getWslLists(): Promise<string[]> {
    const list = await common.exeRunner({ exe: 'wsl.exe', args: ['-l', '-q'], mode: 'utf16le', logger: this.outputLogger, silent: true });
    if (list.code !== 0) {
      throw new Error('Failed to list WSL distros.');
    }
    const distroList = list.stdout.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (distroList.length === 0) {
      throw new Error('No WSL distros found.');
    }
    return distroList;
  }

  private static async convertPathIfNeeded(originalPath: string, source: Source): Promise<string> {
    if (originalPath === undefined) { throw new Error('Failed to convert path : path not exists.'); }
    if (source !== 'wsl') { return originalPath; }
    if (originalPath.trim().length === 0) { return originalPath; } // original path could be empty.
    const wslDistro = this.getWslDistro();
    const converted = await common.winToLinuxPathForWsl(wslDistro, originalPath, common.exeRunner);
    if (!converted) { throw new Error(`Failed to convert path: ${originalPath}`); }

    return converted;
  }

  private static buildQuantContext(data: any, target: 'NPU' | 'CPU', type: any, source?: Source, skipQuant?: boolean): QuantContext | undefined {
    const { mergedData, compressionData, layerData, linuxCacheRoot } = data;

    const isWSL = source === 'wsl';
    const isCPU = target === 'CPU';
    const isQAT = target === 'NPU' && type?.toUpperCase() === 'QAT';

    const remoteHome = GlobalModel.instance?.remoteHome;
    const wslDistro = GlobalModel.instance?.wslDistro;
    const historyRootDir = GlobalModel.instance?.aiCacheDir;
    const selectedFile = GlobalModel.instance?.selectedFile;

    if (!historyRootDir || !selectedFile) { return undefined; }

    const rootDir = remoteRootDir;
    const paths = this.paramsConfig(historyRootDir, remoteHome, 'quant');

    const chip     = GlobalModel.instance.soc ?? '';
    const platform = this.getPlatform(chip, target);

    return {
      source,
      skipQuant,
      target,
      type,
      isWSL,
      isCPU,
      isQAT,
      remoteHome,
      wslDistro,
      selectedFile,
      historyRootDir,
      rootDir,
      chip,
      platform,
      mergedData: { ...mergedData, chip, platform },
      compressionData,
      layerData,
      linuxCacheRoot,
      paths,
    };
  }

  private static buildConvertContext(data: any, target: 'NPU' | 'CPU', source?: Source): ConvertContext | undefined {
    const { mergedData, convertData, linuxCacheRoot } = data;

    const isWSL = source === 'wsl';
    const isCPU = target === 'CPU';

    const remoteHome = GlobalModel.instance?.remoteHome;
    const wslDistro = GlobalModel.instance?.wslDistro;
    const historyRootDir = GlobalModel.instance?.aiCacheDir;
    const selectedFile = GlobalModel.instance?.selectedFile;

    if (!historyRootDir || !selectedFile) { return undefined; }

    const rootDir = remoteRootDir;
    const paths = this.paramsConfig(historyRootDir, remoteHome, 'convert');

    const chip     = GlobalModel.instance.soc ?? '';
    const platform = this.getPlatform(chip, target);

    return {
      source,
      target,
      isWSL,
      isCPU,
      remoteHome,
      wslDistro,
      selectedFile,
      historyRootDir,
      rootDir,
      chip,
      platform,
      mergedData: { ...mergedData, chip, platform },
      convertData,
      linuxCacheRoot,
      paths,
    };
  }

  private static async newModelSetup(): Promise<void> {
    this.clearConfig();
    await this.clearHistory();
    await this.generateFolders();
  }

  private static async runProcess(
    exe: string,
    args: string[],
    rootPath: string,
    options?: common.RunProcessOptions,
    trackProcess?: (child: any | null) => void
  ): Promise<void> {
    const { cmd, customEnv, onStdout, onStderr } = options ?? {};
    OutputChannelManager.show(this.channelName, true);
    this.outputLogger.clear();

    if (cmd) { this.outputLogger.handleLogInfo(`Start running: ${cmd}\n`, 'info'); }
    return new Promise<void>((resolve, reject) => {
      const baseEnv: NodeJS.ProcessEnv = {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUNBUFFERED: '1',
      };
      const finalEnv: NodeJS.ProcessEnv = {
        ...baseEnv,
        ...customEnv,
      };

      const child = spawn(exe, args, {
        cwd: rootPath,
        shell: false,
        windowsHide: false,
        env: finalEnv,
      });

      if (trackProcess) { trackProcess(child); }

      child.stdout.on('data', (data) => {
        const text = data.toString('utf8');
        if (!options?.stdoutFilter || options.stdoutFilter(text)) {
          this.outputLogger.handleLogInfo(text, 'info');
        }
        if (onStdout) { onStdout(text); }
      });

      child.stderr.on('data', (data) => {
        const text = data.toString('utf8');
        if (/ - ERROR - |Traceback|Exception/i.test(text)) {
          this.outputLogger.handleLogInfo(text, 'error');
        } else {
          this.outputLogger.handleLogInfo(text, 'info');
        }

        if (onStderr) { onStderr(text); }
      });

      child.on('error', (err) => {
        if (trackProcess) { trackProcess(null); }
        const errorMsg = `Python error: ${this.handleError(err)}`;
        this.outputLogger.handleLogInfo(errorMsg, 'error');
        reject(new Error(errorMsg));
      });

      child.on('close', (code) => {
        if (trackProcess) { trackProcess(null); }
        this.outputLogger.flush();
        if (code === 0) {
          this.outputLogger.handleLogInfo('Process finished successfully\n', 'info');
          resolve();
        } else {
          this.outputLogger.handleLogInfo(`Process failed with code ${code}\n`, 'error');
          reject(new Error(`Exited with code ${code}\n`));
        }
      });
    });
  }

  private static flattenDir(localDir: string, dirname: 'quant' | 'convert'): void {
    const targetDir = path.join(localDir, dirname);

    if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) { return; } // unlikely

    const entries = fs.readdirSync(targetDir);
    for (const entry of entries) {
      const src = path.join(targetDir, entry);
      const dest = path.join(localDir, entry);

      if (fs.existsSync(dest)) {
        fs.rmSync(dest, { recursive: true, force: true });
      }

      fs.renameSync(src, dest);
    }

    fs.rmdirSync(targetDir);
  }

  private static showWarnToast(message: string): void {
    setTimeout(() => { vscode.window.showWarningMessage(message); }, 0);
  }

  private static handleError(err: any): string {
    if (err instanceof Error) {
      return err.message;
    }
    if (typeof err === 'string') {
      return err;
    }
    if (err && typeof err === 'object') {
      return JSON.stringify(err);
    }
    return 'Unknown error';
  }

  private static logAndReportError(errMsg: string): void {
    if (!errMsg) { return; }
    logger.error(errMsg);
    vscode.window.showErrorMessage(errMsg);
  }

  private static postStatusMsg(type: any, params?: any): void {
    const statusMsg: Message = params ? { type, params } : { type };
    extension.chipConfigPanel?.postMessage(statusMsg);
  }

  private static async getWSLPython(distro: string): Promise<string> {
    const which = await common.exeRunner({
      exe: 'wsl.exe',
      args: ['-d', distro, '--', 'bash', '-lc', 'command -v python3'],
      mode: 'utf8', logger: this.outputLogger, python: false, silent: true,
    });
    const python = (which.stdout || '').replace(/\u0000/g, '').trim() || '/usr/bin/python3';
    return python;
  }

  private static getMindSporeLitePath(): string {
    // This function should not throw, otherwise unnecessary throw will occur in NPU workflow.
    const baseDir = path.join(common.getToolsPath(), 'tools', 'mindspore-lite');
    if (!fs.existsSync(baseDir)) { return ''; }

    const entries = fs.readdirSync(baseDir, { withFileTypes: true });

    const matchedDirs = entries
      .filter(entry => entry.isDirectory() && entry.name.includes('mindspore-'))
      .map(entry => entry.name);

    if (matchedDirs.length === 0) { return ''; }
    if (matchedDirs.length > 1) {
      vscode.window.showWarningMessage(
        `Multiple mindspore directories found in ${baseDir}, using the first one: ${matchedDirs[0]}`
      );
    }
    return path.join(baseDir, matchedDirs[0]);
  }

  private static getWslDistro(): string {
    const distro = GlobalModel.instance?.wslDistro;
    if (!distro) {
      throw new Error('wslDistro not recognized.');
    }
    return distro;
  }

  private static cpuCheckSDKReady(): boolean | string {
    const rootPath = common.getWorkFolderPath();
    const checkLists = [
      path.join(rootPath, 'middleware', 'utils', 'ai_mcu'),
      path.join(rootPath, 'middleware', 'utils', 'at'),
    ];
    for (const item of checkLists) {
      if (!fs.existsSync(item)) {
        return item;
      }
    }
    return true;
  }

  private static clearAllWatchers(): void {
    SerialPortWatcher.getInstance().dispose();
    LocalIpWatcher.getInstance().dispose();
    RemoteHeartbeatWatcher.getInstance().dispose();
  }

  private static async watchers(watcherOption: { serial: boolean; heartbeat: boolean }): Promise<void> {
    const { serial, heartbeat } = watcherOption;
    if (serial) {
      SerialPortWatcher.getInstance().start();
      LocalIpWatcher.getInstance().start();
    }

    if (heartbeat) {
      const commands = await vscode.commands.getCommands(true);
      if (commands.includes(this.remoteCmdLib.silentExecuteCmd)) {
        RemoteHeartbeatWatcher.getInstance().start(
          async (): Promise<exeCmdRetType> => {
            return vscode.commands.executeCommand<exeCmdRetType>(this.remoteCmdLib.silentExecuteCmd, 'echo heartbeat');
          },
          () => { this.handleLostConnection(); }
        );
      } else {
        // Disable not found notification temporarily
      }
    }
  }

  private static async checkIfPathValid(stage: 'ptq' | 'qat', jsonData: any, source?: Source): Promise<void> {
    // ptq applies to both CPU and NPU.
    if (!jsonData || Object.keys(jsonData).length === 0) {
      throw new Error('jsonData is empty or invalid'); // unlikely
    }

    // if skipping quantization
    if ('quant' in jsonData && jsonData.quant === '0') {
      return;
    }

    const config = jsonData?.quantConfig;
    if (stage === 'ptq') {
      if (!config) {
        throw new Error('quantConfig is missing');
      }

      const caliInputs = Array.isArray(config.caliInputs) ? config.caliInputs : [];
      for (let i = 0; i < caliInputs.length; i++) {
        const p = caliInputs[i]?.path;
        await this.assertDirectoryPath(p, `quantConfig.caliInputs[${i}].path`, source);
      }

      const valiInputs = Array.isArray(config.valiInputs) ? config.valiInputs : [];
      for (let i = 0; i < valiInputs.length; i++) {
        const p = valiInputs[i]?.path;
        if (typeof p === 'string' && p.trim()) {
          await this.assertDirectoryPath(p, `quantConfig.valiInputs[${i}].path`, source);
        }
      }

      const valiOutputsPath = config.valiOutputs?.path;
      if (typeof valiOutputsPath === 'string' && valiOutputsPath.trim()) {
        await this.assertFilePath(valiOutputsPath, `quantConfig.valiOutputs.path`, '.csv', source);
      }

      const ascendConfig = config.ascendConfig;
      if (typeof ascendConfig === 'string' && ascendConfig.trim()) {
        await this.assertFilePath(ascendConfig, 'quantConfig.ascendConfig', '.cfg', source);
      }

      return;
    }

    if (stage === 'qat') {
      const ascendConfig = config.ascendConfig;
      await this.assertFilePath(jsonData.networkStructure, 'networkStructure.py', '.py', source);

      await this.assertDirectoryPath(config?.retrainInputs, 'retrainInputs', source);
      await this.assertFilePath(config?.retrainOutputs, 'retrainOutputs', '.csv', source);
      await this.assertDirectoryPath(config?.validationInputs, 'validationInputs', source);
      await this.assertFilePath(config?.validationOutput, 'validationOutput', '.csv', source);
      this.assertPositiveInteger(config?.batchSize, 'batchSize');
      this.assertPositiveInteger(config?.epochNum, 'epochNum');
      if (typeof ascendConfig === 'string' && ascendConfig.trim()) {
        await this.assertFilePath(ascendConfig, 'quantConfig.ascendConfig', '.cfg', source);
      }
      return;
    }
    throw new Error(`Unsupported stage: ${stage}`);
  }

  private static assertPositiveInteger(value: any, fieldName: string): void {
    // batch size and epoch number must be valid positive integers.
    const text = String(value ?? '').trim();

    if (!/^[1-9]\d*$/.test(text)) {
      throw new Error(`${fieldName} must be a positive integer without leading zeros: ${value}`);
    }
  }

  private static async assertDirectoryPath(rawPath: any, fieldName: string, source?: Source): Promise<void> {
    if (typeof rawPath !== 'string' || !rawPath.trim()) {
      throw new Error(`${fieldName} is empty or invalid`);
    }

    const selectedPath = rawPath.trim();

    if (source === 'linux') {
      const remoteType = await this.getRemotePathType(selectedPath, fieldName);
      if (remoteType === 'missing') {
        throw new Error(`${fieldName} does not exist: ${selectedPath}`);
      }
      if (remoteType !== 'directory') {
        throw new Error(`${fieldName} must be a directory: ${selectedPath}`);
      }
      return;
    }

    const realPath = this.resolveLocalPath(selectedPath, source);
    if (!fs.existsSync(realPath)) {
      throw new Error(`${fieldName} does not exist: ${selectedPath}`);
    }

    let stat: fs.Stats;
    try {
      stat = fs.statSync(realPath);
    } catch {
      throw new Error(`Failed to access ${fieldName}: ${selectedPath}`);
    }

    if (!stat.isDirectory()) {
      throw new Error(`${fieldName} must be a directory: ${selectedPath}`);
    }
  }

  private static async assertFilePath(rawPath: any, fieldName: string, ext: '.csv' | '.cfg' | '.py', source?: Source): Promise<void> {
    if (typeof rawPath !== 'string' || !rawPath.trim()) {
      throw new Error(`${fieldName} is empty or invalid`);
    }

    const selectedPath = rawPath.trim();
    if (path.extname(selectedPath).toLowerCase() !== ext) {
      throw new Error(`${fieldName} must be a ${ext} file: ${selectedPath}`);
    }

    if (source === 'linux') {
      const remoteType = await this.getRemotePathType(selectedPath, fieldName);
      if (remoteType === 'missing') {
        throw new Error(`${fieldName} does not exist: ${selectedPath}`);
      }
      if (remoteType !== 'file') {
        throw new Error(`${fieldName} must be a file: ${selectedPath}`);
      }
      return;
    }

    const realPath = this.resolveLocalPath(selectedPath, source);
    if (!fs.existsSync(realPath)) {
      throw new Error(`${fieldName} does not exist: ${selectedPath}`);
    }

    let stat: fs.Stats;
    try {
      stat = fs.statSync(realPath);
    } catch {
      throw new Error(`Failed to access ${fieldName}: ${selectedPath}`);
    }

    if (!stat.isFile()) {
      throw new Error(`${fieldName} must be a file: ${selectedPath}`);
    }
  }

  private static resolveLocalPath(p: string, source?: Source): string {
    let localPath = p.trim();

    if (source === 'wsl') {
      // /mnt/d/foo/bar -> D:\foo\bar
      const m = localPath.match(/^\/mnt\/(?<drive>[a-zA-Z])\/(?<path>.*)$/);
      if (m) {
        const drive = m[1].toUpperCase();
        const rest = m[2].replace(/\//g, '\\');
        localPath = `${drive}:\\${rest}`;
      }
    }

    try {
      return fs.realpathSync.native ? fs.realpathSync.native(localPath) : fs.realpathSync(localPath);
    } catch {
      return path.normalize(localPath);
    }
  }

  private static async getRemotePathType(selectedPath: string, fieldName: string): Promise<'missing' | 'file' | 'directory' | 'other'> {
    const quotedPath = `'${selectedPath.replace(/'/g, `'\\''`)}'`;
    const cmd =
      `if [ ! -e ${quotedPath} ]; then echo missing; ` +
      `elif [ -d ${quotedPath} ]; then echo directory; ` +
      `elif [ -f ${quotedPath} ]; then echo file; ` +
      `else echo other; fi`;

    let result: { exitCode: number; stdout: string; stderr: string };
    try {
      result = await vscode.commands.executeCommand(this.remoteCmdLib.executeCmd, cmd);
    } catch (err) {
      throw new Error(`${cmd} failed to execute on the remote server: ${this.handleError(err)}`);
    }

    if (result.exitCode !== 0) {
      throw new Error(`Failed to check ${fieldName} on remote server: ${selectedPath}`);
    }

    const type = result.stdout.trim(); // if type is one of these four options.
    const validTypes = new Set(['missing', 'file', 'directory', 'other']);
    if (validTypes.has(type as 'missing' | 'file' | 'directory' | 'other')) {
      return type as 'missing' | 'file' | 'directory' | 'other';
    }

    throw new Error(`Unexpected remote check result for ${fieldName}: ${selectedPath}`);
  }

  private static getPlatform(chip: string, target: 'CPU' | 'NPU'): string {
    const platformMap: Record<string, Partial<Record<'CPU' | 'NPU', string>>> = {
      ws63: {
        CPU: 'riscv',
      },
      diting: {
        NPU: 'nano',
      },
      mcu: {
        CPU: 'riscv',
      },
      '1156e': {
        CPU: 'arm',
        NPU: 'tiny',
      },
      '1155': {
        CPU: 'arm',
        NPU: 'nano',
      },
    };

    return platformMap[chip]?.[target] ?? '';
  }
}
