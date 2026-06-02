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
import type { ApiMethod } from './apiMethod';

export interface Message {
  method: ApiMethod;
  params?: {
    [key: string]: string | number | boolean | object;
  };
}

export interface ThemeChangeMessage extends Message {
  params: {
    theme: string;
  };
}

export interface LanguageSetMessage extends Message {
  params: {
    language: string;
  };
}

export interface GetInfoCallBack extends Message {
  params: {
    data: any;
    key: string;
  };
}

export interface CustomIDESetMessage extends Message {
  params: {
    isCustomIDE: boolean;
  };
}
