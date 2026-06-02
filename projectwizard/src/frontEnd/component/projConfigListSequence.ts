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
import type { GroupConfigItem } from '../../backEnd/interface/model';

// List of configuration items that are displayed regardless of whether the corresponding field exists in the description file.
const sort: any = {
  information: [
    'series_name',
    'board',
    'sdk_path',
    'target',
  ],
  compile: [
    'tool_chain',
    'link_c_library_in_toolchain',
    'link_c_library_in_compilationchain',
    'compile_type',
    'constant_type',
    'generate_crc',
    'generate_checksum',
    'generate_symboltable',
    'generate_allinone_bin',
    'generate_target_hex',
    'parse_elf_for_livewatch',
    'enable_perf',
    'enable_build_problem',
    'parse_analysis_json',
    'add_nhso_build_parameter',
    'padding',
    'optimization',
    'fstack_protector_strong',
    'werror',
    'werr_implicit_func',
    'warning',
    'wno_unused_function',
    'wno_unused_label',
    'wno_unused_parameter',
    'wno_unused_variable',
    'wno_missing_prototypes',
    'static_library_enable',
    'static_library_import',
    'static_library_name',
    'static_library_source_file',
    'static_library_path',
    'static_library_dependency_header_file',
    'extern_staticlib_path',
    'extern_staticlib_include',
    'global_macro_definition',
    'burned_file_name',
    'execute_before_build',
    'execute_after_build',
  ],
  debug: [
    'multicore',
    'elf_path',
    'client',
    'tool',
    'jlinkServerPath',
    'jlinkScriptPath',
    'interface',
    'speed',
    'port',
    'timeout',
  ],
  upload: [
    'protocol',
    'bin_path',
    'port',
    'baud',
    'debug_board',
    'frequency',
    'usb_device_list',
    'reset',
    'burn_verification',
  ],
};

const compileAnchorList = {
  compile: [
    'isCompile',
    'optimization',
    'werror',
    'werr_implicit_func',
    'warning',
    'wno_unused_function',
    'wno_unused_label',
    'wno_unused_parameter',
    'wno_unused_variable',
    'wno_burned_file',
    'wno_missing_prototypes',
  ],
};

const listSort = (dataSource: any, type: string): any => {
  let children: GroupConfigItem[] = [];
  const sortList = Object.assign({}, sort);
  for (let i = 0; i < sortList[type].length; i++) {
    for (const key of Object.keys(dataSource)) {
      if (dataSource[key]?.name === sortList[type][i]) {
        children.push(dataSource[key]);
      }
    }
  }
  return children;
};

export {
  sort as allAnchorList,
  listSort,
  compileAnchorList,
};
