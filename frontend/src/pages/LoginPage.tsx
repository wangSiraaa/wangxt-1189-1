import React, { useState } from 'react';
import { Form, Input, Select, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { commonApi } from '../api/common';
import { useAppStore } from '../store/appStore';
import { User, UserRole } from '../types';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { setCurrentUser } = useAppStore();

  const handleLogin = async (values: { username: string; password: string; role: UserRole }) => {
    setLoading(true);
    try {
      const users = await commonApi.getUsers();
      const user = users.find(
        (u) => u.username === values.username && u.role === values.role
      );

      if (!user) {
        message.error('用户名或角色不匹配');
        return;
      }

      if (values.password !== `${values.username}123`) {
        message.error('密码错误');
        return;
      }

      setCurrentUser(user);
      message.success('登录成功');
      navigate('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    { username: 'risk01', role: 'risk_control' as UserRole, name: '张风控', desc: '风控人员' },
    { username: 'manager01', role: 'customer_manager' as UserRole, name: '李经理', desc: '客户经理' },
    { username: 'trading01', role: 'trading_ops' as UserRole, name: '王交易', desc: '交易运营' },
    { username: 'admin', role: 'admin' as UserRole, name: '系统管理员', desc: '管理员' },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card
        style={{ width: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}
        title={
          <div style={{ textAlign: 'center', fontSize: 20, fontWeight: 600 }}>
            证券两融担保品风险处置系统
          </div>
        }
      >
        <Form name="login" onFinish={handleLogin} size="large">
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
            initialValue="risk01"
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
            initialValue="risk123"
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>

          <Form.Item
            name="role"
            rules={[{ required: true, message: '请选择角色' }]}
            initialValue="risk_control"
          >
            <Select placeholder="选择登录角色">
              <Select.Option value="risk_control">风控</Select.Option>
              <Select.Option value="customer_manager">客户经理</Select.Option>
              <Select.Option value="trading_ops">交易运营</Select.Option>
              <Select.Option value="admin">管理员</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登录
            </Button>
          </Form.Item>
        </Form>

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
          <div style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>演示账号：</div>
          {demoAccounts.map((acc) => (
            <div
              key={acc.username}
              style={{ fontSize: 12, color: '#666', marginBottom: 4 }}
            >
              <strong>{acc.name}</strong> ({acc.desc}) - 用户名: {acc.username}, 密码: {acc.username}123
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;
