/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enUsTrans from './lang/en.json';
import zhCnTrans from './lang/zh.json';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: enUsTrans },
    zh: { translation: zhCnTrans },
  },
  fallbackLng: 'zh',
  debug: false,
  interpolation: { escapeValue: false },
});

export default i18n;
