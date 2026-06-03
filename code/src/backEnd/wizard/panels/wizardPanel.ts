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

export class WizardPanel {
  public panel: WebviewPanel | undefined;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.panel   = this.createPanel();
  }

  toggle(): void {
    if (!this.panel) { return; }
    // Use context.extensionPath directly — same pattern as code's ChipConfigPanel.
    // getResource.setConfig is never called in code's extension.ts, so we cannot
    // rely on the getResource singleton here.
    const distDir  = path.join(this.context.extensionPath, 'dist');
    const htmlPath = path.join(distDir, 'wizard.html');
    this.panel.webview.html = fs
      .readFileSync(htmlPath, 'utf-8')
      .replace(
        /(?<prefix><link.+?href="|<script.+?src="|<img.+?src=")(?<src>.+?)"/g,
        (m, $1, $2) =>
          `${$1 + this.panel?.webview.asWebviewUri(vscode.Uri.file(path.resolve(distDir, $2)))}"`,
      )
      .replace('flagdefault', 'flagCreate');
  }

  private createPanel(): WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
      'HisparkAIProjectWizard',
      res('newProjectName'),
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
