import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Form, Select, DatePicker, Input, message, Modal } from 'antd';
import { WarningOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { riskApi } from '../api/risk';
import { commonApi } from '../api/common';
import { RiskWarning, WarningLevel, WarningStatus, WarningLevelColors, WarningLevelTexts, WarningStatusTexts, WarningType } from '../types';
import dayjs from 'dayjs';
import { formatPercent, formatLocaleNumber } from '../utils/format';

const WarningsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [warnings, setWarnings] = useState<RiskWarning[]>([]);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [filters, setFilters] = useState<{
    status?: WarningStatus;
    warning_level?: WarningLevel;
    customer_id?: string;
  }>({});
  const [customers, setCustomers] = useState<any[]>([]);
  const [generateModalVisible, setGenerateModalVisible] = useState(false);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await riskApi.getWarnings({
        ...filters,
        page: pagination.current,
        page_size: pagination.pageSize,
      });
      setWarnings(result.warnings);
      setTotal(result.total);
    } catch (error) {
      console.error('Failed to load warnings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [pagination, filters]);

  useEffect(() => {
    const fetchCustomers = async () => {
      const result = await commonApi.getCustomers({ page_size: 100 });
      setCustomers(result.customers);
    };
    fetchCustomers();
  }, []);

  const handleGenerateWarning = async (values: any) => {
    try {
      await riskApi.generateWarning(values);
      message.success('预警生成成功');
      setGenerateModalVisible(false);
      form.resetFields();
      loadData();
    } catch (error) {
      console.error('Failed to generate warning:', error);
    }
  };

  const columns = [
    {
      title: '客户名称',
      dataIndex: 'customer_name',
      key: 'customer_name',
    },
    {
      title: '账号',
      dataIndex: 'account_number',
      key: 'account_number',
    },
    {
      title: '预警类型',
      dataIndex: 'warning_type',
      key: 'warning_type',
      render: (type: WarningType) => {
        const texts: Record<WarningType, string> = {
          maintenance_ratio: '维持担保比例',
          suspended_security: '停牌证券',
          other: '其他',
        };
        return texts[type];
      },
    },
    {
      title: '维持担保比例',
      dataIndex: 'maintenance_ratio',
      key: 'maintenance_ratio',
      render: (val: number) => (
        <span style={{ fontWeight: 600 }}>{formatPercent(val)}</span>
      ),
      sorter: (a: RiskWarning, b: RiskWarning) => a.maintenance_ratio - b.maintenance_ratio,
    },
    {
      title: '担保品价值',
      dataIndex: 'total_collateral_value',
      key: 'total_collateral_value',
      render: (val: number) => `¥${formatLocaleNumber(val)}`,
    },
    {
      title: '负债总额',
      dataIndex: 'total_debt',
      key: 'total_debt',
      render: (val: number) => `¥${formatLocaleNumber(val)}`,
    },
    {
      title: '风险等级',
      dataIndex: 'warning_level',
      key: 'warning_level',
      render: (level: WarningLevel) => (
        <Tag color={WarningLevelColors[level]}>{WarningLevelTexts[level]}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: WarningStatus) => WarningStatusTexts[status],
    },
    {
      title: '触发时间',
      dataIndex: 'triggered_at',
      key: 'triggered_at',
      render: (val: string) => new Date(val).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: RiskWarning) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/warnings/${record.warning_id}`)}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 className="page-title">
          <WarningOutlined style={{ marginRight: 8 }} />
          风险预警
        </h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setGenerateModalVisible(true)}>
          生成预警
        </Button>
      </div>

      <div className="filter-bar">
        <Form layout="inline" onFinish={(values) => setFilters(values)}>
          <Form.Item name="status" label="状态">
            <Select
              allowClear
              placeholder="选择状态"
              style={{ width: 150 }}
              options={[
                { value: 'pending', label: '待处理' },
                { value: 'in_progress', label: '处理中' },
                { value: 'resolved', label: '已解决' },
                { value: 'liquidated', label: '已平仓' },
                { value: 'cancelled', label: '已取消' },
              ]}
            />
          </Form.Item>
          <Form.Item name="warning_level" label="风险等级">
            <Select
              allowClear
              placeholder="选择等级"
              style={{ width: 150 }}
              options={[
                { value: 'warning', label: '预警' },
                { value: 'danger', label: '警戒' },
                { value: 'liquidation', label: '平仓' },
              ]}
            />
          </Form.Item>
          <Form.Item name="customer_id" label="客户">
            <Select
              allowClear
              placeholder="选择客户"
              style={{ width: 200 }}
              showSearch
              optionFilterProp="label"
              options={customers.map((c) => ({
                value: c.customer_id,
                label: `${c.customer_name} (${c.account_number})`,
              }))}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                筛选
              </Button>
              <Button
                onClick={() => {
                  setFilters({});
                  form.resetFields();
                }}
              >
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </div>

      <Table
        loading={loading}
        dataSource={warnings}
        columns={columns}
        rowKey="warning_id"
        pagination={{
          ...pagination,
          total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条记录`,
          onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
        }}
      />

      <Modal
        title="生成风险预警"
        open={generateModalVisible}
        onCancel={() => setGenerateModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleGenerateWarning}>
          <Form.Item
            name="customer_id"
            label="客户"
            rules={[{ required: true, message: '请选择客户' }]}
          >
            <Select
              placeholder="选择客户"
              showSearch
              optionFilterProp="label"
              options={customers.map((c) => ({
                value: c.customer_id,
                label: `${c.customer_name} (${c.account_number})`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="warning_type"
            label="预警类型"
            rules={[{ required: true, message: '请选择预警类型' }]}
            initialValue="maintenance_ratio"
          >
            <Select>
              <Select.Option value="maintenance_ratio">维持担保比例</Select.Option>
              <Select.Option value="suspended_security">停牌证券</Select.Option>
              <Select.Option value="other">其他</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                生成预警
              </Button>
              <Button onClick={() => setGenerateModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default WarningsPage;
