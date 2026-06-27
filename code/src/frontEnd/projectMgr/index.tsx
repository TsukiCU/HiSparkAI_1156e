/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
import * as React from 'react';
import { Provider } from 'react-redux';
import { createRoot } from 'react-dom/client';

import ProjectCreate from './projectCreate';
import ProjectImport from './projectImport/projectImport';
import { Command } from './core/command';
import { IStore } from './core/store/store';
import type { Message } from './interface/api';

type VSCodeApi = {
  postMessage: (message: unknown) => void;
  getState?: () => unknown;
  setState?: (state: unknown) => void;
};

declare function acquireVsCodeApi(): VSCodeApi;
declare const module: any;

export const vscode = acquireVsCodeApi();

const root = document.getElementById('app');
const flagCreate = document.getElementById('flagCreate');
const flagImport = document.getElementById('flagImport');

if (!root) { throw new Error('Cannot find root element: #app'); }

const store = IStore.getStore();

function createApp(): React.ReactElement {
  if (flagCreate) {
    return <Provider store={store}><ProjectCreate /></Provider>;
  }
  if (flagImport) {
    return <Provider store={store}><ProjectImport /></Provider>;
  }
  return <div />;
}

const reactRoot = createRoot(root);
reactRoot.render(createApp());

vscode.postMessage({ method: 'closeProgress' });

if (module.hot) {
  module.hot.accept('./index', () => { reactRoot.render(createApp()); });
}

window.addEventListener('message', (event: MessageEvent) => {
  const message = event.data as Message;
  const func = Reflect.get(Command, message.method);
  if (typeof func === 'function') {
    Reflect.apply(func, Command, [message]);
  }
});

document.addEventListener('contextmenu', (event: MouseEvent) => { event.preventDefault(); });
