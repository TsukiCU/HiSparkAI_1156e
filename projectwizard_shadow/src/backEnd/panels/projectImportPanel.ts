/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
import type { Panel } from './panel';
import * as vscode from 'vscode';
import type { WebviewPanel } from 'vscode';
import * as path   from 'path';
import * as fs     from 'fs';
import type { Message } from '../interface/api';
import { Command }      from '../command';
import { res }          from '../../i18n/backEndTrans';
import { getResource }  from '../resourceManage/resourceManager';
import { html }         from '../resourceManage/resourcePath';

export default class ProjectImportPanel implements Panel {
  public panel: WebviewPanel | undefined;
  public context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.panel   = this.newPanel();
  }

  toggle(): void {
    if (!this.panel) { return; }
    const htmlPath = getResource.get(html.index);
    const htmlDir  = path.dirname(htmlPath);
    this.panel.webview.html = fs
      .readFileSync(htmlPath, 'utf-8')
      .replace(
        /(?<link><link.+?href="|<script.+?src="|<img.+?src=")(?<dot>.+?)"/g,
        (m, $1, $2) =>
          `${$1 + this.panel?.webview.asWebviewUri(vscode.Uri.file(path.resolve(htmlDir, $2)))}"`,
      )
      .replace('flagdefault', 'flagImport');
  }

  newPanel(): WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
      'ShadowProjectImport',
      res('importProjectName'),
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true },
    );
    panel.onDidDispose(this.onPanelDisposed, this, this.context.subscriptions);
    panel.webview.onDidReceiveMessage(
      (message) => {
        const func = Reflect.get(Command, message.method);
        if (typeof func === 'function') {
          Reflect.apply(func, Command, [message.params]);
        }
      },
      undefined,
      this.context.subscriptions,
    );
    return panel;
  }

  onPanelDisposed(): void {
    this.panel?.dispose();
    this.panel = undefined;
  }

  postMessage(message: Message): void {
    this.panel?.webview.postMessage(message);
  }
}
