export type ChipName = 'ws63' | '3322' | '1156e' | 'diting' | 'NONE';

export interface ChipConfig {
  fwpkgRelPath: string;
  buildTarget: string;
  scriptDir: string;
  remotePython: string;
  remoteBuildDir?: string;
  // Script-level platform identifiers per compute target (e.g. 'riscv', 'nano', 'arm', 'tiny').
  // Named `platforms` (plural) to distinguish from the wizard's NPU/CPU "Platform" concept.
  platforms: Partial<Record<'CPU' | 'NPU', string>>;
}

export const CHIP_CONFIG = {
  chipWS63: {
    fwpkgRelPath: 'output/ws63/fwpkg/ws63-liteos-app/ws63-liteos-app_all.fwpkg',
    buildTarget: 'ws63-liteos-app',
    scriptDir: 'cpu',
    remotePython: '/usr/bin/python3.11',
    platforms: { CPU: 'riscv' },
  },
  chip3322: {
    fwpkgRelPath: 'output/3322/fwpkg/3322-wstp-app.fwpkg',
    buildTarget: 'pack_3322_wstp',
    scriptDir: 'npu',
    remotePython: '/usr/bin/python3.10',
    platforms: { NPU: 'nano' },
  },
  chipDiting: {
    fwpkgRelPath: 'output/3322/fwpkg/diting-community.fwpkg',
    buildTarget: 'pack_diting_community',
    scriptDir: 'npu',
    remotePython: '/usr/bin/python3.10',
    platforms: { NPU: 'nano' },
  },
  chip1156e: {
    fwpkgRelPath: 'output/tiangong2_cmcc_hgu_release/images/tiangong2_cmcc_hgu_release.fwpkg',
    buildTarget: 'build_mkp',
    scriptDir: '',
    remotePython: '',
    remoteBuildDir: 'HiSmart/sample',
    platforms: { CPU: 'arm', NPU: 'tiny' },
  },
} satisfies Record<string, ChipConfig>;

/**
 * Look up ChipConfig by the runtime chip-name string ('ws63', '3322', '1156e', 'diting').
 * Returns undefined for unknown names (e.g. 'NONE').
 */
export function getChipConfig(chipName: string): ChipConfig | undefined {
  const map: Record<string, keyof typeof CHIP_CONFIG> = {
    ws63:   'chipWS63',
    '3322': 'chip3322',
    '1156e': 'chip1156e',
    diting: 'chipDiting',
  };
  const key = map[chipName];
  return key ? CHIP_CONFIG[key] : undefined;
}
