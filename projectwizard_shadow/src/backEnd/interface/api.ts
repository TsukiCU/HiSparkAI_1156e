/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
import { ApiMethod } from './apiMethod';

export interface Message {
  method: string;
  params?: any;
}

export interface GetInfoCallBack {
  method: ApiMethod.GET_INFO_CALLBAK;
  params: {
    key: string;
    data: any;
  };
}

export interface LanguageSetMessage {
  method: ApiMethod.SET_LANGUAGE;
  params: { language: string };
}

export interface ThemeChangeMessage {
  method: ApiMethod.CHANGE_THEME;
  params: { theme: string };
}
