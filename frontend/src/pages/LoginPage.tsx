import React, { useState, useEffect } from 'react';
import { Form, Input, Select, Button, Card, message, Spin, Alert, Divider, Space, Tag } from 'antd';
import {
  UserOutlined,
  LockOutlined,
  TeamOutlined,
  SafetyOutlined,
  LoginOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';
import { useAppStore } from '../store/appStore';
import { UserRole } from '../types';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [apiHealth, setApiHealth] = useState<{ ok: boolean; message: string } | null>(null);
  const [checkingBackend, setCheckingBackend] = useState(true);
  const { setCurrentUser } = useAppStore();
  const [form] = Form.useForm();

  useEffect(() => {
    checkBackendHealth();
  }, []);

  const checkBackendHealth = async () => {
    setCheckingBackend(true);
    try {
      const health = await authApi.healthCheck({ skipErrorMessage: true });
      if (health.status === 'healthy' && health.database === 'connected') {
        setApiHealth({ ok: true, message: `后端服务正常 (端口: ${health.port})` });
      } else {
        setApiHealth({ ok: false, message: '后端服务异常，部分功能可能受限' });
      }
    } catch (error) {
      console.warn('Backend health check failed:', error);
      setApiHealth({ ok: false, message: '无法连接后端服务，请启动后端服务器 (端口: 19489)' });
    } finally {
      setCheckingBackend(false);
    }
  };

  const handleLogin = async (values: { username: string; password: string; role: UserRole }) => {
    setLoading(true);
    const hide = message.loading('正在登录验证...', 0);

    try {
      if (!apiHealth?.ok) {
        hide();
        message.error('后端服务不可用，请先启动后端服务器 (端口: 19489) 后再登录');
        return;
      }

      const result = await authApi.login(
        {
          username: values.username.trim(),
          password: values.password,
          role: values.role,
        },
        { skipErrorMessage: true }
      );

      if (result?.user) {
        hide();
        setCurrentUser(result.user);
        localStorage.setItem('auth_token', result.token || '');
        message.success({
          content: `欢迎回来，${result.user.full_name}！`,
          icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
          duration: 2,
        });
        navigate('/dashboard', { replace: true });
        return;
      }

      hide();
      message.error('登录失败：未获取到用户信息');
    } catch (error: any) {
      hide();
      const status = error?.status;
      if (status === 401) {
        message.error('用户名或密码错误，请检查后重试');
      } else if (status === 403) {
        message.error(error?.message || '该用户不具有所选角色权限');
      } else if (status === 400) {
        message.error(error?.message || '请求参数错误');
      } else if (!status) {
        message.error('无法连接后端服务，请检查网络或后端是否已启动 (端口: 19489)');
      } else {
        console.error('Login error:', error);
        message.error(error?.message || '登录失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    {
      username: 'risk01',
      password: 'risk123',
      role: 'risk_control' as UserRole,
      name: '张风控',
      desc: '风控人员',
      color: 'red',
    },
    {
      username: 'manager01',
      password: 'manager123',
      role: 'customer_manager' as UserRole,
      name: '李经理',
      desc: '客户经理',
      color: 'blue',
    },
    {
      username: 'trading01',
      password: 'trading123',
      role: 'trading_ops' as UserRole,
      name: '王交易',
      desc: '交易运营',
      color: 'orange',
    },
    {
      username: 'admin',
      password: 'admin123',
      role: 'admin' as UserRole,
      name: '系统管理员',
      desc: '管理员',
      color: 'purple',
    },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background:
          'linear-gradient(135deg, #1e3a8a 0%, #3730a3 25%, #6d28d9 50%, #7c3aed 75%, #9333ea 100%)',
      }}
    >
      <div style={{ position: 'fixed', top: 20, left: 20, zIndex: 1000 }}>
        {checkingBackend ? (
          <Spin tip="正在检测后端服务..." size="small" />
        ) : apiHealth ? (
          <Alert
            type={apiHealth.ok ? 'success' : 'error'}
            message={apiHealth.ok ? '后端连接正常' : '后端服务异常'}
            description={apiHealth.message}
            showIcon
            style={{ width: 280, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
            action={
              !apiHealth.ok ? (
                <Button
                  size="small"
                  type="primary"
                  ghost
                  icon={<ReloadOutlined />}
                  onClick={checkBackendHealth}
                >
                  重试
                </Button>
              ) : null
            }
          />
        ) : null}
      </div>

      <Card
        style={{
          width: 480,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          borderRadius: 16,
          overflow: 'hidden',
        }}
        bodyStyle={{ padding: 0 }}
      >
        <div
          style={{
            background:
              'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '32px 32px 24px',
            textAlign: 'center',
            color: 'white',
          }}
        >
          <SafetyOutlined style={{ fontSize: 48, marginBottom: 8 }} />
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 1 }}>
            证券两融担保品风险处置系统
          </div>
          <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
            Securities Margin Trading Collateral Risk Management
          </div>
        </div>

        <div style={{ padding: '28px 32px 32px' }}>
          <Form
            form={form}
            name="login"
            onFinish={handleLogin}
            size="large"
            layout="vertical"
            initialValues={{
              username: 'risk01',
              password: 'risk123',
              role: 'risk_control',
            }}
          >
            <Form.Item
              label="用户名"
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input prefix={<UserOutlined style={{ color: '#999' }} />} placeholder="请输入用户名" autoComplete="username" />
            </Form.Item>

            <Form.Item
              label="密码"
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#999' }} />}
                placeholder="请输入密码"
                autoComplete="current-password"
              />
            </Form.Item>

            <Form.Item
              label="登录角色"
              name="role"
              rules={[{ required: true, message: '请选择登录角色' }]}
            >
              <Select
                placeholder="选择登录角色"
                prefix={<TeamOutlined style={{ color: '#999' }} />}
                options={[
                  { value: 'risk_control', label: '🛡️ 风控部门' },
                  { value: 'customer_manager', label: '👤 客户经理' },
                  { value: 'trading_ops', label: '⚖️ 交易运营' },
                  { value: 'admin', label: '🔧 系统管理员' },
                ]}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                size="large"
                icon={<LoginOutlined />}
                style={{
                  height: 44,
                  fontSize: 15,
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
                }}
              >
                {loading ? '正在验证...' : '立即登录'}
              </Button>
            </Form.Item>
          </Form>

          <Divider style={{ margin: '20px 0 16px' }}>
            <span style={{ color: '#999', fontSize: 12 }}>快速登录（演示账号）</span>
          </Divider>

          <Space direction="vertical" style={{ width: '100%' }} size="small">
            {demoAccounts.map((acc) => (
              <div
                key={acc.username}
                onClick={() => {
                  form.setFieldsValue({
                    username: acc.username,
                    password: acc.password,
                    role: acc.role,
                  });
                  setTimeout(() => form.submit(), 100);
                }}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #f0f0f0',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.backgroundColor = '#f6f8ff';
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#d6e4ff';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.backgroundColor = 'white';
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#f0f0f0';
                }}
              >
                <Space>
                  <span
                    style={{
                      fontWeight: 600,
                      color:
                        acc.color === 'red'
                          ? '#f5222d'
                          : acc.color === 'blue'
                          ? '#1890ff'
                          : acc.color === 'orange'
                          ? '#fa8c16'
                          : '#722ed1',
                    }}
                  >
                    {acc.name}
                  </span>
                  <Tag
                    color={
                      acc.color === 'red'
                        ? 'volcano'
                        : acc.color === 'blue'
                        ? 'blue'
                        : acc.color === 'orange'
                        ? 'orange'
                        : 'purple'
                    }
                    style={{ margin: 0 }}
                  >
                    {acc.desc}
                  </Tag>
                </Space>
                <span style={{ color: '#999', fontSize: 12, fontFamily: 'monospace' }}>
                  {acc.username} / {acc.password}
                </span>
              </div>
            ))}
          </Space>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;
