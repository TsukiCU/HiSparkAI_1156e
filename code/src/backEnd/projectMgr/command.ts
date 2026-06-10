/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 *
 * All backend commands for the Project Wizard (New Project + Import Project).
 * Kept in a separate file so code/src/backEnd/command.ts does not grow further.
 */
import * as fs    from 'fs';
import * as path  from 'path';
import * as vscode from 'vscode';
import * as ini   from 'ini';
import * as cp    from 'child_process';

import { ProjectMgrContext }   from './context';
import { GlobalModel }         from '../storage/Global';
import { res }             from './i18n/backEndTrans';
import { WizardApiMethod, type GetInfoCallBack, type LanguageSetMessage } from './interface/api';
import type { OperateStruct, ProjectMgrData } from './interface/model';
import {
  addItemsToProList,
  updateOneItemToLatestList,
  deleteFromProjectList,
  getProjectList,
  getLatestList,
  getHiprojContent,
  findHiprojFiles,
  showMessageModal,
  getUserDir,
  upsertProjectDataJson,
  removeProjectDataJson,
  upsertMainProjectList,
  removeFromMainProjectList,
} from './utils';

// ─── helpers ─────────────────────────────────────────────────────────────────

function callback(key: string, data: any, target: 'projectMgr' | 'import' = 'projectMgr'): void {
  const msg: GetInfoCallBack = {
    method: WizardApiMethod.GET_INFO_CALLBAK,
    params: { key, data },
  };
  if (target === 'import') {
    ProjectMgrContext.postToImport(msg);
  } else {
    ProjectMgrContext.postToWizard(msg);
  }
}

// ─── SDK path validation ──────────────────────────────────────────────────────

/**
 * Validate that sdkPath is a correct SDK for the given chip.
 *
 * Rules (strict, chip-specific):
 *   ws63  → build/config/target_config/ws63/ws63.json must exist
 *   3322  → build/config/target_config/3322/3322.json must exist
 *   other → no validation (always valid)
 *
 * This mirrors detectTargetFromWorkspace() in extension.ts so the SDK the
 * wizard accepts is guaranteed to be recognised by the main plugin.
 */
function validateSdkForChip(soc: string, sdkPath: string): boolean {
  if (!sdkPath || !fs.existsSync(sdkPath)) { return false; }
  if (soc === 'ws63' || soc === '3322') {
    const jsonPath = path.join(sdkPath, 'build', 'config', 'target_config', soc, `${soc}.json`);
    return fs.existsSync(jsonPath);
  }
  return true;
}

// ─── Minimal .hiproj writer ───────────────────────────────────────────────────

function writeHiproj(
  projectData: ProjectMgrData,
  hiprojDir: string,
  sdkDir: string,
  opts?: { host?: string; port?: string },
): void {
  const hiprojPath = path.join(hiprojDir, `${projectData.projectName}.hiproj`);
  // For Linux 1156e the SDK lives on a remote server; store hiprojDir as sdk_path so
  // that openProject (main command.ts) opens the correct local workspace. The actual
  // remote path is kept in remote_sdk_path for reference.
  const isLinux = projectData.connectionType === 'linux';
  const content = {
    information: {
      'board_build.mcu':  projectData.soc,
      board:              projectData.board,
      platform:           projectData.platform,
      project_name:       projectData.projectName,
      project_path:       hiprojDir,
      sdk_path:           isLinux ? hiprojDir : sdkDir,
      remote_sdk_path:    isLinux ? sdkDir : '',
      series_name:        'projectMgr',
      project_type:       'PROJECT_MGR',
      connection_type:    projectData.connectionType ?? '',
      wsl_distro:         projectData.wslDistro ?? '',
      // host/port match remote-build.json servers.host / servers.port (Linux 1156e only).
      host:               opts?.host ?? '',
      port:               opts?.port ?? '',
    },
    compile: {
      bin_path:    '',
      protocol:    'serial',
      port:        '',
      baud:        '115200',
      localip:     '',
      ipaddr:      '',
      subnetmask:  '',
      gateway:     '',
      eraseconfig: '',
      pid:         '',
      vid:         '',
    },
    debug:   {},
  };
  fs.writeFileSync(hiprojPath, ini.stringify(content), 'utf-8');
}

