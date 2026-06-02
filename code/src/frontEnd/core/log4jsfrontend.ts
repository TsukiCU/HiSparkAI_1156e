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

import { ApiMethod } from '@src/backEnd/interface/apiMethod';
import type { Log4jsMessage } from '@src/backEnd/interface/api';
import { vscode } from '@src/frontEnd/index';
import type { Log4jsData } from '@src/backEnd/interface/model';
import { message } from 'antd';

export enum Log4jsLevelType {
  TRACE = 'trace',
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

export function log4jsFrontEnd(level: Log4jsLevelType, msg: string): void {
  try {
    const data: Log4jsData = {
      level: level,
      data: `[WEB]${msg}`,
    };
    const webviewMessage: Log4jsMessage = {
      method: ApiMethod.SET_LOG4JS_MESSAGE,
      params: {
        log4jsData: data,
      },
    };
    vscode.postMessage(webviewMessage);
  } catch (error) {
    message.error('log4jsFrontEnd error');
  }
}

export class Logger {
  static trace(msg: string): void {
    log4jsFrontEnd(Log4jsLevelType.TRACE, msg);
  }

  static debug(msg: string): void {
    log4jsFrontEnd(Log4jsLevelType.DEBUG, msg);
  }

  static info(msg: string): void {
    log4jsFrontEnd(Log4jsLevelType.INFO, msg);
  }

  static warn(msg: string): void {
    log4jsFrontEnd(Log4jsLevelType.WARN, msg);
  }

  static error(msg: string): void {
    log4jsFrontEnd(Log4jsLevelType.ERROR, msg);
  }

  static fatal(msg: string): void {
    log4jsFrontEnd(Log4jsLevelType.FATAL, msg);
  }
}
