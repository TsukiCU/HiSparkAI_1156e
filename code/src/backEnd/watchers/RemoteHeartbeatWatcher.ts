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

import * as vscode from 'vscode';

interface ExecuteResult {
  exitCode: number;
  stdout: string;
  stderr: string;
};

type LostConnectionHandler = () => void;
type HeartbeatCheck = () => Promise<ExecuteResult>;

export class RemoteHeartbeatWatcher implements vscode.Disposable {
  private static instance: RemoteHeartbeatWatcher;

  private timer: NodeJS.Timeout | undefined;
  private isChecking = false;
  private lastConnected = true;

  private handler: LostConnectionHandler | undefined;
  private checkHeartbeat: HeartbeatCheck | undefined;

  private constructor() { }

  // Singleton
  static getInstance(): RemoteHeartbeatWatcher {
    if (!this.instance) {
      this.instance = new RemoteHeartbeatWatcher();
    }
    return this.instance;
  }

  start(heartbeatFunc: HeartbeatCheck, handler: LostConnectionHandler, interval = 1000): void {
    this.checkHeartbeat = heartbeatFunc;
    this.handler = handler;

    if (this.timer) {
      return;
    }

    this.timer = setInterval(async () => {
      if (!this.checkHeartbeat) {
        return;
      }

      if (this.isChecking) {
        return;
      }

      this.isChecking = true;
      try {
        const ret = await this.checkHeartbeat();

        if (!ret || ret.exitCode !== 0) {
          this.handleDisconnect();
          return;
        }

        // Connection recovered.
        if (!this.lastConnected) {
          vscode.window.showInformationMessage('Connection to Linux server recovered.');
        }
        this.lastConnected = true;
      } catch (err) {
        this.handleDisconnect();
      } finally {
        this.isChecking = false;
      }
    }, interval);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    this.isChecking = false;
    this.lastConnected = true;
    this.handler = undefined;
    this.checkHeartbeat = undefined;
  }

  dispose(): void {
    this.stop();
  }

  /** True if the watcher is running (i.e. a Linux connection was established this session). */
  get isRunning(): boolean { return !!this.timer; }

  /** True if the last heartbeat check succeeded. */
  get lastConnectionState(): boolean { return this.lastConnected; }

  /** Execute the heartbeat function once and return whether the server is reachable. */
  async checkOnce(): Promise<boolean> {
    if (!this.checkHeartbeat) { return false; }
    try {
      const ret = await this.checkHeartbeat();
      return ret?.exitCode === 0;
    } catch { return false; }
  }

  // Connection lost
  private handleDisconnect(): void {
    if (this.lastConnected) {
      this.lastConnected = false;

      // 回调到外部
      this.handler?.();
    }
  }
}