/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
import type { WebviewPanel } from 'vscode';
import type { Message } from '../interface/api';

export interface Panel {
  panel: WebviewPanel | undefined;
  toggle(): void;
  onPanelDisposed(): void;
  postMessage(message: Message): void;
}
