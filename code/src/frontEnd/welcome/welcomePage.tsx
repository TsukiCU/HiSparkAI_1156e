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
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ProjectList from './projectList';
import UserGuide from './userGuides';
import Community from './community';
import WelcomeInfo from './welcomeInfo';
import ProjectManage from './projectManage';
import { useDispatch } from 'react-redux';
import { setLanguage } from '../actions';
import { Command } from '../core/command';
import ReleaseNotes from './releaseNotes';

const WelcomePage: React.FC = (): JSX.Element => {
  const { t } = useTranslation();

  const dispatch = useDispatch();

  const messageHandler = useCallback((event: MessageEvent) => {
    // Message type: init, sent to indicate target platform.
    const msg = event.data;
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

  useEffect(() => {
    dispatch(setLanguage());
  }, [dispatch]);

  return (
    <>
      <div className='grid-container'>
        <div className='column-left'>
          <div className='header primary-text'></div>
          <WelcomeInfo></WelcomeInfo>
          <ProjectManage></ProjectManage>
          <ProjectList></ProjectList>
        </div>
        <div className='column-right'>
          <UserGuide></UserGuide>
          <ReleaseNotes></ReleaseNotes>
          <Community></Community>
        </div>
      </div>
    </>
  );
};

export default WelcomePage;
