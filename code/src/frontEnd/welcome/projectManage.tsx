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
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import newProjectBg from '../../../resources/welcome/new_project_bg.svg';
import newProjectIcon from '../../../resources/welcome/new_project.png';
import importProjectBg from '../../../resources/welcome/import_project_bg.svg';
import importProjectIcon from '../../../resources/welcome/import_project.png';
import plusIcon from '../../../resources/welcome/plus.svg';
import { projectAction } from '../actions';
import { vscode } from '@src/frontEnd/index';

const ProjectManage: React.FC = (): React.JSX.Element => {
  const { t } = useTranslation();

  const dispatch = useDispatch();

  const projectManageAction = (action: string, aiSideAction: string, bgSrc: string, iconSrc: string): React.JSX.Element => {
    return (
      <a className={`project-manage-action ${action}`} onClick={(): void => onClickEvent(action, aiSideAction)}>
        <img src={bgSrc} className='project-manage-action-bg'></img>
        <img src={iconSrc} className='project-manage-action-icon'></img>
        <div className='project-manage-action-text primary-text'>{t(action)}</div>
        <div className='project-manage-action-plus' style={{ WebkitMask: `url(${plusIcon}) no-repeat`, WebkitMaskSize: '100% 100%' }}></div>
      </a>
    );
  };

  const onClickEvent = (action: string, aiSideAction: string): void => {
    dispatch(projectAction({ method: action }));

    vscode.postMessage({
      type: 'runCommand',
      commandId: aiSideAction,
    });
  };

  return (
    <>
      <div id='project-manage'>
        {projectManageAction('newProject', 'showProjectWizard', newProjectBg, newProjectIcon)}
        {projectManageAction('importProject', 'showProjectImport', importProjectBg, importProjectIcon)}
      </div>
    </>
  );
};

export default ProjectManage;
