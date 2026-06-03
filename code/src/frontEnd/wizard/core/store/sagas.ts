/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
import { all } from 'redux-saga/effects';
import type { ForkEffect } from 'redux-saga/effects';
import appSagas from '../../sagas';

export default function* root(): Generator<any, any, any> {
  const sagas: Array<() => Generator<ForkEffect<never>, void, unknown>> = [...appSagas];
  yield all(sagas.map((s) => s()));
}
