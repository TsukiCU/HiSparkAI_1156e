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
// Warning subitems.
const warningSubitems: Array<string> = ['wno_unused_function', 'wno_unused_label', 'wno_unused_parameter', 'wno_unused_variable', 'wno_missing_prototypes'];

// armGccUnsupportedCompilationOptions
const armGccUnsupportedCompilationOptions: Array<string> = 
[
    'generate_crc', 'generate_checksum', 'generate_symboltable', 'generate_allinone_bin', 
    'parse_elf_for_livewatch', 'enable_perf', 'padding', 'optimization', 
    'fstack_protector_strong', 'static_library_enable', 'static_library_import', 'static_library_name', 
    'static_library_source_file', 'static_library_path', 'static_library_dependency_header_file', 
    'extern_staticlib_path', 'extern_staticlib_include', 'burned_file_name',
];

const fbbUnsupportedCompilationOptions: Array<string> = [
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
    'static_library_name',
    'static_library_source_file',
    'static_library_dependency_header_file',
    'extern_staticlib_path',
    'extern_staticlib_include',
    'global_macro_definition',
    'burned_file_name',
    'execute_before_build',
    'execute_after_build',
];
// static library enable subitems.
const staticLibraryEnableSubitems: Array<string> = ['static_library_name', 'static_library_source_file', 'static_library_dependency_header_file'];

// tool subitems.
const toolSubitems: Array<string> = ['debug_port'];

// openocd subitems.
const openocdSubitems: Array<string> = ['interface', 'port', 'speed'];

// only jlink subitems.
const jlinkSubitems: Array<string> = ['jlinkServerPath', 'jlinkScriptPath'];

// when debug tool is null, the subitems.
const debugaToolNullSubitems: Array<string> = ['elf_path', 'client', 'tool', 'timeout'];

// when upload transmission mode is null, the subitems.
const uploadTransModeNullSubitems: Array<string> = ['protocol', 'bin_path', 'reset', 'burn_verification'];

const WARNING = 'warning';
const TOOL = 'tool';
const QEMU = 'qemu';
const PROTOCOL = 'protocol';
const SERIAL = 'serial';
const USB = 'usb';
const JTAG = 'jtag';
const SWD = 'swd';
const I2C = 'i2c';
const JLINK = 'jlink';
const INFORMATION = 'information';
const COMPILE = 'compile';
const DEBUG = 'debug';
const UPLOAD = 'upload';
const PORT = 'port';
const MULTICORE = 'multicore';
const STATICLIBRARYENABLE = 'static_library_enable';
const STATICLIBRARYIMPORT = 'static_library_import';
const STATICLIBRARYPATH = 'static_library_path';

export {
    warningSubitems,
    staticLibraryEnableSubitems,
    toolSubitems,
    openocdSubitems,
    jlinkSubitems,
    debugaToolNullSubitems,
    uploadTransModeNullSubitems,
    WARNING,
    TOOL,
    QEMU,
    PROTOCOL,
    SERIAL,
    JTAG,
    SWD,
    I2C,
    USB,
    JLINK,
    INFORMATION,
    COMPILE,
    DEBUG,
    UPLOAD,
    PORT,
    MULTICORE,
    STATICLIBRARYENABLE,
    STATICLIBRARYIMPORT,
    STATICLIBRARYPATH,
    armGccUnsupportedCompilationOptions,
    fbbUnsupportedCompilationOptions,
};