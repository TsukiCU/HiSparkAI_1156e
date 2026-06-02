/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
import * as path from 'path';
import { ResourceLocation, ResourceObject, BASE_PATHS } from './resourcePath';

class ResourceManager {
  private static instance: ResourceManager;
  private contextPath: string = '';

  private constructor() {}

  public static getInstance(): ResourceManager {
    if (!ResourceManager.instance) {
      ResourceManager.instance = new ResourceManager();
    }
    return ResourceManager.instance;
  }

  public setConfig(contextPath: string): void {
    this.contextPath = contextPath;
  }

  public getResourcePath(resource: ResourceObject): string {
    const base = resource.location === ResourceLocation.STATIC ? BASE_PATHS.STATIC : BASE_PATHS.WEB;
    return path.join(this.contextPath, base, resource.path);
  }
}

export const getResource = {
  get: (resource: ResourceObject): string =>
    ResourceManager.getInstance().getResourcePath(resource),
  setConfig: (contextPath: string): void =>
    ResourceManager.getInstance().setConfig(contextPath),
};
