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
 * 资源对象通用类型
 */
export type ResourceObject = {
  path: string;
  location: ResourceLocation;
};

/**
 * 基础路径配置
 */
export const BASE_PATHS = {
  STATIC: 'resources',                   // 静态资源基础路径(svg, png等)
  WEB: 'dist',                           // 网页资源基础路径(html, js, css等)
  CUSTOM_STATIC: 'dist/resources/projectwizard/resources', // 自定义静态资源默认路径(插件B)
  CUSTOM_WEB: 'dist/resources/projectwizard', // 自定义网页资源默认路径(插件B)
};

/**
 * 图标资源定义 - 使用小写命名便于IDE自动补全
 */
export const icon = {
  // 用户指南图标
  userGuide: {
    path: 'icons/user_guide.svg',
    location: ResourceLocation.STATIC,
  },
  // 主页图标
  home: {
    path: 'icons/home.svg',
    location: ResourceLocation.STATIC,
  },
  // 导入项目图标
  importProjectLight: {
    path: 'icons/importProject.svg',
    location: ResourceLocation.STATIC,
  },
  importProjectDark: {
    path: 'icons/importProjectlight.svg',
    location: ResourceLocation.STATIC,
  },
  // 新建项目图标
  newProjectLight: {
    path: 'icons/newProject.svg',
    location: ResourceLocation.STATIC,
  },
  newProjectDark: {
    path: 'icons/newProjectlight.svg',
    location: ResourceLocation.STATIC,
  },
  // 新建项目图标
  projectSettingLight: {
    path: 'icons/projectSetting.svg',
    location: ResourceLocation.STATIC,
  },
  projectSettingDark: {
    path: 'icons/projectSettinglight.svg',
    location: ResourceLocation.STATIC,
  },
  customProjectSettingLight: {
    path: 'icons/projectSetting-custom.svg',
    location: ResourceLocation.STATIC,
  },
  customProjectSettingDark: {
    path: 'icons/projectSettinglight-custom.svg',
    location: ResourceLocation.STATIC,
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
 * 样式资源定义
 */
export const script = {
  // 工程搜索脚本
  search: {
    path: 'searchProjects.js',
    location: ResourceLocation.WEB,
  },
};

/**
 * 芯片资源定义
 */
export const chip = {
  // 芯片JSON配置
  config: {
    path: 'chips/',
    location: ResourceLocation.STATIC,
  },
  // debug
  debugFile: {
    path: 'debug/',
    location: ResourceLocation.STATIC,
  },
  // connect
  connectFile: {
    path: 'connect/',
    location: ResourceLocation.STATIC,
  },
};
