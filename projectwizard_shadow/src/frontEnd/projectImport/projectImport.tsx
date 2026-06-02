/**
 * Copyright (c) 2025-2026 HiSilicon (Shanghai) Technologies Co., Ltd. All rights reserved.
 * Licensed under the Apache License, Version 2.0
 */
import * as React from 'react';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Modal, Button, Space, Input, Table, Checkbox, Tooltip,
} from 'antd';
import { FolderOpenOutlined, SyncOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';

import { getInfo, sendProjectData } from '../actions';
import type { OperateStruct } from '../../backEnd/interface/model';
import Drag from '../component/drag';
import { vscode } from '../index';

interface ImportItem {
  key: string;
  name: string;
  path: string;
  disabled: boolean;
}

let drag: Drag | undefined;

const ProjectImport = (): JSX.Element => {
  const { t }    = useTranslation();
  const dispatch = useDispatch();

  const [isOpen,        setIsOpen]        = useState(true);
  const [importPath,    setImportPath]    = useState('');
  const [items,         setItems]         = useState<ImportItem[]>([]);
  const [selectedKeys,  setSelectedKeys]  = useState<string[]>([]);

  const importablePath: any         = useSelector((s: any) => s.entities.importablePath);
  const importableItemsInfo: any    = useSelector((s: any) => s.entities.importableItemsInfo);
  const importResult: any           = useSelector((s: any) => s.entities.importResult);

  // init drag
  useEffect(() => {
    if (isOpen && !drag) {
      drag = new Drag('ant-modal', 'ant-modal-header', 0);
      drag.init();
    }
  }, [isOpen]);

  // fetch language on mount
  useEffect(() => {
    const op: OperateStruct = { operationType: 'getLanguage', paramData: '', source: 'import' };
    dispatch(getInfo(op));
  }, [dispatch]);

  // path returned from backend dialog
  useEffect(() => {
    if (importablePath) { setImportPath(importablePath); }
  }, [importablePath]);

  // scan results
  useEffect(() => {
    if (importableItemsInfo) {
      setItems(importableItemsInfo);
      setSelectedKeys([]);
    }
  }, [importableItemsInfo]);

  // import finished → close
  useEffect(() => {
    if (importResult) { setIsOpen(false); }
  }, [importResult]);

  // ── Browse scan path ──────────────────────────────────────────────────────
  const onBrowse = (): void => {
    const op: OperateStruct = { operationType: 'selectImportPath', paramData: {}, source: 'import' };
    dispatch(getInfo(op));
  };

  // ── Rescan ────────────────────────────────────────────────────────────────
  const onRescan = (): void => {
    if (!importPath) { return; }
    onBrowse();
  };

  // ── Confirm import ────────────────────────────────────────────────────────
  const onConfirm = (): void => {
    if (selectedKeys.length === 0) { return; }
    const selectedPaths = items
      .filter((item) => selectedKeys.includes(item.key))
      .map((item) => item.path);

    dispatch(sendProjectData({
      operationType: 'confirmImport',
      projectData: { selectedPaths },
    }));
  };

  const onCancel = (): void => {
    setIsOpen(false);
    vscode.postMessage({ method: 'closeProjectWizard', params: {} });
  };

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns: ColumnsType<ImportItem> = [
    {
      title: '',
      key: 'check',
      width: 40,
      render: (_, record) => (
        <Checkbox
          checked={selectedKeys.includes(record.key)}
          disabled={record.disabled}
          onChange={(e) => {
            setSelectedKeys((prev) =>
              e.target.checked
                ? [...prev, record.key]
                : prev.filter((k) => k !== record.key),
            );
          }}
        />
      ),
    },
    {
      title: t('name'),
      dataIndex: 'name',
      key: 'name',
      width: '30%',
      ellipsis: true,
    },
    {
      title: t('path'),
      dataIndex: 'path',
      key: 'path',
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text} placement="topLeft">
          <span>{text}</span>
        </Tooltip>
      ),
    },
  ];

  // ── Select all ─────────────────────────────────────────────────────────────
  const allKeys    = items.filter((i) => !i.disabled).map((i) => i.key);
  const allChecked = allKeys.length > 0 && allKeys.every((k) => selectedKeys.includes(k));
  const indeterminate = !allChecked && selectedKeys.length > 0;

  return (
    <Modal
      title={<span style={{ color: '#666' }}>{t('projectImportTitle')}</span>}
      visible={isOpen}
      width={680}
      onCancel={onCancel}
      footer={
        <Space>
          <Button
            type="primary"
            disabled={selectedKeys.length === 0}
            onClick={onConfirm}
          >
            {t('finished')}
          </Button>
          <Button onClick={onCancel}>{t('cancel')}</Button>
        </Space>
      }
    >
      <span style={{ color: '#a3a3a3' }}>{t('projectImportDescription')}</span>
      <br /><br />

      {/* ── Path row ── */}
      <Input.Group compact style={{ marginBottom: 12 }}>
        <Input
          readOnly
          style={{ width: 'calc(100% - 70px)' }}
          placeholder={t('selectImportPath')}
          value={importPath}
          onClick={onBrowse}
        />
        <Button
          type="primary"
          style={{ paddingLeft: 10 }}
          onClick={onBrowse}
          icon={<FolderOpenOutlined style={{ color: '#fff' }} />}
        />
        <Button
          style={{ marginLeft: 4 }}
          icon={<SyncOutlined />}
          onClick={onRescan}
          disabled={!importPath}
        />
      </Input.Group>

      {/* ── Select all header ── */}
      {items.length > 0 && (
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Checkbox
            indeterminate={indeterminate}
            checked={allChecked}
            onChange={(e) => setSelectedKeys(e.target.checked ? allKeys : [])}
          />
          <span style={{ color: '#a3a3a3', fontSize: 12 }}>
            {t('discoveredProjects')}
            {items.length} {t('name')}
          </span>
        </div>
      )}

      {/* ── File list table ── */}
      <Table<ImportItem>
        dataSource={items}
        columns={columns}
        pagination={false}
        rowKey="key"
        scroll={{ y: 300 }}
        size="small"
        locale={{ emptyText: t('selectImportItems') }}
      />
    </Modal>
  );
};

export default ProjectImport;
