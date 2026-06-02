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
import * as actions from './actions';
import type { Message } from '../backEnd/interface/api';
import { vscode } from './index';
import { ApiMethod } from '../backEnd/interface/apiMethod';

/**
 * watch get info saga
 */
function* watchGetInfo(): Generator<any, any, any> {
  yield takeLatest(actions.GET_INFO, function* (params: any) {
    try {
      const webviewMessage: Message = {
        method: params.operate.operationType,
        params: params.operate,
      };
      vscode.postMessage(webviewMessage);
    } catch (err) {
      vscode.postMessage({
        method: 'ShowWarning',
        params: err,
      });
    }
  });
}

/**
 * watch get serial ports info
 */
function* watchGetSerialPorts(): Generator<any, any, any> {
  yield takeLatest(actions.GET_SERIAL_PORTS, function* (params: any) {
    try {
      const webviewMessage: Message = {
        method: params.operate.operationType,
      };
      vscode.postMessage(webviewMessage);
    } catch (err) {
      vscode.postMessage({
        method: 'ShowWarning',
        params: err,
      });
    }
  });
}

function* watchGetUsbValueList(): Generator<any, any, any> {
  yield takeLatest(actions.GET_USB_VALUE_LIST, function* (params: any) {
    try {
      const webviewMessage: Message = {
        method: params.operate.operationType,
      };
      vscode.postMessage(webviewMessage);
    } catch (err) {
      vscode.postMessage({
        method: 'ShowWarning',
        params: err,
      });
    }
  });
}

function* watchUpdateDefaultBinPath(): Generator<any, any, any> {
  yield takeLatest(actions.GET_Default_BIN_PATH, function* (params: any) {
    try {
      const webviewMessage: Message = {
        method: params.operate.operationType,
      };
      vscode.postMessage(webviewMessage);
    } catch (err) {
      vscode.postMessage({
        method: 'ShowWarning',
        params: err,
      });
    }
  });
}

function* watchUpdateUsbBinPath(): Generator<any, any, any> {
  yield takeLatest(actions.GET_USB_BIN_PATH, function* (params: any) {
    try {
      const webviewMessage: Message = {
        method: params.operate.operationType,
      };
      vscode.postMessage(webviewMessage);
    } catch (err) {
      vscode.postMessage({
        method: 'ShowWarning',
        params: err,
      });
    }
  });
}

function* watchUpdateI2cHexPath(): Generator<any, any, any> {
  yield takeLatest(actions.GET_I2C_BIN_PATH, function* (params: any) {
    try {
      const webviewMessage: Message = {
        method: params.operate.operationType,
      };
      vscode.postMessage(webviewMessage);
    } catch (err) {
      vscode.postMessage({
        method: 'ShowWarning',
        params: err,
      });
    }
  });
}

/**
 * watch send project data saga
 */
function* watchSendProjectData(): Generator<any, any, any> {
  yield takeLatest(actions.SEND_PROJECT_DATA, function* (params: any) {
    try {
      const webviewMessage: Message = {
        method: params.operate.operationType,
        params: params.operate.projectData,
      };
      vscode.postMessage(webviewMessage);
    } catch (err) {
      vscode.postMessage({
        method: 'ShowWarning',
        params: err,
      });
    }
  });
}

/**
 * watch multicore value
 */
function* watchSetMultiCoreModeValue(): Generator<any, any, any> {
  yield takeLatest(actions.MULTI_MODE, function* (params: any) {
    try {
      const webviewMessage: Message = {
        method: ApiMethod.SET_MULTICORE_MODE_VALUE,
        params: { params },
      };
      vscode.postMessage(webviewMessage);
    } catch (err) {
      vscode.postMessage({
        method: 'ShowWarning',
        params: err,
      });
    }
  });
}

/**
 * watch save ini
 */
function* watchSaveIni(): Generator<any, any, any> {
  yield takeLatest(actions.SAVE_INI, function* (params: any) {
    try {
      const webviewMessage: Message = {
        method: params.data.operationType,
        params: params.data.data,
      };
      vscode.postMessage(webviewMessage);
    } catch (err) {
      vscode.postMessage({
        method: 'ShowWarning',
        params: err,
      });
    }
  });
}

function* watchWarnMsg(): Generator<any, any, any> {
  yield takeLatest(actions.SHOW_WARNING, function* (params: any) {
    try {
      const warnMessage: Message = {
        method: params.data.operationType,
        params: params.data.data,
      };
      vscode.postMessage(warnMessage);
    } catch (err) {
      vscode.postMessage({
        method: 'ShowWarning',
        params: err,
      });
    }
  });
}

/*
 * Description: watch handleFactory action
 */
function* watchHandleFactory(): Generator<any, any, any> {
  yield takeLatest(actions.HANDLE_FACTORY, function* (params: any) {
    try {
      const webviewMessage: Message = {
        method: ApiMethod.HANDLE_FACTORY,
        params: params.data,
      };
      vscode.postMessage(webviewMessage);
    } catch (err) {
      vscode.postMessage({
        method: 'ShowWarning',
        params: err,
      });
    }
  });
}

function* watchIsCustomIDE(): Generator<any, any, any> {
  yield takeLatest(actions.CHECK_CUSTOMIDE, function* () {
    try {
      const webviewMessage: Message = {
        method: ApiMethod.CHECK_CUSTOMIDE,
      };
      vscode.postMessage(webviewMessage);
    } catch (err) {
      // no impact, go on
    }
  });
}

export default [
  watchGetInfo,
  watchSendProjectData,
  watchSaveIni,
  watchWarnMsg,
  watchGetSerialPorts,
  watchUpdateDefaultBinPath,
  watchUpdateI2cHexPath,
  watchGetUsbValueList,
  watchUpdateUsbBinPath,
  watchHandleFactory,
  watchSetMultiCoreModeValue,
  watchIsCustomIDE,
];
