import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Descriptions,
  Button,
  Space,
  Tag,
  Card,
  Table,
  Form,
  Select,
  Input,
  Modal,
  message,
  Timeline,
  Divider,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  ArrowLeftOutlined,
  WarningOutlined,
  PhoneOutlined,
  PlusSquareOutlined,
  SwapOutlined,
  MessageOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { riskApi } from '../api/risk';
import { customerApi } from '../api/customer';
import { tradingApi } from '../api/trading';
import { commonApi } from '../api/common';
import {
  RiskWarning,
  WarningLevelColors,
  WarningLevelTexts,
  WarningStatusTexts,
  Communication,
  CollateralAddition,
  ForcedLiquidation,
  RiskHistory,
  AdditionStatusTexts,
  LiquidationStatusTexts,
  CommunicationTypeTexts,
  WarningStatus,
} from '../types';
import RiskCurveChart from '../components/RiskCurveChart';

const WarningDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState<RiskWarning | null>(null);
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [additions, setAdditions] = useState<CollateralAddition[]>([]);
  const [liquidations, setLiquidations] = useState<ForcedLiquidation[]>([]);
  const [riskHistory, setRiskHistory] = useState<RiskHistory[]>([]);
  const [marginAccount, setMarginAccount] = useState<any>(null);
  const [positions, setPositions] = useState<any[]>([]);

  const [communicationModalVisible, setCommunicationModalVisible] = useState(false);
  const [additionModalVisible, setAdditionModalVisible] = useState(false);
  const [liquidationModalVisible, setLiquidationModalVisible] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [securities, setSecurities] = useState<any[]>([]);

  const [communicationForm] = Form.useForm();
  const [additionForm] = Form.useForm();
  const [statusForm] = Form.useForm();

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [
        warningData,
        commData,
        addData,
        liqData,
      ] = await Promise.all([
        riskApi.getWarning(id),
        customerApi.getCommunications({ warning_id: id, page_size: 100 }),
        customerApi.getCollateralAdditions({ warning_id: id, page_size: 100 }),
        tradingApi.getLiquidations({ warning_id: id, page_size: 100 }),
      ]);

      setWarning(warningData);
      setCommunications(commData.communications);
      setAdditions(addData.additions);
      setLiquidations(liqData.liquidations);

      if (warningData?.customer_id) {
        const customerData = await commonApi.getCustomer(warningData.customer_id);
        setMarginAccount(customerData);
        const history = await riskApi.getRiskHistory(warningData.customer_id, { limit: 30 });
        setRiskHistory(history);
        const posData = await tradingApi.getLiquidatablePositions(warningData.customer_id);
        setPositions(posData.positions);
      }

      const [usersData, securitiesData] = await Promise.all([
        commonApi.getUsers(),
        commonApi.getSecurities(),
      ]);
      setUsers(usersData);
      setSecurities(securitiesData);
    } catch (error) {
      console.error('Failed to load warning detail:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleCalculateRisk = async () => {
    if (!warning?.customer_id) return;
    try {
      await riskApi.calculateRisk(warning.customer_id);
      message.success('风险计算完成');
      loadData();
    } catch (error) {
      console.error('Failed to calculate risk:', error);
    }
  };

  const handleUpdateStatus = async (values: any) => {
    if (!id) return;
    try {
      await riskApi.updateWarningStatus(id, values);
      message.success('状态更新成功');
      setStatusModalVisible(false);
      statusForm.resetFields();
      loadData();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleCreateCommunication = async (values: any) => {
    if (!warning) return;
    try {
      await customerApi.createCommunication({
        ...values,
        customer_id: warning.customer_id,
        warning_id: id,
      });
      message.success('沟通记录已创建');
      setCommunicationModalVisible(false);
      communicationForm.resetFields();
      loadData();
    } catch (error) {
      console.error('Failed to create communication:', error);
    }
  };

  const handleCreateAddition = async (values: any) => {
    if (!warning) return;
    try {
      await customerApi.recordCollateralAddition({
        ...values,
        customer_id: warning.customer_id,
        warning_id: id,
      });
      message.success('担保品追加已记录');
      setAdditionModalVisible(false);
      additionForm.resetFields();
      loadData();
    } catch (error) {
      console.error('Failed to create addition:', error);
    }
  };

  const handleCreateLiquidation = async () => {
    if (!id) return;
    try {
      await tradingApi.createLiquidation({ warning_id: id });
      message.success('强平指令已创建');
      setLiquidationModalVisible(false);
      loadData();
    } catch (error) {
      console.error('Failed to create liquidation:', error);
    }
  };

  const handleConfirmAddition = async (additionId: string) => {
    try {
      await customerApi.confirmAddition(additionId);
      message.success('担保品追加已确认');
      loadData();
    } catch (error) {
      console.error('Failed to confirm addition:', error);
    }
  };

  const getTimelineEvents = () => {
    const events: any[] = [];

    if (warning) {
      events.push({
        time: new Date(warning.triggered_at).toLocaleString('zh-CN'),
        color: 'red',
        icon: <WarningOutlined />,
        children: `预警生成 - ${WarningLevelTexts[warning.warning_level]} - 维持比例: ${warning.maintenance_ratio.toFixed(2)}%`,
      });
    }

    communications.forEach((comm) => {
      events.push({
        time: new Date(comm.created_at).toLocaleString('zh-CN'),
        color: 'blue',
        icon: <MessageOutlined />,
        children: `${CommunicationTypeTexts[comm.communication_type]}沟通 - ${comm.manager_name}: ${comm.content.substring(0, 50)}${comm.content.length > 50 ? '...' : ''}`,
      });
    });

    additions.forEach((add) => {
      events.push({
        time: new Date(add.created_at).toLocaleString('zh-CN'),
        color: 'green',
        icon: <PlusSquareOutlined />,
        children: `担保品追加 - ${add.addition_type === 'cash' ? '现金' : '证券'} ¥${add.amount.toLocaleString()} - ${AdditionStatusTexts[add.status]}`,
      });
    });

    liquidations.forEach((liq) => {
      events.push({
        time: new Date(liq.created_at).toLocaleString('zh-CN'),
        color: 'orange',
        icon: <SwapOutlined />,
        children: `强平指令 - ${LiquidationStatusTexts[liq.status]}${liq.total_liquidated_amount ? ` - ¥${liq.total_liquidated_amount.toLocaleString()}` : ''}`,
      });
    });

    return events.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
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

  const communicationColumns = [
    {
      title: '沟通方式',
      dataIndex: 'communication_type',
      key: 'communication_type',
      render: (type: keyof typeof CommunicationTypeTexts) => CommunicationTypeTexts[type],
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
      render: (type: any) => (type === 'cash' ? '现金' : '证券'),
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
      render: (val: number) => val?.toFixed(4),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: keyof typeof AdditionStatusTexts) => AdditionStatusTexts[status],
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
              onClick={() => handleConfirmAddition(record.addition_id)}
            >
              确认
            </Button>
          </Space>
        ) : null,
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
      title: '触发时间',
      dataIndex: 'trigger_time',
      key: 'trigger_time',
      render: (val: string) => new Date(val).toLocaleString('zh-CN'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: keyof typeof LiquidationStatusTexts) => LiquidationStatusTexts[status],
    },
    {
      title: '强平金额',
      dataIndex: 'total_liquidated_amount',
      key: 'total_liquidated_amount',
      render: (val: number) => (val ? `¥${val.toLocaleString()}` : '-'),
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

  if (!warning) {
    return <div className="page-container">加载中...</div>;
  }

  return (
    <div className="page-container">
      <div style={{ marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/warnings')}>
          返回列表
        </Button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 className="page-title">风险预警详情</h1>
        <Space>
          <Button onClick={handleCalculateRisk}>重新计算风险</Button>
          <Button onClick={() => setCommunicationModalVisible(true)} icon={<PhoneOutlined />}>
            记录沟通
          </Button>
          <Button onClick={() => setAdditionModalVisible(true)} icon={<PlusSquareOutlined />}>
            追加担保品
          </Button>
          <Button
            type="primary"
            danger
            onClick={() => setLiquidationModalVisible(true)}
            icon={<SwapOutlined />}
          >
            创建强平
          </Button>
          <Button onClick={() => setStatusModalVisible(true)}>更新状态</Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="预警信息" loading={loading}>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="客户">
                {warning.customer_name} ({warning.account_number})
              </Descriptions.Item>
              <Descriptions.Item label="风险等级">
                <Tag color={WarningLevelColors[warning.warning_level]}>
                  {WarningLevelTexts[warning.warning_level]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {WarningStatusTexts[warning.status]}
              </Descriptions.Item>
              <Descriptions.Item label="维持担保比例">
                <span style={{ fontWeight: 600, fontSize: 18 }}>
                  {warning.maintenance_ratio.toFixed(2)}%
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="担保品总价值">
                ¥{warning.total_collateral_value.toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="负债总额">
                ¥{warning.total_debt.toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="触发时间">
                {new Date(warning.triggered_at).toLocaleString('zh-CN')}
              </Descriptions.Item>
              <Descriptions.Item label="创建人">{warning.creator_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="备注">{warning.notes || '-'}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="账户概览" loading={loading}>
            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="维持担保比例"
                  value={marginAccount?.maintenance_ratio || 0}
                  suffix="%"
                  precision={2}
                  valueStyle={{
                    color:
                      (marginAccount?.maintenance_ratio || 0) >=
                      (marginAccount?.warning_line || 150)
                        ? '#52c41a'
                        : '#f5222d',
                  }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="预警线 / 平仓线"
                  value={marginAccount?.warning_line || 150}
                  suffix={`% / ${marginAccount?.liquidation_line || 130}%`}
                  precision={0}
                />
              </Col>
            </Row>
            <Divider />
            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="担保品价值"
                  value={marginAccount?.total_collateral_value || 0}
                  prefix="¥"
                  precision={0}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="负债总额"
                  value={marginAccount?.total_debt || 0}
                  prefix="¥"
                  precision={0}
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Divider />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="风险变化曲线" loading={loading}>
            {riskHistory.length > 0 ? (
              <RiskCurveChart
                history={riskHistory}
                warningLine={marginAccount?.warning_line}
                liquidationLine={marginAccount?.liquidation_line}
                height={320}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无历史数据</div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="处置流程时间线">
            <Timeline items={getTimelineEvents()} />
          </Card>
        </Col>
      </Row>

      <Divider />

      <Card title="担保品持仓" loading={loading} style={{ marginBottom: 24 }}>
        <Table
          dataSource={positions}
          columns={positionColumns}
          rowKey="position_id"
          pagination={false}
          size="small"
        />
      </Card>

      <Card title="沟通记录" loading={loading} style={{ marginBottom: 24 }}>
        <Table
          dataSource={communications}
          columns={communicationColumns}
          rowKey="communication_id"
          pagination={false}
          size="small"
        />
      </Card>

      <Card title="担保品追加记录" loading={loading} style={{ marginBottom: 24 }}>
        <Table
          dataSource={additions}
          columns={additionColumns}
          rowKey="addition_id"
          pagination={false}
          size="small"
        />
      </Card>

      <Card title="强平指令" loading={loading}>
        <Table
          dataSource={liquidations}
          columns={liquidationColumns}
          rowKey="liquidation_id"
          pagination={false}
          size="small"
        />
      </Card>

      <Modal
        title="更新状态"
        open={statusModalVisible}
        onCancel={() => setStatusModalVisible(false)}
        footer={null}
      >
        <Form form={statusForm} layout="vertical" onFinish={handleUpdateStatus}>
          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
            initialValue={warning.status}
          >
            <Select>
              <Select.Option value="pending">待处理</Select.Option>
              <Select.Option value="in_progress">处理中</Select.Option>
              <Select.Option value="resolved">已解决</Select.Option>
              <Select.Option value="cancelled">已取消</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                确认
              </Button>
              <Button onClick={() => setStatusModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="记录沟通"
        open={communicationModalVisible}
        onCancel={() => setCommunicationModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={communicationForm} layout="vertical" onFinish={handleCreateCommunication}>
          <Form.Item
            name="communication_type"
            label="沟通方式"
            rules={[{ required: true, message: '请选择沟通方式' }]}
            initialValue="phone"
          >
            <Select>
              <Select.Option value="phone">电话</Select.Option>
              <Select.Option value="email">邮件</Select.Option>
              <Select.Option value="sms">短信</Select.Option>
              <Select.Option value="in_person">面谈</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="manager_id"
            label="沟通人"
            rules={[{ required: true, message: '请选择沟通人' }]}
          >
            <Select
              placeholder="选择沟通人"
              options={users
                .filter((u) => u.role === 'customer_manager' || u.role === 'admin')
                .map((u) => ({ value: u.user_id, label: u.full_name }))}
            />
          </Form.Item>
          <Form.Item
            name="content"
            label="沟通内容"
            rules={[{ required: true, message: '请输入沟通内容' }]}
          >
            <Input.TextArea rows={4} placeholder="请输入沟通内容..." />
          </Form.Item>
          <Form.Item name="customer_response" label="客户回复">
            <Input.TextArea rows={2} placeholder="请输入客户回复..." />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
              <Button onClick={() => setCommunicationModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="记录担保品追加"
        open={additionModalVisible}
        onCancel={() => setAdditionModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={additionForm} layout="vertical" onFinish={handleCreateAddition}>
          <Form.Item
            name="addition_type"
            label="追加类型"
            rules={[{ required: true, message: '请选择追加类型' }]}
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
              <Button onClick={() => setAdditionModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="确认创建强平指令"
        open={liquidationModalVisible}
        onCancel={() => setLiquidationModalVisible(false)}
        onOk={handleCreateLiquidation}
        okText="确认创建"
        okButtonProps={{ danger: true }}
      >
        <p>确定要为该客户创建强平指令吗？</p>
        <p style={{ color: '#f5222d' }}>
          <WarningOutlined /> 系统将自动检查：是否有未入账的追加担保品
        </p>
        <p>停牌证券将按照可处置比例单独计算。</p>
      </Modal>
    </div>
  );
};

export default WarningDetailPage;
