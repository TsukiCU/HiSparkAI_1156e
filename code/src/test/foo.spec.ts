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

import { foo } from '@src/backEnd/common';
import * as sumObj from '@src/backEnd/sum';

describe('foo module', () => {
  test('1+2-1', () => {
    expect(foo(1, 2)).toBe(2);
  });
  test('mock test 1-1', () => {
    // 给sum打桩，指定返回值为1
    jest.spyOn(sumObj, 'sum').mockReturnValue(1);
    // 断言，1-1 = 0
    expect(foo(1, 2)).toBe(0);
    // 清桩，不影响后续测试用例
    jest.spyOn(sumObj, 'sum').mockRestore();
  });
  test('1+2-1 again', () => {
    expect(foo(1, 2)).toBe(2);
  });
});
