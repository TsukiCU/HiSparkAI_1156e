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

// eslint-disable-next-line header/header
declare module '*.mp4' {
  const src: string;
  export default src;
}

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.svg' {
  const content: string;
  export default content;
}
declare module 'ini';
declare module 'archiver' {
  import type * as stream from 'stream';

  interface Archiver extends stream.Transform {
    append: (data: any, options: any) => Archiver;
    finalize: () => Promise<void>;
  }

  function create(): Archiver;
  namespace create {
    function zip(): Archiver;
  }

  export = create;
}