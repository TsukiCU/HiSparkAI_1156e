/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
import * as ActionTypes from './actions';
import { combineReducers } from 'redux';

function copyWithoutMatchingKeys(obj: any, re: any): any {
  const newObj = Object.assign({}, obj);
  Object.keys(newObj).forEach((key) => { if (re.test(key)) { delete newObj[key]; } });
  return newObj;
}

function entities(state: any = {}, action: any = {}): any {
  switch (action.type) {
    case ActionTypes.UPDATE_ENTITY:
      return Object.assign({}, state, { [action.key]: action.data });
    case ActionTypes.DELETE_ENTITY:
      return copyWithoutMatchingKeys(state, action.re);
  }
  return state;
}

const appReducer = combineReducers({ entities });

export default function rootReducer(state: any, action: any): any {
  if (action.type === ActionTypes.RESET_STORE) { return {}; }
  return appReducer(state, action);
}
