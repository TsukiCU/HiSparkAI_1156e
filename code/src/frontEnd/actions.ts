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

import { createAction } from './core/store/actions';
import type { ProjectAction } from '../backEnd/interface/model';
import type { Action } from 'redux';

/* Welcome Page */
export const SET_LANGUAGE = 'SET_LANGUAGE';
export const GET_PROJECT_DATA = 'GET_PROJECT_DATA';
export const PROJECT_ACTION = 'PROJECT_ACTION';
export const GET_RELEASE_NOTES = 'GET_RELEASE_NOTES';
export const OPEN_RELEASE_NOTE = 'OPEN_RELEASE_NOTE';
export const OPEN_DEBUGKITS_GUIDE = 'OPEN_DEBUGKITS_GUIDE';
export const EXPORT_DATA_MESSAGE = 'EXPORT_DATA_MESSAGE';
export const GET_USERGUIDE_WEBSITE = 'GET_USERGUIDE_WEBSITE';

export const setLanguage = (): Action => createAction(SET_LANGUAGE);
export const getProjectData = (): Action => createAction(GET_PROJECT_DATA);
export const projectAction = (action: ProjectAction): Action => createAction(PROJECT_ACTION, { ...action });
export const getReleaseNotes = (): Action => createAction(GET_RELEASE_NOTES);
export const openReleaseNote = (version: string): Action => createAction(OPEN_RELEASE_NOTE, { version });
export const openDebugKitsGuide = (): Action => createAction(OPEN_DEBUGKITS_GUIDE);
export const getUserGuideWebsite = (): Action => createAction(GET_USERGUIDE_WEBSITE);

export const GET_DEMO_DATA = 'GET_DEMO_DATA';

export const getDemoData = (): Action => createAction(GET_DEMO_DATA);

export const exportDataMessage = (value: any): any => {
  return createAction(EXPORT_DATA_MESSAGE, { value });
};