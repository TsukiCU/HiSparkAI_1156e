/**
 * Wizard-specific webview message types.
 * Kept separate from code's main backEnd/interface/api.ts to avoid type conflicts.
 */

export const ApiMethod = {
  CHANGE_THEME:     'changeTheme',
  SET_LANGUAGE:     'setLanguage',
  GET_INFO_CALLBAK: 'getInfoCallBack',
} as const;

export interface Message {
  method: string;
  params?: any;
}

export interface GetInfoCallBack extends Message {
  method: typeof ApiMethod.GET_INFO_CALLBAK;
  params: { key: string; data: any };
}

export interface LanguageSetMessage extends Message {
  method: typeof ApiMethod.SET_LANGUAGE;
  params: { language: string };
}

export interface ThemeChangeMessage extends Message {
  method: typeof ApiMethod.CHANGE_THEME;
  params: { theme: string };
}
