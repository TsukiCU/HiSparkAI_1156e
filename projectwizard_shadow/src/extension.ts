/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
import * as vscode from 'vscode';
import * as path   from 'path';
import type { ColorTheme } from 'vscode';

import ChipConfigPanel    from './backEnd/panels/chipConfigPanel';
import ProjectImportPanel from './backEnd/panels/projectImportPanel';
import type { ThemeChangeMessage } from './backEnd/interface/api';
import { ApiMethod } from './backEnd/interface/apiMethod';
import { getResource }   from './backEnd/resourceManage/resourceManager';

// ─── Extension singleton ──────────────────────────────────────────────────────

class Extension {
  public chipConfigPanel:    ChipConfigPanel    | undefined;
  public projectImportPanel: ProjectImportPanel | undefined;
  public globalStoragePath:  string | undefined;
  public extensionPath:      string | undefined;

  // ── activate ───────────────────────────────────────────────────────────────
  public async activate(context: vscode.ExtensionContext): Promise<void> {
    this.extensionPath     = context.extensionPath;
    this.globalStoragePath = context.globalStorageUri.fsPath;

    getResource.setConfig(context.extensionPath);

    const commands = [

      // ── New Project wizard ──────────────────────────────────────────────
      vscode.commands.registerCommand('showProjectWizard', () => {
        if (!this.chipConfigPanel?.panel) {
          this.chipConfigPanel = new ChipConfigPanel(context);
        }
        this.chipConfigPanel.toggle();
        this.chipConfigPanel.panel?.reveal();
      }),

      // ── Import existing project ─────────────────────────────────────────
      vscode.commands.registerCommand('showProjectImport', () => {
        if (!this.projectImportPanel?.panel) {
          this.projectImportPanel = new ProjectImportPanel(context);
        }
        this.projectImportPanel.toggle();
        this.projectImportPanel.panel?.reveal();
      }),

      // ── Open project by .hiproj path ────────────────────────────────────
      vscode.commands.registerCommand(
        'openProject',
        async (hiprojPath: string) => {
          if (!hiprojPath) { return; }
          const projectDir = path.dirname(hiprojPath);
          await vscode.commands.executeCommand(
            'vscode.openFolder',
            vscode.Uri.file(projectDir),
          );
        },
      ),

      // ── Delete project from list ────────────────────────────────────────
      vscode.commands.registerCommand(
        'deleteProject',
        (hiprojPath: string) => {
          const { Command } = require('./backEnd/command');
          Command.deleteProject({ paramData: { projectPath: hiprojPath } });
        },
      ),

    ];

    context.subscriptions.push(...commands);

    // theme change
    vscode.window.onDidChangeActiveColorTheme(this.onThemeChange.bind(this));
  }

  // ── theme propagation ──────────────────────────────────────────────────────
  onThemeChange(colorTheme: ColorTheme): void {
    const themeMap: Record<number, string> = { 1: 'light', 2: 'dark', 3: 'dark', 4: 'light' };
    const msg: ThemeChangeMessage = {
      method: ApiMethod.CHANGE_THEME,
      params: { theme: themeMap[colorTheme.kind] ?? 'dark' },
    };
    this.chipConfigPanel?.postMessage(msg);
    this.projectImportPanel?.postMessage(msg);
  }

  // ── deactivate ─────────────────────────────────────────────────────────────
  public deactivate(type: 'chipConfig' | 'projectImport'): void {
    if (type === 'chipConfig') {
      this.chipConfigPanel?.onPanelDisposed();
      this.chipConfigPanel = undefined;
    } else {
      this.projectImportPanel?.onPanelDisposed();
      this.projectImportPanel = undefined;
    }
  }
}

export const extension = new Extension();

export const activate   = (context: vscode.ExtensionContext): void => {
  extension.activate(context).then();
};
export const deactivate = (): void => {
  extension.deactivate('chipConfig');
  extension.deactivate('projectImport');
};
