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

import { takeLatest } from 'redux-saga/effects';
import type { ForkEffect } from 'redux-saga/effects';
import * as actions from './actions';
import type { Message } from '../backEnd/interface/api';
import { ApiMethod } from '../backEnd/interface/apiMethod';
import { vscode } from './index';
import { Logger } from '@src/frontEnd/core/log4jsfrontend';

/**
 * demo
 */
function* watchGetDemoData(): Generator<ForkEffect<never>, void, unknown> {
  // eslint-disable-next-line
  yield takeLatest(actions.GET_DEMO_DATA, function* () {
    try {
      const webviewMessage: Message = {
        method: ApiMethod.GET_DEMO_DATA,
      };
      Logger.info(`saga, ${JSON.stringify(webviewMessage)}`);
      vscode.postMessage(webviewMessage);
    } catch (err) {
      Logger.error(`${JSON.stringify(err)}`);
    }
  });
}
function* watchExportDataMessage(): Generator<any, any, unknown> {
  // eslint-disable-next-line
  yield takeLatest(actions.EXPORT_DATA_MESSAGE, function* (value) {
    try {
      const webviewMessage: Message = {
        method: ApiMethod.EXPORT_DATA_MESSAGE,
        params: { value },
      };
      vscode.postMessage(webviewMessage);
    } catch (err) {
      Logger.error(`${JSON.stringify(err)}`);
    }
  });
}
function* watchGetUserGuideWebsite(): Generator<ForkEffect<never>, void, unknown> {
  yield takeLatest(actions.GET_USERGUIDE_WEBSITE, function* () {
    try {
      const webviewMessage: Message = {
        method: ApiMethod.GET_USERGUIDE_WEBSITE,
      };
      vscode.postMessage(webviewMessage);
    } catch (err) {
      // no impact, go on
    }
  });
}
function* watchOpenReleaseNote(): Generator<ForkEffect<never>, void, unknown> {
  yield takeLatest(actions.OPEN_RELEASE_NOTE, function* (params: any) {
    try {
      const webviewMessage: Message = {
        method: ApiMethod.OPEN_RELEASE_NOTE,
        params: params.version,
      };
      vscode.postMessage(webviewMessage);
    } catch (err) {
      // no impact, go on
    }
  });
}
function* watchGetReleaseNotes(): Generator<ForkEffect<never>, void, unknown> {
  yield takeLatest(actions.GET_RELEASE_NOTES, function* () {
    try {
      const webviewMessage: Message = {
        method: ApiMethod.GET_RELEASE_NOTES,
      };
      vscode.postMessage(webviewMessage);
    } catch (err) {
      // no impact, go on
    }
  });
}
export default [watchGetDemoData, watchExportDataMessage, watchGetUserGuideWebsite, watchOpenReleaseNote, watchGetReleaseNotes];
