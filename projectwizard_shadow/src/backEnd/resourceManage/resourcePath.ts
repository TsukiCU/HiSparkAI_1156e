/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
export enum ResourceLocation {
  STATIC = 'STATIC',
  WEB    = 'WEB',
}

export type ResourceObject = {
  path: string;
  location: ResourceLocation;
};

export const BASE_PATHS = {
  STATIC: 'resources',
  WEB:    'dist',
};

export const html = {
  index: { path: 'index.html', location: ResourceLocation.WEB },
};

export const icon = {
  newProjectLight:    { path: 'icons/newProject.svg',         location: ResourceLocation.STATIC },
  newProjectDark:     { path: 'icons/newProject.svg',         location: ResourceLocation.STATIC },
  importProjectLight: { path: 'icons/importProject.svg',      location: ResourceLocation.STATIC },
  importProjectDark:  { path: 'icons/importProject.svg',      location: ResourceLocation.STATIC },
};
