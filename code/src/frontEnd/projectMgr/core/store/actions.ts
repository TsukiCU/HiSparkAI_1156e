/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
import type { Action } from 'redux';

export function createAction(type: string, payload: any = {}): Action {
  return { type, ...payload };
}

export const UPDATE_ENTITY = 'UPDATE_ENTITY';
export const DELETE_ENTITY = 'DELETE_ENTITY';
export const RESET_STORE = 'RESET_STORE';

export const updateEntity = (key: string, data: any): Action =>
  createAction(UPDATE_ENTITY, { key, data });
export const deleteEntity = (re: RegExp | string): Action =>
  createAction(DELETE_ENTITY, { re });
