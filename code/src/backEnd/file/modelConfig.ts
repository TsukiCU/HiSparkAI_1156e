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
import * as path from 'path';
import * as fs from 'fs';

function getQuantizeCfg(): string {
  const filePath = path.join(__dirname, '../resources/QuantizeConfig.txt');
  return filePath;
}

export function getChipConfigPath(): string {
  const configPath = getQuantizeCfg();
  if (!fs.existsSync(configPath)) {
    throw new Error('getChipConfigPath: Quantization Config doesn\'t exist!');
  }
  const ret = configPath;
  return ret;
}

export function getUserGuidePath(): string {
  const configPath = getUserGuideJson();
  if (!fs.existsSync(configPath)) {
    throw new Error('getUserGuidePath:未找到userGuide.json');
  }
  const ret = configPath;
  return ret;
}

function getUserGuideJson(): string {
  const filePath = path.join(__dirname, '../resources/userGuide.json');
  return filePath;
}