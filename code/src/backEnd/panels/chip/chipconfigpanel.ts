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

import type { Target, Panel } from '../panel';
import * as vscode from 'vscode';
import type { WebviewPanel } from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../../log4js';
import type { LanguageSetMessage, Message } from '../../interface/api';
import { Command } from '../../command';
import { ApiMethod } from '../../interface/apiMethod';

/**
 * chip config panel
 */
export default class ChipConfigPanel implements Panel {
  public panel: WebviewPanel | undefined;
  public context: vscode.ExtensionContext;
  public contextpath: string;
  public target: Target;
  public configPath: string;

  /**
   * @param {vscode.ExtensionContext} context
   * @param {Target} target target platform on which the extension is running.
   */
  constructor(context: vscode.ExtensionContext, target: Target) {
    this.target = target;
    this.context = context;
    this.panel = this.newPanel();
    this.configPath = path.join(context.globalStorageUri.fsPath, '../../../projectlist.json');
    this.contextpath = context.extensionPath;
  }

  /**
   * open the chip config panel
   */
  toggle(): void {
    if (!this.panel) {
      return;
    }
    this.panel.iconPath = vscode.Uri.file(path.join(this.context.extensionPath, 'resources', 'transceiverForLight.svg'));
    const dirPath = path.join(this.context.extensionPath, 'dist');
    let html = fs
      .readFileSync(path.join(this.context.extensionPath, 'dist', 'index.html'), 'utf-8')
      .replace(/(?<tag><link.+?href="|<script.+?src="|<img.+?src=")(?<path>.+?)"/g, (m, $1, $2) => {
        return `${$1 + this.panel?.webview.asWebviewUri(vscode.Uri.file(path.resolve(dirPath, $2)))}"`;
      })
      .toString();

    // Collect all injected scripts, then write webview.html exactly ONCE.
    // Multiple webview.html assignments each create a new webview session; the
    // onDidReceiveMessage handler stays bound to the first session's channel,
    // so messages from later sessions are silently dropped.
    let jsonData: any[] = [];
    try {
      const data = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
      jsonData = Array.isArray(data)
        ? data.filter((item: any) => item.chip === '3322' || item.chip === 'ws63' || item.chip === 'WS63' || item.chip === '1156e')
        : [];
    } catch (e) {
      logger.error(`Failed to load config: ${e}`);
    }

    const injected = [
      `<script>window.initialState = { target: "${this.target}" };</script>`,
      `<script>window.initialData = ${JSON.stringify(vscode.window.activeColorTheme)};</script>`,
      `<script>window.initialDemoData = ${JSON.stringify(jsonData)};</script>`,
    ].join('');

    this.panel.webview.html = html.replace('</body>', `${injected}</body>`);

    // set webview language environment
    const message: LanguageSetMessage = {
      method: ApiMethod.SET_LANGUAGE,
      params: {
        language: vscode.env.language,
      },
    };
    this.postMessage(message);

    this.panel.reveal(vscode.ViewColumn.One);
  }

  /**
   *  create a chip config panel
   * @return {WebviewPanel}
   */
  newPanel(): WebviewPanel {
    const panel = vscode.window.createWebviewPanel('HiSpark Studio AI', 'HiSpark Studio AI', vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true,
    });
    panel.onDidDispose(this.onPanelDisposed, this, this.context.subscriptions);
    panel.webview.onDidReceiveMessage(
      async (message) => {
        if (message.type === 'runCommand') {
          const { commandId } = message;
          await vscode.commands.executeCommand(commandId);
          return;
        }
        const method: string = message?.method ?? '(no method)';
        logger.info(`[ChipConfigPanel] recv: ${method}`);
        const func = Reflect.get(Command, method);
        if (typeof func !== 'function') {
          const err = `[ChipConfigPanel] No handler for "${method}"`;
          logger.error(err);
          vscode.window.showErrorMessage(err);
          return;
        }
        try {
          await Reflect.apply(func, Command, [message]);
        } catch (e) {
          const err = `[ChipConfigPanel] ${method} threw: ${e}`;
          logger.error(err);
          vscode.window.showErrorMessage(err);
        }
      },
      undefined,
      this.context.subscriptions
    );

    return panel;
  }

  /**
   * dispose the chip config panel
   */
  onPanelDisposed(): void {
    this.panel?.dispose();
    this.panel = undefined;
  }

  /**
   * send message to webview
   * @param {Message} message
   */
  postMessage(message: Message | string): void {
    this.panel?.webview.postMessage(message);
  }

  /**
   * send message to webview
   * @param {Target} target target to be sent, can either be 'NPU' or 'CPU'.
   */
  postInitTarget(target: Target): void {
    this.panel?.webview.postMessage({ type: 'init', target });
  }
}
