import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Select,
  DatePicker,
  Button,
  Spin,
  Alert,
  Space,
  Statistic,
  Tag,
  Typography,
  Tooltip,
} from 'antd';
import {
  LineChartOutlined,
  RiseOutlined,
  FallOutlined,
  WarningOutlined,
  ThunderboltOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import RiskCurveChart from '../components/RiskCurveChart';
import { commonApi } from '../api/common';
import { RiskHistory, Customer, WarningLevel } from '../types';
import dayjs from 'dayjs';
import { formatPercent, formatLocaleNumber, formatNumber } from '../utils/format';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const WarningLevelColors: Record<WarningLevel, string> = {
  normal: 'green',
  warning: 'gold',
  danger: 'orange',
  liquidation: 'red',
};

const WarningLevelTexts: Record<WarningLevel, string> = {
  normal: '正常',
  warning: '关注',
  danger: '预警',
  liquidation: '强平',
};

const RiskCurvePage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allHistory, setAllHistory] = useState<RiskHistory[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await commonApi.getRiskHistory({
        customer_id: selectedCustomerId,
        start_date: dateRange?.[0]?.toISOString(),
        end_date: dateRange?.[1]?.toISOString(),
      });
      setAllHistory(result.history);
      setCustomers(result.customers);

      if (!selectedCustomerId && result.customers.length > 0) {
        setSelectedCustomerId(result.customers[0].customer_id);
      }
    } catch (err: any) {
      console.error('Load risk history failed:', err);
      setError(err.message || '加载风险历史数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const customerHistory = useMemo(() => {
    if (selectedCustomerId) {
      return allHistory.filter((h) => h.customer_id === selectedCustomerId);
    }
    return allHistory;
  }, [allHistory, selectedCustomerId]);

  const groupedByCustomer = useMemo(() => {
    const groups: Record<string, RiskHistory[]> = {};
    allHistory.forEach((h) => {
      if (!groups[h.customer_id]) {
        groups[h.customer_id] = [];
      }
      groups[h.customer_id].push(h);
    });
    return groups;
  }, [allHistory]);

  const stats = useMemo(() => {
    if (customerHistory.length === 0) return null;

    const sorted = [...customerHistory].sort(
      (a, b) => new Date(a.calculated_at).getTime() - new Date(b.calculated_at).getTime()
    );
    const latest = sorted[sorted.length - 1];
    const earliest = sorted[0];
    const maxRatio = Math.max(...customerHistory.map((h) => h.maintenance_ratio));
    const minRatio = Math.min(...customerHistory.map((h) => h.maintenance_ratio));
    const avgRatio =
      customerHistory.reduce((sum, h) => sum + h.maintenance_ratio, 0) / customerHistory.length;
    const warningDays = customerHistory.filter((h) => h.warning_level !== 'normal').length;

    return {
      latest,
      earliest,
      maxRatio,
      minRatio,
      avgRatio,
      warningDays,
      totalDays: customerHistory.length,
      trend: latest.maintenance_ratio - earliest.maintenance_ratio,
    };
  }, [customerHistory]);

  const selectedCustomer = customers.find((c) => c.customer_id === selectedCustomerId);

  const handleReset = () => {
    setSelectedCustomerId(undefined);
    setDateRange(null);
    setTimeout(() => loadData(), 100);
  };

  const multipleCustomerCurves = useMemo(() => {
    if (selectedCustomerId || customers.length === 0 || allHistory.length === 0) return [];

    return customers.slice(0, 5).map((cust) => ({
      customer: cust,
      history: allHistory.filter((h) => h.customer_id === cust.customer_id),
    }));
  }, [selectedCustomerId, customers, allHistory]);

  if (loading && allHistory.length === 0) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <Spin size="large" tip="正在加载风险历史数据..." />
      </div>
    );
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card
        title={
          <Space>
            <LineChartOutlined style={{ color: '#1890ff', fontSize: 20 }} />
            <span>风险变化曲线</span>
            {selectedCustomer && (
              <Tag color="blue" style={{ marginLeft: 12 }}>
                {selectedCustomer.customer_name} ({selectedCustomer.account_number})
              </Tag>
            )}
          </Space>
        }
        extra={
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        }
      >
        {error && (
          <Alert
            type="error"
            message="数据加载异常"
            description={error}
            showIcon
            closable
            style={{ marginBottom: 16 }}
          />
        )}

        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} md={8}>
            <div style={{ marginBottom: 8, fontWeight: 500, color: '#666' }}>客户选择</div>
            <Select
              placeholder="全部客户（综合对比）"
              style={{ width: '100%' }}
              allowClear
              value={selectedCustomerId}
              onChange={(val) => setSelectedCustomerId(val)}
              options={customers.map((c) => ({
                value: c.customer_id,
                label: `${c.customer_name} (${c.account_number})`,
              }))}
            />
          </Col>
          <Col xs={24} md={10}>
            <div style={{ marginBottom: 8, fontWeight: 500, color: '#666' }}>时间范围</div>
            <RangePicker
              style={{ width: '100%' }}
              value={dateRange}
              onChange={(range) => setDateRange(range as any)}
            />
          </Col>
          <Col xs={24} md={6}>
            <div style={{ marginBottom: 8, fontWeight: 500, color: 'transparent' }}>操作</div>
            <Space>
              <Button type="primary" onClick={loadData} loading={loading}>
                查询
              </Button>
              <Button onClick={handleReset}>重置</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {stats && (
        <Row gutter={[16, 16]}>
          <Col xs={12} md={6}>
            <Card>
              <Statistic
                title="当前维持担保比例"
                value={stats.latest.maintenance_ratio}
                precision={2}
                suffix="%"
                valueStyle={{
                  color:
                    stats.latest.maintenance_ratio >= 150
                      ? '#3f8600'
                      : stats.latest.maintenance_ratio >= 130
                      ? '#cf1322'
                      : '#cf1322',
                  fontWeight: 700,
                }}
                prefix={
                  <Tag color={WarningLevelColors[stats.latest.warning_level]}>
                    {WarningLevelTexts[stats.latest.warning_level]}
                  </Tag>
                }
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic
                title="区间均值"
                value={stats.avgRatio}
                precision={2}
                suffix="%"
                valueStyle={{ color: '#1890ff', fontWeight: 700 }}
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic
                title={
                  <Tooltip title="观测期间内最高担保比例">
                    最高值 <InfoCircleOutlined style={{ color: '#999' }} />
                  </Tooltip>
                }
                value={stats.maxRatio}
                precision={2}
                suffix="%"
                prefix={<RiseOutlined style={{ color: '#52c41a' }} />}
                valueStyle={{ color: '#52c41a', fontWeight: 700 }}
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic
                title={
                  <Tooltip title="观测期间内最低担保比例">
                    最低值 <InfoCircleOutlined style={{ color: '#999' }} />
                  </Tooltip>
                }
                value={stats.minRatio}
                precision={2}
                suffix="%"
                prefix={<FallOutlined style={{ color: '#ff4d4f' }} />}
                valueStyle={{ color: '#ff4d4f', fontWeight: 700 }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {selectedCustomerId ? (
        <Card
          title={
            <Space>
              <span>维持担保比例走势 - {selectedCustomer?.customer_name || '客户'}</span>
              {stats && (
                <Tag
                  color={stats.trend >= 0 ? 'green' : 'red'}
                  icon={stats.trend >= 0 ? <RiseOutlined /> : <FallOutlined />}
                >
                  区间变化 {stats.trend >= 0 ? '+' : ''}
                  {formatNumber(Math.abs(stats.trend), 2)}%
                </Tag>
              )}
            </Space>
          }
          extra={
            <Space>
              <Tag color="gold"><WarningOutlined /> 警戒线 150%</Tag>
              <Tag color="red"><ThunderboltOutlined /> 强平线 130%</Tag>
            </Space>
          }
        >
          {customerHistory.length > 0 ? (
            <RiskCurveChart history={customerHistory} height={420} />
          ) : (
            <div style={{ padding: 80, textAlign: 'center', color: '#999' }}>
              <LineChartOutlined style={{ fontSize: 48, opacity: 0.3, marginBottom: 12 }} />
              <div>暂无该客户的风险历史数据</div>
            </div>
          )}
        </Card>
      ) : (
        <Card
          title={
            <Space>
              <span>全体客户风险对比</span>
              <Tag color="blue">综合视图（前5位客户）</Tag>
            </Space>
          }
        >
          {allHistory.length > 0 ? (
            <Row gutter={[16, 16]}>
              {multipleCustomerCurves.map(({ customer, history }) => (
                <Col xs={24} lg={12} key={customer.customer_id}>
                  <Card
                    size="small"
                    title={
                      <Space size="small">
                        <LineChartOutlined style={{ color: '#1890ff' }} />
                        <strong>{customer.customer_name}</strong>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          ({customer.account_number})
                        </Text>
                      </Space>
                    }
                    style={{ marginBottom: 8 }}
                    bodyStyle={{ padding: '8px 16px 16px' }}
                  >
                    {history.length > 0 ? (
                      <RiskCurveChart history={history} height={260} />
                    ) : (
                      <div style={{ padding: 40, textAlign: 'center', color: '#bbb' }}>
                        暂无数据
                      </div>
                    )}
                  </Card>
                </Col>
              ))}
            </Row>
          ) : (
            <div style={{ padding: 80, textAlign: 'center', color: '#999' }}>
              <LineChartOutlined style={{ fontSize: 48, opacity: 0.3, marginBottom: 12 }} />
              <div>暂无风险历史数据</div>
            </div>
          )}
        </Card>
      )}

      {stats && (
        <Card title="风险概要">
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <div>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                    观测数据点数量
                  </Text>
                  <Space>
                    <Title level={3} style={{ margin: 0 }}>
                      {stats.totalDays}
                    </Title>
                    <Text>天</Text>
                  </Space>
                </div>
                <div>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                    存在风险的天数
                  </Text>
                  <Space>
                    <Tag
                      color={stats.warningDays > 0 ? 'red' : 'green'}
                      style={{ fontSize: 16, padding: '4px 12px', margin: 0 }}
                    >
                      {stats.warningDays} / {stats.totalDays} 天
                    </Tag>
                    {stats.warningDays > 0 && stats.warningDays === stats.totalDays && (
                      <Tooltip title="观测期间持续存在风险，建议重点关注">
                        <WarningOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />
                      </Tooltip>
                    )}
                  </Space>
                </div>
              </Space>
            </Col>
            <Col xs={24} md={12}>
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <div>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                    统计开始日期
                  </Text>
                  <Title level={4} style={{ margin: 0 }}>
                    {dayjs(stats.earliest.calculated_at).format('YYYY年MM月DD日')}
                  </Title>
                </div>
                <div>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                    最新计算日期
                  </Text>
                  <Title level={4} style={{ margin: 0 }}>
                    {dayjs(stats.latest.calculated_at).format('YYYY年MM月DD日')}
                  </Title>
                </div>
              </Space>
            </Col>
          </Row>
        </Card>
      )}
    </Space>
  );
};

export default RiskCurvePage;
