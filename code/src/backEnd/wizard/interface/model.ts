/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */

export interface ShadowProjectData {
  soc: string;
  board: string;
  platform: 'CPU' | 'NPU' | '';
  projectName: string;
  projectPath: string;
  // TODO: temporary — user manually selects an existing SDK folder.
  // Future: auto-download or auto-configure the SDK.
  sdkPath: string;
  // For 1156e: records whether the SDK lives on a Linux remote or in WSL.
  connectionType?: 'linux' | 'wsl';
  wslDistro?: string;
}

export interface OperateStruct {
  operationType: string;
  paramData?: any;
  source?: string;
}

export interface ProjectConfigStruct {
  operationType: string;
  projectData?: ShadowProjectData;
}

export interface SocChipItem {
  value: string;
  title: string;
  key: string;
  series: string;
  boards: string[];
  defaultPlatform: 'CPU' | 'NPU';
  platformFixed: boolean;
}

export interface SocGroupItem {
  value: string;
  title: string;
  selectable: boolean;
  key: string;
  children: SocChipItem[];
}

export interface ProjectListItem {
  name: string;
  path: string;
  chip: string;
  board: string;
  platform: string;
  time: string;
}
