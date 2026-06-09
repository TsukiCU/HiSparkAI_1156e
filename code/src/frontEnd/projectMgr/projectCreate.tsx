/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
import * as React from 'react';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Modal, Form, Row, Col, Select, Input, Button,
} from 'antd';
import { FolderOpenOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

import { getInfo, sendProjectData } from './actions';
import type { OperateStruct, SocChipItem, SocGroupItem } from '../../backEnd/projectMgr/interface/model';
import Drag from './component/drag';
import { vscode } from './index';

const { Option } = Select;

// Chips available in the projectMgr — MCU is excluded intentionally.
const ALLOWED_SOCS = new Set(['ws63', '3322', '1156e']);

// SOC-to-platform mapping.  fixed=true locks the platform dropdown.
// 1156e is intentionally absent so both CPU and NPU can be selected
// (chiplist.json: defaultPlatform='CPU', platformFixed=false).
const PLATFORM_MAP: Record<string, { platform: 'CPU' | 'NPU'; fixed: boolean }> = {
  ws63:   { platform: 'CPU', fixed: true },
  '3322': { platform: 'NPU', fixed: true },
};

// Chips for which SDK path validation is performed.
const SDK_VALIDATED_CHIPS = new Set(['ws63', '3322']);

let drag: Drag | undefined;

const ProjectCreate = (): JSX.Element => {
  const { t }    = useTranslation();
  const dispatch = useDispatch();
  const [form]   = Form.useForm();

  // ── form state ────────────────────────────────────────────────────────────
  const [soc,             setSoc]             = useState('');
  const [board,           setBoard]           = useState('');
  const [boardList,       setBoardList]       = useState<string[]>([]);
  const [platform,        setPlatform]        = useState<'CPU' | 'NPU' | ''>('');
  const [platformFixed,   setPlatformFixed]   = useState(false);
  const [sdkPath,         setSdkPath]         = useState('');
  const [projectPath,     setProjectPath]     = useState('');
  const [projectName,     setProjectName]     = useState('');

  // ── validation state ──────────────────────────────────────────────────────
  const [projectPathWrong, setProjectPathWrong] = useState(false);
  const [sdkContentWrong,  setSdkContentWrong]  = useState(false);
  const [sdkValidated,     setSdkValidated]     = useState(false); // true once user picked a path

  // ── modal state ───────────────────────────────────────────────────────────
  const [isOpen,    setIsOpen]    = useState(true);
  const [isErrOpen, setIsErrOpen] = useState(false);

  // ── redux ─────────────────────────────────────────────────────────────────
  const chipList: SocGroupItem[]  = useSelector((s: any) => s.entities.chipList  ?? []);
  const userConfig: any           = useSelector((s: any) => s.entities.userConfig ?? null);
  const sdkPathInfo: any          = useSelector((s: any) => s.entities.sdkPathInfo);
  const sdkPathRightInfo: any     = useSelector((s: any) => s.entities.sdkPathRightInfo);
  const sdkPathWrongInfo: any     = useSelector((s: any) => s.entities.sdkPathWrongInfo);
  const projectPathInfo: any      = useSelector((s: any) => s.entities.projectPathInfo);
  const projectPathRightInfo: any = useSelector((s: any) => s.entities.projectPathRightInfo);
  const projectPathWrongInfo: any = useSelector((s: any) => s.entities.projectPathWrongInfo);
  const thisProjectExists: any    = useSelector((s: any) => s.entities.thisProjectExists);
  const thisProjectNotExists: any = useSelector((s: any) => s.entities.thisProjectNotExists);

  // ── drag init ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen && !drag) {
      drag = new Drag('ant-modal', 'ant-modal-header', 0);
      drag.init();
    }
  }, [isOpen]);

  // ── mount ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(getInfo({ operationType: 'getLanguage',   paramData: '',                              source: 'projectMgr' }));
    dispatch(getInfo({ operationType: 'getJsonInfo',   paramData: { fileName: 'chiplist.json' }, source: 'projectMgr' }));
    dispatch(getInfo({ operationType: 'getUserConfig', paramData: '',                              source: 'projectMgr' }));
  }, [dispatch]);

  // ── userConfig → pre-fill project path ────────────────────────────────────
  useEffect(() => {
    if (userConfig?.projectCreate_last_projectPath) {
      form.setFieldsValue({ projectPath: userConfig.projectCreate_last_projectPath });
      setProjectPath(userConfig.projectCreate_last_projectPath);
    }
  }, [userConfig]);

  // ── SDK path selected via dialog ──────────────────────────────────────────
  useEffect(() => {
    if (sdkPathInfo == null) { return; }
    form.setFieldsValue({ sdkPath: sdkPathInfo });
    setSdkPath(sdkPathInfo);
    setSdkValidated(true);
    // Trigger backend validation for ws63 / 3322.
    if (soc && SDK_VALIDATED_CHIPS.has(soc)) {
      dispatch(getInfo({ operationType: 'updateSdkTips', paramData: { soc, sdkPath: sdkPathInfo }, source: 'projectMgr' }));
    } else {
      // No validation needed for this chip — mark as valid.
      setSdkContentWrong(false);
    }
  }, [sdkPathInfo]);

  // ── SDK validation result ─────────────────────────────────────────────────
  useEffect(() => {
    if (sdkPathRightInfo !== undefined) {
      setSdkContentWrong(false);
      form.validateFields(['sdkPath']);
    }
  }, [sdkPathRightInfo]);

  useEffect(() => {
    if (sdkPathWrongInfo !== undefined) {
      setSdkContentWrong(true);
      form.validateFields(['sdkPath']);
    }
  }, [sdkPathWrongInfo]);

  // ── project path selected via dialog ──────────────────────────────────────
  useEffect(() => {
    if (projectPathInfo) {
      form.setFieldsValue({ projectPath: projectPathInfo });
      setProjectPath(projectPathInfo);
      form.validateFields(['projectPath']);
    }
  }, [projectPathInfo]);

  useEffect(() => {
    if (projectPathRightInfo !== undefined) { setProjectPathWrong(false); }
  }, [projectPathRightInfo]);

  useEffect(() => {
    if (projectPathWrongInfo !== undefined) { setProjectPathWrong(true); }
  }, [projectPathWrongInfo]);

  // ── project exists / created ───────────────────────────────────────────────
  useEffect(() => { if (thisProjectExists)    { setIsErrOpen(true);  } }, [thisProjectExists]);
  useEffect(() => { if (thisProjectNotExists) { setIsOpen(false); }     }, [thisProjectNotExists]);

  // ── SOC change ────────────────────────────────────────────────────────────
  const onSocChange = (value: string): void => {
    setSoc(value);

    // Board list from chiplist.
    const chip = allChips.find((c) => c.value === value);
    const boards = chip?.boards ?? [value];
    setBoardList(boards);
    const firstBoard = boards[0] ?? value;
    setBoard(firstBoard);
    form.setFieldsValue({ board: firstBoard });

    // Platform (auto).
    const constraint = PLATFORM_MAP[value];
    if (constraint) {
      setPlatform(constraint.platform);
      setPlatformFixed(constraint.fixed);
      form.setFieldsValue({ platform: constraint.platform });
    } else {
      setPlatform('CPU');
      setPlatformFixed(false);
      form.setFieldsValue({ platform: 'CPU' });
    }

    // Re-validate SDK if already set.
    if (sdkPath && SDK_VALIDATED_CHIPS.has(value)) {
      dispatch(getInfo({ operationType: 'updateSdkTips', paramData: { soc: value, sdkPath }, source: 'projectMgr' }));
    } else if (sdkPath) {
      setSdkContentWrong(false);
    }

    // Re-check project path.
    dispatch(getInfo({ operationType: 'updateProjectTips', paramData: { needValidate: true, projectPath }, source: 'projectMgr' }));
  };

  // ── browse handlers ───────────────────────────────────────────────────────
  const onBrowseSdkPath = (): void => {
    // Pass the selected SOC so the backend can use the chip-specific SDK picker
    // (e.g. QuickPick for 1156e instead of a local folder browser).
    dispatch(getInfo({ operationType: 'selectFolderPath', paramData: { key: 'sdkPathInfo', currentValue: sdkPath, soc }, source: 'projectMgr' }));
  };

  const onBrowsePath = (): void => {
    dispatch(getInfo({ operationType: 'selectFolderPath', paramData: { key: 'projectPathInfo', currentValue: projectPath }, source: 'projectMgr' }));
  };

  // ── finish ────────────────────────────────────────────────────────────────
  const onFinish = (): void => {
    form.validateFields().then(() => {
      dispatch(sendProjectData({
        operationType: 'getProjectData',
        projectData: { soc, board, platform, projectName, projectPath, sdkPath },
      }));
    }).catch(() => {});
  };

  const onCancel = (): void => {
    setIsOpen(false);
    vscode.postMessage({ method: 'closeProjectMgr', params: {} });
  };

  // ── chip data ─────────────────────────────────────────────────────────────
  const allChips: SocChipItem[] = chipList
    .reduce<SocChipItem[]>((list, group) => list.concat(group.children ?? []), [])
    .filter((chip) => ALLOWED_SOCS.has(chip.value));

  // ── validation rules ──────────────────────────────────────────────────────
  const nameRules: any[] = [
    { required: true, message: t('fieldCannotEmpty', { field: t('projectName') }) },
    { pattern: /^[\w\-\s.]+$/i, message: t('nameRule') },
    { pattern: /^.*[^\s.]$/i,   message: t('nameRule2') },
    { max: 50, message: t('overMmaxLength', { length: '50' }) },
  ];
  const pathRules: any[] = [
    { required: true, message: t('fieldCannotEmpty', { field: t('projectPath') }) },
    { pattern: /^(?:[a-zA-Z]:[\\/]|\/)(?:[^\\/\0]*[\\/]?)*[^\\/\0]*$/i, message: t('projectPathRule') },
    { validator: (): Promise<void> => projectPathWrong ? Promise.reject(t('projectPathNotExist')) : Promise.resolve() },
  ];
  const sdkRules: any[] = [
    { required: true, message: t('fieldCannotEmpty', { field: t('sdkPath') }) },
    {
      validator: (): Promise<void> => {
        if (!sdkValidated || !SDK_VALIDATED_CHIPS.has(soc)) { return Promise.resolve(); }
        if (sdkContentWrong) {
          const chip = soc.toUpperCase();
          return Promise.reject(t('sdkWrongInfo', { chip }));
        }
        return Promise.resolve();
      },
    },
  ];

  return (
    <>
      <Modal
        title={<span style={{ fontWeight: 500, fontSize: 14 }}>{t('projectWizard')}</span>}
        visible={isOpen}
        width={640}
        onCancel={onCancel}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button type="primary" onClick={onFinish}>{t('finished')}</Button>
            <Button onClick={onCancel}>{t('cancel')}</Button>
          </div>
        }
      >
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: 4 }}>
            {t('projectCreateTitle')}
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
            {t('projectCreateDescription')}
          </div>
        </div>

        <Form layout="vertical" form={form} autoComplete="off" requiredMark={false}>

          {/* ── Row 1: SOC + Board + Platform ── */}
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label={t('SOC')}
                name="soc"
                rules={[{ required: true, message: t('fieldCannotEmpty', { field: t('SOC') }) }]}
              >
                <Select placeholder={t('selectSoc')} onChange={onSocChange} showSearch>
                  {allChips.map((chip) => (
                    <Option key={chip.value} value={chip.value}>{chip.title}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={8}>
              <Form.Item
                label={t('board')}
                name="board"
                rules={[{ required: true, message: t('fieldCannotEmpty', { field: t('board') }) }]}
              >
                <Select
                  placeholder={t('selectBoard')}
                  disabled={!soc}
                  value={board || undefined}
                  onChange={(v: string) => setBoard(v)}
                >
                  {boardList.map((b) => (
                    <Option key={b} value={b}>{b}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={8}>
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

          {/* ── Project Name ── */}
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

          {/* ── Project Path ── */}
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
                    className="browse"
                    onClick={onBrowsePath}
                    icon={<FolderOpenOutlined style={{ color: '#fff' }} />}
                  />
                </Input.Group>
              </Form.Item>
            </Col>
          </Row>

          {/* ── SDK Path ── */}
          <Row>
            <Col span={24}>
              <Form.Item label={t('sdkPath')} name="sdkPath" rules={sdkRules}>
                <Input.Group compact>
                  <Input
                    readOnly
                    style={{ width: 'calc(100% - 37px)' }}
                    placeholder={t('sdkPathInputPrompt')}
                    value={sdkPath}
                    onClick={onBrowseSdkPath}
                  />
                  <Button
                    type="primary"
                    className="browse"
                    onClick={onBrowseSdkPath}
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

export default ProjectCreate;
