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
const fs = require('fs');
const path = require('path');

/**
 *
 * @param {number} n
 * @return {*}
 */
const pad2 = (n) => {
  return (n < 10 ? '0' : '') + n;
};

/**
 *
 * @return {string}
 */
const getTimeStamp = () => {
  const date = new Date();
  return date.getFullYear().toString() +
    pad2(date.getMonth() + 1) +
    pad2(date.getDate()) +
    pad2(date.getHours()) +
    pad2(date.getMinutes()) +
    pad2(date.getSeconds());
};

const packageJsonFilePath = path.join(__dirname, '../', 'package.json');
const rawData = fs.readFileSync(packageJsonFilePath);
const app = JSON.parse(rawData);
app.versionFull = `${app.version}.${getTimeStamp()}`;
fs.writeFileSync(packageJsonFilePath, JSON.stringify(app, undefined, 2));
