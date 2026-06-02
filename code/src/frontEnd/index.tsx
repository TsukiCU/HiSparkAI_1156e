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
import WelcomePage from './welcome/welcomePage';
import { AppContainer } from 'react-hot-loader';
import { Provider } from 'react-redux';
import { IStore } from './core/store/store';
import App from './routes/app';
import { frontEndFirstLoad } from './core/frontend_test';
import { Message } from '@src/backEnd/interface/api';
import { Command } from './core/command';

const target = (window as any).initialState?.target;

const app = (
  <AppContainer>
    <Provider store={IStore.getStore()}>
      {target === 'NONE' ? <WelcomePage /> : <App />}
    </Provider>
  </AppContainer>
);

// @ts-expect-error: Unreachable code error
// eslint-disable-next-line no-undef
export const vscode = acquireVsCodeApi();

ReactDOM.render(app, document.getElementById('app'));
const webviewMessage = {
  method: 'closeProgress',
};
frontEndFirstLoad();

const anyModule = module as any;
if (anyModule.hot) {
  anyModule.hot.accept('./index', () => {
    ReactDOM.render(app, document.getElementById('app'));
  });
}

document.addEventListener('contextmenu', event => event.preventDefault());