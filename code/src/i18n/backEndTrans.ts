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

import * as vscode from 'vscode';

/**
 * i18n
 * @param {string} key
 * @param {string[]} args
 * @return {string} value
 */
export function res(key: string, args?: string[]): string {
  const zh = require('./lang/zh.json');
  const en = require('./lang/en.json');

  let languageResult;
  if (vscode.env.language.includes('zh')) {
    languageResult = zh[key] || key;
  } else {
    languageResult = en[key] || key;
  }
  if (!args || args.length === 0) {
    return languageResult;
  }
  for (let i = 0; i < args.length; i++) {
    if (languageResult.indexOf(`{${i}}`) >= 0) {
      languageResult = languageResult.replace(`{${i}}`, args[i]);
    }
  }
  return languageResult;
}
