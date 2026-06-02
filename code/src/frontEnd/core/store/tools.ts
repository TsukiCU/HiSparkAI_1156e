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

import type { GetMockLocalStorageMessage, SetMockLocalStorageMessage } from '@src/backEnd/interface/api';
import { ApiMethod } from '@src/backEnd/interface/apiMethod';
import type { GetMockLocalStorageData, PanelType, SetMockLocalStorageData } from '@src/backEnd/interface/model';
import { Logger } from '../log4jsfrontend';
import { vscode } from '@src/frontEnd';

export class BackEndStorage {
  static set(key: string, value: any, type: PanelType): void {
    const data: SetMockLocalStorageData = {
      panelType: type,
      key: key,
      value: value,
    };
    const webviewMessage: SetMockLocalStorageMessage = {
      method: ApiMethod.SET_MOCKLOCALSTORAGE,
      params: {
        data: data,
      },
    };
    Logger.info(`前端发送消息给后端 forntendSetMockLocalStorage, ${webviewMessage}`);
    vscode.postMessage(webviewMessage);
  }

  static get(key: string, type: PanelType): void {
    const data: GetMockLocalStorageData = {
      panelType: type,
      key: key,
    };
    const webviewMessage: GetMockLocalStorageMessage = {
      method: ApiMethod.GET_MOCKLOCALSTORAGE,
      params: {
        data: data,
      },
    };
    Logger.info(`前端发送消息给后端 forntendSetMockLocalStorage, ${webviewMessage}`);
    vscode.postMessage(webviewMessage);
  }
}
