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
import { vscode } from '@src/frontEnd/index';
import { Logger } from './log4jsfrontend';
import { ApiMethod } from '@src/backEnd/interface/apiMethod';
import type { Message } from '@src/backEnd/interface/api';

export function frontEndFirstLoad(): void {
  const chipMessage: Message = {
    method: ApiMethod.IMPORT_CONFIG_TARGET,
  };
  Logger.info(`前端发送消息给后端 firstload, ${chipMessage}`);
  vscode.postMessage(chipMessage);
  const guideMessage: Message = {
    method: ApiMethod.GET_USERGUIDE_WEBSITE,
  };
  vscode.postMessage(guideMessage);
}