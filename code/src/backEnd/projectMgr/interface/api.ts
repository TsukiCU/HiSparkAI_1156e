/**
 * Wizard webview message types used by the backend (Node.js) side.
 */
export const WizardApiMethod = {
  CHANGE_THEME:     'changeTheme',
  SET_LANGUAGE:     'setLanguage',
  GET_INFO_CALLBAK: 'getInfoCallBack',
} as const;

export interface WizardMessage {
  method: string;
  params?: any;
}

export interface GetInfoCallBack extends WizardMessage {
  method: typeof WizardApiMethod.GET_INFO_CALLBAK;
  params: { key: string; data: any };
}

export interface LanguageSetMessage extends WizardMessage {
  method: typeof WizardApiMethod.SET_LANGUAGE;
  params: { language: string };
}
