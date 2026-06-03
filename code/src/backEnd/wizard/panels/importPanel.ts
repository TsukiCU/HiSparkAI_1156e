/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
import * as vscode from 'vscode';
import * as path   from 'path';
import * as fs     from 'fs';
import type { WebviewPanel } from 'vscode';
import type { Message } from '../../interface/api';
import { WizardCommand } from '../command';
import { res }           from '../i18n/backEndTrans';
import { getResource }   from '../../resourceManage/resourceManager';
import { wizardHtml }    from '../../resourceManage/resourcePath';

export class ImportPanel {
  public panel: WebviewPanel | undefined;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.panel   = this.createPanel();
  }

  toggle(): void {
    if (!this.panel) { return; }
    const htmlPath = getResource.get(wizardHtml.index);
    const htmlDir  = path.dirname(htmlPath);
    this.panel.webview.html = fs
      .readFileSync(htmlPath, 'utf-8')
      .replace(
        /(?<prefix><link.+?href="|<script.+?src="|<img.+?src=")(?<src>.+?)"/g,
        (m, $1, $2) =>
          `${$1 + this.panel?.webview.asWebviewUri(vscode.Uri.file(path.resolve(htmlDir, $2)))}"`,
      )
      .replace('flagdefault', 'flagImport');
  }

  private createPanel(): WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
      'HisparkAIProjectImport',
      res('importProjectName'),
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true },
    );
    panel.onDidDispose(this.onPanelDisposed, this, this.context.subscriptions);
    panel.webview.onDidReceiveMessage(
      (message) => {
        const func = Reflect.get(WizardCommand, message.method);
        if (typeof func === 'function') {
          Reflect.apply(func, WizardCommand, [message.params]);
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
