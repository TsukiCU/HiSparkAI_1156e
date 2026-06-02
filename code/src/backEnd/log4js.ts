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

import * as log4js from 'log4js';
import * as os from 'os';
import * as path from 'path';

log4js.configure({
  appenders: {
    info: {
      type: 'file',
      filename: path.join(os.homedir(), '.hispark-studio', 'logs', 'transceiver', 'transceiver.log'),
      maxLogSize: '5M',
      encoding: 'utf-8',
      backups: 10,
      compress: true,
      layout: {
        type: 'pattern',
        pattern: '{"date":"%d","level":"%p","category":"%c","host":"%h","pid":"%z","data":\'%m\'}',
      },
      pattern: 'yyyy-MM-dd',
      keepFileExt: true,
      alwaysIncludePattern: true,
    },
  },
  categories: {
    default: { appenders: ['info'], level: 'info' },
  },
});

export default log4js;

export const logger = log4js.getLogger();
