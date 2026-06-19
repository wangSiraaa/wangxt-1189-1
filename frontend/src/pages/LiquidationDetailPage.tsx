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
} from '@ant-design/icons';
import { tradingApi } from '../api/trading';
import { customerApi } from '../api/customer';
import {
  ForcedLiquidation,
  LiquidationStatusTexts,
  CollateralPosition,
  CollateralAddition,
  AdditionStatusTexts,
} from '../types';
import dayjs from 'dayjs';

const LiquidationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [liquidation, setLiquidation] = useState<ForcedLiquidation | null>(null);
  const [hasPendingAddition, setHasPendingAddition] = useState(false);
  const [additions, setAdditions] = useState<CollateralAddition[]>([]);

  const [triggerTimeModalVisible, setTriggerTimeModalVisible] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [triggerTimeForm] = Form.useForm();
  const [cancelForm] = Form.useForm();

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await tradingApi.getLiquidation(id);
      setLiquidation(data);

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
      title: '原持仓数量',
      dataIndex: 'original_quantity',
      key: 'original_quantity',
      render: (val: number) => val.toFixed(4),
    },
    {
      title: '拟强平数量',
      dataIndex: 'quantity_to_liquidate',
      key: 'quantity_to_liquidate',
      render: (val: number) => val.toFixed(4),
    },
    {
      title: '预计强平金额',
      dataIndex: 'estimated_amount',
      key: 'estimated_amount',
      render: (val: number) => `¥${val.toLocaleString()}`,
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
                  {liquidation.trigger_maintenance_ratio.toFixed(2)}%
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
                  ? `¥${liquidation.total_liquidated_amount.toLocaleString()}`
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

      <Card title="相关担保品追加记录" loading={loading}>
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
    </div>
  );
};

export default LiquidationDetailPage;
