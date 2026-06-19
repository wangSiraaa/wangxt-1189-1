import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Button, Space, Table, Tag, message } from 'antd';
import {
  WarningOutlined,
  SwapOutlined,
  PlusSquareOutlined,
  UserOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { commonApi } from '../api/common';
import { riskApi } from '../api/risk';
import { DashboardStats, RiskWarning, WarningLevelColors, WarningLevelTexts, WarningStatusTexts } from '../types';
import RiskCurveChart from '../components/RiskCurveChart';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentWarnings, setRecentWarnings] = useState<RiskWarning[]>([]);
  const [riskHistory, setRiskHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, warningsData] = await Promise.all([
        commonApi.getDashboardStats(),
        riskApi.getWarnings({ page: 1, page_size: 10 }),
      ]);
      setStats(statsData);
      setRecentWarnings(warningsData.warnings);

      const customers = await commonApi.getCustomers({ page_size: 100 });
      if (customers.customers.length > 0) {
        const history = await riskApi.getRiskHistory(customers.customers[0].customer_id, { limit: 30 });
        setRiskHistory(history);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchCalculate = async () => {
    try {
      const result = await riskApi.batchCalculate();
      message.success(`已处理 ${result.processed} 个客户，生成 ${result.warningsGenerated} 个预警`);
      loadData();
    } catch (error) {
      console.error('Batch calculate failed:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const warningColumns = [
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
      title: '维持比例',
      dataIndex: 'maintenance_ratio',
      key: 'maintenance_ratio',
      render: (val: number) => `${val.toFixed(2)}%`,
    },
    {
      title: '风险等级',
      dataIndex: 'warning_level',
      key: 'warning_level',
      render: (level: string) => (
        <Tag color={WarningLevelColors[level as keyof typeof WarningLevelColors]}>
          {WarningLevelTexts[level as keyof typeof WarningLevelTexts]}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => WarningStatusTexts[status as keyof typeof WarningStatusTexts],
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
        <Button type="link" onClick={() => navigate(`/warnings/${record.warning_id}`)}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 className="page-title">仪表盘</h1>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData}>
            刷新
          </Button>
          <Button type="primary" onClick={handleBatchCalculate} loading={loading}>
            批量计算风险
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} className="dashboard-grid">
        <Col xs={24} sm={12} md={6}>
          <Card hoverable onClick={() => navigate('/warnings')}>
            <Statistic
              title="风险预警总数"
              value={stats?.warnings.total || 0}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#f5222d' }}
            />
            <div style={{ marginTop: 8, color: '#666' }}>
              <span style={{ color: '#faad14' }}>预警: {stats?.warnings.level_warning || 0}</span>
              {' | '}
              <span style={{ color: '#fa8c16' }}>警戒: {stats?.warnings.level_danger || 0}</span>
              {' | '}
              <span style={{ color: '#f5222d' }}>平仓: {stats?.warnings.level_liquidation || 0}</span>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable onClick={() => navigate('/liquidations')}>
            <Statistic
              title="强平指令"
              value={stats?.liquidations.total || 0}
              prefix={<SwapOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
            <div style={{ marginTop: 8, color: '#666' }}>
              已执行: {stats?.liquidations.completed || 0}
              {' | '}
              待执行: {stats?.liquidations.pending || 0}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable onClick={() => navigate('/additions')}>
            <Statistic
              title="担保品追加"
              value={stats?.additions.total || 0}
              prefix={<PlusSquareOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
            <div style={{ marginTop: 8, color: '#666' }}>
              待确认: {stats?.additions.pending || 0}
              {' | '}
              已确认金额: ¥{(stats?.additions.total_confirmed_amount || 0).toLocaleString()}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable onClick={() => navigate('/customers')}>
            <Statistic
              title="风险客户数"
              value={stats?.at_risk_customers || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="风险变化曲线" loading={loading}>
            {riskHistory.length > 0 ? (
              <RiskCurveChart history={riskHistory} height={320} />
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                暂无数据
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            title="最近预警"
            extra={<Button type="link" onClick={() => navigate('/warnings')}>查看全部</Button>}
            loading={loading}
          >
            <Table
              dataSource={recentWarnings}
              columns={warningColumns}
              pagination={false}
              size="small"
              rowKey="warning_id"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage;
