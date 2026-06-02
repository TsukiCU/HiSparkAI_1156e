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

import { all } from 'redux-saga/effects';
import type { ForkEffect, AllEffect } from 'redux-saga/effects';

import appSagas from '../../sagas';

/**
 * root sagas
 */
export default function* root(): Generator<AllEffect<Generator<ForkEffect<never>, void, unknown>>, void, unknown> {
  const sagas: Array<() => Generator<ForkEffect<never>, void, unknown>> = [...appSagas];
  yield all(sagas.map((s) => s()));
}
