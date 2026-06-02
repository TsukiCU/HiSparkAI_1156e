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

import * as path from 'path';
import { 
  ResourceLocation, ResourceObject, BASE_PATHS
} from './resourcePath';

/**
 * 欢迎页资源管理器
 * 统一管理不同位置的资源
 */
export class ResourceManager {
  private static instance: ResourceManager;
  private isCustomIDE: boolean = true;
  private customStaticPath: string = '';
  private customWebPath: string = '';
  private contextPath: string = '';

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): ResourceManager {
    if (!ResourceManager.instance) {
      ResourceManager.instance = new ResourceManager();
    }
    return ResourceManager.instance;
  }

  /**
   * 设置运行模式
   * @param contextPath 基础上下文路径
   * @param isCustomIDE 是否在自定义IDE中运行
   * @param customStaticPath 自定义静态资源路径(svg,png等)，不传则使用默认值
   * @param customWebPath 自定义网页资源路径(html等)，不传则使用默认值
   */
  public setConfig(
    contextPath: string,
    isCustomIDE: boolean = true, 
    customStaticPath?: string,
    customWebPath?: string
  ): void {
    this.contextPath = contextPath;
    this.isCustomIDE = isCustomIDE;
    
    if (!isCustomIDE) {
      // 使用传入的自定义路径，如果没传则使用默认配置
      this.customStaticPath = customStaticPath ?? BASE_PATHS.CUSTOM_STATIC;
      this.customWebPath = customWebPath ?? BASE_PATHS.CUSTOM_WEB;
    }
  }

  /**
   * 获取基础资源路径(根据资源位置)
   * @param location 资源位置
   */
  public getBasePath(location: ResourceLocation): string {
    if (this.isCustomIDE) {
      return path.join(
        this.contextPath,
        location === ResourceLocation.STATIC ? 
          BASE_PATHS.STATIC : 
          BASE_PATHS.WEB
      );
    } else {
      return path.join(
        this.contextPath,
        location === ResourceLocation.STATIC ? 
          this.customStaticPath : 
          this.customWebPath
      );
    }
  }

  /**
   * 获取资源的完整路径 - 简化版，不处理变量替换
   * @param resource 资源对象
   */
  public getResourcePath(resource: ResourceObject): string {
    return path.join(
      this.getBasePath(resource.location),
      resource.path
    );
  }
}

// 导出便捷访问函数
export const getResource = {
  /**
   * 统一的资源获取方法 - 支持IDE自动补全和Ctrl+点击跳转
   * @param resource 资源对象
   */
  get: (resource: ResourceObject): string => 
    ResourceManager.getInstance().getResourcePath(resource),

  /**
   * 设置资源管理器配置
   * @param contextPath 插件上下文路径
   * @param isCustomIDE 是否在自定义IDE中运行
   * @param customStaticPath 自定义静态资源路径，不传则使用默认值
   * @param customWebPath 自定义网页资源路径，不传则使用默认值
   */
  setConfig: (
    contextPath: string,
    isCustomIDE: boolean = true, 
    customStaticPath?: string,
    customWebPath?: string
  ): void => ResourceManager.getInstance().setConfig(
    contextPath, isCustomIDE, customStaticPath, customWebPath
  )
};