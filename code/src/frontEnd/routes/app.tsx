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
import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import Navbar from './Navbar';
import '../a-styles/app.css';
import SelectModel from './SelectModel';
import Quantize from './Quantize';
import Convert from './Convert';
import Deploy from './Deploy';
import Benchmark from './Benchmark';
import { Command } from '../core/command';

type Target = 'CPU' | 'NPU' | 'NONE';
type Source = 'wsl' | 'linux';

function App(): React.JSX.Element {
  const [target, setTarget] = useState<Target>((window as any).initialState?.target ?? 'NONE');
  const [source, setSource] = useState<Source>('linux');

  const messageHandler = useCallback((event: MessageEvent) => {
    // Message type: init, sent to indicate target platform.
    const msg = event.data;
    if (msg?.type === 'init') {
      const t = msg.target as Target;
      setTarget(t);
      return;
    }
    if (msg.type === 'Source') {
      const s = msg.params?.source as Source;
      setSource(s);
    }
    // Message type: method, sent to apply the corresponding callback function.
    const method = msg?.method;
    if (typeof method === 'string' && method in Command) {
      const func = Reflect.get(Command, msg.method);
      Reflect.apply(func, Command, [msg]);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, [messageHandler]);

  return (
    <div className="chip-setting">
      <HashRouter>
        <Routes>
          <Route path="/" element={<Navbar />}>
            <Route index element={<SelectModel target={target} source={source} />} />
            <Route path="selectmodel" element={<SelectModel target={target} source={source} />} />
            <Route path="quantize" element={<Quantize target={target} source={source} />} />
            <Route path="convert" element={<Convert target={target} source={source} />} />
            <Route path="deploy" element={<Deploy target={target} source={source} />} />
            <Route path="benchmark" element={<Benchmark target={target} source={source} />} />
          </Route>
        </Routes>
      </HashRouter>
    </div>
  );
};

export default App;
