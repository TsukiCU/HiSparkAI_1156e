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

const LEVEL_MAP: Record<string, 'info' | 'warn' | 'error' | 'debug'> = {
  INFO: 'info',
  WARN: 'warn',
  WARNING: 'warn',
  DEBUG: 'debug',
  ERROR: 'error',
  CRITICAL: 'error',
};

const PYTHON_LOG_PATTERN =
  /^(?:(?<timestamp>\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[,.]\d{1,})?)\s*-?\s*)?(?:[\[-]?(?<level>INFO|ERROR|WARN|WARNING|DEBUG|CRITICAL)\]?\s*[:-：]?\s*-\s*)?(?<message>.*)$/i;
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export class Logger {
  private pending = ''; // Handle half-rows caused by buffer sharding
  private lastLevel: LogLevel = 'info';

  constructor(private readonly channel: vscode.LogOutputChannel) { }

  info(msg: string): void {
    this.channel.info(msg);
  }

  warn(msg: string): void {
    this.channel.warn(msg);
  }

  error(msg: string): void {
    this.channel.error(msg);
  }

  debug(msg: string): void {
    this.channel.debug(msg);
  }

  clear(): void {
    this.channel.clear();
  }

  raw(data: Buffer | string): void {
    let chunk = '';
    if (typeof data === 'string') {
      chunk = data;
    } else {
      const buffer = data;
      const isUtf16le = this.isUtf16LEBuffer(buffer);
      chunk = isUtf16le
        ? buffer.toString('utf16le')
        : buffer.toString('utf8');
    }
    chunk = chunk.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
    const text = this.pending + chunk;
    const isFullTraceback =
      /Traceback\s+\(most recent call last\):/i.test(chunk) ||
      /\s*File\s+"[^"]+",\s*line\s+\d+/i.test(chunk);
    const parts = text.split(/\r?\n/);
    this.pending = parts.pop() ?? '';

    for (const line of parts) {
      if (isFullTraceback) {
        this.writeParsedLine(line, 'error');
      } else {
        this.writeParsedLine(line);
      }
    }
  }

  /**
   * Called when no further output will follow
   */
  flush(): void {
    if (!this.pending) { return; }
    this.writeParsedLine(this.pending);
    this.pending = '';
  }

  handleLogInfo(data: Buffer | string, level: 'info' | 'warn' | 'error'): void {
    this.raw(data);
  }

  rawWithForcedLevel(data: Buffer | string, forcedLevel: Exclude<LogLevel, 'debug'>): void {
    let chunk = '';
    if (typeof data === 'string') {
      chunk = data;
    } else {
      const buffer = data;
      const isUtf16le = this.isUtf16LEBuffer(buffer);
      chunk = isUtf16le
        ? buffer.toString('utf16le')
        : buffer.toString('utf8');
    }
    chunk = chunk.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
    const text = this.pending + chunk;
    const isFullTraceback =
      /Traceback\s+\(most recent call last\):/i.test(chunk) ||
      /\s*File\s+"[^"]+",\s*line\s+\d+/i.test(chunk);
    const parts = text.split(/\r?\n/);
    this.pending = parts.pop() ?? '';
    for (const line of parts) {
      if (isFullTraceback) {
        this.writeParsedLine(line, 'error');
      } else {
        this.writeParsedLine(line);
      }
    }
  }

  private writeParsedLine(line: string, forcedLevel?: LogLevel): void {
    const { level, content } = this.parsePythonLog(line, forcedLevel);
    if (!content || !content.trimEnd()) { return; }

    this.lastLevel = level;

    switch (level) {
      case 'info':
        this.channel.info(content);
        break;
      case 'warn':
        this.channel.warn(content);
        break;
      case 'error':
        this.channel.error(content);
        break;
      case 'debug':
        this.channel.debug(content);
        break;
      default:
        this.channel.appendLine(content);
        break;
    }
  }

  private parsePythonLog(
    rawLog: string,
    forcedLevel?: LogLevel
  ): { level: LogLevel; content: string } {
    const line = rawLog.replace(/\r?\n$/, '').trimEnd();
    if (!line) {
      return { level: forcedLevel ?? 'info', content: '' };
    }

    // Blocks that contains multiple lines, should be treated as one continuous section.
    const looksLikeContinuation =
      /^\s+/.test(rawLog) ||
      /^File\s+".*",\s+line\s+\d+/.test(line) ||
      /^Traceback\s+\(most recent call last\):/i.test(line);

    const match = line.match(PYTHON_LOG_PATTERN);
    const groups = match?.groups;

    const parsedLevel = groups?.level ? groups.level.toUpperCase() : undefined;
    let pythonLevel = parsedLevel ?? undefined;

    const message = (groups?.message ?? line).trimEnd();
    if (forcedLevel) {
      return { level: forcedLevel, content: message };
    }

    // If it's continuation and no explicit level is specified, inherit the lastLevel (tracebacks).
    if (!pythonLevel && looksLikeContinuation) {
      return { level: this.lastLevel, content: message };
    }

    // Resolve for real levels
    let level: LogLevel | undefined = pythonLevel ? (LEVEL_MAP[pythonLevel] ?? undefined) : undefined;

    // If the level is not resolved, infer from keywords.
    if (!level) {
      let textWithoutPaths = message.toUpperCase();

      const PATH_REGEX = /(?:[A-Z]:\\|\\\\|\\|\/)[^\s:\\/*?"<>|]+/gi;
      textWithoutPaths = textWithoutPaths.replace(PATH_REGEX, '');

      if (/\b(?:ERROR|FAILED|EXCEPTION|TRACEBACK)\b|\bE[:：]/.test(textWithoutPaths)) {
        level = 'error';
      } else if (/\b(?:WARN|WARNING)\b|\bW[:：]/.test(textWithoutPaths)) {
        level = 'warn';
      } else if (/\b(?:DEBUG)\b|\bD[:：]/.test(textWithoutPaths)) {
        level = 'debug';
      } else {
        level = 'info';
      }
    }

    return { level, content: message };
  }

  private isUtf16LEBuffer(buffer: Buffer): boolean {
    return buffer.length >= 2 && buffer.readUInt16LE(0) === 0xFEFF;
  }
}