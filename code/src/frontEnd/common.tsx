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

import React from 'react';
import { message } from 'antd';

type NotifyType = 'info' | 'success' | 'warning' | 'error' | 'loading';

export function notify(
  text: string,
  opts?: {
    type?: NotifyType;
    duration?: number; // lifespan(seconds). 0: persistant.
    stack?: boolean; /// if message with the same content will stack. false: will replace.
  }
): void {
  const { type = 'info', duration = 3, stack = true } = opts ?? {};

  // if stack is disabled, use a stable key so same message replaces instead of stacking
  const key = stack ? undefined : `notify:${type}:${text}`;

  message.open({
    type,
    content: text,
    duration,
    key,
  });
}
