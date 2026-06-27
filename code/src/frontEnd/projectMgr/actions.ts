/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
import type { OperateStruct } from '../../backEnd/projectMgr/interface/model';
import { createAction } from './core/store/actions';
import type { Action } from 'redux';

export const GET_INFO = 'GET_INFO';
export const SEND_PROJECT_DATA = 'SEND_PROJECT_DATA';

export const getInfo = (operate: OperateStruct): Action => createAction(GET_INFO, { operate });
export const sendProjectData = (operate: any): Action => createAction(SEND_PROJECT_DATA, { operate });
