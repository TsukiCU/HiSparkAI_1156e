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
import type { Panel } from './panel';
import * as vscode from 'vscode';
import type { WebviewPanel } from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import type { Message } from '../interface/api';
import { Command } from '../command';
import { res } from '../../i18n/backEndTrans';
import { getResource } from '../resourceManage/resourceManager';
import { icon, html } from '../resourceManage/resourcePath';

/**
 * target mange panel
 */
export default class TargetManagePanel implements Panel {
  public panel: WebviewPanel | undefined;
  public context: vscode.ExtensionContext;
  public contextpath: string;

  /**
   *
   * @param {vscode.ExtensionContext} context
   */
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.contextpath = context.extensionPath;
    this.panel = this.newPanel();
  }

  /**
   * open the target mange panel
   */
  toggle(): void {
    if (!this.panel) {
      return;
    }
    this.panel.iconPath = {
      light: vscode.Uri.file(getResource.get(icon.newProjectLight)),
      dark: vscode.Uri.file(getResource.get(icon.newProjectDark)),
    };
    // 获取index.html的路径
    const htmlPath = getResource.get(html.index);
    const htmlDir = path.dirname(htmlPath);

    this.panel.webview.html = fs
      .readFileSync(htmlPath, 'utf-8')
      .replace(/(?<link><link.+?href="|<script.+?src="|<img.+?src=")(?<dot>.+?)"/g, (m, $1, $2) => {
        return `${$1 + this.panel?.webview.asWebviewUri(vscode.Uri.file(path.resolve(htmlDir, $2)))}"`;
      }).replace('flagdefault', 'flagTarget')
      .toString();
  }

  /**
   *  create a target mange panel
   * @return {WebviewPanel}
   */
  newPanel(): WebviewPanel {
    const panel = vscode.window.createWebviewPanel('Target Manage', res('targetManage'), vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true,
    });
    panel.onDidDispose(this.onPanelDisposed, this, this.context.subscriptions);
    panel.webview.onDidReceiveMessage(
      (message) => {
        const func = Reflect.get(Command, message.method);
        Reflect.apply(func, Command, [message.params]);
      },
      undefined,
      this.context.subscriptions
    );
    return panel;
  }

  /**
   * dispose the target mange panel
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
