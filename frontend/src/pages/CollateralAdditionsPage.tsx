import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Form, Select, Modal, message, Input } from 'antd';
import { PlusSquareOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { customerApi } from '../api/customer';
import { commonApi } from '../api/common';
import {
  CollateralAddition,
  AdditionStatus,
  AdditionStatusTexts,
  AdditionTypeTexts,
} from '../types';

const CollateralAdditionsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [additions, setAdditions] = useState<CollateralAddition[]>([]);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [filters, setFilters] = useState<{
    status?: AdditionStatus;
    customer_id?: string;
  }>({});
  const [customers, setCustomers] = useState<any[]>([]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [securities, setSecurities] = useState<any[]>([]);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await customerApi.getCollateralAdditions({
        ...filters,
        page: pagination.current,
        page_size: pagination.pageSize,
      });
      setAdditions(result.additions);
      setTotal(result.total);
    } catch (error) {
      console.error('Failed to load additions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [pagination, filters]);

  useEffect(() => {
    const fetchData = async () => {
      const [customersResult, securitiesResult] = await Promise.all([
        commonApi.getCustomers({ page_size: 100 }),
        commonApi.getSecurities(),
      ]);
      setCustomers(customersResult.customers);
      setSecurities(securitiesResult);
    };
    fetchData();
  }, []);

  const handleConfirm = async (additionId: string) => {
    try {
      await customerApi.confirmAddition(additionId);
      message.success('担保品追加已确认');
      loadData();
    } catch (error) {
      console.error('Failed to confirm addition:', error);
    }
  };

  const handleReject = async (additionId: string) => {
    Modal.confirm({
      title: '拒绝担保品追加',
      content: (
        <Form>
          <Form.Item label="拒绝原因" name="notes">
            <Input.TextArea rows={3} id="reject-notes" />
          </Form.Item>
        </Form>
      ),
      okText: '确认拒绝',
      okButtonProps: { danger: true },
      onOk: async () => {
        const notes = (document.getElementById('reject-notes') as HTMLTextAreaElement)?.value;
        try {
          await customerApi.rejectAddition(additionId, { notes });
          message.success('担保品追加已拒绝');
          loadData();
        } catch (error) {
          console.error('Failed to reject addition:', error);
        }
      },
    });
  };

  const handleCreate = async (values: any) => {
    try {
      await customerApi.recordCollateralAddition(values);
      message.success('担保品追加已记录');
      setCreateModalVisible(false);
      form.resetFields();
      loadData();
    } catch (error) {
      console.error('Failed to create addition:', error);
    }
  };

  const columns = [
    {
      title: '客户',
      dataIndex: 'customer_name',
      key: 'customer_name',
    },
    {
      title: '类型',
      dataIndex: 'addition_type',
      key: 'addition_type',
      render: (type: string) => AdditionTypeTexts[type as keyof typeof AdditionTypeTexts],
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (val: number) => `¥${val.toLocaleString()}`,
    },
    {
      title: '证券',
      dataIndex: 'security_name',
      key: 'security_name',
      render: (_val?: string, record?: CollateralAddition) =>
        record?.security_code ? `${record.security_code} ${_val}` : '-',
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (val?: number) => (val !== undefined ? val.toFixed(4) : '-'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: AdditionStatus) => (
        <Tag
          color={
            status === 'confirmed'
              ? 'green'
              : status === 'rejected'
              ? 'red'
              : status === 'pending'
              ? 'orange'
              : 'default'
          }
        >
          {AdditionStatusTexts[status]}
        </Tag>
      ),
    },
    {
      title: '提交人',
      dataIndex: 'submitter_name',
      key: 'submitter_name',
    },
    {
      title: '提交时间',
      dataIndex: 'submitted_at',
      key: 'submitted_at',
      render: (val: string) => new Date(val).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: CollateralAddition) =>
        record.status === 'pending' ? (
          <Space>
            <Button
              type="primary"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleConfirm(record.addition_id)}
            >
              确认
            </Button>
            <Button
              size="small"
              danger
              icon={<CloseCircleOutlined />}
              onClick={() => handleReject(record.addition_id)}
            >
              拒绝
            </Button>
          </Space>
        ) : null,
    },
  ];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 className="page-title">
          <PlusSquareOutlined style={{ marginRight: 8 }} />
          担保品追加
        </h1>
        <Button type="primary" onClick={() => setCreateModalVisible(true)}>
          记录追加
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
                { value: 'pending', label: '待确认' },
                { value: 'confirmed', label: '已确认' },
                { value: 'rejected', label: '已拒绝' },
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
        dataSource={additions}
        columns={columns}
        rowKey="addition_id"
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
        title="记录担保品追加"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
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
            name="addition_type"
            label="追加类型"
            rules={[{ required: true, message: '请选择类型' }]}
            initialValue="cash"
          >
            <Select>
              <Select.Option value="cash">现金</Select.Option>
              <Select.Option value="security">证券</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.addition_type !== curr.addition_type}
          >
            {({ getFieldValue }) => {
              const type = getFieldValue('addition_type');
              return (
                <>
                  <Form.Item
                    name="amount"
                    label="追加金额"
                    rules={[{ required: true, message: '请输入金额' }]}
                  >
                    <Input type="number" prefix="¥" placeholder="请输入金额" />
                  </Form.Item>
                  {type === 'security' && (
                    <>
                      <Form.Item
                        name="security_id"
                        label="证券"
                        rules={[{ required: true, message: '请选择证券' }]}
                      >
                        <Select
                          placeholder="选择证券"
                          showSearch
                          optionFilterProp="label"
                          options={securities.map((s) => ({
                            value: s.security_id,
                            label: `${s.security_code} ${s.security_name}`,
                          }))}
                        />
                      </Form.Item>
                      <Form.Item
                        name="quantity"
                        label="数量"
                        rules={[{ required: true, message: '请输入数量' }]}
                      >
                        <Input type="number" placeholder="请输入数量" />
                      </Form.Item>
                    </>
                  )}
                </>
              );
            }}
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
              <Button onClick={() => setCreateModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CollateralAdditionsPage;
