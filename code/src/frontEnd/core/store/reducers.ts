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

import * as ActionTypes from './actions';
import { combineReducers } from 'redux';

/**
 * copyWithoutMatchingKeys
 *
 * @param {any} obj original object
 * @param {any} re target key
 * @return {any} object without {re} key-value
 */
export function copyWithoutMatchingKeys(obj: any, re: any): any {
  const newObj = Object.assign({}, obj);
  Object.keys(newObj).forEach((key) => {
    if (re.test(key)) {
      delete newObj[key];
    }
  });
  return newObj;
}

/**
 * deal with some data for temporary storage
 * @param {{}} state pre-state
 * @param {any} action action to dispatch
 * @return {{}}  next state
 */
function entities(state: any, action: any): any {
  let entitiesState = state;
  if (!entitiesState) {
    entitiesState = {};
  }
  switch (action.type) {
    case ActionTypes.UPDATE_ENTITY:
      return Object.assign({}, entitiesState, {
        [action.key]: action.data,
      });

    case ActionTypes.DELETE_ENTITY:
      return copyWithoutMatchingKeys(entitiesState, action.re);
    // no default
  }
  return entitiesState;
}

/**
 * storage
 * @param {{}}state pre state
 * @param {any} action action to dispatch
 * @return {{}} next state
 */
function storage(state: any, action: any): any {
  let storageState = state;
  if (!storageState) {
    storageState = {};
  }
  switch (action.type) {
    case ActionTypes.UPDATE_STORAGE_ITEM:
      return Object.assign({}, storageState, {
        [action.key]: action.data,
      });

    case ActionTypes.DELETE_STORAGE_ITEM:
      return copyWithoutMatchingKeys(storageState, action.re);
    // no default
  }
  return storageState;
}

const appReducer = combineReducers({
  storage,
  entities,
});

/**
 * root reducer
 * @param {any} state state
 * @param {any} action action
 * @return {{}} next state
 */
function rootReducer(state: any, action: any): object {
  switch (action.type) {
    case ActionTypes.UPDATE_STORE:
      return Object.assign({}, appReducer(state, action), action.newState);

    case ActionTypes.RESET_STORE:
      return {};
    // no default
  }
  return appReducer(state, action);
}

export default rootReducer;