// ─── Command class ────────────────────────────────────────────────────────────

export class ProjectMgrCommand {

  static closeProgress(): void { /* no-op */ }

  // ── Language / theme ───────────────────────────────────────────────────────

  static getLanguage(operate: OperateStruct): void {
    const msg: LanguageSetMessage = {
      method: WizardApiMethod.SET_LANGUAGE,
      params: { language: vscode.env.language },
    };
    if (operate.source === 'import') {
      ProjectMgrContext.postToImport(msg);
    } else {
      ProjectMgrContext.postToWizard(msg);
    }
  }

  // ── Chip list ──────────────────────────────────────────────────────────────

  static getJsonInfo(operate: OperateStruct): void {
    const { fileName } = operate.paramData ?? {};
    if (fileName === 'chiplist.json') {
      const chiplistPath = path.join(ProjectMgrContext.extensionPath!, 'resources', 'chips', 'chiplist.json');
      try {
        const data = JSON.parse(fs.readFileSync(chiplistPath, 'utf-8'));
        callback('chipList', data, operate.source === 'import' ? 'import' : 'projectMgr');
      } catch {
        callback('chipList', [], operate.source === 'import' ? 'import' : 'projectMgr');
      }
    }
  }

  // ── User config ────────────────────────────────────────────────────────────

  static getUserConfig(_operate: OperateStruct): void {
    // Return empty string — the wizard pre-fills no path so the user always
    // makes an explicit choice. Within a session the folder dialog remembers
    // the last directory via the currentValue parameter in selectFolderPath.
    callback('userConfig', { projectCreate_last_projectPath: '' });
  }

  // ── Project / SDK path dialog ──────────────────────────────────────────────

  static selectFolderPath(operate: OperateStruct): void {
    const { key, currentValue, soc } = operate.paramData ?? {};

    // 1156e SDK lives on a remote (Linux or WSL); use a specialised picker.
    if (soc === '1156e' && key === 'sdkPathInfo') {
      ProjectMgrCommand.selectSdkPathFor1156e(key);
      return;
    }

    const defaultUri = currentValue && fs.existsSync(currentValue)
      ? vscode.Uri.file(currentValue)
      : vscode.Uri.file(getUserDir());

    vscode.window.showOpenDialog({
      canSelectFiles:   false,
      canSelectFolders: true,
      canSelectMany:    false,
      defaultUri,
      title: res('selectFolderTitle'),
    }).then((result) => {
      if (result?.[0]?.fsPath) {
        callback(key, result[0].fsPath);
      }
    });
  }

  // ── 1156e SDK picker (Linux remote or WSL) ────────────────────────────────

