/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */

/** Data collected from the Create Project wizard */
export interface ShadowProjectData {
  soc: string;
  board: string;
  platform: 'CPU' | 'NPU' | '';
  projectName: string;
  projectPath: string;
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

export type Invoker = 'welcomePage' | 'handSelect' | 'openAfterCreate' | 'openAfterImport' | 'other';

export interface ProjectListItem {
  name: string;
  path: string;
  chip: string;
  board: string;
  platform: string;
  time: string;
}
