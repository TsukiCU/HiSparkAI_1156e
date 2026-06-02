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
import * as React from 'react';
import { Row, Col, Select, Modal, Space, Input, Button, TreeSelect, Tooltip, Radio, Table, Form, Empty, ConfigProvider } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { useEffect, useState } from 'react';
import { getInfo, sendProjectData } from './actions';
import type { SocListType, OperateStruct, ProjectConfigStruct, ProjectData } from '../backEnd/interface/model';
import { useTranslation } from 'react-i18next';
import { SdkModal } from './sdkModal';
import { FolderOpenOutlined } from '@ant-design/icons';
import NewProjectSvg from './costomIcons/newProjectIcon';
import { checkCustomIDE } from './actions';
import SelectSvg from './costomIcons/selectIcon';
import Drag from './component/drag';
import ErrSvg from './costomIcons/errIcon';
let drag: Drag | undefined;

const App = (): JSX.Element => {
  const { Option } = Select;
  const { t } = useTranslation();
  const [socList, setSocList] = useState<SocListType[]>([]);
  const [soc, setSoc] = useState<string>('');
  const [projectNewType, setProjectNewType] = useState<string>(('commonProject'));
  const [boardList, setBoardList] = useState<Array<string>>([]);
  const [board, setBoard] = useState<string | null>(null);
  const [sdkContentWrong, setSdkContentWrong] = useState(false);
  const [projectPathWrong, setProjectPathWrong] = useState(false);
  const [checkEmptyProject, setCheckEmptyProject] = useState<string>('');
  const isCustomIDE = useSelector((state: any) => state.entities.isCustomIDE);

  const [chooseSdkPath, setChooseSdkPath] = useState('');

  const dispatch = useDispatch();
  const chips: any = useSelector((state: any) => state.entities.chipList);
  const sampleListInfo: any = useSelector((state: any) => state.entities.build_config);
  const sampleDownloadPath: any = useSelector((state: any) => state.entities.sampleDownloadPath);
  const chipConfig: any = useSelector((state: any) => state.entities.chipConfig);
  const projectPathInfo: any = useSelector((state: any) => state.entities.projectPathInfo);
  const samplePathInfo: any = useSelector((state: any) => state.entities.samplePathInfo);
  const thisProjectExists: any = useSelector((state: any) => state.entities.thisProjectExists);
  const sdkPathWrong: any = useSelector((state: any) => state.entities.sdkPathWrong);
  const sdkPathRight: any = useSelector((state: any) => state.entities.sdkPathRight);
  const projectPathWrongInfo: any = useSelector((state: any) => state.entities.projectPathWrongInfo);
  const projectPathRightInfo: any = useSelector((state: any) => state.entities.projectPathRightInfo);
  const thisProjectNotExists: any = useSelector((state: any) => state.entities.thisProjectNotExists);
  const userConfig: any = useSelector((state: any) => state.entities.userConfig);
  const [projectData, setPorjectData] = useState<ProjectData>({
    seriesName: '',
    soc: '',
    board: '',
    projectName: '',
    himpwName: '',
    cpu0Name: '',
    cpu1Name: '',
    cpu2Name: '',
    projectPath: '',
    projectType: '',
    sdkPath: '',
    needSdk: false,
    chipConfig: false,
    boardJsonPath: '',
    platform: '',
    projectNewType: '',
    checkEmptyProject: '',
    samplePath: '',
    sampleNameSelect: '',
  });
  const [projectPath, setProjectPath] = useState('');
  const [projectName, setProjectName] = useState('');
  const [himpwName, setHimpwName] = useState('');
  const [cpu0Name, setCpu0Name] = useState('');
  const [cpu1Name, setCpu1Name] = useState('');
  const [cpu2Name, setCpu2Name] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [errModalType, setErrModalType] = useState<'alreadyExists' | 'sdkPathWrong'>('alreadyExists');
  const [projectForm] = Form.useForm();
  const [projectNewTypeDisable, setProjectNewTypeDisable] = useState<boolean>(true);
  const [boardsMap, setBoardsMap] = useState<any>({});
  const [samplePath, setSamplePath] = useState('');
  const [sampleSelect, setSampleSelect] = useState('');
  const [sampleProjectDisable, setSampleProjectDisable] = useState<boolean>(true);
  const [multiCoreProjectDisable, setMultiCoreProjectDisable] = useState<boolean>(false);
  const [isSecondModalOpen, setIsSecondModalOpen] = useState(false); 

  const operateData: OperateStruct = {
    operationType: '',
    paramData: '',
    source: 'wizard',
  };
  const projectOperateData: ProjectConfigStruct = {
    operationType: '',
    projectData: projectData,
  };

  useEffect(() => {
    if (isModalOpen) {
      if (!drag) {
        drag = new Drag('ant-modal', 'ant-modal-header', 0);
        drag.init();
      }
    }
  }, [isModalOpen]);

  useEffect(() => {
    dispatch(checkCustomIDE());
  }, [dispatch]);

  // triggered at the first time
  useEffect(() => {
    operateData.operationType = 'getLanguage';
    dispatch(getInfo(operateData));
    operateData.operationType = 'getJsonInfo';
    operateData.paramData = {
      fileName: 'chiplist.json',
      sdkPath: chooseSdkPath,
    };
    dispatch(getInfo(operateData));
    operateData.operationType = 'getUserConfig';
    operateData.paramData = '';
    dispatch(getInfo(operateData));
  }, [dispatch]);

  // triggered at the first time
  useEffect(() => {
    if (!chips) {
      return;
    }
    setSocList(chips);
  }, [chips]);

  useEffect(() => {
    if (userConfig) {
      projectForm.setFieldsValue({ projectPath: userConfig.projectCreate_last_projectPath });
      setProjectPath(userConfig.projectCreate_last_projectPath);
    }
  }, [userConfig]);

  useEffect(() => {
    if (userConfig) {
      projectForm.setFieldsValue({ samplePath: userConfig.projectCreate_last_samplePath });
      setSamplePath(userConfig.projectCreate_last_samplePath);
    }
  }, [userConfig]);

  useEffect(() => {
    if (sampleListInfo) {
      const formattedData: SampleData[] = sampleListInfo.map((item: any) => ({
          key: item.key,
          name: item.name,
          description: item.description,
      }));
      setData(formattedData); // 更新表格数据
      setIsSecondModalOpen(true);
    } else {
      setIsSecondModalOpen(false);
    } 
  }, [sampleListInfo]);

  // triggered by changing boards
  useEffect(() => {
    if (!board) {
      return;
    }

    const boardJsonPath = `${board}.json`;
    operateData.operationType = 'getJsonInfo';
    operateData.paramData = {
      fileName: boardJsonPath,
      sdkPath: chooseSdkPath,
    };
    dispatch(getInfo(operateData));
    projectData.board = board;
    projectData.boardJsonPath = boardJsonPath;
  }, [board]);

  const onOpenProjectPathClick = (): void => {
    // sending slect folder messages to the backend
    operateData.operationType = 'selectFolderPath';
    operateData.paramData = {
      key: 'projectPathInfo',
      currentValue: projectPath,
    };
    dispatch(getInfo(operateData));
  };

  const onOpenSamplePathClick = (): void => {
    // sending slect folder messages to the backend
    operateData.operationType = 'selectFolderPath';
    operateData.paramData = {
      key: 'samplePathInfo',
      currentValue: samplePath,
    };
    dispatch(getInfo(operateData));
  };

  const onSampleSelectClick = (): void => {
    if (samplePath && projectData.projectNewType === 'sampleProject') {
      operateData.operationType = 'getSampleJsonInfo';
      operateData.paramData = {
        sdkPath: samplePath,
      };
      dispatch(getInfo(operateData));        
    }    
  };

  const onSecondModalCancel = () => {
    setIsSecondModalOpen(false);
  };

  useEffect(() => {
    if (sampleDownloadPath) {
      setSamplePath(sampleDownloadPath);
    }
  }, [sampleDownloadPath]);

  // triggered by select the project path
  useEffect(() => {
    if (projectPathInfo) {
      projectForm.setFieldsValue({ projectPath: projectPathInfo });
      setProjectPath(projectPathInfo);
      projectForm.validateFields(['projectPath']);
    }
  }, [projectPathInfo]);

  useEffect(() => {
    if (samplePathInfo) {
      projectForm.setFieldsValue({ samplePath: samplePathInfo });
      setSamplePath(samplePathInfo);
      projectForm.validateFields(['samplePath']);
    }
  }, [samplePathInfo]);

  // triggered by change the project path
  useEffect(() => {
    if (projectPath) {
      projectData.projectPath = projectPath;
    }
  }, [projectPath]);

  useEffect(() => {
    if (projectNewType) {
      projectData.projectNewType = projectNewType;
    } 
  }, [projectNewType]);

  useEffect(() => {
    if (checkEmptyProject) {
      projectData.checkEmptyProject = checkEmptyProject;
    }
  }, [checkEmptyProject]);

  useEffect(() => {
    if (samplePath) {
      projectData.samplePath = samplePath;
    }
  }, [samplePath]);

  useEffect(() => {
    if (sampleSelect) {
      projectData.sampleNameSelect = sampleSelect;
    }
  }, [sampleSelect]);

  useEffect(() => {
    if (projectData.seriesName === 'cfbb') {
      if (chooseSdkPath !== '' && board !== null) {
        operateData.operationType = 'getJsonInfo';
        operateData.paramData = {
          fileName: `${board}.json`,
          sdkPath: chooseSdkPath,
        };
        dispatch(getInfo(operateData));
      }
    }
  }, [chooseSdkPath]);

  // triggered by select the project path
  useEffect(() => {
    if (thisProjectExists) {
      // open create project failed window
      setIsErrorModalOpen(true);
      setErrModalType('alreadyExists');
    }
  }, [thisProjectExists]);

  useEffect(() => {
    if (sdkPathWrong) {
      setSdkContentWrong(true);
    }
  }, [sdkPathWrong]);

  useEffect(() => {
    if (projectPathRightInfo) {
      setProjectPathWrong(false);
    }
  }, [projectPathRightInfo]);

  useEffect(() => {
    if (projectPathWrongInfo) {
      setProjectPathWrong(true);
    }
  }, [projectPathWrongInfo]);

  useEffect(() => {
    if (sdkPathRight) {
      setSdkContentWrong(false);
    }
  }, [sdkPathRight]);

  useEffect(() => {
    if (projectData.seriesName) {
      projectForm.validateFields(['sdkPath']);
    }
  }, [sdkContentWrong]);

  useEffect(() => {
    if (projectData.seriesName) {
      projectForm.validateFields(['projectPath']);
    }
  }, [projectPathWrong]);

  // triggered by clicking the next button
  useEffect(() => {
    if (thisProjectNotExists) {
      // close project wizard window
      setIsModalOpen(false);
    }
  }, [thisProjectNotExists]);

  const onClickOk = (): void => {
    setIsErrorModalOpen(false);
  };

  // triggered by changing soc
  function setChipData(children: any): boolean {
    for (const chip of children) {
      if (chip.boardsMap) {
        setBoardsMap(chip.boardsMap);
      }
  
      if (chip.value === soc) {
        projectData.soc = soc;
        setBoardList(chip.boards);
        setBoard(chip?.boards[0]);
        projectForm.setFieldsValue({ board: chip?.boards[0] });
        const boardJsonPath = `${chip?.boards[0]}.json`;
        operateData.operationType = 'getJsonInfo';
        operateData.paramData = {
          fileName: boardJsonPath,
          sdkPath: chooseSdkPath,
        };
        projectData.boardJsonPath = boardJsonPath;
        projectData.seriesName = chip.series;
        dispatch(getInfo(operateData));
        return true;
      }
  
      if (chip.children && setChipData(chip.children)) {
        return true;
      }
    }
    return false;
  }

  useEffect(() => {
    if (!soc) {
      return;
    }
    setChipData(chips);
    if (projectData.soc === 'sw21') {
      operateData.operationType = 'showRemoteMessage';
      operateData.paramData = {
        key: 'samplePathInfo',
        currentValue: samplePath,
      };
      dispatch(getInfo(operateData));
    }   
    const checkIsEmptyProject = projectData.seriesName === 'cfbb' && projectData.projectNewType === 'emptyProject';
    if ( projectData.soc === 'ws63' ) {
      setSampleProjectDisable(false);
    } else {
      setSampleProjectDisable(true);
    }
    
    if ((projectData.seriesName === '3066h') || (projectData.seriesName === '3067m')) {
      setMultiCoreProjectDisable(false);
    } else {
      setMultiCoreProjectDisable(true);
    }

    const checkIsSampleProject = (!(projectData.soc === 'ws63')) && (projectData.projectNewType === 'sampleProject');
    if (checkIsEmptyProject || checkIsSampleProject) {      
      setProjectNewType('commonProject');
    }
  }, [soc]);

  useEffect(()=>{
    if (projectData.seriesName) {
      operateData.operationType = 'updateProjectTips';
      operateData.paramData = {
        needValidate: true,
        projectPath: projectPath,
      };
      dispatch(getInfo(operateData));
      if (projectData.seriesName === 'cfbb') {
        setProjectNewTypeDisable(true);

        operateData.operationType = 'updateSdkTips';
        operateData.paramData = {
          needValidate: false,
          sdkPath: chooseSdkPath,
        };
        dispatch(getInfo(operateData));

        setProjectPath(chooseSdkPath);
        projectForm.setFieldsValue({ projectPath: chooseSdkPath });
      } else {
        setProjectNewTypeDisable(false);     

        operateData.operationType = 'updateSdkTips';
        operateData.paramData = {
          needValidate: true,
          sdkPath: chooseSdkPath,
        };
        dispatch(getInfo(operateData));
      }
    }
  }, [projectData.seriesName]);

  // triggered by changing board, update the product type
  useEffect(() => {
    if (chipConfig !== undefined) {
      projectData.needSdk = chipConfig.need_sdk;
      projectData.chipConfig = chipConfig.chip_config;
      projectData.needProjectPath = chipConfig.need_project_path;
      projectData.platform = chipConfig.platform;
      if (chipConfig.project_type && chipConfig.project_type.length > 0) {
        projectData.projectType = chipConfig.project_type[0].name.toUpperCase();
      } else {
        projectData.projectType = ' '; // in case board with no projectType, remain last choice.
      }
    }
  }, [chipConfig]);

  const onClickFinish = (): void => {
    // sending finish messages to the backend
    projectData.sdkPath = chooseSdkPath;
    projectForm
      .validateFields()
      .then(() => {
        projectOperateData.operationType = 'getProjectData';
        if (projectData.projectNewType === 'emptyProject') {
          setCheckEmptyProject('true');
        }
        projectOperateData.projectData = projectData;
        dispatch(sendProjectData(projectOperateData));
      })
      .catch(() => { });
  };

  const onClickCancel = (): void => {
    // close project wizard window
    setIsModalOpen(false);

    // sending cancel messages to the backend
    operateData.operationType = 'closeProjectWizard';
    dispatch(sendProjectData(operateData));
  };

  const useEnPathRule: any = [
    {
      whitespace: false,
      pattern: /^(?:[a-zA-Z]:[\\/]|\/)(?:[^\\/\0]*[\\/]?)*[^\\/\0]*$/i,
      type: 'string',
      message: t('projectPathRule'),
    },
    { required: true, message: t('fieldCannotEmpty', { field: t('projectPath') }) },
    {
      validator: (): Promise<void> => {
        if (projectPathWrong) {
          return Promise.reject(t('projectPathNotExist'));
        }
        return Promise.resolve();
      },
    },
  ];

  const useSelectSampleRule: any = [
    {
      validator: (): Promise<void> => {
        if (!sampleSelect) {
          return Promise.reject(t('selectSampleCannotEmpty'));
        }
        return Promise.resolve();
      },
    },
  ];

  let proPathComponents: JSX.Element[] = [
    <Row>
      <Col>
        <p>{t('projectPath')}</p>
        <Form.Item
          name="projectPath"
          rules={useEnPathRule}
        >
          <Input.Group compact>
            <Input
              className='ant-input-text'
              readOnly={true}
              placeholder={t('projectPathInputPrompt') ?? 'Selecting the path for storing project files'}
              value={projectPath}
              style={{ width: 'calc(100% - 37px)' }}
              onClick={(): void => onOpenProjectPathClick()} />
            <Button
              className='browse'
              type='primary'
              style={{ paddingLeft: '10px' }}
              onClick={(): void => onOpenProjectPathClick()}
              icon={<FolderOpenOutlined style={{ color: '#FFFFFF', width: '14px', height: '14px' }} />}></Button>
          </Input.Group>
        </Form.Item>
      </Col>
    </Row>,
  ];
  if (chipConfig?.need_project_path === false) {
    proPathComponents = [];
  }

  let sdkComponents: JSX.Element[] = [
    <SdkModal
      setSdkPath={setChooseSdkPath}
      setProPath={setProjectPath}
      setIsErrorModalOpen={setIsErrorModalOpen}
      setErrModalType={setErrModalType}
      projectData={projectData}
      setFieldsValue={projectForm.setFieldsValue}
      lastSdkPath={userConfig?.projectCreate_last_sdkPath}
      setSdkContentWrong={setSdkContentWrong}
      sdkContentWrong={sdkContentWrong}
      validateFields={projectForm.validateFields}
    />,
  ];
  if (chipConfig?.need_sdk === false) {
    sdkComponents = [];
  }

  // editing a project name
  const onInputChange = (name: string): void => {
    setProjectName(name);
    projectData.projectName = name;
  };

  const onInputHimpwChange = (name: string): void => {
    setHimpwName(name);
    projectData.himpwName = name;
  };

  const onInputCpu0Change = (name: string): void => {
    setCpu0Name(name);
    projectData.cpu0Name = name;
  };

  const onInputCpu1Change = (name: string): void => {
    setCpu1Name(name);
    projectData.cpu1Name = name;
  };

  const onInputCpu2Change = (name: string): void => {
    setCpu2Name(name);
    projectData.cpu2Name = name;
  };

  const tableEmptyRender = (): JSX.Element => {
    return <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={<></>}
    ></Empty>;
  };
  
  const [selectedSample, setSelectedSample] = useState<string | null>(null);
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [data, setData] = useState<SampleData[]>([]);

  interface SampleData {
    key: string;
    name: string;
    description: string;
  }

  // 表格列配置
  const columns = [
    {
      title: t('sampleName'),
      dataIndex: 'name',
      key: 'name',
      width: '30%',
    },
    {
      title: t('description'),
      dataIndex: 'description',
      key: 'description',
      width: '50%',    
    },
    {
      title: t('select'),
      key: 'action',
      width: '20%',
      render: (_: any, record: SampleData) => (
        <Radio
          className={selectedSample === record.key ? 'radio-selected' : 'radio-default'}
          checked={selectedSample === record.key} // 选中状态
          onChange={() => {
            setSelectedSample(record.key);
            setSelectedRowKey(record.key);
            setSampleSelect(record.name);
          }} // 选中行时，设置选中的行
        >
        </Radio>
      ),
    },
  ];

  return <>
    <Modal
      title={[
        <span>
          <NewProjectSvg />
          <span style={{ color: '#666666', marginLeft: '8px' }}>{t('projectWizard')}</span>
        </span>,
      ]}
      visible={isModalOpen}
      width={710}
      footer={[
        <Space direction="horizontal" size="large">
          <div className='footerBar'>
            <Button type='primary' onClick={(): void => onClickFinish()}>
              {t('finished')}
            </Button>
            <Button onClick={(): void => onClickCancel()}>
              {t('cancel')}
            </Button>
          </div>
        </Space>,
      ]}
      onCancel={(): void => onClickCancel()}
    >
      <strong>{t('projectCreateTitle')}</strong><br />
      <span style={{ color: '#A3A3A3' }}>{t('projectCreateDescription')}</span><br /><br />

      <Form layout="horizontal" autoComplete="off" form={projectForm}>
        <Space direction="vertical" size="small" className='width100 project-wizard'>
          <Row>
            <Col span={7}>
              <p>{t('SOC')}</p>
              <ConfigProvider renderEmpty={tableEmptyRender}>
                <Form.Item
                  name="soc"
                  rules={[{ required: true, message: t('fieldCannotEmpty', { field: t('SOC') }) ?? 'SOC cannot be Empty' }]}
                >
                  <TreeSelect
                    showSearch
                    dropdownStyle={{
                      maxHeight: 400,
                      overflow: 'auto',
                    }}
                    placeholder={t('selectSoc')}
                    treeDefaultExpandAll
                    onChange={(value): void => {
                      setSoc(value);
                    }}
                    treeData={socList.map((item: any) => ({
                      ...item,
                      title: t(item.key),
                    }))}
                  />
                </Form.Item>
              </ConfigProvider>
            </Col>
            <Col span={6} offset={2}>
              <p>{t('board')}</p>
              <Form.Item
                name={'board'}
                rules={[{ required: true, message: t('fieldCannotEmpty', { field: t('board') }) ?? 'Board cannot be Empty' }]}
              >
                <Select
                  getPopupContainer={(triggerNode): HTMLElement => triggerNode.parentNode}
                  onChange={(value): void => {
                    setBoard(value);
                  }}
                  value={board}
                  placeholder={t('selectBoard')}
                  disabled={boardList.length < 2}
                >
                  {
                    boardList ? boardList.map((boardItem: any) => (
                      <Option key={boardItem} value={boardItem}>
                        {boardsMap?.[boardItem] ?? boardItem}
                      </Option>
                    )) : <> {t('boardNotFound')} </>
                  }
                </Select>
              </Form.Item>
            </Col>
            <Col span={7} offset={2}>
              <p>{t('projectType')}</p>
               <Form.Item  
                  name="projectType"
                  initialValue={('commonProject')} // 设置默认值为 normalProject
                  >
                  <Select
                    getPopupContainer={(triggerNode): HTMLElement => triggerNode.parentNode}
                    dropdownStyle={{
                      maxHeight: 400,
                      overflow: 'auto',
                    }}
                    onChange={(value): void => {
                        setProjectNewType(value);                      
                    }}
                    value = {projectNewType}
                  >
                    <Option key={'commonProject'} value={'commonProject'}>
                      {t('commonProject')}
                    </Option>
                    {isCustomIDE && <Option key={'emptyProject'} value={'emptyProject'}
                     disabled={ projectNewTypeDisable }>
                      {t('emptyProject')}
                    </Option>}
                    <Option key={'sampleProject'} value={'sampleProject'}
                     disabled={ sampleProjectDisable }>
                      {t('sampleProject')}
                    </Option>
                    {isCustomIDE && <Option key={'multiCoreProject'} value={'multiCoreProject'}
                     disabled={ multiCoreProjectDisable }>
                      {t('multiCoreProject')}
                    </Option> }
                  </Select>
                </Form.Item>
            </Col>
          </Row>
          { projectNewType === 'sampleProject' && (
          <>
          <Row>
            <Col span={15}>
              <p>{t('samplePath')}</p>
              <Form.Item
                name="samplePath"
                rules={useEnPathRule}
              >
                <Input.Group compact>
                  <Tooltip title={samplePath} placement="top">
                  <Input
                    className='ant-input-text'
                    readOnly={true}
                    placeholder={t('samplePath') ?? 'Selecting the path for storing project sample files'}
                    value={samplePath}
                    style={{ width: 'calc(100% - 37px)' }}
                    onClick={(): void => onOpenSamplePathClick()} />
                    </Tooltip>
                  <Button
                    className='browse'
                    type='primary'
                    style={{ paddingLeft: '10px' }}
                    onClick={(): void => onOpenSamplePathClick()}
                    icon={<FolderOpenOutlined style={{ color: '#FFFFFF', width: '14px', height: '14px' }} />}>
                  </Button>

                </Input.Group>
              </Form.Item>
            </Col>
            <Col span={7} offset={2}>
              <p>{t('sampleSelect')}</p>
              <Form.Item
                name="sampleSelect"
                rules={useSelectSampleRule}
              >
                <Input.Group compact>
                  <Tooltip title={sampleSelect} placement="top">
                  <Input
                    className='ant-input-text'
                    readOnly={true}
                    placeholder={t('sampleSelect') ?? 'Selecting the path for storing sample files'}
                    value={sampleSelect}
                    style={{ width: 'calc(100% - 37px)' }}
                    onClick={(): void => onSampleSelectClick()} />
                    </Tooltip>
                  <Button
                    className='browse'
                    type='primary'
                    style={{ paddingLeft: '10px', paddingTop: '2px' }}
                    onClick={(): void => onSampleSelectClick()}
                    icon={<SelectSvg style={{ color: '#FFFFFF', width: '16px', height: '16px' }} />}
                  >
                  </Button>
                </Input.Group>
              </Form.Item>
            </Col>
          </Row>
          </>
          )}
          { projectNewType !== 'multiCoreProject' && (
          <Row>
            <Col>
              <p>{t('projectName')}</p>
              <Form.Item
                name="projectName"
                rules={[
                  {
                    whitespace: false,
                    pattern: /^[\w\-\s.]+$/i,
                    type: 'string',
                    message: t('nameRule') ?? 'Project name does not support Chinese characters, special characters of % [ ] \' \\ / : * ? \" < > | = ` ~ ! @ # $ ^ & ( ) + { } ; ,',
                  },
                  {
                    whitespace: false,
                    pattern: /^.*[^\s.]$/i,
                    type: 'string',
                    message: t('nameRule2') ?? 'Project name cannot end with a dot (.) or a space.',
                  },
                  {
                    whitespace: false,
                    type: 'string',
                    max: 50,
                    message: t('overMmaxLength', { length: 50 }) ?? 'Maximum length must not exceed 50.',
                  },
                  { required: true, message: t('fieldCannotEmpty', { field: t('projectName') }) ?? 'Project Name cannot be Empty' },
                ]}
              >
                <Input placeholder={t('projectNameInputPrompt') ?? 'enter a project name'} value={projectName}
                  onChange={(e): void => {
                    onInputChange(e.target.value);
                  }}
                />
              </Form.Item>
            </Col>
          </Row>
          )}
          { projectNewType === 'multiCoreProject' && (
          <Row>
          <Col span={6}>
            <p>{t('workspace')}</p>
            <Form.Item
              name="workspace"
              rules={[
                {
                  whitespace: false,
                  pattern: /^[\w\-\s.]+$/i,
                  type: 'string',
                  message: t('nameRule') ?? 'Project name does not support Chinese characters, special characters of % [ ] \' \\ / : * ? \" < > | = ` ~ ! @ # $ ^ & ( ) + { } ; ,',
                },
                {
                  whitespace: false,
                  pattern: /^.*[^\s.]$/i,
                  type: 'string',
                  message: t('nameRule2') ?? 'Project name cannot end with a dot (.) or a space.',
                },
                {
                  whitespace: false,
                  type: 'string',
                  max: 50,
                  message: t('overMmaxLength', { length: 50 }) ?? 'Maximum length must not exceed 50.',
                },
                { required: true, message: t('fieldCannotEmpty', { field: t('projectName') }) ?? 'Project Name cannot be Empty' },
              ]}
            >
              <Input placeholder={t('workspaceInputPrompt') ?? 'enter a workspace name'} value={himpwName}
                onChange={(e): void => {
                  onInputHimpwChange(e.target.value);
                }}
              />
            </Form.Item>
          </Col>
          <Col span={5} offset={1}>
            <p>{t('cpu0')}</p>
            <Form.Item
              name="cpu0"
              rules={[
                {
                  whitespace: false,
                  pattern: /^[\w\-\s.]+$/i,
                  type: 'string',
                  message: t('nameRule') ?? 'Project name does not support Chinese characters, special characters of % [ ] \' \\ / : * ? \" < > | = ` ~ ! @ # $ ^ & ( ) + { } ; ,',
                },
                {
                  whitespace: false,
                  pattern: /^.*[^\s.]$/i,
                  type: 'string',
                  message: t('nameRule2') ?? 'Project name cannot end with a dot (.) or a space.',
                },
                {
                  whitespace: false,
                  type: 'string',
                  max: 50,
                  message: t('overMmaxLength', { length: 50 }) ?? 'Maximum length must not exceed 50.',
                },
                { required: true, message: t('fieldCannotEmpty', { field: t('projectName') }) ?? 'Project Name cannot be Empty' },
              ]}
            >
              <Input placeholder={t('cpu0InputPrompt') ?? 'enter a CPU0 name'} value={cpu0Name}
                onChange={(e): void => {
                  onInputCpu0Change(e.target.value);
                }}
              />
            </Form.Item>
          </Col>
          <Col span={5} offset={1}>
            <p>{t('cpu1')}</p>
            <Form.Item
              name="cpu1"
              rules={[
                {
                  whitespace: false,
                  pattern: /^[\w\-\s.]+$/i,
                  type: 'string',
                  message: t('nameRule') ?? 'Project name does not support Chinese characters, special characters of % [ ] \' \\ / : * ? \" < > | = ` ~ ! @ # $ ^ & ( ) + { } ; ,',
                },
                {
                  whitespace: false,
                  pattern: /^.*[^\s.]$/i,
                  type: 'string',
                  message: t('nameRule2') ?? 'Project name cannot end with a dot (.) or a space.',
                },
                {
                  whitespace: false,
                  type: 'string',
                  max: 50,
                  message: t('overMmaxLength', { length: 50 }) ?? 'Maximum length must not exceed 50.',
                },
                { required: true, message: t('fieldCannotEmpty', { field: t('projectName') }) ?? 'Project Name cannot be Empty' },
              ]}
            >
              <Input placeholder={t('cpu1InputPrompt') ?? 'enter a CPU1 name'} value={cpu1Name}
                onChange={(e): void => {
                  onInputCpu1Change(e.target.value);
                }}
              />
            </Form.Item>
          </Col>
          <Col span={5} offset={1}>
            <p>{t('cpu2')}</p>
            <Form.Item
              name="cpu2"
              rules={[
                {
                  whitespace: false,
                  pattern: /^[\w\-\s.]+$/i,
                  type: 'string',
                  message: t('nameRule') ?? 'Project name does not support Chinese characters, special characters of % [ ] \' \\ / : * ? \" < > | = ` ~ ! @ # $ ^ & ( ) + { } ; ,',
                },
                {
                  whitespace: false,
                  pattern: /^.*[^\s.]$/i,
                  type: 'string',
                  message: t('nameRule2') ?? 'Project name cannot end with a dot (.) or a space.',
                },
                {
                  whitespace: false,
                  type: 'string',
                  max: 50,
                  message: t('overMmaxLength', { length: 50 }) ?? 'Maximum length must not exceed 50.',
                },
                { required: true, message: t('fieldCannotEmpty', { field: t('projectName') }) ?? 'Project Name cannot be Empty' },
              ]}
            >
              <Input placeholder={t('cpu2InputPrompt') ?? 'enter a CPU2 name'} value={cpu2Name}
                onChange={(e): void => {
                  onInputCpu2Change(e.target.value);
                }}
              />
            </Form.Item>
          </Col>
        </Row>
          )}
          {proPathComponents}
          <Row className='width100'>
            {sdkComponents}
          </Row>
          <Modal
            title={[
              <span>
                <ErrSvg />
                <span style={{ color: '#666666', marginLeft: '8px' }}>{t('create_project_warning')}</span>
              </span>,
            ]}
            open={isErrorModalOpen} closable={false} centered={true} footer={[
            <Button type='primary' onClick={(): void => onClickOk()}
            >
              {t('confirm')}
            </Button>,
          ]}>
            <Col>{
              errModalType === 'alreadyExists' ? <label htmlFor={'product-type'}>
                {t('createProjectFailedInfo1')}"{projectPath}\{projectName}"{t('createProjectFailedInfo2')}
              </label> : <label htmlFor={'product-type'}>
                {
                  projectData.seriesName === 'cfbb' 
                  ? t('sdkCfbbWrongInfo') 
                  : t('sdkMcuWrongInfo')
                }
              </label>
            }

            </Col>
          </Modal>
          <Modal
            title={[
              <span>
                <span style={{ color: '#666666', marginLeft: '16px', marginTop: '16px' }}>{t('sampleSelect')}</span>
              </span>,
            ]}
            open={isSecondModalOpen} onCancel={onSecondModalCancel}
            footer={null}
            className="ant-modal custom-modal" // 添加自定义类名来更精确控制 Modal
            bodyStyle={{ width: '710px', height: '600px', overflowY: 'auto'}}
            >
            <Table<SampleData>
            dataSource={data}
            columns={columns}
            pagination={false} // 取消分页
            rowKey="key" // 使用 key 作为唯一标识
            className="custom-table"
            onRow={(record) => ({
              onClick: () => {
                setSelectedRowKey(record.key); // 点击行时，设置为选中行
              },
              className: selectedRowKey === record.key ? 'selected-row' : '', // 为选中的行添加类
            })}
            bordered={false} 
            scroll={{ y: 440 }} // 设置表格内部的最大高度，支持滚动
            />
          </Modal>
        </Space>
      </Form>
    </Modal>
  </>;
};

export default App;
