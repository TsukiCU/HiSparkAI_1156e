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
import { Modal, Input, Form, Space, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { clone } from '../../component/utils';

const MacroModal = (props: any): JSX.Element => {
  const { visible, setVisible, title, globalMacroObj, setGlobalMacroDef } = props;
  const { t } = useTranslation();
  const [macroForm] = Form.useForm();

  const [selfName, setSelfName] = useState('');
  const [selfValue, setSelfValue] = useState('');

  useEffect(() => {
    if (props?.inputName) {
      setSelfName(props?.inputName);
    }
  }, [props?.inputName, visible]);

  useEffect(() => {
    if (props?.inputValue) {
      setSelfValue(props?.inputValue);
    }
  }, [props?.inputValue, visible]);

  useEffect(() => {
    macroForm.setFieldsValue({ macroName: selfName });
  }, [selfName]);

  useEffect(() => {
    macroForm.setFieldsValue({ macroValue: selfValue });
  }, [selfValue]);

  const confirm = (): void => {
    macroForm.validateFields().then(() => {
      let obj = clone(globalMacroObj);
      if (props.inputName) {
        delete obj[props.inputName];
      }
      obj[selfName] = selfValue;
      setGlobalMacroDef(JSON.stringify(obj));
      setVisible(false);
    }).catch(() => { });
  };

  return <Modal
    destroyOnClose
    visible={visible}
    title={`${title} ${t('macro')}`}
    onCancel={(): void => setVisible(false)}
    width={800}
    footer={[
      <Space direction="horizontal" size="large">
        <div className='footerBar'>
          <Button type='primary' onClick={confirm}>
            {t('confirm')}
          </Button>
          <Button onClick={(): void => setVisible(false)}>
            {t('cancel')}
          </Button>
        </div>
      </Space>,
    ]}
  >
    <Form
      form={macroForm}
      name="wrap"

      labelCol={{ flex: '60px' }}
      labelAlign="left"
      labelWrap={false}
      wrapperCol={{ flex: 1 }}
      colon={false}
    >
      <Form.Item label={t('macro')} name="macroName"
        labelCol={{ span: 24, offset: 0 }} wrapperCol={{ span: 24, offset: 0 }}
        rules={[
          {
            required: true,
            message: t('macroNameEmpty') ?? 'The macro name cannot be empty.',
          },
          {
            validator: (): Promise<void> => {
              if (globalMacroObj[selfName] !== undefined && props?.inputName !== selfName) {
                return Promise.reject(t('macroNameUnique'));
              }
              return Promise.resolve();
            },
          },
          {
            whitespace: false,
            pattern: /^[a-z_]+\w*$/i,
            type: 'string',
            message: t('macroNameRule') ?? 'Macro name consists of uppercase letters, lowercase letters, digits, and underscores (_), and cannot start with a digit.',
          },
          {
            whitespace: false,
            type: 'string',
            max: 32,
            message: t('overMmaxLength', { length: 32 }) ?? 'Maximum length must not exceed 32.',
          },
        ]}>
        <Input placeholder={t('inputMacroName') ?? 'Enter a macro name'} value={selfName} onChange={(e): void => setSelfName(e.target.value)} />
      </Form.Item>

      <Form.Item label={t('value')} name="macroValue"
        labelCol={{ span: 24, offset: 0 }} wrapperCol={{ span: 24, offset: 0 }}
        rules={[
          {
            whitespace: false,
            type: 'string',
            max: 32,
            message: t('overMmaxLength', { length: 32 }) ?? 'Maximum length must not exceed 32.',
          },
        ]}>
        <Input placeholder={t('inputMacroValue') ?? 'Enter a value for the macro'} onChange={(e): void => setSelfValue(e.target.value)} />
      </Form.Item>

    </Form>
  </Modal>;
};

export default MacroModal;