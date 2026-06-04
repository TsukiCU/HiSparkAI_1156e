/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 *
 * WizardContext — decouples the wizard from code's Extension class.
 * extension.ts populates these fields during activation and creates panels
 * on demand. wizard/command.ts reads them without depending on Extension directly.
 */
type PanelLike = { postMessage(msg: any): void; onPanelDisposed(): void; toggle(): void; panel: any };

export class WizardContext {
  static globalStoragePath: string | undefined;
  static extensionPath:     string | undefined;

  // Path to projectlist.json — set in extension.ts using the SAME calculation as
  // ChipConfigPanel.configPath so both always point to the same file.
  static mainProjectListPath: string | undefined;

  // Path to the "wizard opened this folder" marker file.
  // When present at activation time, HisparkAI.show is called and the file is deleted.
  static pendingOpenMarkerPath: string | undefined;

  static wizardPanel: PanelLike | undefined;
  static importPanel: PanelLike | undefined;

  static postToWizard(msg: any): void {
    WizardContext.wizardPanel?.postMessage(msg);
  }

  static postToImport(msg: any): void {
    WizardContext.importPanel?.postMessage(msg);
  }

  static deactivate(type: 'wizard' | 'import'): void {
    if (type === 'wizard') {
      WizardContext.wizardPanel?.onPanelDisposed();
      WizardContext.wizardPanel = undefined;
    } else {
      WizardContext.importPanel?.onPanelDisposed();
      WizardContext.importPanel = undefined;
    }
  }
}
