import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Descriptions,
  Button,
  Space,
  Card,
  Table,
  Tag,
  Row,
  Col,
  Statistic,
  Tabs,
} from 'antd';
import { ArrowLeftOutlined, UserOutlined } from '@ant-design/icons';
import { commonApi } from '../api/common';
import { riskApi } from '../api/risk';
import { tradingApi } from '../api/trading';
import { customerApi } from '../api/customer';
import {
  Customer,
  CollateralPosition,
  RiskHistory,
  RiskWarning,
  Communication,
  CollateralAddition,
  ForcedLiquidation,
  WarningLevelColors,
  WarningLevelTexts,
  WarningStatusTexts,
  AdditionStatusTexts,
  LiquidationStatusTexts,
  CommunicationTypeTexts,
} from '../types';
import RiskCurveChart from '../components/RiskCurveChart';

const CustomerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [positions, setPositions] = useState<CollateralPosition[]>([]);
  const [riskHistory, setRiskHistory] = useState<RiskHistory[]>([]);
  const [warnings, setWarnings] = useState<RiskWarning[]>([]);
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [additions, setAdditions] = useState<CollateralAddition[]>([]);
  const [liquidations, setLiquidations] = useState<ForcedLiquidation[]>([]);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [
        customerData,
        positionsData,
        historyData,
        warningsData,
        commData,
        addData,
        liqData,
      ] = await Promise.all([
        commonApi.getCustomer(id),
        tradingApi.getLiquidatablePositions(id),
        riskApi.getRiskHistory(id, { limit: 60 }),
        riskApi.getWarnings({ customer_id: id, page_size: 50 }),
        customerApi.getCommunications({ customer_id: id, page_size: 50 }),
        customerApi.getCollateralAdditions({ customer_id: id, page_size: 50 }),
        tradingApi.getLiquidations({ customer_id: id, page_size: 50 }),
      ]);

      setCustomer(customerData);
      setPositions(positionsData.positions);
      setRiskHistory(historyData);
      setWarnings(warningsData.warnings);
      setCommunications(commData.communications);
      setAdditions(addData.additions);
      setLiquidations(liqData.liquidations);
    } catch (error) {
      console.error('Failed to load customer detail:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleCalculateRisk = async () => {
    if (!id) return;
    try {
      await riskApi.calculateRisk(id);
      loadData();
    } catch (error) {
      console.error('Failed to calculate risk:', error);
    }
  };

  const positionColumns = [
    {
      title: '证券代码',
      dataIndex: 'security_code',
      key: 'security_code',
    },
    {
      title: '证券名称',
      dataIndex: 'security_name',
      key: 'security_name',
    },
    {
      title: '是否停牌',
      dataIndex: 'is_suspended',
      key: 'is_suspended',
      render: (val: boolean) => (val ? <Tag color="orange">停牌</Tag> : <Tag color="green">正常</Tag>),
    },
    {
      title: '可处置比例',
      dataIndex: 'disposable_ratio',
      key: 'disposable_ratio',
      render: (val: number) => `${(val * 100).toFixed(0)}%`,
    },
    {
      title: '当前价格',
      dataIndex: 'current_price',
      key: 'current_price',
      render: (val: number) => `¥${val.toFixed(2)}`,
    },
    {
      title: '持仓数量',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (val: number) => val.toFixed(4),
    },
    {
      title: '市值',
      dataIndex: 'market_value',
      key: 'market_value',
      render: (val: number) => `¥${val.toLocaleString()}`,
    },
    {
      title: '可处置价值',
      dataIndex: 'disposable_value',
      key: 'disposable_value',
      render: (val: number) => `¥${val.toLocaleString()}`,
    },
  ];

  const warningColumns = [
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
      title: '维持比例',
      dataIndex: 'maintenance_ratio',
      key: 'maintenance_ratio',
      render: (val: number) => `${val.toFixed(2)}%`,
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

  const communicationColumns = [
    {
      title: '沟通方式',
      dataIndex: 'communication_type',
      key: 'communication_type',
      render: (type: string) => CommunicationTypeTexts[type as keyof typeof CommunicationTypeTexts],
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
      ellipsis: true,
    },
    {
      title: '客户回复',
      dataIndex: 'customer_response',
      key: 'customer_response',
      ellipsis: true,
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (val: string) => new Date(val).toLocaleString('zh-CN'),
    },
  ];

  const additionColumns = [
    {
      title: '类型',
      dataIndex: 'addition_type',
      key: 'addition_type',
      render: (type: string) => (type === 'cash' ? '现金' : '证券'),
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
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (val?: number) => val?.toFixed(4),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => AdditionStatusTexts[status as keyof typeof AdditionStatusTexts],
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
  ];

  const liquidationColumns = [
    {
      title: '触发比例',
      dataIndex: 'trigger_maintenance_ratio',
      key: 'trigger_maintenance_ratio',
      render: (val: number) => `${val.toFixed(2)}%`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => LiquidationStatusTexts[status as keyof typeof LiquidationStatusTexts],
    },
    {
      title: '强平金额',
      dataIndex: 'total_liquidated_amount',
      key: 'total_liquidated_amount',
      render: (val?: number) => (val ? `¥${val.toLocaleString()}` : '-'),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (val: string) => new Date(val).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: ForcedLiquidation) => (
        <Button type="link" onClick={() => navigate(`/liquidations/${record.liquidation_id}`)}>
          详情
        </Button>
      ),
    },
  ];

  if (!customer) {
    return <div className="page-container">加载中...</div>;
  }

  const tabItems = [
    {
      key: 'positions',
      label: '担保品持仓',
      children: (
        <Table
          dataSource={positions}
          columns={positionColumns}
          rowKey="position_id"
          pagination={false}
          size="small"
        />
      ),
    },
    {
      key: 'warnings',
      label: '风险预警',
      children: (
        <Table
          dataSource={warnings}
          columns={warningColumns}
          rowKey="warning_id"
          pagination={false}
          size="small"
        />
      ),
    },
    {
      key: 'communications',
      label: '沟通记录',
      children: (
        <Table
          dataSource={communications}
          columns={communicationColumns}
          rowKey="communication_id"
          pagination={false}
          size="small"
        />
      ),
    },
    {
      key: 'additions',
      label: '担保品追加',
      children: (
        <Table
          dataSource={additions}
          columns={additionColumns}
          rowKey="addition_id"
          pagination={false}
          size="small"
        />
      ),
    },
    {
      key: 'liquidations',
      label: '强平记录',
      children: (
        <Table
          dataSource={liquidations}
          columns={liquidationColumns}
          rowKey="liquidation_id"
          pagination={false}
          size="small"
        />
      ),
    },
  ];

  return (
    <div className="page-container">
      <div style={{ marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/customers')}>
          返回列表
        </Button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 className="page-title">
          <UserOutlined style={{ marginRight: 8 }} />
          客户详情 - {customer.customer_name}
        </h1>
        <Button type="primary" onClick={handleCalculateRisk}>
          计算风险
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="基本信息" loading={loading}>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="客户名称">{customer.customer_name}</Descriptions.Item>
              <Descriptions.Item label="账号">{customer.account_number}</Descriptions.Item>
              <Descriptions.Item label="联系电话">{customer.phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="邮箱">{customer.email || '-'}</Descriptions.Item>
              <Descriptions.Item label="客户经理">{customer.manager_name || '-'}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="账户概览" loading={loading}>
            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="维持担保比例"
                  value={customer.maintenance_ratio || 0}
                  suffix="%"
                  precision={2}
                  valueStyle={{
                    color:
                      (customer.maintenance_ratio || 0) >= (customer.warning_line || 150)
                        ? '#52c41a'
                        : '#f5222d',
                  }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="预警线 / 平仓线"
                  value={customer.warning_line || 150}
                  suffix={`% / ${customer.liquidation_line || 130}%`}
                  precision={0}
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Card title="风险变化曲线" loading={loading} style={{ marginTop: 16, marginBottom: 16 }}>
        {riskHistory.length > 0 ? (
          <RiskCurveChart
            history={riskHistory}
            warningLine={customer.warning_line}
            liquidationLine={customer.liquidation_line}
            height={320}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无历史数据</div>
        )}
      </Card>

      <Card loading={loading}>
        <Tabs defaultActiveKey="positions" items={tabItems} />
      </Card>
    </div>
  );
};

export default CustomerDetailPage;
