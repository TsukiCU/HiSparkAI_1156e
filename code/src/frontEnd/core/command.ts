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

import type {
  DemoCallbackMessage,
  LanguageSetMessage,
  ConfigMessage,
  ThemeChangeMessage,
  FrontEndConfigMessage,
  GetHistoryCallbackMessage,
  GetResultHistoryCallbackMessage,
  UserGuideWebsiteCallbackMessage,
  ReleaseCallbackMessage,
} from '../../backEnd/interface/api';
import { updateEntity } from './store/actions';
import { IStore } from './store/store';
import { State } from '../state';
import i18n from '../../i18n/fronEndTrans';
import { Logger } from '@src/frontEnd/core/log4jsfrontend';
import { notify } from '../common';

/**
 * deal with commands from extension
 */
export class Command {
  /**
   * change webview theme
   * @param {ThemeChangeMessage} messageData
   */
  static changeTheme(messageData: ThemeChangeMessage): void {
    document.getElementsByTagName('link')[0].href = document
      .getElementsByTagName('link')[0]
      .href.replace(/themes\/.*\.css/, `themes/${messageData.params.theme}.css`);
    IStore.getStore().dispatch(updateEntity('themeData', messageData.params.theme));
  }

  /**
   * @param {GetHistoryCallbackMessage} messageData
   */
  static getSelectModelHistoryInfoCallback(messageData: GetHistoryCallbackMessage): void {
    IStore.getStore().dispatch(updateEntity('historyInfoData', messageData.params));
  }

  /**
 * @param {GetResultHistoryCallbackMessage} messageData
 */
  static getCompressionHistoryInfoCallback(messageData: GetResultHistoryCallbackMessage): void {
    IStore.getStore().dispatch(updateEntity('compHistoryData', messageData.params));
  }

  /**
   * @param {GetResultHistoryCallbackMessage} messageData
   */
  static getConvertHistoryInfoCallback(messageData: GetResultHistoryCallbackMessage): void {
    IStore.getStore().dispatch(updateEntity('convHistoryData', messageData.params));
  }

  /**
   * @param {GetResultHistoryCallbackMessage} messageData
   */
  static getProfilingHistoryInfoCallback(messageData: GetResultHistoryCallbackMessage): void {
    IStore.getStore().dispatch(updateEntity('profHistoryData', messageData.params));
  }

  /**
   * set language environment
   * @param {LanguageSetMessage} messageData
   */
  static setLanguage(messageData: LanguageSetMessage): void {
    State.lang = messageData.params.language.includes('zh') ? 'zh' : 'en';
    i18n.changeLanguage(State.lang);
  }

  /**
   * @param {DemoCallbackMessage} messageData
   */
  static demoCallBack(messageData: DemoCallbackMessage): void {
    Logger.info(`data, ${JSON.stringify(messageData.params.data)}`);
    IStore.getStore().dispatch(updateEntity('demoData', messageData.params.data));
  }

  /**
   * Save data in Redux store.
   * @param {ConfigMessage} messageData
   */
  static saveConfigCallback(messageData: ConfigMessage): void {
    const { config } = messageData.params;
    config.forEach(item => {
      const { key, value } = item;
      IStore.getStore().dispatch(updateEntity(key, value));
    });
  }

  static updateHisgraph(messageData: FrontEndConfigMessage): void {
    const { fileData, stage } = messageData.params.data;
    if (stage !== 'compression' && stage !== 'profiling') {
      notify(
        `updateHisgraph failed. Got unknown stage ${stage}`,
        { type: 'error', stack: false, duration: 2 }
      );
      return;
    }
    if (stage === 'compression') {
      IStore.getStore().dispatch(updateEntity('compressionHisgraphData', fileData));
    }
    if (stage === 'profiling') {
      IStore.getStore().dispatch(updateEntity('profilingHisgraphData', fileData));
    }
  }

  static updateConstark(messageData: FrontEndConfigMessage): void {
    // IStore.getStore().dispatch(updateEntity('importConStarkCallbackData', messageData.params.data));
    const { fileData, stage } = messageData.params.data;
    if (stage !== 'convert') {
      notify(
        `updateConstark failed. Got unknown stage ${stage}`,
        { type: 'error', stack: false, duration: 2 }
      );
      return;
    }
    IStore.getStore().dispatch(updateEntity('importConStarkCallbackData', fileData));
  }

  static importProGraphCallback(messageData: FrontEndConfigMessage): void {
    IStore.getStore().dispatch(updateEntity('importProGraphCallbackData', messageData.params.data));
  }

  static importProValidationCallback(messageData: FrontEndConfigMessage): void {
    IStore.getStore().dispatch(updateEntity('importProValidationCallbackData', messageData.params.data));
  }

  static getUserGuideWebsiteCallBack(messageData: UserGuideWebsiteCallbackMessage): void {
    IStore.getStore().dispatch(updateEntity('hisiWebsite', messageData.params.data.hisiWebsite));
    IStore.getStore().dispatch(updateEntity('hisiEcologyWebsite', messageData.params.data.hisiEcologyWebsite));
    IStore.getStore().dispatch(updateEntity('vsStudioCodeMarketplaceWebsite', messageData.params.data.vsStudioCodeMarketplaceWebsite));
    IStore.getStore().dispatch(updateEntity('extensionMarketplaceWebsite', messageData.params.data.extensionMarketplaceWebsite));
    IStore.getStore().dispatch(updateEntity('quickUserGuideWebsite', messageData.params.data.quickUserGuideWebsite));
    IStore.getStore().dispatch(updateEntity('userGuideWebsite', messageData.params.data.userGuideWebsite));
  }

  static deleteProjectCallBack(messageData: FrontEndConfigMessage): void {
    IStore.getStore().dispatch(updateEntity('deleteProjectCallBackData', messageData.params.data));
  }

/**
 * @param {ReleaseCallbackMessage} messageData
 */
  static releaseCallBack(messageData: ReleaseCallbackMessage): void {
    IStore.getStore().dispatch(updateEntity('releaseNotes', messageData.params.data));
  }
}
