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

/**
 * 资源位置枚举
 */
export enum ResourceLocation {
  STATIC = 'STATIC',  // 静态资源 (/resources)
  WEB = 'WEB',        // 网页资源 (/dist)
}

/**
 * 基础路径配置
 */
export const BASE_PATHS = {
  STATIC: 'resources',                   // 静态资源基础路径(svg, png等)
  WEB: 'dist',                           // 网页资源基础路径(html, js, css等)
  CUSTOM_STATIC: 'dist/resources/welcome/resources', // 自定义静态资源默认路径(插件B)
  CUSTOM_WEB: 'dist/resources/welcome', // 自定义网页资源默认路径(插件B)
};

/**
 * 资源对象通用类型
 */
export type ResourceObject = {
  path: string;
  location: ResourceLocation;
};

/**
 * 图标资源定义 - 使用小写命名便于IDE自动补全
 */
export const icon = {
  // 用户指南图标
  userGuide: {
    path: 'user_guide.svg',
    location: ResourceLocation.STATIC,
  },
  // 主页图标
  homeLight: {
    path: 'home_light.svg',
    location: ResourceLocation.STATIC,
  },
  homeDark: {
    path: 'home_dark.svg',
    location: ResourceLocation.STATIC,
  },
  // 新建项目图标
  importProject: {
    path: 'import_project.png',
    location: ResourceLocation.STATIC,
  },
};

/**
 * Wizard webview HTML (separate bundle from the main AI pipeline webview)
 */
export const wizardHtml = {
  index: {
    path: 'wizard.html',
    location: ResourceLocation.WEB,
  },
};

/**
 * HTML资源定义
 */
export const html = {
  // 主页HTML
  index: {
    path: 'index.html',
    location: ResourceLocation.WEB,
  },
  // 发布说明HTML
  releaseNote: {
    path: 'releasenote-{{version}}.html',
    location: ResourceLocation.WEB,
  },
};

/**
 * 样式资源定义
 */
export const style = {
  // 深色主题
  dark: {
    path: 'themes/dark.css',
    location: ResourceLocation.WEB,
  },
  // 浅色主题
  light: {
    path: 'themes/light.css',
    location: ResourceLocation.WEB,
  },
};

/**
 * 芯片资源定义
 */
export const chip = {
  // 芯片JSON配置
  config: {
    path: 'chips/{{fileName}}',
    location: ResourceLocation.STATIC,
  },
};