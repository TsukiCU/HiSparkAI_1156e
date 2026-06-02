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
import React from 'react';

export interface ProjectData {
  seriesName: string;
  soc: string;
  board: string;
  projectName: string;
  himpwName: string;
  cpu0Name: string;
  cpu1Name: string;
  cpu2Name: string;
  projectPath: string;
  projectType: string;
  sdkPath: string;
  needSdk: boolean;
  needProjectPath?: boolean;
  boardJsonPath: string;
  chipConfig: boolean;
  platform: string;
  projectNewType: string;
  checkEmptyProject: string;
  samplePath: string;
  sampleNameSelect: string;
};

export interface ProjectConfig {
  setSdkPath: (sdkPath: string) => void;
  setProPath: (proPath: string) => void;
  setIsErrorModalOpen: (isErrorModalOpen: boolean) => void;
  setErrModalType: (errModalType: 'alreadyExists' | 'sdkPathWrong') => void;
  projectData: ProjectData;
  setFieldsValue: any;
  lastSdkPath?: any;
  setSdkContentWrong: (sdkContentWrong: boolean) => void;
  sdkContentWrong?: boolean;
  validateFields: (nameList?: NamePath[]) => any;
};

export declare type InternalNamePath = Array<string | number>;

export declare type NamePath = string | number | InternalNamePath;
export interface launchJsonConfig {
  name: string;
  value: string;
};
export interface OperateStruct {
  operationType: string;
  paramData?: any;
  source?: string;
};

export interface GetJsonInfoStruct {
  operationType: string;
  paramData: GetJsonParam;
  source?: string;
};

export interface ProjectConfigStruct {
  operationType: string;
  projectData?: ProjectData;
};

export interface SaveIniStruct {
  operationType: string;
  data: any;
};

export interface MultiModeStruct {
  value: any;
};

export interface ProjectIniSection {
  partName: string;
  partMap: Map<string, string>;
};

export interface WarningMsg {
  operationType: string;
  data: any;
};

export interface SocListType {
  value: string;
  title: string;
  key: React.Key;
  children?: Array<SocListType & { series: string; boards: Array<string> }>;
};

export interface HandleFactoryStruct {
  path: string;
};

export interface FileTreeNode {
  title: string;
  key: string;
  isLeaf: boolean;
  disabled: boolean;
  children: Array<FileTreeNode>;
};

export interface GroupConfigItem {
  group?: string;
  children?: Array<GroupConfigItem>;
  name?: string;
};

export interface GetJsonParam {
  fileName: string;
  sdkPath: string;
};

export interface AccessAllRights {
  fOk: boolean;
  rOk: boolean;
  wOk: boolean;
};

export interface TipsArr {
  fErr: string;
  rErr: string;
  parseErr: string;
};

export interface CbArr {
  fErr: () => void;
  parseErr: () => void;
};

export type PaeseFileType = 'ini' | 'json';

export interface ConfigReturn {
  userconfig: any;
  subsystem: any;
};

export interface JsonGetParam {
  soc: string;
  sdkPath: string;
  boardJsonPath: string;
  seriesName: string;
};

export interface launchJsonParam extends JsonGetParam {
  toolChain: string;
}

export interface ModalManageObj {
  fErrModal: string;
  rErrModal: string;
  parseErrModal: string;
};

export interface ModalManageWrite {
  unExpectModal: string;
  wErrModal: string;
};

export interface MsgObj {
  unExpectMsg: string;
  wErrMsg: string;
};

export interface FailedFileChildren {
  path: string;
  status: string;
};

export interface ImportTableItem {
  key: string;
  path: string;
  status: string;
  children: Array<FailedFileChildren>;
};

export type Invoker = 'welcomePage' | 'projectSubMenu' | 'handSelect' | 'openAfterCreate' | 'openAfterImport' | 'other';

export interface ProjectCache {
  SDK: string;
  project: string[];
  active: string;
}
