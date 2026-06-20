import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Input, Form, Select, Space } from 'antd';
import { UserOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { commonApi } from '../api/common';
import { Customer, WarningLevelColors, WarningLevelTexts } from '../types';
import { formatPercent, formatLocaleNumber } from '../utils/format';

const CustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [filters, setFilters] = useState<{ keyword?: string; manager_id?: string }>({});
  const [users, setUsers] = useState<any[]>([]);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await commonApi.getCustomers({
        ...filters,
        page: pagination.current,
        page_size: pagination.pageSize,
      });
      setCustomers(result.customers);
      setTotal(result.total);
    } catch (error) {
      console.error('Failed to load customers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [pagination, filters]);

  useEffect(() => {
    const fetchUsers = async () => {
      const result = await commonApi.getUsers({ role: 'customer_manager' });
      setUsers(result);
    };
    fetchUsers();
  }, []);

  const getRiskLevel = (ratio?: number, warningLine?: number, liquidationLine?: number) => {
    if (ratio === undefined) return null;
    if (ratio >= (warningLine || 150) * 1.2) return 'normal';
    if (ratio >= (warningLine || 150)) return 'warning';
    if (ratio >= (liquidationLine || 130)) return 'danger';
    return 'liquidation';
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
      title: '联系电话',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '客户经理',
      dataIndex: 'manager_name',
      key: 'manager_name',
    },
    {
      title: '担保品价值',
      dataIndex: 'total_collateral_value',
      key: 'total_collateral_value',
      render: (val?: number | null) => (val != null ? `¥${formatLocaleNumber(val)}` : '-'),
    },
    {
      title: '负债总额',
      dataIndex: 'total_debt',
      key: 'total_debt',
      render: (val?: number | null) => (val != null ? `¥${formatLocaleNumber(val)}` : '-'),
    },
    {
      title: '维持担保比例',
      dataIndex: 'maintenance_ratio',
      key: 'maintenance_ratio',
      render: (val?: number | null) => {
        if (val == null) return '-';
        const level = getRiskLevel(val);
        return (
          <Space>
            <span style={{ fontWeight: 600 }}>{formatPercent(val)}</span>
            {level && (
              <Tag color={WarningLevelColors[level as keyof typeof WarningLevelColors]}>
                {WarningLevelTexts[level as keyof typeof WarningLevelTexts]}
              </Tag>
            )}
          </Space>
        );
      },
      sorter: (a: Customer, b: Customer) =>
        (a.maintenance_ratio || 0) - (b.maintenance_ratio || 0),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Customer) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/customers/${record.customer_id}`)}
        >
          详情
        </Button>
      ),
    },
  ];

  const handleSearch = (values: any) => {
    setFilters(values);
    setPagination({ ...pagination, current: 1 });
  };

  return (
    <div className="page-container">
      <h1 className="page-title">
        <UserOutlined style={{ marginRight: 8 }} />
        客户管理
      </h1>

      <div className="filter-bar">
        <Form form={form} layout="inline" onFinish={handleSearch}>
          <Form.Item name="keyword" label="搜索">
            <Input.Search placeholder="搜索客户名称/账号" allowClear enterButton />
          </Form.Item>
          <Form.Item name="manager_id" label="客户经理">
            <Select
              allowClear
              placeholder="选择客户经理"
              style={{ width: 180 }}
              options={users.map((u) => ({ value: u.user_id, label: u.full_name }))}
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
        dataSource={customers}
        columns={columns}
        rowKey="customer_id"
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

export default CustomersPage;
