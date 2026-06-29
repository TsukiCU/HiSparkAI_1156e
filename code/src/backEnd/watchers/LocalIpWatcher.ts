/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */

import * as os from 'os';
import type { ConfigMessage } from '../interface/api';
import { ApiMethod } from '../interface/apiMethod';
import { extension } from '../../extension';
import * as vscode from 'vscode';

export interface IpInfo {
  ip: string;
  netmask: string;
}

export class LocalIpWatcher implements vscode.Disposable {
  private static instance: LocalIpWatcher;
  private timer: NodeJS.Timeout | undefined;
  private lastIps: string[] = [];

  private constructor() { }

  static getInstance(): LocalIpWatcher {
    if (!this.instance) {
      this.instance = new LocalIpWatcher();
    }
    return this.instance;
  }

  start(interval = 5000): void {
    if (this.timer) {
      return;
    }
    this.poll();
    this.timer = setInterval(() => this.poll(), interval);
  }

  dispose(): void {
    this.stop();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.lastIps = [];
  }

  private poll(): void {
    const interfaces = os.networkInterfaces();
    const ipList: IpInfo[] = [];
    for (const devName in interfaces) {
      const iface = interfaces[devName];
      if (!iface) { continue; }
      for (const alias of iface) {
        if (alias.family === 'IPv4' && !alias.address.startsWith('127.0.0')) {
          ipList.push({ ip: alias.address, netmask: alias.netmask });
        }
      }
    }

    const ipKeys = ipList.map(item => item.ip);
    const changed = ipKeys.length !== this.lastIps.length || ipKeys.some((ip, i) => ip !== this.lastIps[i]);
    if (changed) {
      this.lastIps = ipKeys;
      const config = [{ key: 'localIps', value: ipList }];
      const message: ConfigMessage = {
        method: ApiMethod.SAVE_CONFIG_CALLBACK,
        params: { config },
      };
      extension.chipConfigPanel?.postMessage(message);
    }
  }
}
