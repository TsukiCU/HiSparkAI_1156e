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

export interface BaseContext {
  source?: 'linux' | 'wsl' | 'windows';
  target: 'NPU' | 'CPU';

  isWSL: boolean;
  isCPU: boolean;

  remoteHome?: string; // linux specific. Remote home directory.
  wslDistro?: string; // wsl specific. WSL distribution info.

  selectedFile: string; // absolute path for selected model on either wsl or linux.
  historyRootDir: string; // aicached/model_ts/<Task>/<task_ts> (task: quant/convert)
  rootDir: string; // remote root directory: 'hisparkai'.

  mergedData: any; // task.json file content. Used for running task scripts.
  linuxCacheRoot: string; // tasks' output dir on linux. (task: quant/convert)

  timeStamp?: number; // Timestamp for this task operation.
}
