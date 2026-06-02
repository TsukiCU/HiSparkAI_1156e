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

import * as vscode from 'vscode';

export class OutputChannelManager {
  private static channels = new Map<string, vscode.LogOutputChannel>();

  static get(name: string): vscode.LogOutputChannel {
    let ch = this.channels.get(name);
    if (!ch) {
      ch = vscode.window.createOutputChannel(name, { log: true });
      this.channels.set(name, ch);
    }
    return ch;
  }

  static show(name: string, preserveFocus = true): void {
    this.get(name).show(preserveFocus);
  }

  static clear(name: string): void {
    this.channels.get(name)?.clear();
  }

  static disposeAll(): void {
    for (const ch of this.channels.values()) {
      ch.dispose();
    }
    this.channels.clear();
  }
}
