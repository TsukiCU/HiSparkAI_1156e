/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
type PanelLike = { postMessage(msg: any): void; onPanelDisposed(): void; toggle(): void; panel: any };

export class ProjectMgrContext {
  static globalStoragePath:     string | undefined;
  static extensionPath:         string | undefined;
  static mainProjectListPath:   string | undefined;
  static pendingOpenMarkerPath: string | undefined;

  // Transient connection state for 1156e projects — cleared after project creation.
  static pendingConnectionType: 'linux' | 'wsl' | undefined;
  static pendingWslDistro:      string | undefined;

  // Passed from getProjectData to showFromProjectMgr to avoid unreliable path comparison.
  static pendingPlatform:   string | undefined;  // 'CPU' | 'NPU'
  static pendingHiprojPath: string | undefined;

  // Captured from remote-build.json after Linux 1156e connection (before project creation).
  static pendingRemoteBuildJsonContent: string | undefined;
  static pendingRemoteHost: string | undefined;
  static pendingRemotePort: string | undefined;

  // 'projectMgr' = New Project panel; 'import' = Import Project panel
  static projectMgrPanel: PanelLike | undefined;
  static importPanel:     PanelLike | undefined;

  static postToWizard(msg: any): void  { ProjectMgrContext.projectMgrPanel?.postMessage(msg); }
  static postToImport(msg: any): void  { ProjectMgrContext.importPanel?.postMessage(msg); }

  static deactivate(type: 'projectMgr' | 'import'): void {
    if (type === 'projectMgr') {
      ProjectMgrContext.projectMgrPanel?.onPanelDisposed();
      ProjectMgrContext.projectMgrPanel = undefined;
    } else {
      ProjectMgrContext.importPanel?.onPanelDisposed();
      ProjectMgrContext.importPanel = undefined;
    }
  }
}
