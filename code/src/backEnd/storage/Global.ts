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

// Global model selected by user.
export class GlobalModel {
  private static _instance: GlobalModel;

  private _source: 'wsl' | 'linux' | 'windows' | undefined;
  private _target: 'NPU' | 'CPU' | undefined;

  private _hiprojPath: string | undefined;
  // Root folder of the xxx_hiproj directory (sibling of the SDK folder).
  // aicache/ lives here instead of in the SDK workspace folder.
  private _hiprojDir: string | undefined;
  private _localFile?: string | undefined; // path of locally copied file.
  private _aiCacheDir?: string | undefined; // History dir for current operation. (aicache/${name}.${ext}_${ts})

  // Absolute path of model user picked on either Linux or WSL.
  private _selectedFile: string | undefined;

  // linux specific
  private _remoteHome: string | undefined;

  // wsl specific.
  private _wslDistro?: string | undefined;

  // SOC identifier ('ws63', '3322', '1156e', …) read from .hiproj on activation.
  private _soc?: string | undefined;

  // Board/chip name (the `board` field in .hiproj, e.g. 'ws63', '3322', '1156e').
  private _chipName?: string | undefined;

  private constructor() { }

  public static get instance(): GlobalModel {
    if (!this._instance) { this._instance = new GlobalModel(); }
    return this._instance;
  }

  // getter
  get source(): 'wsl' | 'linux' | 'windows' | undefined {
    return this._source;
  }

  get target(): 'NPU' | 'CPU' | undefined {
    return this._target;
  }

  get hiprojPath(): string | undefined {
    return this._hiprojPath;
  }

  get hiprojDir(): string | undefined {
    return this._hiprojDir;
  }

  get remoteHome(): string | undefined {
    return this._remoteHome;
  }

  get selectedFile(): string | undefined {
    return this._selectedFile;
  }

  get localFile(): string | undefined {
    return this._localFile;
  }

  get aiCacheDir(): string | undefined {
    return this._aiCacheDir;
  }

  get wslDistro(): string | undefined {
    return this._wslDistro;
  }

  // setter
  set source(value: 'wsl' | 'linux' | 'windows' | undefined) {
    this._source = value;
  }

  set target(value: 'NPU' | 'CPU' | undefined) {
    this._target = value;
  }

  set hiprojPath(value: string | undefined) {
    this._hiprojPath = value;
  }

  set hiprojDir(value: string | undefined) {
    this._hiprojDir = value;
  }

  set remoteHome(value: string | undefined) {
    this._remoteHome = value;
  }

  set selectedFile(value: string | undefined) {
    this._selectedFile = value;
  }

  set localFile(value: string | undefined) {
    this._localFile = value;
  }

  set aiCacheDir(value: string | undefined) {
    this._aiCacheDir = value;
  }

  set wslDistro(value: string | undefined) {
    this._wslDistro = value;
  }

  get soc(): string | undefined { return this._soc; }
  set soc(value: string | undefined) { this._soc = value; }

  get chipName(): string | undefined { return this._chipName; }
  set chipName(value: string | undefined) { this._chipName = value; }
}

export enum targetPlatform {
  CPU = 'CPU',
  NPU = 'NPU'
}

export const remoteRootDir = 'hisparkai';
export const DEFAULT_WSL_DISTRO = 'ubuntu-22.04-cann-base';
export const remotePython = {
  NPU: '/usr/bin/python3.10',
  CPU: '/usr/bin/python3.11',
};

/**
 * Return the correct remote Python path for a given chip + platform.
 *
 * ws63 (CPU chip) runs python3.11.
 * 3322, 1156e and any other NPU-server chip run python3.10 — these chips
 * connect to an NPU/AI server whose Python environment is python3.10,
 * even when the project platform is set to CPU.
 */
export function getRemotePython(target: 'CPU' | 'NPU' | 'NONE', soc?: string): string {
  if (soc === '1156e') { return remotePython.NPU; } // 1156e server has python3.10
  return target === 'CPU' ? remotePython.CPU : remotePython.NPU;
}

export const LAST_SELECTED_PATH = {
  model: '',
  general: '',
};