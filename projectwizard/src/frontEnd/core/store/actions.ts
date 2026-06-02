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
import type { Action } from 'redux';

/**
 * create a redux type action
 * @param {string} type behavior Type
 * @param {any} payload The input of the behavior
 * @return {Action} action
 */
export function createAction(type: string, payload: any = {}): Action {
  return { type, ...payload };
}

export const UPDATE_ENTITY: string = 'UPDATE_ENTITY';
export const DELETE_ENTITY: string = 'DELETE_ENTITY';

export const UPDATE_STORAGE_ITEM = 'UPDATE_STORAGE_ITEM';
export const DELETE_STORAGE_ITEM = 'DELETE_STORAGE_ITEM';

export const UPDATE_STORE = 'UPDATE_STORE';
export const RESET_STORE = 'RESET_STORE';

export const updateEntity = (key: string, data: any): Action => createAction(UPDATE_ENTITY, { key, data });
export const deleteEntity = (re: RegExp | string): Action => createAction(DELETE_ENTITY, { re });
