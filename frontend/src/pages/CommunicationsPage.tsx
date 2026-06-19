import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Form, Select, Tag } from 'antd';
import { MessageOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { customerApi } from '../api/customer';
import { commonApi } from '../api/common';
import {
  Communication,
  CommunicationTypeTexts,
} from '../types';

const CommunicationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [filters, setFilters] = useState<{
    customer_id?: string;
    manager_id?: string;
  }>({});
  const [customers, setCustomers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await customerApi.getCommunications({
        ...filters,
        page: pagination.current,
        page_size: pagination.pageSize,
      });
      setCommunications(result.communications);
      setTotal(result.total);
    } catch (error) {
      console.error('Failed to load communications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [pagination, filters]);

  useEffect(() => {
    const fetchData = async () => {
      const [customersResult, usersResult] = await Promise.all([
        commonApi.getCustomers({ page_size: 100 }),
        commonApi.getUsers(),
      ]);
      setCustomers(customersResult.customers);
      setUsers(usersResult);
    };
    fetchData();
  }, []);

  const columns = [
    {
      title: '客户',
      dataIndex: 'customer_name',
      key: 'customer_name',
    },
    {
      title: '沟通方式',
      dataIndex: 'communication_type',
      key: 'communication_type',
      render: (type: string) => (
        <Tag>
          {CommunicationTypeTexts[type as keyof typeof CommunicationTypeTexts]}
        </Tag>
      ),
    },
    {
      title: '沟通人',
      dataIndex: 'manager_name',
      key: 'manager_name',
    },
    {
      title: '沟通内容',
      dataIndex: 'content',
      key: 'content',
      ellipsis: {
        showTitle: false,
      },
      render: (val: string) => (
        <span title={val}>{val.length > 50 ? val.substring(0, 50) + '...' : val}</span>
      ),
    },
    {
      title: '客户回复',
      dataIndex: 'customer_response',
      key: 'customer_response',
      ellipsis: {
        showTitle: false,
      },
      render: (val?: string) =>
        val ? (
          <span title={val}>
            {val.length > 30 ? val.substring(0, 30) + '...' : val}
          </span>
        ) : (
          '-'
        ),
    },
    {
      title: '下次跟进时间',
      dataIndex: 'next_follow_up_at',
      key: 'next_follow_up_at',
      render: (val?: string) =>
        val ? new Date(val).toLocaleString('zh-CN') : '-',
    },
    {
      title: '沟通时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (val: string) => new Date(val).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Communication) => (
        <Button type="link" onClick={() => navigate(`/warnings/${record.warning_id}`)}>
          查看预警
        </Button>
      ),
    },
  ];

  return (
    <div className="page-container">
      <h1 className="page-title">
        <MessageOutlined style={{ marginRight: 8 }} />
        沟通记录
      </h1>

      <div className="filter-bar">
        <Form layout="inline" onFinish={(values) => setFilters(values)}>
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
          <Form.Item name="manager_id" label="沟通人">
            <Select
              allowClear
              placeholder="选择沟通人"
              style={{ width: 180 }}
              options={users.map((u) => ({ value: u.user_id, label: u.full_name }))}
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
        dataSource={communications}
        columns={columns}
        rowKey="communication_id"
        pagination={{
          ...pagination,
          total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条记录`,
          onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
        }}
      />
    </div>
  );
};

export default CommunicationsPage;
