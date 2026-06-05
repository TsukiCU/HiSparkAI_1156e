/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
type PanelLike = { postMessage(msg: any): void; onPanelDisposed(): void; toggle(): void; panel: any };

export class WizardContext {
  static globalStoragePath:     string | undefined;
  static extensionPath:         string | undefined;
  static mainProjectListPath:   string | undefined;
  static pendingOpenMarkerPath: string | undefined;

  // Transient connection state for 1156e projects — cleared after project creation.
  static pendingConnectionType: 'linux' | 'wsl' | undefined;
  static pendingWslDistro:      string | undefined;

  // Passed from getProjectData to showFromWizard to avoid unreliable path comparison.
  static pendingPlatform:   string | undefined;  // 'CPU' | 'NPU'
  static pendingHiprojPath: string | undefined;

  // Captured from remote-build.json after Linux 1156e connection (before project creation).
  // Field names match remote-build.json and .hiproj [information] section.
  static pendingRemoteBuildJsonContent: string | undefined;
  static pendingRemoteHost: string | undefined;  // servers.host in remote-build.json
  static pendingRemotePort: string | undefined;  // servers.port in remote-build.json

  static wizardPanel: PanelLike | undefined;
  static importPanel: PanelLike | undefined;

  static postToWizard(msg: any): void { WizardContext.wizardPanel?.postMessage(msg); }
  static postToImport(msg: any): void { WizardContext.importPanel?.postMessage(msg); }

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
