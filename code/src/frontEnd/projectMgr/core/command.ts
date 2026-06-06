/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
import type { GetInfoCallBack, LanguageSetMessage, ThemeChangeMessage } from '../interface/api';
import { updateEntity } from './store/actions';
import { IStore }       from './store/store';
import { State }        from '../state';
import i18n             from '../i18n/fronEndTrans';

export class Command {
  static changeTheme(message: ThemeChangeMessage): void {
    const link = document.getElementsByTagName('link')[0];
    if (link) {
      link.href = link.href.replace(/projectMgr-themes\/.*\.css/, `projectMgr-themes/${message.params.theme}.css`);
    }
  }

  static setLanguage(message: LanguageSetMessage): void {
    State.lang = message.params.language.includes('zh') ? 'zh' : 'en';
    i18n.changeLanguage(State.lang);
  }

  static getInfoCallBack(message: GetInfoCallBack): void {
    IStore.getStore().dispatch(updateEntity(message.params.key, message.params.data));
  }
}
