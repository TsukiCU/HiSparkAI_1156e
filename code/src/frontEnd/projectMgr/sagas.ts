/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
import { takeEvery, takeLatest } from 'redux-saga/effects';
import * as actions from './actions';
import type { Message } from './interface/api';
import { vscode } from './index';

function* watchGetInfo(): Generator<any, any, any> {
  yield takeEvery(actions.GET_INFO, function* (params: any) {
    try {
      const msg: Message = {
        method: params.operate.operationType,
        params: params.operate,
      };
      vscode.postMessage(msg);
    } catch (err) {
      vscode.postMessage({ method: 'ShowWarning', params: err });
    }
  });
}

function* watchSendProjectData(): Generator<any, any, any> {
  yield takeLatest(actions.SEND_PROJECT_DATA, function* (params: any) {
    try {
      const msg: Message = {
        method: params.operate.operationType,
        params: params.operate.projectData,
      };
      vscode.postMessage(msg);
    } catch (err) {
      vscode.postMessage({ method: 'ShowWarning', params: err });
    }
  });
}

export default [watchGetInfo, watchSendProjectData];