  static async selectSdkPathFor1156e(key: string): Promise<void> {
    const OPT_LINUX = 'Connect using Linux';
    const OPT_WSL   = 'Connect using WSL';

    const selection = await vscode.window.showQuickPick([OPT_LINUX, OPT_WSL], {
      title:       'Select connection method for 1156E SDK',
      placeHolder: 'Choose how the 1156E SDK is accessed...',
    });
    if (!selection) { return; }

    if (selection === OPT_LINUX) {
      // Connect to the remote Linux server first.
      const availableCmds = await vscode.commands.getCommands(true);
      if (!availableCmds.includes('remoteBuild.connectFresh')) {
        vscode.window.showWarningMessage('remoteBuild extension is not available. Please install HiSpark Studio.');
        return;
      }
      // Use connectFresh (not connectLite) so the user always enters credentials
      // fresh when creating a new project, regardless of any cached remote-build.json.
      const connected = await vscode.commands.executeCommand('remoteBuild.connectFresh');
      if (!connected) {
        vscode.window.showWarningMessage('Failed to connect to remote server.');
        return;
      }
      // Browse a directory on the remote server.
      const remotePath = await vscode.commands.executeCommand<string | undefined>(
        'remoteBuild.api.browseRemoteDirectory',
      );
      if (!remotePath) { return; }
      ProjectMgrContext.pendingConnectionType = 'linux';
      ProjectMgrContext.pendingWslDistro      = undefined;

      // Capture the remote-build.json written by remoteBuild into the current workspace.
      // We copy it into the hiproj folder after project creation so it's available there.
      const currentWs = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath ?? '';
      const rbPath = path.join(currentWs, '.vscode', 'remote-build.json');
      if (fs.existsSync(rbPath)) {
        try {
          const rbContent = fs.readFileSync(rbPath, 'utf-8');
          ProjectMgrContext.pendingRemoteBuildJsonContent = rbContent;
          const rbParsed = JSON.parse(rbContent);
          // remote-build.json format: { "servers": [{ "host": "...", "port": 22, ... }] }
          // servers is an array; take the first entry.
          const server = Array.isArray(rbParsed?.servers) ? rbParsed.servers[0] : rbParsed?.servers;
          ProjectMgrContext.pendingRemoteHost = String(server?.host ?? '');
          ProjectMgrContext.pendingRemotePort = String(server?.port ?? '22');
        } catch { /* ignore parse errors */ }
      }

      callback(key, remotePath);

    } else {
      // WSL: let user choose a distribution, then pick a local folder.
      const distros = await ProjectMgrCommand.getWslDistros();
      if (!distros.length) {
        vscode.window.showWarningMessage('No WSL distributions found. Please install WSL first.');
        return;
      }
      const selectedDistro = await vscode.window.showQuickPick(distros, {
        title:       'Select WSL Distribution',
        placeHolder: 'Choose a WSL distro...',
      });
      if (!selectedDistro) { return; }

      const result = await vscode.window.showOpenDialog({
        canSelectFiles:   false,
        canSelectFolders: true,
        canSelectMany:    false,
        defaultUri:       vscode.Uri.file(getUserDir()),
        title:            `Select 1156E SDK folder (WSL: ${selectedDistro})`,
      });
      if (!result?.[0]?.fsPath) { return; }

      ProjectMgrContext.pendingConnectionType = 'wsl';
      ProjectMgrContext.pendingWslDistro      = selectedDistro;
      callback(key, result[0].fsPath);
    }
  }

  // ── WSL distro enumeration ────────────────────────────────────────────────

  private static async getWslDistros(): Promise<string[]> {
    return new Promise((resolve) => {
      cp.exec('wsl --list --quiet', { encoding: 'buffer' }, (err, stdout) => {
        if (err) { resolve([]); return; }
        // wsl --list outputs UTF-16LE on Windows; strip null bytes then split.
        const text = Buffer.isBuffer(stdout)
          ? stdout.toString('utf16le')
          : String(stdout);
        const distros = text
          .split('\n')
          .map((d) => d.replace(/\r/g, '').replace(/\0/g, '').trim())
          .filter(Boolean);
        resolve(distros);
      });
    });
  }

