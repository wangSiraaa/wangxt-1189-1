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
  Input,
  DatePicker,
  Modal,
  message,
  Popconfirm,
  Row,
  Col,
  Statistic,
  Alert,
  Divider,
} from 'antd';
import {
  ArrowLeftOutlined,
  SwapOutlined,
  PlayCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  WarningOutlined,
  LockOutlined,
  UnlockOutlined,
  OrderedListOutlined,
  CloseCircleTwoTone,
  CheckCircleTwoTone,
} from '@ant-design/icons';
import { tradingApi } from '../api/trading';
import { customerApi } from '../api/customer';
import {
  ForcedLiquidation,
  LiquidationStatusTexts,
  CollateralPosition,
  CollateralAddition,
  AdditionStatusTexts,
  LiquidationExecution,
  PositionToLiquidate,
  ExecutionTypeTexts,
  ExecutionTypeColors,
} from '../types';
import dayjs from 'dayjs';
import { formatPercent, formatNumber, formatMoney, formatLocaleNumber } from '../utils/format';

const LiquidationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [liquidation, setLiquidation] = useState<ForcedLiquidation | null>(null);
  const [hasPendingAddition, setHasPendingAddition] = useState(false);
  const [additions, setAdditions] = useState<CollateralAddition[]>([]);
  const [executions, setExecutions] = useState<LiquidationExecution[]>([]);

  const [triggerTimeModalVisible, setTriggerTimeModalVisible] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [batchExecuteModalVisible, setBatchExecuteModalVisible] = useState(false);
  const [cancelOrderModalVisible, setCancelOrderModalVisible] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<PositionToLiquidate | null>(null);
  const [triggerTimeForm] = Form.useForm();
  const [cancelForm] = Form.useForm();
  const [batchExecuteForm] = Form.useForm();
  const [cancelOrderForm] = Form.useForm();

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await tradingApi.getLiquidation(id);
      setLiquidation(data);

      const execData = await tradingApi.getExecutions(id);
      setExecutions(execData);

      if (data?.customer_id) {
        const [pendingResult, additionsResult] = await Promise.all([
          customerApi.checkPendingAddition(data.customer_id),
          customerApi.getCollateralAdditions({ customer_id: data.customer_id, page_size: 50 }),
        ]);
        setHasPendingAddition(pendingResult.has_pending);
        setAdditions(additionsResult.additions);
      }
    } catch (error) {
      console.error('Failed to load liquidation detail:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleExecute = async () => {
    if (!id) return;
    try {
      await tradingApi.executeLiquidation(id);
      message.success('强平执行成功');
      loadData();
    } catch (error) {
      console.error('Failed to execute liquidation:', error);
    }
  };

  const handleUpdateTriggerTime = async (values: any) => {
    if (!id) return;
    try {
      await tradingApi.updateTriggerTime(id, {
        new_trigger_time: values.new_trigger_time.toISOString(),
      });
      message.success('触发时间已更新');
      setTriggerTimeModalVisible(false);
      triggerTimeForm.resetFields();
      loadData();
    } catch (error) {
      console.error('Failed to update trigger time:', error);
    }
  };

  const handleCancel = async (values: any) => {
    if (!id) return;
    try {
      await tradingApi.cancelLiquidation(id, values);
      message.success('强平已撤销');
      setCancelModalVisible(false);
      cancelForm.resetFields();
      loadData();
    } catch (error) {
      console.error('Failed to cancel liquidation:', error);
    }
  };

  const handleBatchExecute = async (values: any) => {
    if (!id || !selectedPosition) return;
    try {
      await tradingApi.batchExecute(id, {
        position_id: selectedPosition.position_id,
        quantity: Number(values.quantity),
        fill_price: values.fill_price ? Number(values.fill_price) : undefined,
        notes: values.notes,
      });
      message.success('分批成交已记录');
      setBatchExecuteModalVisible(false);
      batchExecuteForm.resetFields();
      setSelectedPosition(null);
      loadData();
    } catch (error) {
      console.error('Failed to batch execute:', error);
    }
  };

  const handleCancelOrder = async (values: any) => {
    if (!id || !selectedPosition) return;
    try {
      await tradingApi.cancelOrder(id, {
        position_id: selectedPosition.position_id,
        cancellation_reason: values.cancellation_reason,
        notes: values.notes,
      });
      message.success('撤单已记录');
      setCancelOrderModalVisible(false);
      cancelOrderForm.resetFields();
      setSelectedPosition(null);
      loadData();
    } catch (error) {
      console.error('Failed to cancel order:', error);
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
      render: (val: number) => formatPercent(val * 100, 0),
    },
    {
      title: '当前价格',
      dataIndex: 'current_price',
      key: 'current_price',
      render: (val: number) => formatMoney(val),
    },
    {
      title: '原持仓数量',
      dataIndex: 'original_quantity',
      key: 'original_quantity',
      render: (val: number) => formatNumber(val),
    },
    {
      title: '拟强平数量',
      dataIndex: 'quantity_to_liquidate',
      key: 'quantity_to_liquidate',
      render: (val: number) => formatNumber(val),
    },
    {
      title: '已成交数量',
      dataIndex: 'filled_quantity',
      key: 'filled_quantity',
      render: (val: number) => (
        <span style={{ color: val > 0 ? '#52c41a' : '#666' }}>{formatNumber(val)}</span>
      ),
    },
    {
      title: '已成交金额',
      dataIndex: 'filled_amount',
      key: 'filled_amount',
      render: (val: number) => (val > 0 ? `¥${formatLocaleNumber(val)}` : '-'),
    },
    {
      title: '剩余数量',
      key: 'remaining_quantity',
      render: (_: any, record: PositionToLiquidate) => {
        const remaining = record.quantity_to_liquidate - record.filled_quantity;
        return <span style={{ color: remaining > 0 ? '#fa8c16' : '#52c41a' }}>{formatNumber(remaining)}</span>;
      },
    },
    {
      title: '状态',
      key: 'position_status',
      render: (_: any, record: PositionToLiquidate) => {
        if (record.cancelled) return <Tag color="default">已撤单</Tag>;
        const remaining = record.quantity_to_liquidate - record.filled_quantity;
        if (remaining <= 0) return <Tag color="green">已成交</Tag>;
        if (record.filled_quantity > 0) return <Tag color="blue">部分成交</Tag>;
        return <Tag color="orange">待成交</Tag>;
      },
    },
    {
      title: '预计强平金额',
      dataIndex: 'estimated_amount',
      key: 'estimated_amount',
      render: (val: number) => `¥${formatLocaleNumber(val)}`,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: PositionToLiquidate) => {
        if (liquidation?.is_disposal_locked || liquidation?.is_trigger_time_locked) {
          return <Tag icon={<LockOutlined />}>已锁定</Tag>;
        }
        if (record.cancelled) return '-';
        const remaining = record.quantity_to_liquidate - record.filled_quantity;
        if (remaining <= 0) return '-';
        return (
          <Space size="small">
            <Button
              type="primary"
              size="small"
              icon={<CheckCircleTwoTone />}
              onClick={() => {
                setSelectedPosition(record);
                batchExecuteForm.setFieldsValue({
                  quantity: remaining,
                  fill_price: record.current_price,
                });
                setBatchExecuteModalVisible(true);
              }}
            >
              分批成交
            </Button>
            <Button
              size="small"
              danger
              icon={<CloseCircleTwoTone />}
              onClick={() => {
                setSelectedPosition(record);
                setCancelOrderModalVisible(true);
              }}
            >
              撤单
            </Button>
          </Space>
        );
      },
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
      render: (val: number) => `¥${formatLocaleNumber(val)}`,
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

  const executionColumns = [
    {
      title: '类型',
      dataIndex: 'execution_type',
      key: 'execution_type',
      render: (type: keyof typeof ExecutionTypeTexts) => (
        <Tag color={ExecutionTypeColors[type]}>{ExecutionTypeTexts[type]}</Tag>
      ),
    },
    {
      title: '证券',
      key: 'security',
      render: (_: any, record: LiquidationExecution) =>
        `${record.security_code || '-'} ${record.security_name || ''}`,
    },
    {
      title: '计划数量',
      dataIndex: 'planned_quantity',
      key: 'planned_quantity',
      render: (val: number) => (val != null ? formatNumber(val) : '-'),
    },
    {
      title: '成交/撤单数量',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (val: number) => formatNumber(val),
    },
    {
      title: '成交价格',
      dataIndex: 'fill_price',
      key: 'fill_price',
      render: (val: number) => (val != null ? formatMoney(val) : '-'),
    },
    {
      title: '成交金额',
      dataIndex: 'fill_amount',
      key: 'fill_amount',
      render: (val: number) => (val != null && val > 0 ? `¥${formatLocaleNumber(val)}` : '-'),
    },
    {
      title: '执行人',
      dataIndex: 'executor_name',
      key: 'executor_name',
      render: (val: string) => val || '-',
    },
    {
      title: '执行时间',
      dataIndex: 'executed_at',
      key: 'executed_at',
      render: (val: string) => new Date(val).toLocaleString('zh-CN'),
    },
    {
      title: '撤单原因',
      dataIndex: 'cancellation_reason',
      key: 'cancellation_reason',
      render: (val: string) => val || '-',
      ellipsis: true,
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      render: (val: string) => val || '-',
      ellipsis: true,
    },
  ];

  if (!liquidation) {
    return <div className="page-container">加载中...</div>;
  }

  const positionsToLiquidate = liquidation.positions_to_liquidate || [];
  const totalEstimated = positionsToLiquidate.reduce(
    (sum: number, p: any) => sum + p.estimated_amount,
    0
  );

  return (
    <div className="page-container">
      <div style={{ marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/liquidations')}>
          返回列表
        </Button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 className="page-title">
          <SwapOutlined style={{ marginRight: 8 }} />
          强平指令详情
        </h1>
        <Space>
          {liquidation.status === 'pending' && (
            <>
              <Button
                icon={<EditOutlined />}
                onClick={() => {
                  triggerTimeForm.setFieldsValue({
                    new_trigger_time: dayjs(liquidation.trigger_time),
                  });
                  setTriggerTimeModalVisible(true);
                }}
                disabled={liquidation.is_trigger_time_locked}
              >
                修改触发时间
              </Button>
              <Popconfirm
                title="确认执行强平?"
                description={
                  hasPendingAddition
                    ? '该客户有未入账的追加担保品，执行强平前请确认!'
                    : '执行后将无法撤销，触发时间将被锁定'
                }
                onConfirm={handleExecute}
                okText="确认执行"
                cancelText="取消"
                okButtonProps={{ danger: true }}
              >
                <Button type="primary" danger icon={<PlayCircleOutlined />}>
                  执行强平
                </Button>
              </Popconfirm>
              <Button
                icon={<CloseCircleOutlined />}
                onClick={() => setCancelModalVisible(true)}
                disabled={liquidation.is_trigger_time_locked}
              >
                撤销强平
              </Button>
            </>
          )}
        </Space>
      </div>

      {hasPendingAddition && liquidation.status === 'pending' && (
        <Alert
          message="注意：该客户有未入账的追加担保品，不能执行强平!"
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {liquidation.is_trigger_time_locked && (
        <Alert
          message="触发时间已锁定，强平完成后不能修改触发时点"
          type="info"
          showIcon
          icon={<LockOutlined />}
          style={{ marginBottom: 24 }}
        />
      )}

      {liquidation.is_disposal_locked && (
        <Alert
          message="处置流水已锁定：触发时点、沟通痕迹、处置流水全部锁定，不能再执行分批成交、撤单或新增沟通记录"
          type="error"
          showIcon
          icon={<LockOutlined />}
          style={{ marginBottom: 24 }}
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="强平信息" loading={loading}>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="客户">
                {liquidation.customer_name} ({liquidation.account_number})
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag
                  color={
                    liquidation.status === 'completed'
                      ? 'green'
                      : liquidation.status === 'cancelled'
                      ? 'default'
                      : liquidation.status === 'pending'
                      ? 'orange'
                      : 'blue'
                  }
                >
                  {LiquidationStatusTexts[liquidation.status as keyof typeof LiquidationStatusTexts]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="触发时维持担保比例">
                <span style={{ fontWeight: 600, color: '#f5222d' }}>
                  {formatPercent(liquidation.trigger_maintenance_ratio)}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="触发时间">
                <Space>
                  {new Date(liquidation.trigger_time).toLocaleString('zh-CN')}
                  {liquidation.is_trigger_time_locked ? (
                    <LockOutlined style={{ color: '#f5222d' }} />
                  ) : (
                    <UnlockOutlined style={{ color: '#52c41a' }} />
                  )}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="触发时间锁定">
                {liquidation.is_trigger_time_locked ? '是' : '否'}
              </Descriptions.Item>
              <Descriptions.Item label="处置流水锁定">
                <Space>
                  {liquidation.is_disposal_locked ? '是' : '否'}
                  {liquidation.is_disposal_locked ? (
                    <LockOutlined style={{ color: '#f5222d' }} />
                  ) : (
                    <UnlockOutlined style={{ color: '#52c41a' }} />
                  )}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="执行时间">
                {liquidation.executed_at
                  ? new Date(liquidation.executed_at).toLocaleString('zh-CN')
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="执行人">
                {liquidation.executor_name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="实际强平金额">
                {liquidation.total_liquidated_amount
                  ? `¥${formatLocaleNumber(liquidation.total_liquidated_amount)}`
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="撤销原因">
                {liquidation.cancellation_reason || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="撤销人">
                {liquidation.canceller_name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="撤销时间">
                {liquidation.cancelled_at
                  ? new Date(liquidation.cancelled_at).toLocaleString('zh-CN')
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="备注">{liquidation.notes || '-'}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="统计信息" loading={loading}>
            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="预计强平金额"
                  value={totalEstimated}
                  prefix="¥"
                  precision={0}
                  valueStyle={{ color: '#f5222d' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="涉及证券数量"
                  value={positionsToLiquidate.length}
                  suffix="只"
                />
              </Col>
            </Row>
            <Divider />
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="已成交金额"
                  value={positionsToLiquidate.reduce(
                    (sum: number, p: PositionToLiquidate) => sum + (p.filled_amount || 0),
                    0
                  )}
                  prefix="¥"
                  precision={0}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="已成交笔数"
                  value={executions.filter((e) => e.execution_type === 'fill').length}
                  suffix="笔"
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="撤单笔数"
                  value={executions.filter((e) => e.execution_type === 'cancel').length}
                  suffix="笔"
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Col>
            </Row>
            {liquidation.customer_id && (
              <div style={{ marginTop: 16 }}>
                <Button block onClick={() => navigate(`/customers/${liquidation.customer_id}`)}>
                  查看客户详情
                </Button>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Card
        title="拟强平持仓明细"
        loading={loading}
        style={{ marginTop: 24, marginBottom: 24 }}
      >
        <Table
          dataSource={positionsToLiquidate}
          columns={positionColumns}
          rowKey="position_id"
          pagination={false}
          size="small"
        />
      </Card>

      <Card title="相关担保品追加记录" loading={loading} style={{ marginBottom: 24 }}>
        {additions.length > 0 ? (
          <Table
            dataSource={additions}
            columns={additionColumns}
            rowKey="addition_id"
            pagination={false}
            size="small"
          />
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无追加记录</div>
        )}
      </Card>

      <Card
        title={
          <Space>
            <OrderedListOutlined />
            <span>分批成交与撤单记录</span>
          </Space>
        }
        loading={loading}
        extra={
          <span style={{ fontSize: 12, color: '#999' }}>
            共 {executions.length} 条记录（{executions.filter((e) => e.execution_type === 'fill').length} 成交 /{' '}
            {executions.filter((e) => e.execution_type === 'cancel').length} 撤单）
          </span>
        }
      >
        {executions.length > 0 ? (
          <Table
            dataSource={executions}
            columns={executionColumns}
            rowKey="execution_id"
            pagination={false}
            size="small"
          />
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            暂无成交与撤单记录
          </div>
        )}
      </Card>

      <Modal
        title="修改触发时间"
        open={triggerTimeModalVisible}
        onCancel={() => setTriggerTimeModalVisible(false)}
        footer={null}
      >
        <Form form={triggerTimeForm} layout="vertical" onFinish={handleUpdateTriggerTime}>
          <Form.Item
            name="new_trigger_time"
            label="新触发时间"
            rules={[{ required: true, message: '请选择时间' }]}
          >
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Alert
            message="强平完成后不能修改触发时点"
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                确认修改
              </Button>
              <Button onClick={() => setTriggerTimeModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="撤销强平"
        open={cancelModalVisible}
        onCancel={() => setCancelModalVisible(false)}
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
              <Button onClick={() => setCancelModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="分批成交"
        open={batchExecuteModalVisible}
        onCancel={() => {
          setBatchExecuteModalVisible(false);
          setSelectedPosition(null);
        }}
        footer={null}
      >
        <Form form={batchExecuteForm} layout="vertical" onFinish={handleBatchExecute}>
          {selectedPosition && (
            <Alert
              message={`证券：${selectedPosition.security_code} ${selectedPosition.security_name}`}
              description={`拟强平数量：${formatNumber(selectedPosition.quantity_to_liquidate)}，已成交：${formatNumber(selectedPosition.filled_quantity)}，剩余可成交：${formatNumber(selectedPosition.quantity_to_liquidate - selectedPosition.filled_quantity)}`}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}
          <Form.Item
            name="quantity"
            label="本次成交数量"
            rules={[
              { required: true, message: '请输入成交数量' },
              {
                validator: (_, value) => {
                  if (!selectedPosition) return Promise.resolve();
                  const remaining = selectedPosition.quantity_to_liquidate - selectedPosition.filled_quantity;
                  if (value > remaining) {
                    return Promise.reject(new Error(`不能超过剩余可成交数量 ${formatNumber(remaining)}`));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input type="number" prefix="股" placeholder="请输入本次成交数量" />
          </Form.Item>
          <Form.Item name="fill_price" label="成交价格（可选，默认当前价格）">
            <Input type="number" prefix="¥" placeholder="请输入成交价格" />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} placeholder="备注信息..." />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                确认成交
              </Button>
              <Button onClick={() => setBatchExecuteModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="撤单"
        open={cancelOrderModalVisible}
        onCancel={() => {
          setCancelOrderModalVisible(false);
          setSelectedPosition(null);
        }}
        footer={null}
      >
        <Form form={cancelOrderForm} layout="vertical" onFinish={handleCancelOrder}>
          {selectedPosition && (
            <Alert
              message={`确认撤销证券 ${selectedPosition.security_code} ${selectedPosition.security_name} 的强平委托？`}
              description={`拟强平数量：${formatNumber(selectedPosition.quantity_to_liquidate)}，已成交：${formatNumber(selectedPosition.filled_quantity)}，撤单后剩余数量将不再执行。`}
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}
          <Form.Item
            name="cancellation_reason"
            label="撤单原因"
            rules={[{ required: true, message: '请输入撤单原因' }]}
          >
            <Input.TextArea rows={4} placeholder="请输入撤单原因..." />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} placeholder="备注信息..." />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" danger htmlType="submit">
                确认撤单
              </Button>
              <Button onClick={() => setCancelOrderModalVisible(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LiquidationDetailPage;
