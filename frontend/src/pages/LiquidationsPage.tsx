import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Form, Select, Modal, message, Popconfirm, Input } from 'antd';
import { SwapOutlined, EyeOutlined, PlayCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { tradingApi } from '../api/trading';
import { commonApi } from '../api/common';
import {
  ForcedLiquidation,
  LiquidationStatus,
  LiquidationStatusTexts,
  WarningLevelColors,
  WarningLevelTexts,
} from '../types';

const LiquidationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [liquidations, setLiquidations] = useState<ForcedLiquidation[]>([]);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [filters, setFilters] = useState<{ status?: LiquidationStatus; customer_id?: string }>({});
  const [customers, setCustomers] = useState<any[]>([]);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [selectedLiquidation, setSelectedLiquidation] = useState<ForcedLiquidation | null>(null);
  const [cancelForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await tradingApi.getLiquidations({
        ...filters,
        page: pagination.current,
        page_size: pagination.pageSize,
      });
      setLiquidations(result.liquidations);
      setTotal(result.total);
    } catch (error) {
      console.error('Failed to load liquidations:', error);
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

  const handleExecute = async (id: string) => {
    try {
      await tradingApi.executeLiquidation(id);
      message.success('强平执行成功');
      loadData();
    } catch (error) {
      console.error('Failed to execute liquidation:', error);
    }
  };

  const handleCancel = async (values: any) => {
    if (!selectedLiquidation) return;
    try {
      await tradingApi.cancelLiquidation(selectedLiquidation.liquidation_id, values);
      message.success('强平已撤销');
      setCancelModalVisible(false);
      cancelForm.resetFields();
      setSelectedLiquidation(null);
      loadData();
    } catch (error) {
      console.error('Failed to cancel liquidation:', error);
    }
  };

  const columns = [
    {
      title: '客户',
      dataIndex: 'customer_name',
      key: 'customer_name',
    },
    {
      title: '账号',
      dataIndex: 'account_number',
      key: 'account_number',
    },
    {
      title: '触发时维持比例',
      dataIndex: 'trigger_maintenance_ratio',
      key: 'trigger_maintenance_ratio',
      render: (val: number) => `${val.toFixed(2)}%`,
    },
    {
      title: '风险等级',
      dataIndex: 'warning_level',
      key: 'warning_level',
      render: (level: string) =>
        level ? (
          <Tag color={WarningLevelColors[level as keyof typeof WarningLevelColors]}>
            {WarningLevelTexts[level as keyof typeof WarningLevelTexts]}
          </Tag>
        ) : null,
    },
    {
      title: '触发时间',
      dataIndex: 'trigger_time',
      key: 'trigger_time',
      render: (val: string) => new Date(val).toLocaleString('zh-CN'),
    },
    {
      title: '触发时间锁定',
      dataIndex: 'is_trigger_time_locked',
      key: 'is_trigger_time_locked',
      render: (val: boolean) => (val ? <Tag color="red">已锁定</Tag> : <Tag color="green">可修改</Tag>),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: LiquidationStatus) => LiquidationStatusTexts[status],
    },
    {
      title: '强平金额',
      dataIndex: 'total_liquidated_amount',
      key: 'total_liquidated_amount',
      render: (val?: number) => (val ? `¥${val.toLocaleString()}` : '-'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: ForcedLiquidation) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/liquidations/${record.liquidation_id}`)}
          >
            详情
          </Button>
          {record.status === 'pending' && (
            <>
              <Popconfirm
                title="确认执行强平?"
                description="执行后将无法撤销，触发时间将被锁定"
                onConfirm={() => handleExecute(record.liquidation_id)}
                okText="确认执行"
                cancelText="取消"
                okButtonProps={{ danger: true }}
              >
                <Button type="primary" size="small" icon={<PlayCircleOutlined />} danger>
                  执行
                </Button>
              </Popconfirm>
              <Button
                type="link"
                icon={<CloseCircleOutlined />}
                onClick={() => {
                  setSelectedLiquidation(record);
                  setCancelModalVisible(true);
                }}
              >
                撤销
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="page-container">
      <h1 className="page-title">
        <SwapOutlined style={{ marginRight: 8 }} />
        强平管理
      </h1>

      <div className="filter-bar">
        <Form layout="inline" onFinish={(values) => setFilters(values)}>
          <Form.Item name="status" label="状态">
            <Select
              allowClear
              placeholder="选择状态"
              style={{ width: 150 }}
              options={[
                { value: 'pending', label: '待执行' },
                { value: 'in_progress', label: '执行中' },
                { value: 'completed', label: '已完成' },
                { value: 'cancelled', label: '已撤销' },
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
              <Button onClick={() => setFilters({})}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </div>

      <Table
        loading={loading}
        dataSource={liquidations}
        columns={columns}
        rowKey="liquidation_id"
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
        title="撤销强平"
        open={cancelModalVisible}
        onCancel={() => {
          setCancelModalVisible(false);
          setSelectedLiquidation(null);
        }}
        footer={null}
      >
        <Form form={cancelForm} layout="vertical" onFinish={handleCancel}>
          <Form.Item
            name="cancellation_reason"
            label="撤销原因"
            rules={[{ required: true, message: '请输入撤销原因' }]}
          >
            <Input.TextArea rows={4} placeholder="请输入撤销原因..." />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" danger htmlType="submit">
                确认撤销
              </Button>
              <Button
                onClick={() => {
                  setCancelModalVisible(false);
                  setSelectedLiquidation(null);
                }}
              >
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LiquidationsPage;
