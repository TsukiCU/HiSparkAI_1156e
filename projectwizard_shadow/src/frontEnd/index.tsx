/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
import * as React from 'react';
import { Provider } from 'react-redux';

import ProjectWizard from './projectWizard';
import ProjectImport from './projectImport/projectImport';
import { Command }   from './core/command';
import { createRoot } from 'react-dom/client';
import { IStore }    from './core/store/store';
import type { Message } from '../backEnd/interface/api';

type VSCodeApi = {
  postMessage: (message: unknown) => void;
  getState?: () => unknown;
  setState?: (state: unknown) => void;
};

declare function acquireVsCodeApi(): VSCodeApi;

// 如果没有安装 @types/webpack-env，用这个避免 module 报错
declare const module: any;

export const vscode = acquireVsCodeApi();

const root = document.getElementById('app');
const flagCreate = document.getElementById('flagCreate');
const flagImport = document.getElementById('flagImport');

if (!root) {
  throw new Error('Cannot find root element: #app');
}

const store = IStore.getStore();

function createApp(): React.ReactElement {
  if (flagCreate) {
    return (
      <Provider store={store}>
        <ProjectWizard />
      </Provider>
    );
  }

  if (flagImport) {
    return (
      <Provider store={store}>
        <ProjectImport />
      </Provider>
    );
  }

  // fallback – render nothing meaningful
  return <div />;
}

const reactRoot = createRoot(root);

reactRoot.render(createApp());

// close progress (no-op in shadow, keeps compatibility)
vscode.postMessage({ method: 'closeProgress' });

// hot-reload
if (module.hot) {
  module.hot.accept('./index', () => {
    reactRoot.render(createApp());
  });
}

// messages from the extension
window.addEventListener('message', (event: MessageEvent) => {
  const message = event.data as Message;
  const func = Reflect.get(Command, message.method);

  if (typeof func === 'function') {
    Reflect.apply(func, Command, [message]);
  }
});

document.addEventListener('contextmenu', (event: MouseEvent) => {
  event.preventDefault();
});

