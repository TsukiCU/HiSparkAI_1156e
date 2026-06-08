export type ChipName = 'ws63' | '3322' | '1156e' | 'NONE';

export interface ChipConfig {
  fwpkgRelPath: string;
  buildTarget: string;
  scriptDir: string;
  remotePython: string;
  remoteBuildDir?: string; // Remote directory for build (relative to hisparkai root)
}

export const CHIP_CONFIG: Record<string, ChipConfig> = {
  'ws63': {
    fwpkgRelPath: 'output/ws63/fwpkg/ws63-liteos-app/ws63-liteos-app_all.fwpkg',
    buildTarget: 'ws63-liteos-app',
    scriptDir: 'cpu',
    remotePython: '/usr/bin/python3.11',
  },
  '3322': {
    fwpkgRelPath: 'output/3322/fwpkg/3322-wstp-app.fwpkg',
    buildTarget: 'pack_3322_wstp',
    scriptDir: 'npu',
    remotePython: '/usr/bin/python3.10',
  },
  '1156e': {
    fwpkgRelPath: 'output/1156e/tiangong2_cmcc_hgu_release.fwpkg',
    buildTarget: 'build_mkp',
    scriptDir: '',
    remotePython: '',
    remoteBuildDir: 'HiSmart/sample',
  },
};
