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
import type { OperateStruct, ProjectConfigStruct, SaveIniStruct, WarningMsg, HandleFactoryStruct, MultiModeStruct } from '../backEnd/interface/model';
import { createAction } from './core/store/actions';
import type { Action } from 'redux';

export const GET_INFO = 'GET_INFO';
export const SEND_PROJECT_DATA = 'SEND_PROJECT_DATA';
export const CHECK_CUSTOMIDE = 'CHECK_CUSTOMIDE';
export const SAVE_INI = 'SAVE_INI';
export const MULTI_MODE = 'MULTI_MODE';
export const SHOW_WARNING = 'SHOW_WARNING';
export const GET_SERIAL_PORTS = 'GET_SERIAL_PORTS';
export const HANDLE_FACTORY = 'HANDLE_FACTORY';
export const GET_USB_VALUE_LIST = 'GET_USB_VALUE_LIST';
export const GET_USB_BIN_PATH = 'GET_USB_BIN_PATH';
export const GET_Default_BIN_PATH = 'GET_DEFAULT_BIN_PATH';
export const GET_I2C_BIN_PATH = 'GET_I2C_BIN_PATH';

export const getInfo = (operate: OperateStruct): Action => createAction(GET_INFO, { operate });
export const sendProjectData = (operate: ProjectConfigStruct): Action => createAction(SEND_PROJECT_DATA, { operate });

export const save2Ini = (data: SaveIniStruct): Action => createAction(SAVE_INI, { data });
export const setMultiCoreModeValue = (data: MultiModeStruct): Action => createAction(MULTI_MODE, { data });
export const showWarnMsg = (data: WarningMsg): Action => createAction(SHOW_WARNING, { data });
export const getSerialPorts = (operate: OperateStruct): Action => createAction(GET_SERIAL_PORTS, { operate });
export const getUsbValueList = (operate: OperateStruct): Action => createAction(GET_USB_VALUE_LIST, { operate });
export const handleFactory = (data: HandleFactoryStruct): Action => createAction(HANDLE_FACTORY, { data });
export const getUsbBinPath = (operate: OperateStruct): Action => createAction(GET_USB_BIN_PATH, { operate });
export const getDefaultBinPath = (operate: OperateStruct): Action => createAction(GET_Default_BIN_PATH, { operate });
export const getI2cBinPath = (operate: OperateStruct): Action => createAction(GET_I2C_BIN_PATH, { operate });
export const checkCustomIDE = (): Action => createAction(CHECK_CUSTOMIDE);