  // ── 1156e SDK validation stub ──────────────────────────────────────────────
  // TODO: implement chip-specific validation for 1156e.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static verifySDK(_sdkPath: string, _connectionType: 'linux' | 'wsl'): boolean {
    return true;
  }

  // ── SDK validation ─────────────────────────────────────────────────────────

  static updateSdkTips(operate: OperateStruct): void {
    const { soc, sdkPath } = operate.paramData ?? {};
    if (!sdkPath) { return; }
    if (validateSdkForChip(soc, sdkPath)) {
      callback('sdkPathRightInfo', sdkPath);
    } else {
      callback('sdkPathWrongInfo', sdkPath);
    }
  }

  // ── Path validation ────────────────────────────────────────────────────────

  static updateProjectTips(operate: OperateStruct): void {
    const { projectPath } = operate.paramData ?? {};
    if (!projectPath) { return; }
    if (fs.existsSync(projectPath)) {
      callback('projectPathRightInfo', projectPath);
    } else {
      callback('projectPathWrongInfo', projectPath);
    }
  }

  // ── Create project ─────────────────────────────────────────────────────────

  static async getProjectData(projectData: ProjectMgrData): Promise<void> {
    if (!projectData.soc || !projectData.projectName || !projectData.projectPath || !projectData.sdkPath) {
      showMessageModal({ content: res('fieldsMissing'), infoType: 'err' });
      return;
    }

    const sdkDir    = projectData.sdkPath;
    const hiprojDir = path.join(projectData.projectPath, `${projectData.projectName}_hiproj`);

    // Attach the connection type captured during SDK selection (1156e only).
    projectData.connectionType = ProjectMgrContext.pendingConnectionType;
    projectData.wslDistro      = ProjectMgrContext.pendingWslDistro;
    ProjectMgrContext.pendingConnectionType = undefined;
    ProjectMgrContext.pendingWslDistro      = undefined;

    // For Linux 1156e the SDK lives on a remote server; open only the local hiproj folder.
    const isLinuxRemote = projectData.connectionType === 'linux';

    // For all non-Linux cases, create a .code-workspace file so VS Code opens as
    // multi-root from the start (hiprojDir first so remoteBuild writes
    // remote-build.json there instead of sdkDir).
    // Opening a workspace file never triggers the single→multi-root conversion that
    // would restart the extension host, avoiding the message-routing breakage.
    const workspaceFilePath = path.join(
      projectData.projectPath,
      `${projectData.projectName}.code-workspace`,
    );

    let pathToOpen: string;
    if (isLinuxRemote) {
      pathToOpen = hiprojDir;
    } else {
      try {
        fs.writeFileSync(
          workspaceFilePath,
          JSON.stringify({ folders: [{ path: hiprojDir }, { path: sdkDir }] }, null, 2),
          'utf-8',
        );
      } catch { /* ignore write failure — fall back to sdkDir */ }
      pathToOpen = fs.existsSync(workspaceFilePath) ? workspaceFilePath : sdkDir;
    }

    // projectDataKey = hiprojDir in all cases: workspace[0] is always hiprojDir
    // (either the only folder for Linux or the first folder in the workspace file).
    const projectDataKey = hiprojDir;

    // Only check hiprojDir — sdkDir is an existing folder chosen by the user.
    if (fs.existsSync(hiprojDir)) {
      callback('thisProjectExists', new Date().getTime());
      return;
    }

    try {
      fs.mkdirSync(hiprojDir, { recursive: true });
      // Pre-create the aicache subfolder so the AI pipeline can write results there.
      fs.mkdirSync(path.join(hiprojDir, 'aicache'), { recursive: true });
    } catch {
      showMessageModal({ content: res('createFolderFailed', [hiprojDir]), infoType: 'err' });
      return;
    }

    writeHiproj(projectData, hiprojDir, sdkDir, {
      host: ProjectMgrContext.pendingRemoteHost,
      port: ProjectMgrContext.pendingRemotePort,
    });
    ProjectMgrContext.pendingRemoteHost = undefined;
    ProjectMgrContext.pendingRemotePort = undefined;

    // Set up .vscode/ in the hiproj folder to suppress VSCode's "Generate launch.json" prompt.
    // For Linux 1156e this also writes remote-build.json.
    // IMPORTANT: must happen AFTER the fs.existsSync(hiprojDir) guard above.
    if (isLinuxRemote) {
      const vscodeDir    = path.join(hiprojDir, '.vscode');
      const vscodeDirNew = !fs.existsSync(vscodeDir);
      try {
        fs.mkdirSync(vscodeDir, { recursive: true });
        // Create an empty launch.json only when we are creating .vscode for the first
        // time. This suppresses VSCode's "Generate launch.json" prompt.
        if (vscodeDirNew && !fs.existsSync(path.join(vscodeDir, 'launch.json'))) {
          fs.writeFileSync(
            path.join(vscodeDir, 'launch.json'),
            JSON.stringify({ version: '0.2.0', configurations: [] }, null, 4),
            'utf-8',
          );
        }
        // Write the remote-build.json captured from the connection step.
        if (ProjectMgrContext.pendingRemoteBuildJsonContent) {
          fs.writeFileSync(
            path.join(vscodeDir, 'remote-build.json'),
            ProjectMgrContext.pendingRemoteBuildJsonContent,
            'utf-8',
          );
        }
      } catch { /* ignore */ }
      ProjectMgrContext.pendingRemoteBuildJsonContent = undefined;
    } else {
      // ws63 / 3322: create .vscode/launch.json to suppress the "Generate launch.json" prompt.
      try {
        const vscodeDir = path.join(hiprojDir, '.vscode');
        fs.mkdirSync(vscodeDir, { recursive: true });
        const launchPath = path.join(vscodeDir, 'launch.json');
        if (!fs.existsSync(launchPath)) {
          fs.writeFileSync(
            launchPath,
            JSON.stringify({ version: '0.2.0', configurations: [] }, null, 4),
            'utf-8',
          );
        }
      } catch { /* ignore */ }
    }

    const hiprojFilePath = path.join(hiprojDir, `${projectData.projectName}.hiproj`);
    const item = {
      name:      projectData.projectName,
      path:      hiprojFilePath,
      chip:      projectData.soc,
      board:     projectData.board,
      platform:  projectData.platform,
      time:      new Date().toLocaleString('zh-CN'),
      timestamp: Date.now(),
    };

    // Write chipName to GlobalModel immediately so command.ts can use it
    // before the workspace reloads and activate() re-reads the .hiproj.
    GlobalModel.instance.chipName = projectData.board;
    GlobalModel.instance.soc      = projectData.soc;

    if (ProjectMgrContext.globalStoragePath) {
      addItemsToProList([item], ProjectMgrContext.globalStoragePath);
      updateOneItemToLatestList(item, ProjectMgrContext.globalStoragePath);
      upsertProjectDataJson(projectDataKey, hiprojFilePath, ProjectMgrContext.globalStoragePath);
      if (ProjectMgrContext.mainProjectListPath) {
        upsertMainProjectList(item, ProjectMgrContext.mainProjectListPath);
      }
    }

    callback('thisProjectNotExists', new Date().getTime());

    // Write the marker BEFORE opening so extension.ts can auto-show the AI panel.
    if (ProjectMgrContext.pendingOpenMarkerPath) {
      try { fs.writeFileSync(ProjectMgrContext.pendingOpenMarkerPath, '1', 'utf-8'); } catch { /* ignore */ }
    }
    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(pathToOpen));
    ProjectMgrContext.deactivate('projectMgr');
  }

  // ── Close panel ───────────────────────────────────────────────────────────

  static closeProjectMgr(_operate?: OperateStruct): void {
    ProjectMgrContext.deactivate('projectMgr');
  }

  // ─── Project list ──────────────────────────────────────────────────────────

  static getProjectList(_operate: OperateStruct): void {
    if (!ProjectMgrContext.globalStoragePath) { callback('projectList', []); return; }
    callback('projectList', getProjectList(ProjectMgrContext.globalStoragePath));
  }

  static getLatestList(_operate: OperateStruct): void {
    if (!ProjectMgrContext.globalStoragePath) { callback('latestList', []); return; }
    callback('latestList', getLatestList(ProjectMgrContext.globalStoragePath));
  }

  static deleteProject(operate: OperateStruct): void {
    const { projectPath } = operate.paramData ?? {};
    if (!projectPath || !ProjectMgrContext.globalStoragePath) { return; }
    deleteFromProjectList(projectPath, ProjectMgrContext.globalStoragePath);

    const content = getHiprojContent(projectPath);
    const sdkDir: string | undefined = content?.information?.sdk_path;
    if (sdkDir) {
      removeProjectDataJson(sdkDir, ProjectMgrContext.globalStoragePath);
    }
    // Keep projectlist.json in sync.
    if (ProjectMgrContext.mainProjectListPath) {
      removeFromMainProjectList(projectPath, ProjectMgrContext.mainProjectListPath);
    }
  }

  // ─── Import panel ─────────────────────────────────────────────────────────

  static selectImportPath(_operate: OperateStruct): void {
    vscode.window.showOpenDialog({
      canSelectFiles:   false,
      canSelectFolders: true,
      canSelectMany:    false,
      defaultUri:       vscode.Uri.file(getUserDir()),
      title:            res('selectImportPath'),
    }).then((result) => {
      if (result?.[0]?.fsPath) {
        const scanPath = result[0].fsPath;
        callback('importablePath', scanPath, 'import');
        const found = findHiprojFiles(scanPath);
        const items = found.map((hiprojPath, idx) => ({
          key:      String(idx),
          name:     path.parse(hiprojPath).name,
          path:     hiprojPath,
          disabled: false,
        }));
        callback('importableItemsInfo', items, 'import');
      }
    });
  }

  static confirmImport(operate: OperateStruct): void {
    const selectedPaths: string[] = operate.paramData?.selectedPaths ?? [];
    if (!ProjectMgrContext.globalStoragePath) { return; }

    const succeeded: string[] = [];
    const failed: string[] = [];

    for (const hiprojPath of selectedPaths) {
      const content = getHiprojContent(hiprojPath);
      if (!content) { failed.push(hiprojPath); continue; }
      const chip  = content?.information?.['board_build.mcu'] ?? '';
      const board = content?.information?.board ?? chip;
      const item = {
        name:     path.parse(hiprojPath).name,
        path:     hiprojPath,
        chip,
        board,
        platform: content?.information?.platform ?? '',
        time:     new Date().toLocaleString('zh-CN'),
      };
      addItemsToProList([item], ProjectMgrContext.globalStoragePath!);
      updateOneItemToLatestList(item, ProjectMgrContext.globalStoragePath!);
      // Keep GlobalModel in sync; the project that's actually opened later
      // will be re-read by activate(), but set it now for immediate availability.
      GlobalModel.instance.chipName = board || chip;
      GlobalModel.instance.soc      = chip;
      succeeded.push(hiprojPath);
    }

    callback('importResult', { succeeded, failed }, 'import');

    if (failed.length === 0) {
      showMessageModal({ content: res('importSuccess') });
    } else {
      showMessageModal({ content: res('importPartialFailed', [String(failed.length)]), infoType: 'warn' });
    }

    ProjectMgrContext.deactivate('import');
  }

  static async openProject(operate: OperateStruct): Promise<void> {
    const hiprojPath: string = operate.paramData?.path ?? '';
    if (!hiprojPath || !fs.existsSync(hiprojPath)) {
      showMessageModal({ content: res('pathNotExist', [hiprojPath]), infoType: 'err' });
      return;
    }

    let sdkDir: string | undefined;
    const content = getHiprojContent(hiprojPath);
    const sdkPathFromFile: string | undefined = content?.information?.sdk_path;
    if (sdkPathFromFile && fs.existsSync(sdkPathFromFile)) {
      sdkDir = sdkPathFromFile;
    }

    if (!sdkDir) {
      const hiprojDirName = path.basename(path.dirname(hiprojPath));
      if (hiprojDirName.endsWith('_hiproj')) {
        const sdkDirName = hiprojDirName.replace(/_hiproj$/, '');
        const candidate  = path.join(path.dirname(path.dirname(hiprojPath)), sdkDirName);
        if (fs.existsSync(candidate)) { sdkDir = candidate; }
      }
    }

    if (!sdkDir) { sdkDir = path.dirname(hiprojPath); }

    if (ProjectMgrContext.pendingOpenMarkerPath) {
      try { fs.writeFileSync(ProjectMgrContext.pendingOpenMarkerPath, '1', 'utf-8'); } catch { /* ignore */ }
    }
    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(sdkDir));
  }

  static updateFolderPath(): void { /* no-op */ }
}
