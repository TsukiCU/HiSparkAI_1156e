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

import { logger } from '../log4js';

export default class MockLocalStorage {
  public store: Map<string, any>;
  constructor() {
    this.store = new Map(); // 记录存储数据
  }

  public setItem(key: string, value: any): boolean {
    try {
      this.store.set(key, value);
    } catch (error) {
      logger.info(error);
      return false;
    }
    return true;
  }

  public getItem(key: string): any {
    if (this.store.has(key)) {
      return this.store.get(key);
    }
    return undefined;
  }

  public removeItem(key: string): boolean {
    const ret = this.store.delete(key);
    return ret;
  }

  public clear(): void {
    this.store.clear();
  }
}
