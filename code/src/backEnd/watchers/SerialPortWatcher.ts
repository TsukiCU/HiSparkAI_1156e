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

import { SerialPort } from 'serialport';
import type { ConfigMessage, PortInfo } from '../interface/api';
import { ApiMethod } from '../interface/apiMethod';
import { extension } from '../../extension';
import { logger } from '../log4js';
import * as vscode from 'vscode';

export class SerialPortWatcher implements vscode.Disposable {
  private static instance: SerialPortWatcher;

  // in case failed to get serial. Retry when # of errors is within the preset range.
  private errorCount = 0;
  private readonly maxErrors = 5;
  private timer: NodeJS.Timeout | undefined;
  private lastPorts: string[] = [];

  private constructor() { }

  static getInstance(): SerialPortWatcher {
    if (!this.instance) {
      this.instance = new SerialPortWatcher();
    }
    return this.instance;
  }

  start(interval = 1000): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(async () => {
      try {
        const ports = await SerialPort.list();
        this.errorCount = 0;

        const currentPorts: PortInfo[] = ports
          .map((p): PortInfo => {
            const type = this.getPortTypeWindows(p); // doesn't apply to Linux or mac platform
            let label;
            if (type === 'usb') {
              label = `${p.path} (USB转串口)`;
            } else if (type === 'native') {
              label = `${p.path}`; // Show no extra info if it's native
            } else {
              label = `${p.path} (未知类型)`;
            }

            return {
              path: p.path,
              type,
              label,
              vendorId: p.vendorId,
              productId: p.productId,
              manufacturer: p.manufacturer,
            };
          }).sort((a, b) => a.path.localeCompare(b.path));

        const lastPortKeys = this.lastPorts;
        const currentPortKeys = currentPorts.map(p => `${p.path}:${p.type}:${p.vendorId ?? ''}:${p.productId ?? ''}`);

        if (
          currentPortKeys.length !== lastPortKeys.length ||
          currentPortKeys.some((p, i) => p !== lastPortKeys[i])
        ) {
          this.lastPorts = currentPortKeys;

          const config = [{ key: 'ports', value: currentPorts }];
          const message: ConfigMessage = {
            method: ApiMethod.SAVE_CONFIG_CALLBACK,
            params: { config },
          };

          extension.chipConfigPanel?.postMessage(message);
        }
      } catch (err) {
        this.errorCount++;
        logger.error(`Failed to get serial port : ${err}, retrying...`);

        if (this.errorCount >= this.maxErrors) {
          logger.error('Can\'t access to port. Stopping watcher');
          this.stop();
        }
      }
    }, interval);
  }

  dispose(): void {
    this.stop();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    this.lastPorts = [];
  }

  private getPortTypeWindows(p: {
    path: string;
    pnpId?: string;
    vendorId?: string;
    productId?: string;
  }): 'native' | 'usb' | 'unknown' {
    const pnpId = p.pnpId?.toUpperCase() ?? '';

    // 判断是否为USB口转串口，判断依据：
    // 1. 常见 USB 串口在 Windows 下会带 vendorId/productId，
    // 2. pnpId 里也常出现 USB\VID_xxxx&PID_xxxx；
    // 3. FTDI 还可能出现 FTDIBUS\VID_xxxx+PID_xxxx...
    const isUsb =
      !!p.vendorId ||
      !!p.productId ||
      pnpId.includes('USB\\') ||
      pnpId.includes('VID_') ||
      pnpId.includes('PID_') ||
      pnpId.includes('FTDIBUS\\');

    if (isUsb) {
      return 'usb';
    }

    // 再判断是否为原生串口： COMxx这种端口名
    if (/^COM\d+$/i.test(p.path)) {
      return 'native';
    }

    return 'unknown';
  }
}