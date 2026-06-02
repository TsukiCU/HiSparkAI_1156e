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

import type { Panel } from '../panel';
import * as vscode from 'vscode';
import type { WebviewPanel } from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import type { Message } from '../../interface/api';
import { res } from '../../../i18n/backEndTrans';
import { extension } from '../../../extension';
import { Command } from '@src/backEnd/command';

/**
 * chip config panel
 */
export default class ReleaseNotePanel implements Panel {
  public panel: WebviewPanel | undefined;
  public context: vscode.ExtensionContext;
  public contextpath: string;
  public version: string;

  /**
   * GUIPanel constructor
   * @param {vscode.ExtensionContext} context
   * @param {string} version
   * @param {string} projectName
   */
  constructor(context: vscode.ExtensionContext, version: string) {
    this.context = context;
    this.contextpath = context.extensionPath;
    this.version = version;
    this.panel = this.newPanel();
  }

  /**
   * open the GUI panel
   */
  toggle(): void {
    if (!this.panel) {
      return;
    }

    this.panel.iconPath = vscode.Uri.file(path.join(this.contextpath, 'resources', 'home.svg'));
    const dirPath = path.join(this.context.extensionPath, 'dist/resources/welcome');
    this.panel.webview.html = fs
      .readFileSync(path.join(dirPath, `releasenote-${this.version}.html`), 'utf-8')
      .replace(/(?<tag><link.+?href="|<script.+?src="|<img.+?src=")(?<path>.+?)"/g, (m, $1, $2) => {
        return `${$1 + this.panel?.webview.asWebviewUri(vscode.Uri.file(path.resolve(dirPath, $2)))}"`;
      })
      .toString();
  }

  /**
   *  create a GUI panel
   * @return {WebviewPanel}
   */
  newPanel(): WebviewPanel {
    const panel = vscode.window.createWebviewPanel('Release', `${res('releaseNotes')} - ${this.version}`, vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true,
    });
    panel.onDidDispose(this.onPanelDisposed, this, this.context.subscriptions);
    panel.webview.onDidReceiveMessage(
      (message) => {
        const method = message?.method;
        if (typeof method === 'string' && method in Command) {
          const func = Reflect.get(Command, message.method);
          Reflect.apply(func, Command, [message]);
        }
      },
      undefined,
      this.context.subscriptions
    );
    return panel;
  }

  /**
   * dispose the GUI panel
   */
  onPanelDisposed(): void {
    this.panel?.dispose();
    this.panel = undefined;
  }

  /**
   * send message to webview
   * @param {Message} message
   */
  postMessage(message: Message): void {
    this.panel?.webview.postMessage(message);
  }
}
