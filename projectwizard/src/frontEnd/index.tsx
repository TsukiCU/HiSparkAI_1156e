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
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import App from './projectWizard';
import SettingsApp from './projectSettings/projectSetting';
import ImportApp from './projectImport/projectImport';
import TargetApp from './targetManage/targetManage';
import { Command } from './core/command';
import type { Message } from '../backEnd/interface/api';
import { Provider } from 'react-redux';
import { IStore } from './core/store/store';
import { hot } from 'react-hot-loader/root';

// @ts-expect-error: Unreachable code error
export const vscode = acquireVsCodeApi();
const wizardApp = document.getElementById('app');
const flagCreate = document.getElementById('flagCreate');
const flagSettings = document.getElementById('flagSettings');
const flagImport = document.getElementById('flagImport');
let app: any;
if (flagCreate) {
  app = hot(
    <Provider store={IStore.getStore()}>
      <App />
    </Provider>
  );
} else if (flagSettings) {
  const path = flagSettings?.dataset?.path ?? null;
  app = hot(
    <Provider store={IStore.getStore()}>
      <SettingsApp path={path} />
    </Provider>
  );
} else if (flagImport) {
  app = hot(
    <Provider store={IStore.getStore()}>
      <ImportApp />
    </Provider>
  );
} else {
  app = hot(
    <Provider store={IStore.getStore()}>
      <TargetApp />
    </Provider>
  );
}

ReactDOM.render(app, wizardApp);

const webviewMessage = {
  method: 'closeProgress',
};
vscode.postMessage(webviewMessage);

const anyModule = module as any;
if (anyModule.hot) {
  anyModule.hot.accept('./index', () => {
    ReactDOM.render(app, wizardApp);
  });
}

window.addEventListener('message', (event) => {
  const message: Message = event.data;
  const func = Reflect.get(Command, message.method);
  Reflect.apply(func, Command, [message]);
});

document.addEventListener('contextmenu', event => event.preventDefault());
