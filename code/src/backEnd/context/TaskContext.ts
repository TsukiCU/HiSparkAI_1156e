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

import { BaseContext } from './BaseTaskContext';

export interface QuantContext extends BaseContext {
  type?: string; // 'PTQ' or 'QAT'.
  skipQuant?: boolean; // skip quantization.

  isQAT: boolean;

  compressionData: any; // generated dynamically.
  layerData: any; // layerwise config.

  paths: {
    retrainCfgPath: string; // local retrain.cfg path in QAT.
    quantJsonPath: string; // path for quant.json
    remoteJsonDir: string; // path to which quant.json is uploaded.
    remoteQuantDir: string; // place where quant scripts are executed on Linux server.
    localOutputDir: string; // local dir that stores quantization outputs.
  };
}

export interface ConvertContext extends BaseContext {
  convertData: any; // generated dynamically.

  paths: {
    convertJsonPath: string; // path for convert.json
    remoteJsonDir: string; // path to which convert.json is uploaded.
    remoteConvertDir: string; // place where convert scripts are executed on Linux server.
    localOutputDir: string; // local dir that stores conversion outputs.
  };
}
