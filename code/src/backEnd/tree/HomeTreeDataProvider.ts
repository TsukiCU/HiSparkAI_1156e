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

export class HomeTreeNode extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
        // 去掉 label 前面的空格，保证判断准确
        const cleanLabel = label.trim();

        if (cleanLabel === 'Home') {
            this.iconPath = new vscode.ThemeIcon('home');
        } else if (cleanLabel === 'User Guide') {
            this.iconPath = new vscode.ThemeIcon('book');
        } else if (cleanLabel === 'Connect to Server') {
            this.iconPath = new vscode.ThemeIcon('remote-explorer');
        } else if (cleanLabel === 'Command Line') {
            this.iconPath = new vscode.ThemeIcon('terminal');
        } else if (cleanLabel === 'Download Toolchain') {
            this.iconPath = new vscode.ThemeIcon('tools');
        } else {
            this.iconPath = undefined;
        }
    }
}

export class HomeTreeDataProvider implements vscode.TreeDataProvider<HomeTreeNode> {
    readonly onDidChangeTreeData: vscode.Event<HomeTreeNode | undefined>;
    private _onDidChangeTreeData: vscode.EventEmitter<HomeTreeNode | undefined>;

    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter<HomeTreeNode | undefined>();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    getTreeItem(element: HomeTreeNode): vscode.TreeItem {
        return element;
    }

    getChildren(element?: HomeTreeNode): Promise<HomeTreeNode[]> {
        if (!element) {
            return Promise.resolve([
                new HomeTreeNode(
                    'Welcome',
                    vscode.TreeItemCollapsibleState.Expanded
                ),
            ]);
        }
        if (element.label === 'Welcome') {
            return Promise.resolve([
                new HomeTreeNode(
                    ' Home',
                    vscode.TreeItemCollapsibleState.None,
                    { command: 'HisparkAI.homeShow', title: 'Open Home Page' }
                ),
                new HomeTreeNode(
                    ' User Guide',
                    vscode.TreeItemCollapsibleState.None,
                    { command: 'HisparkAI.showGuide', title: 'Open User Guide' }
                ),
                new HomeTreeNode(
                    ' Connect to Server',
                    vscode.TreeItemCollapsibleState.None,
                    { command: 'HisparkAI.connectServer', title: 'Connect to Server' }
                ),
                new HomeTreeNode(
                    ' Command Line',
                    vscode.TreeItemCollapsibleState.None,
                    { command: 'HisparkAI-studio.remote', title: 'Open Command Line' }
                ),
                new HomeTreeNode(
                    ' Download Toolchain',
                    vscode.TreeItemCollapsibleState.None,
                    { command: 'HisparkAI-studio.manageToolchain', title: 'Open Download Toolchain' }
                ),
            ]);
        }
        return Promise.resolve([]);
    }

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }
}