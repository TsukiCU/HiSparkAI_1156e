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
import type { CustomIDESetMessage, GetInfoCallBack, LanguageSetMessage, ThemeChangeMessage } from '../../backEnd/interface/api';
import { updateEntity } from './store/actions';
import { IStore } from './store/store';
import { State } from '../state';
import i18n from '../../i18n/fronEndTrans';

/**
 * deal with commands from extension
 */
export class Command {
  /**
   * change webview theme
   * @param {ThemeChangeMessage} message
   */
  static changeTheme(message: ThemeChangeMessage): void {
    document.getElementsByTagName('link')[0].href = document
      .getElementsByTagName('link')[0]
      .href.replace(/themes\/.*\.css/, `themes/${message.params.theme}.css`);
  }

  /**
   * set language environment
   * @param {LanguageSetMessage} message
   */
  static setLanguage(message: LanguageSetMessage): void {
    State.lang = message.params.language.includes('zh') ? 'zh' : 'en';
    i18n.changeLanguage(State.lang);
  }

  static checkCustomIDE(message: CustomIDESetMessage): void {
    IStore.getStore().dispatch(updateEntity('isCustomIDE', message.params.isCustomIDE));
  }
  
  /**
   * get info
   * @param {GetInfoCallBack} message
   */
  static getInfoCallBack(message: GetInfoCallBack): void {
    IStore.getStore().dispatch(updateEntity(message.params.key, message.params.data));
  }
}
