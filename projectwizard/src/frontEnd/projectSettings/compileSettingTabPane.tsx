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
import React, { useEffect, useState } from 'react';
import { Select, Input, Checkbox, Tooltip, Tag, Button } from 'antd';
import type { OperateStruct, SaveIniStruct } from '../../backEnd/interface/model';
import { useDispatch, useSelector } from 'react-redux';
import { getInfo, save2Ini, handleFactory } from '../actions';
import { useTranslation } from 'react-i18next';
import { FolderOpenOutlined } from '@ant-design/icons';
import SelectFolderAndFile from './compileTool/selectFolderAndFile';
import SelectFolderAndExtern from './compileTool/selectFolderAndExtern';
import Title from './title';
import { setDocumentById } from './setDocumentById';
import MacroDefTable from './compileTool/macroDefTable';
import SelectFile from './compileTool/selectFile';

export const addGenerateAllinoneBin = ['3065HRPIRZ', '3061HRPIKZ', '3065HRPICZ', 'AU302PDF51', 'AU302NDF51', 'AU301LDF51'];
const COMMAND_NUM = 2; // Number of commands that can be executed before and after compilation.
const PERF_MACRO = 'MEASURE_SUPPORT';

const CompilerInfoTabPane = (props: any): JSX.Element => {
  const group = props?.group;
  const { Option } = Select;
  const { t } = useTranslation();
  const [isInitialized, setIsInitialized] = useState(false);
  const compileIni = props.path && props.independentConfig !== null ? props.independentConfig : props?.compileInfo?.compile;
  const [compileType, setCompileType] = useState<string>(compileIni?.compile_type);
  const [constantType, setConstantType] = useState<string>(compileIni?.constant_type);
  const [toolChain, setToolChain] = useState<string>(compileIni?.tool_chain);
  let [toolChains, setToolChains] = useState<Array<string>>([]);
  const [optimization, setOptimization] = useState<string>(compileIni?.optimization);
  const jsonData: any = useSelector((state: any) => state.entities.jsonData);
  const {presentTarget} = props;

  const yesOrNo2Boolean = (value: string): boolean => {
    return value === 'yes' ? true : false;
  };
  const yesOrNo2BooleanUndefinedYes = (value: string): boolean => {
    if (value === undefined) {
      return true;
    }
    return value === 'yes' ? true : false;
  };
  // FBB不支持配置某些编译选项
  const isFbb = props?.compileInfo?.information?.project_type?.includes('CFBB') ? true : false;
  // 3321和3322需要增加一个编译选项
  const isAddParameter = (props?.compileInfo?.information?.board?.includes('3322') || props?.compileInfo?.information?.board?.includes('brandy')) ? true : false;
  // 3071不支持配置某些编译选项
  const isGccArmOrNot = props?.compileInfo?.information?.board?.includes('3071') ? true : false;
  // 3066M因为有挖空区域,因此不支持镜像填充
  const hasPadding = props?.compileInfo?.information?.series_name?.includes('3066m') ? false : true;
  const [isCompile, setIsCompile] = useState<boolean>(compileIni?.isCompile !== void 0 ? compileIni.isCompile : true);
  const [linkCToolChain, setLinkCToolChain] = useState<boolean>(yesOrNo2BooleanUndefinedYes(compileIni?.link_c_library_in_toolchain));
  const [linkCCompilationChain, setLinkCCompilationChain] = useState<boolean>(yesOrNo2BooleanUndefinedYes(compileIni?.link_c_library_in_compilationchain));
  const [warning, setWarning] = useState<boolean>(yesOrNo2Boolean(compileIni?.warning));
  const [werror, setWerror] = useState<boolean>(yesOrNo2Boolean(compileIni?.werror));
  const [unusedFunction, setUnusedFunction] = useState<boolean>(yesOrNo2Boolean(compileIni?.wno_unused_function));
  const [unusedLabel, setUnusedLabel] = useState<boolean>(yesOrNo2Boolean(compileIni?.wno_unused_label));
  const [unusedParameter, setUnusedParameter] = useState<boolean>(yesOrNo2Boolean(compileIni?.wno_unused_parameter));
  const [unusedVariable, setUnusedVariable] = useState<boolean>(yesOrNo2Boolean(compileIni?.wno_unused_variable));
  const [missingPrototypes, setMissingPrototypes] = useState<boolean>(yesOrNo2Boolean(compileIni?.wno_missing_prototypes));
  const [werrImplicitFunc, setWerrImplicitFunc] = useState<boolean>(yesOrNo2Boolean(compileIni?.werr_implicit_func));
  const [stackProtector, setStackProtector] = useState<boolean>(yesOrNo2Boolean(compileIni?.fstack_protector_strong));
  const [staticLibEnable, setStaticLibEnable] = useState<boolean>(yesOrNo2Boolean(compileIni?.static_library_enable));
  const [staticLibImport, setStaticLibImport] = useState<boolean>(yesOrNo2Boolean(compileIni?.static_library_import));
  const [generateCrcEnable, setGenerateCrcEnable] = useState<boolean>(yesOrNo2Boolean(compileIni?.generate_crc));
  const [generateChecksumEnable, setGenerateChecksumEnable] = useState<boolean>(yesOrNo2Boolean(compileIni?.generate_checksum));
  const [generateSymboltableEnable, setGenerateSymboltableEnable] = useState<boolean>(yesOrNo2Boolean(compileIni?.generate_symboltable));
  const [generateAllinoneBinEnable, setGenerateAllinoneBinEnable] = useState<boolean>(yesOrNo2BooleanUndefinedYes(compileIni?.generate_allinone_bin));
  const [generateTargetHexEnable, setGenerateTargetHexEnable] = useState<boolean>(yesOrNo2BooleanUndefinedYes(compileIni?.generate_target_hex));
  const [generateLivewatchElfEnable, setGenerateLivewatchElfEnable] = useState<boolean>(yesOrNo2BooleanUndefinedYes(compileIni?.parse_elf_for_livewatch));
  const [generatePerfEnable, setGeneratePerfEnable] = useState<boolean>(yesOrNo2BooleanUndefinedYes(compileIni?.enable_perf));
  const [generateBuildProblemEnable, setGenerateBuildProblemEnable] = useState<boolean>(yesOrNo2BooleanUndefinedYes(compileIni?.enable_build_problem));
  const [generateAnalysisJsonEnable, setGenerateAnalysisJsonEnable] = useState<boolean>(yesOrNo2BooleanUndefinedYes(compileIni?.parse_analysis_json));
  const [generateAddnhsoParameter, setGenerateAddnhsoParameter] = useState<boolean>(yesOrNo2BooleanUndefinedYes(compileIni?.add_nhso_build_parameter));
  const [padding, setPadding] = useState<boolean>(compileIni?.padding);
  const [staticLibnName, setStaticLibnName] = useState<string>(compileIni?.static_library_name);
  const [staticLibHeader, setStaticLibHeader] = useState<string>(compileIni?.static_library_dependency_header_file);
  const [staticLibSource, setStaticLibSource] = useState<string>(compileIni?.static_library_source_file);
  const [staticLibPath, setStaticLibPath] = useState<string>(compileIni?.static_library_path);
  const [externStaticlibPath, setExternStaticlibPath] = useState<string>(compileIni?.extern_staticlib_path);
  const [externStaticlibInclude, setExternStaticlibInclude] = useState<string>(compileIni?.extern_staticlib_include);
  const [globalMacroDef, setGlobalMacroDef] = useState<string>(compileIni?.global_macro_definition);
  const [unusedBurnedFile, setUnusedBurnedFile] = useState<boolean>(yesOrNo2Boolean(compileIni?.wno_burned_file));
  const [burnedFileName, setBurnedFileName] = useState<string>(compileIni?.burned_file_name);
 
  const [staticLibPathFolderAndFileModalFlag, setStaticLibPathFolderAndFileModalFlag] = useState<boolean>(false);
  const [sourceFolderAndFileModalFlag, setSourceFolderAndFileModalFlag] = useState<boolean>(false);
  const [headerFolderAndFileModalFlag, setHeaderFolderAndFileModalFlag] = useState<boolean>(false);
  const [externAndPathModalFlag, setExternAndPathModalFlag] = useState<boolean>(false);
  const [externAndIncludeModalFlag, setExternAndIncludeModalFlag] = useState<boolean>(false);
  const [executeBeforeBuild, setExecuteBeforeBuild] = useState<string>(compileIni?.execute_before_build);
  const [executeAfterBuild, setExecuteAfterBuild] = useState<string>(compileIni?.execute_after_build);
  const dispatch = useDispatch();
  const chip: any = useSelector((state: any) => state.entities.chipConfig);

  const saveParams: SaveIniStruct = {
    operationType: 'save2Ini',
    data: '',
  };

  const operateData: OperateStruct = {
    operationType: '',
    paramData: '',
    source: 'setting',
  };

  useEffect(() => {
    operateData.operationType = 'getJsonInfo';
    operateData.paramData = {
      fileName: props?.compileInfo?.information?.json_path,
      sdkPath: props?.compileInfo?.information?.sdk_path,
    };
    dispatch(getInfo(operateData));
  }, [dispatch]);

  useEffect(() => {
    if (chip?.upload) {
      toolChains = [];
      setToolChains(toolChains);
      toolChains.push(...chip?.compile?.tool_chain);
    }
  }, [chip]);

  const getExecuteArr = (executeStr: string): Array<any> => {
    let arr = Array.from({ length: COMMAND_NUM }, () => ({}));
    if (executeStr) {
      try {
        arr = JSON.parse(executeStr);
      } catch {
        // skip.
      }
    }
    return arr;
  };

  const boolean2YesOrNo = (value: boolean): string => {
    return value ? 'yes' : 'no';
  };

  const saveFormData = (): void => {
    const data: any = {
      section: 'compile',
      path: props.path,
      params: {
        compile_type: compileType,
        constant_type: constantType,
        link_c_library_in_toolchain: boolean2YesOrNo(linkCToolChain),
        link_c_library_in_compilationchain: boolean2YesOrNo(linkCCompilationChain),
        tool_chain: toolChain,
        optimization: optimization,
        warning: boolean2YesOrNo(warning),
        werror: boolean2YesOrNo(werror),
        wno_unused_function: boolean2YesOrNo(unusedFunction),
        wno_unused_label: boolean2YesOrNo(unusedLabel),
        wno_unused_parameter: boolean2YesOrNo(unusedParameter),
        wno_unused_variable: boolean2YesOrNo(unusedVariable),
        fstack_protector_strong: boolean2YesOrNo(stackProtector),
        wno_missing_prototypes: boolean2YesOrNo(missingPrototypes),
        werr_implicit_func: boolean2YesOrNo(werrImplicitFunc),
        generate_crc: boolean2YesOrNo(generateCrcEnable),
        generate_checksum: boolean2YesOrNo(generateChecksumEnable),
        generate_symboltable: boolean2YesOrNo(generateSymboltableEnable),
        generate_target_hex: boolean2YesOrNo(generateTargetHexEnable),
        parse_elf_for_livewatch: boolean2YesOrNo(generateLivewatchElfEnable),
        enable_perf: boolean2YesOrNo(generatePerfEnable),
        enable_build_problem: boolean2YesOrNo(generateBuildProblemEnable),
        parse_analysis_json: boolean2YesOrNo(generateAnalysisJsonEnable),
        add_nhso_build_parameter: boolean2YesOrNo(generateAddnhsoParameter),
        padding: padding,
        static_library_enable: boolean2YesOrNo(staticLibEnable),
        static_library_import: boolean2YesOrNo(staticLibImport),
        static_library_name: staticLibnName,
        wno_burned_file: boolean2YesOrNo(unusedBurnedFile),
        burned_file_name: burnedFileName,
        static_library_dependency_header_file: staticLibHeader,
        static_library_source_file: staticLibSource,
        extern_staticlib_path: externStaticlibPath,
        static_library_path: staticLibPath,
        extern_staticlib_include: externStaticlibInclude,
        global_macro_definition: globalMacroDef,
        execute_before_build: executeBeforeBuild,
        execute_after_build: executeAfterBuild,
      },
    };
    // FBB:读取最新更新的target的值后匹配json文件中的build_argv，如果不存在target直接读取json中的custom_build_command
    // MCU:不用全局宏定义功能，且编译不需要用到custom_build_command
    let buildCommand;
    if (presentTarget && jsonData?.target) {
      for (const versionValue of Object.values(jsonData.target)) {
        for (const [targetKey, targetValue] of Object.entries(versionValue as { [key: string]: any })) {
          if (targetKey === presentTarget) {
            buildCommand = targetValue.cmake?.build?.build_argv;
          }
        }
      }
    } else {
      buildCommand = jsonData?.compile?.custom_build_command;
    }
    if (globalMacroDef) {
      const globalMacroDefObj: { [key: string]: string } = JSON.parse(globalMacroDef);
      if (props?.compileInfo?.information?.series_name === 'cfbb' ) {
        const extractedParams: string[] = Object.keys(globalMacroDefObj).map(key => {
          if (globalMacroDefObj[key] !== '') {
            return `-d ${key}=${globalMacroDefObj[key]}`;
          } else {
            return `-d ${key}`;
          }
        });
        data.params.custom_build_command = `${buildCommand} ${extractedParams.join(' ')}`.trim();
      }
    } else {
      data.params.custom_build_command = `${buildCommand}`.trim();
    }

    if (props.path) {
      data.params.isCompile = isCompile;
    }
    if (isDisplayAllinoneCheckbox()) {
      data.params.generate_allinone_bin = boolean2YesOrNo(generateAllinoneBinEnable);
    }
    saveParams.data = data;
    props.updateConfigInfo(data);
    dispatch(save2Ini(saveParams));
  };

  useEffect(() => {
    if (isInitialized) {
      saveFormData();
    } else {
      setIsInitialized(true);
    }
  }, [compileType, toolChain, optimization, warning, werror, unusedFunction,
    unusedLabel, unusedParameter, unusedVariable, stackProtector, staticLibEnable, staticLibnName,
    staticLibHeader, staticLibSource, generateCrcEnable, globalMacroDef, isCompile, werrImplicitFunc,
    generateChecksumEnable, generateSymboltableEnable, padding, externStaticlibPath, externStaticlibInclude, missingPrototypes,
    generateAllinoneBinEnable, generateTargetHexEnable, generateLivewatchElfEnable, generateAnalysisJsonEnable, generateBuildProblemEnable, 
    generateAddnhsoParameter, linkCToolChain, linkCCompilationChain, constantType, executeBeforeBuild, burnedFileName,
    unusedBurnedFile, executeAfterBuild, generatePerfEnable, staticLibImport, staticLibPath,
  ]);

  useEffect(() => {
    operateData.operationType = 'setStaticLibParam';
    operateData.paramData = {
      fileName: staticLibImport,
      sdkPath: staticLibPath,
    };
    dispatch(getInfo(operateData));
  }, [staticLibImport, staticLibPath]);

  useEffect(() => {
    const globalMacroDefObj = JSON.parse(globalMacroDef || '{}');
    if (PERF_MACRO in globalMacroDefObj) {
      setGeneratePerfEnable(true);
    } else {
      setGeneratePerfEnable(false);
    }
  }, [globalMacroDef]);
  const changeExecute = (index: number, key: string, value: string | boolean, type: 'before' | 'after'): void => {
    const arr = getExecuteArr(type === 'before' ? executeBeforeBuild : executeAfterBuild);
    if (!arr[index]) {
      arr[index] = {};
    }
    arr[index][key] = value;
    if (type === 'before') {
      setExecuteBeforeBuild(JSON.stringify(arr));
    } else {
      setExecuteAfterBuild(JSON.stringify(arr));
    }
  };

  const warnSetting = (): JSX.Element => {
    return <>
      {!props.path && !isFbb && !isGccArmOrNot && <div className='config-card' id={setDocumentById(group, 'fstack_protector_strong')}>
        <Title name='' description='' />
        <Checkbox className='ant-modal-title width100' style={{ fontSize: 15 }}
          defaultChecked={stackProtector} onChange={(e): void => {
            setStackProtector(e.target.checked);
          }}>{t('fstack_protector_strong')}</Checkbox>
      </div>}
      {!isFbb && 
      <div className='config-card' id={setDocumentById(group, 'werror')}>
        <Title name='' description='' />
        <Checkbox className='ant-modal-title width100' style={{ fontSize: 15 }}
          defaultChecked={werror}
          onChange={(e): void => {
            setWerror(e.target.checked);
          }}>{t('werror')}</Checkbox>
      </div>}
      {!isFbb && 
      <div className='config-card' id={setDocumentById('warning', 'werr_implicit_func')}>
        <Title name='' description='' />
        <Checkbox className='ant-modal-title width100' style={{ fontSize: 15 }}
          defaultChecked={werrImplicitFunc} onChange={(e): void => {
            setWerrImplicitFunc(e.target.checked);
          }}>{t('werr_implicit_func')}</Checkbox>
      </div>}
      {!isFbb && 
      <div className='config-card' id={setDocumentById(group, 'warning')}>
        <Title name='' description='' />
        <Checkbox className='ant-modal-title width100' style={{ fontSize: 15 }}
          defaultChecked={warning} onChange={(e): void => {
            setWarning(e.target.checked);
          }}
        >
          {t('warning')}
        </Checkbox>
      </div>}
      {!isFbb && 
      <div className='config-card' id={setDocumentById('warning', 'wno_unused_function')}>
        <Title name='' description='' />
        <Checkbox className='ant-modal-title width100' style={{ fontSize: 15 }}
          defaultChecked={unusedFunction} onChange={(e): void => {
            setUnusedFunction(e.target.checked);
          }}>{t('title_unused_function')}</Checkbox>
      </div>}
      {!isFbb && 
      <div className='config-card' id={setDocumentById('warning', 'wno_unused_label')}>
        <Title name='' description='' />
        <Checkbox className='ant-modal-title width100' style={{ fontSize: 15 }}
          defaultChecked={unusedLabel} onChange={(e): void => {
            setUnusedLabel(e.target.checked);
          }}>{t('title_unused_label')}</Checkbox>
      </div>}
      {!isFbb && 
      <div className='config-card' id={setDocumentById('warning', 'wno_unused_parameter')}>
        <Title name='' description='' />
        <Checkbox className='ant-modal-title width100' style={{ fontSize: 15 }}
          defaultChecked={unusedParameter} onChange={(e): void => {
            setUnusedParameter(e.target.checked);
          }}>{t('title_unused_parameter')}</Checkbox>
      </div>}
      {!isFbb && 
      <div className='config-card' id={setDocumentById('warning', 'wno_unused_variable')}>
        <Title name='' description='' />
        <Checkbox className='ant-modal-title width100' style={{ fontSize: 15 }}
          defaultChecked={unusedVariable} onChange={(e): void => {
            setUnusedVariable(e.target.checked);
          }}>{t('title_unused_variable')}</Checkbox>
      </div>}
      {!isFbb && 
      <div className='config-card' id={setDocumentById('warning', 'wno_missing_prototypes')}>
        <Title name='' description='' />
        <Checkbox className='ant-modal-title width100' style={{ fontSize: 15 }}
          defaultChecked={missingPrototypes} onChange={(e): void => {
            setMissingPrototypes(e.target.checked);
          }}>{t('title_missing_prototypes')}</Checkbox>
      </div>}
    </>;
  };

  const staticLibSetting = (): JSX.Element => {
    // return !staticLibEnable ? null : <>
    return <>
      {!isFbb && 
      <div className='config-card' id={setDocumentById('static_library_enable', 'static_library_name')}>
        <Title name={t('static_library_name')} description='' />
        <Input className='ant-input-text width100' defaultValue={staticLibnName} onBlur={(e): void => {
          setStaticLibnName(e.target.value);
        }} />
      </div>}
      {!isFbb && 
      <div className='config-card' id={setDocumentById('static_library_enable', 'static_library_source_file')}>
        <Title name={t('static_library_source_file')} description='' />
        <div className='select-container'>
          <div className='folder-tag-lists'>
            {staticLibSource ? staticLibSource.split(',').map((item: string) => {
              return (
                <Tooltip title={item} key={item}>
                  <Tag key={item} closable onClose={(): void => {
                    setStaticLibSource(staticLibSource.split(',').filter(ele => ele !== item).join(','));
                  }}>
                    <span className='file-name-item'>{item}</span>
                  </Tag>
                </Tooltip>
              );
            }) : null}
          </div>
          <FolderOpenOutlined
            style={{ color: '#fff' }}
            className='folder-icon-style'
            title={t('browse') ?? 'Browse'}
            onClick={(): void => setSourceFolderAndFileModalFlag(true)}
          />
        </div>
      </div>}
      {!isFbb && 
      <div className='config-card' id={setDocumentById('static_library_enable', 'static_library_dependency_header_file')}>
        <Title name={t('static_library_dependency_header_file')} description='' />
        <div className='select-container'>
          <div className='folder-tag-lists'>
            {staticLibHeader ? staticLibHeader.split(',').map((item: string) => {
              return (
                <Tooltip title={item} key={item}>
                  <Tag key={item} closable onClose={(): void => {
                    setStaticLibHeader(staticLibHeader.split(',').filter(ele => ele !== item).join(','));
                  }}>
                    <span className='file-name-item'>{item}</span>
                  </Tag>
                </Tooltip>
              );
            }) : null}
          </div>
          <FolderOpenOutlined
            style={{ color: '#fff' }}
            className='folder-icon-style'
            title={t('browse') ?? 'Browse'}
            onClick={(): void => setHeaderFolderAndFileModalFlag(true)}
          />
        </div>
      </div>}
      {!isFbb && 
      <div className='config-card' id={setDocumentById(group, 'extern_staticlib_path')}>
        <Title name={t('extern_staticlib_path')} description='' />
        <div className='select-container'>
          <div className='folder-tag-lists'>
            {externStaticlibPath ? externStaticlibPath.split(',').map((item: string) => {
              return (
                <Tooltip title={item} key={item}>
                  <Tag key={item} closable onClose={(): void => {
                    setExternStaticlibPath(externStaticlibPath.split(',').filter(ele => ele !== item).join(','));
                  }}>
                    <span className='file-name-item'>{item}</span>
                  </Tag>
                </Tooltip>
              );
            }) : null}
          </div>
          <FolderOpenOutlined
            style={{ color: '#fff' }}
            className='folder-icon-style'
            title={t('browse') ?? 'Browse'}
            onClick={(): void => setExternAndPathModalFlag(true)}
          />
        </div>
      </div>}
      {!isFbb && 
      <div className='config-card' id={setDocumentById(group, 'extern_staticlib_include')}>
        <Title name={t('extern_staticlib_include')} description='' />
        <div className='select-container'>
          <div className='folder-tag-lists'>
            {externStaticlibInclude ? externStaticlibInclude.split(',').map((item: string) => {
              return (
                <Tooltip title={item} key={item}>
                  <Tag key={item} closable onClose={(): void => {
                    setExternStaticlibInclude(externStaticlibInclude.split(',').filter(ele => ele !== item).join(','));
                  }}>
                    <span className='file-name-item'>{item}</span>
                  </Tag>
                </Tooltip>
              );
            }) : null}
          </div>
          <FolderOpenOutlined
            style={{ color: '#fff' }}
            className='folder-icon-style'
            title={t('browse') ?? 'Browse'}
            onClick={(): void => setExternAndIncludeModalFlag(true)}
          />
        </div>
      </div>}
    </>;
  };

  const isDisplayAllinoneCheckbox = (): boolean => {
    return props?.compileInfo?.information &&
      addGenerateAllinoneBin.includes(props?.compileInfo?.information['board_build.mcu']);
  };
  // 修改编译宏开关
  const changeMacro = (newState: boolean) => {
    if (globalMacroDef) {
      const globalMacroDefObj: { [key: string]: string } = JSON.parse(globalMacroDef);

      if (newState) {
        // 检查是否包含 "MEASURE_SUPPORT" 且值为空字符串
        if (!(PERF_MACRO in globalMacroDefObj)) {
          // 如果不包含，添加 {"MEASURE_SUPPORT": ''}
          globalMacroDefObj[PERF_MACRO] = '';
          setGlobalMacroDef(JSON.stringify(globalMacroDefObj));
        }
      } else {
        // 检查是否包含 "MEASURE_SUPPORT" 且值为空字符串
        if (PERF_MACRO in globalMacroDefObj && globalMacroDefObj[PERF_MACRO] === '') {
          // 如果包含，删除 "MEASURE_SUPPORT"
          delete globalMacroDefObj[PERF_MACRO];
          setGlobalMacroDef(JSON.stringify(globalMacroDefObj));
        }
      }
    }
  };

  return <>
    {props.path && <Button type='primary'
      style={{
        position: 'absolute',
        top: '8px',
        right: '30px',
      }}
      onClick={(): void => {
        dispatch(handleFactory({ path: props.path }));
      }}
    >
      {t('defaults')}
    </Button>}
    {props.path && !isFbb && <div className='config-card' id={setDocumentById(group, 'isCompile')}>
      <Title name='' description='' />
      <Checkbox className='ant-modal-title width100' style={{ fontSize: 15 }}
        defaultChecked={isCompile}
        onChange={(e): void => {
          setIsCompile(e.target.checked);
        }}>{t('isCompile')}</Checkbox>
    </div>}
    {!props.path && <>
      {!isFbb && <div className='config-card' id={setDocumentById(group, 'tool_chain')}>
        <Title name={t('tool_chain')} description='' />
        <Select className='width100' value={toolChain}
          getPopupContainer={(triggerNode): HTMLElement => triggerNode.parentNode}
          showArrow={false}
          open={toolChains.length > 0 ? undefined : false}
          disabled
          onChange={(value): void => {
            setToolChain(value);
          }}>
          {
            toolChains.map((item) => {
              return <Option key={item} value={item}>
                {item}
              </Option>;
            })
          }
        </Select>
      </div>}
      {!isFbb &&
      <div className='config-card' id={setDocumentById(group, 'link_c_library_in_toolchain')}>
        <Title name='' description='' />
        <Checkbox className='ant-modal-title width100' style={{ fontSize: 15 }}
          defaultChecked={linkCToolChain} onChange={(e): void => {
            setLinkCToolChain(e.target.checked);
          }}>{t('link_c_library_in_toolchain')}</Checkbox>
      </div>}
      {!isFbb &&
      <div className='config-card' id={setDocumentById(group, 'link_c_library_in_compilationchain')}>
        <Title name='' description='' />
        <Checkbox className='ant-modal-title width100' style={{ fontSize: 15 }}
          defaultChecked={linkCCompilationChain} onChange={(e): void => {
            setLinkCCompilationChain(e.target.checked);
          }}>{t('link_c_library_in_compilationchain')}</Checkbox>
      </div>}
      {!isFbb &&
      <div className='config-card' id={setDocumentById(group, 'compile_type')}>
        <Title name={t('compile_type')} description={t('compile_type_description')} />
        <Select
          getPopupContainer={(triggerNode): HTMLElement => triggerNode.parentNode}
          defaultValue={compileType}
          className='width100'
          onChange={(value): void => {
            setCompileType(value);
          }}
        >
          <Option key={'transType_1'} value={'debug'} xs={24} sm={24} md={24} lg={6}>
            debug
          </Option>
          <Option key={'transType_2'} value={'release'} xs={24} sm={24} md={24} lg={6}>
            release
          </Option>
        </Select>
      </div>}
      {!isFbb && jsonData?.compile?.constant_type && <div className='config-card' id={setDocumentById(group, 'constant_type')}>
        <Title name={t('constant_type')} description={t('constant_type_description')} />
        <Select
          getPopupContainer={(triggerNode): HTMLElement => triggerNode.parentNode}
          defaultValue={constantType}
          className='width100'
          onChange={(value): void => {
            setConstantType(value);
          }}
        >
          <Option key={'constantType_1'} value={'double'} xs={24} sm={24} md={24} lg={6}>
            double
          </Option>
          <Option key={'constantType_2'} value={'float'} xs={24} sm={24} md={24} lg={6}>
            float
          </Option>
        </Select>
      </div>}
      {!isFbb && !isGccArmOrNot && <>
      <div className='config-card' id={setDocumentById(group, 'generate_crc')}>
        <Title name='' description='' />
        <Checkbox className='ant-modal-title width100' style={{ fontSize: 15 }}
          defaultChecked={generateCrcEnable} onChange={(e): void => {
            setGenerateCrcEnable(e.target.checked);
          }}>{t('generate_crc')}</Checkbox>
      </div>
      <div className='config-card' id={setDocumentById(group, 'generate_checksum')}>
        <Title name='' description='' />
        <Checkbox className='ant-modal-title width100' style={{ fontSize: 15 }}
          defaultChecked={generateChecksumEnable} onChange={(e): void => {
            setGenerateChecksumEnable(e.target.checked);
          }}>{t('generate_checksum')}</Checkbox>
      </div>
      <div className='config-card' id={setDocumentById(group, 'generate_symboltable')}>
        <Title name='' description='' />
        <Checkbox className='ant-modal-title width100' style={{ fontSize: 15 }}
          defaultChecked={generateSymboltableEnable} onChange={(e): void => {
            setGenerateSymboltableEnable(e.target.checked);
          }}>{t('generate_symboltable')}</Checkbox>
      </div>
      </>}
      {isDisplayAllinoneCheckbox() && !isFbb && <div className='config-card' id={setDocumentById(group, 'generate_allinone_bin')}>
        <Title name='' description='' />
        <Checkbox className='ant-modal-title width100' style={{ fontSize: 15 }}
          defaultChecked={generateAllinoneBinEnable} onChange={(e): void => {
            setGenerateAllinoneBinEnable(e.target.checked);
          }}>{t('generate_allinone_bin')}</Checkbox>
      </div>}
      {!isFbb &&
      <div className='config-card' id={setDocumentById(group, 'generate_target_hex')}>
        <Title name='' description='' />
        <Checkbox className='ant-modal-title width100' style={{ fontSize: 15 }}
          defaultChecked={generateTargetHexEnable} onChange={(e): void => {
            setGenerateTargetHexEnable(e.target.checked);
          }}>{t('generate_target_hex')}</Checkbox>
      </div>}
      {!isFbb && !isGccArmOrNot && <>
       <div className='config-card' id={setDocumentById(group, 'parse_elf_for_livewatch')}>
        <Title name='' description='' />
        <Checkbox className='ant-modal-title width100' style={{ fontSize: 15 }}
          defaultChecked={generateLivewatchElfEnable} onChange={(e): void => {
            setGenerateLivewatchElfEnable(e.target.checked);
          }}>{t('parse_elf_for_livewatch')}</Checkbox>
      </div>
      <div className='config-card' id={setDocumentById(group, 'enable_perf')}>
        <Title name='' description='' />
        <Checkbox className='ant-modal-title width100' style={{ fontSize: 15 }}
          checked={generatePerfEnable} onChange={(e): void => {
            setGeneratePerfEnable(e.target.checked);
            changeMacro(e.target.checked);
          }}>{t('enable_perf')}</Checkbox>
      </div>
      </>}
      <div className='config-card' id={setDocumentById(group, 'enable_build_problem')}>
        <Title name='' description='' />
        <Checkbox className='ant-modal-title width100' style={{ fontSize: 15 }}
          defaultChecked={generateBuildProblemEnable} onChange={(e): void => {
            setGenerateBuildProblemEnable(e.target.checked);
          }}>{t('enable_build_problem')}</Checkbox>
      </div>
      <div className='config-card' id={setDocumentById(group, 'parse_analysis_json')}>
        <Title name='' description='' />
        <Checkbox className='ant-modal-title width100' style={{ fontSize: 15 }}
          defaultChecked={generateAnalysisJsonEnable} onChange={(e): void => {
            setGenerateAnalysisJsonEnable(e.target.checked);
          }}>{t('parse_analysis_json')}</Checkbox>
      </div>
      {isAddParameter && <div className='config-card' id={setDocumentById(group, 'add_nhso_build_parameter')}>
        <Title name='' description='' />
        <Checkbox className='ant-modal-title width100' style={{ fontSize: 15 }}
          defaultChecked={generateAddnhsoParameter} onChange={(e): void => {
            setGenerateAddnhsoParameter(e.target.checked);
          }}>{t('add_nhso_build_parameter')}</Checkbox>
      </div>}
      {!isFbb && !isGccArmOrNot && <div className='config-card' id={setDocumentById(group, 'padding')}>
        <Title name='padding' description='' />
        <Select
          getPopupContainer={(triggerNode): HTMLElement => triggerNode.parentNode}
          style={{ width: '100%' }}
          defaultValue={padding}
          onChange={(value): void => setPadding(value)}
          options={[
            { value: 'no', label: 'no' },
            ...(hasPadding ? [
              { value: '0', label: '0' },
              { value: '1', label: '1' },
            ] : []),
          ]}
        />
      </div>}
    </>}
    {!isFbb &&
    <div className='config-card' id={setDocumentById(group, 'optimization')}>
      <Title name={t('optimization')} description={t('optimization_description')} />
      <Select
        getPopupContainer={(triggerNode): HTMLElement => triggerNode.parentNode}
        defaultValue={optimization}
        className='width100'
        onChange={(value): void => {
          setOptimization(value);
        }}
      >
        <Option key={'O0'} value={'O0'} md={4} lg={6}>
          O0
        </Option>
        <Option key={'O1'} value={'O1'} md={4} lg={6}>
          O1
        </Option>
        <Option key={'O2'} value={'O2'} md={4} lg={6}>
          O2
        </Option>
        {!isGccArmOrNot && (<Option key={'O3'} value={'O3'} md={4} lg={6}>
          O3
        </Option>)}
        <Option key={'Os'} value={'Os'} md={4} lg={6}>
          Os
        </Option>
      </Select>
    </div>}
    {warnSetting()}
    {!props.path && !isFbb && <>
      {!isGccArmOrNot && <>
      <div className='config-card' id={setDocumentById(group, 'static_library_enable')}>
        <Title name='' description='' />
        <Checkbox className='ant-modal-title width100' style={{ fontSize: 15 }}
          defaultChecked={staticLibEnable} onChange={(e): void => {
            setStaticLibEnable(e.target.checked);
          }}>{t('static_library_enable')}</Checkbox>
      </div>
      {staticLibSetting()}
      <div className='config-card' id={setDocumentById(group, 'static_library_import')}>
        <Title name='' description='' />
        <Checkbox className='ant-modal-title width100' style={{ fontSize: 15 }}
          defaultChecked={staticLibImport} onChange={(e): void => {
            setStaticLibImport(e.target.checked);
          }}>{t('static_library_import')}</Checkbox>
      </div>
      {staticLibImport && <div className='config-card' id={setDocumentById('static_library_import', 'static_library_path')}>
        <Title name={t('static_library_path')} description='static_library_path_description' />
        <div className='select-container'>
          <div className='folder-tag-lists'>
            {staticLibPath ? staticLibPath.split(',').map((item: string) => {
              return (
                <Tooltip title={item} key={item}>
                  <Tag key={item} closable onClose={(): void => {
                    setStaticLibPath(staticLibPath.split(',').filter(ele => ele !== item).join(','));
                  }}>
                    <span className='file-name-item'>{item}</span>
                  </Tag>
                </Tooltip>
              );
            }) : null}
          </div>
          <FolderOpenOutlined
            style={{ color: '#fff' }}
            className='folder-icon-style'
            title={t('browse') ?? 'Browse'}
            onClick={(): void => setStaticLibPathFolderAndFileModalFlag(true)}
          />
        </div>
      </div>
      }
      </>}
      <MacroDefTable
        group={group}
        globalMacroDef={globalMacroDef}
        setGlobalMacroDef={setGlobalMacroDef}
      />
      {!isGccArmOrNot && <div className='config-card' id={setDocumentById(group, 'burned_file_name')}>
        <Title name='burned_file_name' description='burnedfileexplain' />
        {new Array(1).fill(null).map((_, index: number) => {
          return <div className='width100' style={index === 0 ? undefined : { paddingTop: '14px' }}>
            <Checkbox className='ant-modal-title' style={{ fontSize: 15, width: '7%', paddingLeft: '0%' }}
             defaultChecked={unusedBurnedFile} onChange={(e): void => {
               setUnusedBurnedFile(e.target.checked);
             }}></Checkbox>
            <Input className='ant-input-text' defaultValue={burnedFileName} style={{ width: '93%' }} onBlur={(e): void => {
                setBurnedFileName(e.target.value);
            }} />
          </div>;
        })}
      </div>}
      <div className='config-card' id={setDocumentById(group, 'execute_before_build')}>
        <Title name='execute_before_build' description='builtInVariables' />
        {new Array(COMMAND_NUM).fill(null).map((_, index: number) => {
          return <div className='width100' style={index === 0 ? undefined : { paddingTop: '14px' }}>
            <Checkbox className='ant-modal-title' style={{ fontSize: 15, width: '7%', paddingLeft: '0%' }}
              checked={getExecuteArr(executeBeforeBuild)[index]?.enable} onChange={(e): void => {
                changeExecute(index, 'enable', e.target.checked, 'before');
              }} >

            </Checkbox>
            <Input className='ant-input-text' defaultValue={getExecuteArr(executeBeforeBuild)[index]?.command} style={{ width: '93%' }}
              onBlur={(e): void => changeExecute(index, 'command', e.target.value, 'before')}
            />
          </div>;
        })}
      </div>
      <div className='config-card' id={setDocumentById(group, 'execute_after_build')}>
        <Title name='execute_after_build' description='builtInVariables' />
        {new Array(COMMAND_NUM).fill(null).map((_, index: number) => {
          return <div className='width100' style={index === 0 ? undefined : { paddingTop: '14px' }}>
            <Checkbox className='ant-modal-title' style={{ fontSize: 15, width: '7%', paddingLeft: '0%' }}
              checked={getExecuteArr(executeAfterBuild)[index]?.enable} onChange={(e): void => {
                changeExecute(index, 'enable', e.target.checked, 'after');
              }} >

            </Checkbox>
            <Input className='ant-input-text' defaultValue={getExecuteArr(executeAfterBuild)[index]?.command} style={{ width: '93%' }}
              onBlur={(e): void => changeExecute(index, 'command', e.target.value, 'after')}
            />
          </div>;
        })}
      </div>
    </>}
    <SelectFolderAndFile
      folderAndFileModalFlag={sourceFolderAndFileModalFlag}
      setFolderAndFileModalFlag={setSourceFolderAndFileModalFlag}
      pathList={staticLibSource}
      setPathList={setStaticLibSource}
    />
    <SelectFolderAndFile
      folderAndFileModalFlag={headerFolderAndFileModalFlag}
      setFolderAndFileModalFlag={setHeaderFolderAndFileModalFlag}
      pathList={staticLibHeader}
      setPathList={setStaticLibHeader}
    />
    <SelectFile
      folderAndFileModalFlag={staticLibPathFolderAndFileModalFlag}
      setFolderAndFileModalFlag={setStaticLibPathFolderAndFileModalFlag}
      pathList={staticLibPath}
      setPathList={setStaticLibPath}
    />

    <SelectFolderAndExtern
      folderAndFileModalFlag={externAndPathModalFlag}
      setFolderAndFileModalFlag={setExternAndPathModalFlag}
      pathList={externStaticlibPath}
      setPathList={setExternStaticlibPath}
      diskinfo={true}
    />

    <SelectFolderAndExtern
      folderAndFileModalFlag={externAndIncludeModalFlag}
      setFolderAndFileModalFlag={setExternAndIncludeModalFlag}
      pathList={externStaticlibInclude}
      setPathList={setExternStaticlibInclude}
      diskinfo={true}
    />
  </>;
};

export default CompilerInfoTabPane;
