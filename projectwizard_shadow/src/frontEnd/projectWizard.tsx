/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
import * as React from 'react';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Modal, Form, Row, Col, Select, Input, Button, Space,
} from 'antd';
import { FolderOpenOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

import { getInfo, sendProjectData } from './actions';
import type { OperateStruct, SocChipItem, SocGroupItem } from '../backEnd/interface/model';
import Drag from './component/drag';
import { vscode } from './index';

const { Option } = Select;

// ─── Platform constraint map ──────────────────────────────────────────────────
const PLATFORM_MAP: Record<string, { defaultPlatform: 'CPU' | 'NPU'; platformFixed: boolean }> = {
  ws63:  { defaultPlatform: 'CPU', platformFixed: true  },
  '3322':{ defaultPlatform: 'NPU', platformFixed: true  },
  mcu:   { defaultPlatform: 'CPU', platformFixed: false },
  '1156e':{ defaultPlatform: 'CPU', platformFixed: false },
};

let drag: Drag | undefined;

// ─── Component ────────────────────────────────────────────────────────────────
const ProjectWizard = (): JSX.Element => {
  const { t }    = useTranslation();
  const dispatch = useDispatch();
  const [form]   = Form.useForm();

  // state
  const [isOpen,          setIsOpen]          = useState(true);
  const [isErrOpen,       setIsErrOpen]        = useState(false);
  const [soc,             setSoc]              = useState('');
  const [platform,        setPlatform]         = useState<'CPU'|'NPU'|''>('');
  const [platformFixed,   setPlatformFixed]    = useState(false);
  const [projectPath,     setProjectPath]      = useState('');
  const [projectName,     setProjectName]      = useState('');
  const [projectPathWrong, setProjectPathWrong] = useState(false);

  // Redux state
  const chipList: SocGroupItem[]  = useSelector((s: any) => s.entities.chipList  ?? []);
  const userConfig: any           = useSelector((s: any) => s.entities.userConfig ?? null);
  const projectPathInfo: any      = useSelector((s: any) => s.entities.projectPathInfo);
  const projectPathRightInfo: any = useSelector((s: any) => s.entities.projectPathRightInfo);
  const projectPathWrongInfo: any = useSelector((s: any) => s.entities.projectPathWrongInfo);
  const thisProjectExists: any    = useSelector((s: any) => s.entities.thisProjectExists);
  const thisProjectNotExists: any = useSelector((s: any) => s.entities.thisProjectNotExists);

  // init drag
  useEffect(() => {
    if (isOpen && !drag) {
      drag = new Drag('ant-modal', 'ant-modal-header', 0);
      drag.init();
    }
  }, [isOpen]);

  // load chiplist + userConfig on mount
  useEffect(() => {
    const op: OperateStruct = { operationType: 'getLanguage', paramData: '', source: 'wizard' };
    dispatch(getInfo(op));

    const op2: OperateStruct = { operationType: 'getJsonInfo', paramData: { fileName: 'chiplist.json' }, source: 'wizard' };
    dispatch(getInfo(op2));

    const op3: OperateStruct = { operationType: 'getUserConfig', paramData: '', source: 'wizard' };
    dispatch(getInfo(op3));
  }, [dispatch]);

  // pre-fill last used path from userConfig
  useEffect(() => {
    if (userConfig?.projectCreate_last_projectPath) {
      form.setFieldsValue({ projectPath: userConfig.projectCreate_last_projectPath });
      setProjectPath(userConfig.projectCreate_last_projectPath);
    }
  }, [userConfig]);

  // path selected via dialog
  useEffect(() => {
    if (projectPathInfo) {
      form.setFieldsValue({ projectPath: projectPathInfo });
      setProjectPath(projectPathInfo);
      form.validateFields(['projectPath']);
    }
  }, [projectPathInfo]);

  // path validation feedback
  useEffect(() => {
    if (projectPathRightInfo !== undefined) { setProjectPathWrong(false); }
  }, [projectPathRightInfo]);
  useEffect(() => {
    if (projectPathWrongInfo !== undefined) { setProjectPathWrong(true); }
  }, [projectPathWrongInfo]);

  // project exists
  useEffect(() => {
    if (thisProjectExists) { setIsErrOpen(true); }
  }, [thisProjectExists]);

  // project created successfully → modal closes
  useEffect(() => {
    if (thisProjectNotExists) { setIsOpen(false); }
  }, [thisProjectNotExists]);

  // ── SOC change ──────────────────────────────────────────────────────────────
  const onSocChange = (value: string): void => {
    setSoc(value);
    const constraint = PLATFORM_MAP[value];
    if (constraint) {
      setPlatform(constraint.defaultPlatform);
      setPlatformFixed(constraint.platformFixed);
      form.setFieldsValue({ platform: constraint.defaultPlatform });
    } else {
      setPlatform('CPU');
      setPlatformFixed(false);
      form.setFieldsValue({ platform: 'CPU' });
    }
    // trigger path validation
    const op: OperateStruct = {
      operationType: 'updateProjectTips',
      paramData: { needValidate: true, projectPath },
      source: 'wizard',
    };
    dispatch(getInfo(op));
  };

  // ── Browse project path ─────────────────────────────────────────────────────
  const onBrowsePath = (): void => {
    const op: OperateStruct = {
      operationType: 'selectFolderPath',
      paramData: { key: 'projectPathInfo', currentValue: projectPath },
      source: 'wizard',
    };
    dispatch(getInfo(op));
  };

  // ── Finish ──────────────────────────────────────────────────────────────────
  const onFinish = (): void => {
    form.validateFields().then(() => {
      dispatch(sendProjectData({
        operationType: 'getProjectData',
        projectData: {
          soc,
          board:       soc,   // board === soc in shadow (1-to-1)
          platform,
          projectName,
          projectPath,
        },
      }));
    }).catch(() => { /* validation failed, show inline errors */ });
  };

  // ── Cancel ──────────────────────────────────────────────────────────────────
  const onCancel = (): void => {
    setIsOpen(false);
    vscode.postMessage({ method: 'closeProjectWizard', params: {} });
  };

  // ── Flat soc options from grouped chiplist ──────────────────────────────────
  const allChips: SocChipItem[] = chipList.reduce<SocChipItem[]>((list, group) => {
    return list.concat(group.children ?? []);
  }, []);

  // ── Validation rules ────────────────────────────────────────────────────────
  const nameRules: any[] = [
    { required: true, message: t('fieldCannotEmpty', { field: t('projectName') }) },
    { pattern: /^[\w\-\s.]+$/i, message: t('nameRule') },
    { pattern: /^.*[^\s.]$/i,   message: t('nameRule2') },
    { max: 50, message: t('overMmaxLength', { length: '50' }) },
  ];
  const pathRules: any[] = [
    { required: true, message: t('fieldCannotEmpty', { field: t('projectPath') }) },
    {
      pattern: /^(?:[a-zA-Z]:[\\/]|\/)(?:[^\\/\0]*[\\/]?)*[^\\/\0]*$/i,
      message: t('projectPathRule'),
    },
    {
      validator: (): Promise<void> =>
        projectPathWrong ? Promise.reject(t('projectPathNotExist')) : Promise.resolve(),
    },
  ];

  return (
    <>
      <Modal
        title={
          <span style={{ color: '#666' }}>{t('projectWizard')}</span>
        }
        visible={isOpen}
        width={600}
        onCancel={onCancel}
        footer={
          <Space>
            <Button type="primary" onClick={onFinish}>{t('finished')}</Button>
            <Button onClick={onCancel}>{t('cancel')}</Button>
          </Space>
        }
      >
        <strong>{t('projectCreateTitle')}</strong>
        <br />
        <span style={{ color: '#a3a3a3' }}>{t('projectCreateDescription')}</span>
        <br /><br />

        <Form layout="vertical" form={form} autoComplete="off">

          {/* ── Row 1: SOC + Platform ── */}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label={t('SOC')}
                name="soc"
                rules={[{ required: true, message: t('fieldCannotEmpty', { field: t('SOC') }) }]}
              >
                <Select
                  placeholder={t('selectSoc')}
                  onChange={onSocChange}
                  showSearch
                >
                  {allChips.map((chip) => (
                    <Option key={chip.value} value={chip.value}>
                      {chip.title}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label={t('platform')}
                name="platform"
                rules={[{ required: true, message: t('fieldCannotEmpty', { field: t('platform') }) }]}
              >
                <Select
                  value={platform || undefined}
                  disabled={platformFixed || !soc}
                  onChange={(v: 'CPU' | 'NPU') => setPlatform(v)}
                  placeholder="—"
                >
                  <Option value="CPU">{t('CPU')}</Option>
                  <Option value="NPU">{t('NPU')}</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* ── Row 2: Project Name ── */}
          <Row>
            <Col span={24}>
              <Form.Item label={t('projectName')} name="projectName" rules={nameRules}>
                <Input
                  placeholder={t('projectNameInputPrompt')}
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* ── Row 3: Project Path ── */}
          <Row>
            <Col span={24}>
              <Form.Item label={t('projectPath')} name="projectPath" rules={pathRules}>
                <Input.Group compact>
                  <Input
                    readOnly
                    style={{ width: 'calc(100% - 37px)' }}
                    placeholder={t('projectPathInputPrompt')}
                    value={projectPath}
                    onClick={onBrowsePath}
                  />
                  <Button
                    type="primary"
                    style={{ paddingLeft: 10 }}
                    onClick={onBrowsePath}
                    icon={<FolderOpenOutlined style={{ color: '#fff' }} />}
                  />
                </Input.Group>
              </Form.Item>
            </Col>
          </Row>

        </Form>
      </Modal>

      {/* ── Already-exists error modal ── */}
      <Modal
        title={t('create_project_warning')}
        visible={isErrOpen}
        closable={false}
        centered
        footer={<Button type="primary" onClick={() => setIsErrOpen(false)}>{t('finished')}</Button>}
      >
        <span>
          {t('createProjectFailedInfo1')}
          <strong>{`${projectPath}/${projectName}`}</strong>
          {t('createProjectFailedInfo2')}
        </span>
      </Modal>
    </>
  );
};

export default ProjectWizard;
