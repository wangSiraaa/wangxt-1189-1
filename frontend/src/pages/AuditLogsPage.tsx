import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Form, Select } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import { commonApi } from '../api/common';
import { AuditLog } from '../types';

const AuditLogsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [filters, setFilters] = useState<{
    entity_type?: string;
    user_id?: string;
  }>({});
  const [users, setUsers] = useState<any[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await commonApi.getAuditLogs({
        ...filters,
        page: pagination.current,
        page_size: pagination.pageSize,
      });
      setLogs(result.logs);
      setTotal(result.total);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [pagination, filters]);

  useEffect(() => {
    const fetchUsers = async () => {
      const result = await commonApi.getUsers();
      setUsers(result);
    };
    fetchUsers();
  }, []);

  const formatAction = (action: string) => {
    const actionMap: Record<string, string> = {
      'risk_calculated': '风险计算',
      'warning_generated': '生成预警',
      'warning_status_updated:pending': '更新预警状态-待处理',
      'warning_status_updated:in_progress': '更新预警状态-处理中',
      'warning_status_updated:resolved': '更新预警状态-已解决',
      'warning_status_updated:liquidated': '更新预警状态-已平仓',
      'warning_status_updated:cancelled': '更新预警状态-已取消',
      'communication_created': '创建沟通记录',
      'collateral_addition_recorded': '记录担保品追加',
      'collateral_addition_confirmed': '确认担保品追加',
      'collateral_addition_rejected': '拒绝担保品追加',
      'forced_liquidation_created': '创建强平指令',
      'forced_liquidation_executed': '执行强平',
      'forced_liquidation_cancelled': '撤销强平',
      'trigger_time_updated': '更新触发时间',
    };
    return actionMap[action] || action;
  };

  const formatEntityType = (type: string) => {
    const typeMap: Record<string, string> = {
      'risk_warning': '风险预警',
      'communication': '沟通记录',
      'collateral_addition': '担保品追加',
      'forced_liquidation': '强平指令',
      'margin_account': '信用账户',
      'audit_logs': '审计日志',
    };
    return typeMap[type] || type;
  };

  const columns = [
    {
      title: '操作时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (val: string) => new Date(val).toLocaleString('zh-CN'),
    },
    {
      title: '操作人',
      key: 'user_name',
      render: (_: any, record: AuditLog) => {
        const user = users.find((u) => u.user_id === record.user_id);
        return user?.full_name || '-';
      },
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      render: (val: string) => formatAction(val),
    },
    {
      title: '实体类型',
      dataIndex: 'entity_type',
      key: 'entity_type',
      render: (val: string) => formatEntityType(val),
    },
    {
      title: '实体ID',
      dataIndex: 'entity_id',
      key: 'entity_id',
      render: (val?: string) => val?.substring(0, 8) || '-',
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
      render: (val?: string) => val || '-',
    },
  ];

  const entityTypes = [
    { value: 'risk_warning', label: '风险预警' },
    { value: 'communication', label: '沟通记录' },
    { value: 'collateral_addition', label: '担保品追加' },
    { value: 'forced_liquidation', label: '强平指令' },
    { value: 'margin_account', label: '信用账户' },
  ];

  return (
    <div className="page-container">
      <h1 className="page-title">
        <FileTextOutlined style={{ marginRight: 8 }} />
        审计日志
      </h1>

      <div className="filter-bar">
        <Form layout="inline" onFinish={(values) => setFilters(values)}>
          <Form.Item name="entity_type" label="实体类型">
            <Select
              allowClear
              placeholder="选择类型"
              style={{ width: 180 }}
              options={entityTypes}
            />
          </Form.Item>
          <Form.Item name="user_id" label="操作人">
            <Select
              allowClear
              placeholder="选择操作人"
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
        dataSource={logs}
        columns={columns}
        rowKey="log_id"
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

export default AuditLogsPage;
