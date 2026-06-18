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

import type { Log4jsLevelType } from '@src/frontEnd/core/log4jsfrontend';
import type { Target } from '../panels/panel';
import { Source } from '../types';

export interface DemoData {
  key: string;
  name: string;
  age: number;
  address: string;
}

export interface Log4jsData {
  level: Log4jsLevelType;
  data: string;
}

export interface TargetPlatform {
  target: Target;
}

export interface MindScopeModelStruct {
  modelSelected: any;
  batchNum: any;
  bitNum: any;
  input_name1: any;
  input_name2: any;
  inputShape1: any;
  inputShape2: any;
  quantType: any;
  validation: any;
};

export interface ConvertMindScopeModelStruct {
  modelCurrentlySelected: any;
  modelInput1: any;
  shapeValue1: any;
  modelInput2: any;
  shapeValue2: any;
  type1: any;
  type2: any;
};
export interface ProjectData {
  key: string;
  name: string;
  path: string;
  chip: string;
  board: string;
  time: string;
}

export interface ProjectAction {
  method: string;
  project?: ProjectData;
}

export interface Release {
  version: string;
  time: string;
  description: string;
}

export interface ImportFrontEndConfigData {
  content?: any;
  type: ImportFrontEndConfigDataType;
  panelType: PanelType;
}

export enum ImportFrontEndConfigDataType {
  DEFAULT = 0,
  NODEFAULT = 1,
}

export enum PanelType {
  CHIPCONFIG = 0,
  DATAACQ = 1,
  ALLDATA = 2,
}

export interface GetMockLocalStorageData {
  panelType: PanelType;
  key: string;
}

export interface SetMockLocalStorageData {
  panelType: PanelType;
  key: string;
  value: any;
}

export interface HistoryInfo {
  source: Source;
  modelName: string;
  contentLength: number;
  updateTime: number;
  selectUUId?: number;
  quantUUId?: number;    // links a convert/benchmark entry back to its quant entry
  convertUUId?: number;  // links a benchmark entry back to its convert entry
  accuracy?: string | '----';
  avgSim?: string | '----';
  mse?: string | '----';
  ram?: string | '----';
  flash?: string | '----';
  time?: string | '----';
  accuracyChange?: string;
  exeomSize?: string;
  dbgSize?: string;
  host?: string;
  port?: number;
  username?: string;
  dtype?: string;
  quant?: string;
}

export interface UserGuideInfo {
  hisiWebsite: string;
  hisiEcologyWebsite: string;
  vsStudioCodeMarketplaceWebsite: string;
  extensionMarketplaceWebsite: string;
  quickUserGuideWebsite: string;
  userGuideWebsite: string;
}