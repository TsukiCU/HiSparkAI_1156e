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
import type { Target } from '../panels/panel';
import type {
  DemoData,
  Log4jsData,
  ImportFrontEndConfigData,
  GetMockLocalStorageData,
  SetMockLocalStorageData,
  TargetPlatform,
  HistoryInfo,
  UserGuideInfo,
  Release,
} from '@src/backEnd/interface/model';

export interface Message {
  type?: string;
  method?: ApiMethod;
  params?: {
    [key: string]: any;
  };
}

export interface ThemeChangeMessage extends Message {
  params: {
    theme: string;
  };
}

export interface GetHistoryCallbackMessage extends Message {
  params: {
    data: Array<HistoryInfo>;
    totalData: number;
  };
}

export interface GetResultHistoryCallbackMessage extends Message {
  params: {
    data: Array<HistoryInfo>;
  };
}

export interface LanguageSetMessage extends Message {
  params: {
    language: string;
  };
}

export interface DemoCallbackMessage extends Message {
  params: {
    data: Array<DemoData>;
  };
}

export interface Log4jsMessage extends Message {
  params: {
    log4jsData: Log4jsData;
  };
}

export interface CommandMsg extends Message {
  params: {
    targetPlatform: TargetPlatform;
    paramType?: string;
    paramData?: any;
  };
}

export interface FileNameMsg extends Message {
  params: {
    filePath: string;
  };
}

export interface FrontEndConfigMessage extends Message {
  params: {
    data: any | any[];
  };
}

export interface ConfigMessage extends Message {
  params: {
    config: Array<{ key: string; value: any }>;
  };
}

export interface ImportFrontEndConfigMessage extends Message {
  params: {
    data: ImportFrontEndConfigData;
  };
}

export interface SetMockLocalStorageMessage extends Message {
  params: {
    data: SetMockLocalStorageData;
  };
}

export interface SetMockLocalStorageCallbackMessage extends Message {
  params: {
    data: boolean;
  };
}

export interface GetMockLocalStorageMessage extends Message {
  params: {
    data: GetMockLocalStorageData;
  };
}

export interface GetMockLocalStorageCallbackMessage extends Message {
  params: {
    data: any;
  };
}

export interface UserGuideWebsiteCallbackMessage extends Message {
  params: {
    data: UserGuideInfo;
  };
}

export interface ReleaseCallbackMessage extends Message {
  params: {
    data: Array<Release>;
  };
}

export interface PortInfo {
  path: string;
  type: 'native' | 'usb' | 'unknown';
  label: string;
  vendorId?: string;
  productId?: string;
  manufacturer?: string;
};