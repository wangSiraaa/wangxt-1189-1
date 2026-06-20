import React, { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Button, Space } from 'antd';
import {
  DashboardOutlined,
  WarningOutlined,
  UserOutlined,
  SwapOutlined,
  PlusSquareOutlined,
  MessageOutlined,
  FileTextOutlined,
  LogoutOutlined,
  SwitcherOutlined,
  TeamOutlined,
  LineChartOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { RoleTexts, UserRole } from '../types';

const { Header, Sider } = Layout;

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, currentRole, setCurrentRole, logout } = useAppStore();
  const [collapsed, setCollapsed] = useState(false);

  const role = currentRole || currentUser?.role || 'admin';

  const getMenuItems = () => {
    const baseItems = [
      {
        key: '/dashboard',
        icon: <DashboardOutlined />,
        label: '仪表盘',
        onClick: () => navigate('/dashboard'),
      },
      {
        key: '/warnings',
        icon: <WarningOutlined />,
        label: '风险预警',
        onClick: () => navigate('/warnings'),
      },
      {
        key: '/customers',
        icon: <UserOutlined />,
        label: '客户管理',
        onClick: () => navigate('/customers'),
      },
      {
        key: '/additions',
        icon: <PlusSquareOutlined />,
        label: '担保品追加',
        onClick: () => navigate('/additions'),
      },
      {
        key: '/risk-curve',
        icon: <LineChartOutlined />,
        label: '风险变化曲线',
        onClick: () => navigate('/risk-curve'),
      },
      {
        key: '/communications',
        icon: <MessageOutlined />,
        label: '沟通记录',
        onClick: () => navigate('/communications'),
      },
    ];

    if (role === 'trading_ops' || role === 'risk_control' || role === 'admin') {
      baseItems.splice(3, 0, {
        key: '/liquidations',
        icon: <SwapOutlined />,
        label: '强平管理',
        onClick: () => navigate('/liquidations'),
      });
    }

    if (role === 'admin') {
      baseItems.push({
        key: '/audit-logs',
        icon: <FileTextOutlined />,
        label: '审计日志',
        onClick: () => navigate('/audit-logs'),
      });
    }

    return baseItems;
  };

  const roleMenuItems = [
    {
      key: 'risk_control',
      label: '风控角色',
      disabled: currentUser?.role !== 'admin' && currentUser?.role !== 'risk_control',
      onClick: () => setCurrentRole('risk_control'),
    },
    {
      key: 'customer_manager',
      label: '客户经理角色',
      disabled: currentUser?.role !== 'admin' && currentUser?.role !== 'customer_manager',
      onClick: () => setCurrentRole('customer_manager'),
    },
    {
      key: 'trading_ops',
      label: '交易运营角色',
      disabled: currentUser?.role !== 'admin' && currentUser?.role !== 'trading_ops',
      onClick: () => setCurrentRole('trading_ops'),
    },
  ].filter(
    (item) =>
      currentUser?.role === 'admin' ||
      currentUser?.role === item.key
  );

  const userMenuItems = [
    {
      key: 'role',
      label: (
        <Space>
          <SwitcherOutlined />
          切换角色
        </Space>
      ),
      children: roleMenuItems,
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      label: (
        <Space>
          <LogoutOutlined />
          退出登录
        </Space>
      ),
      onClick: () => {
        logout();
        navigate('/login');
      },
    },
  ];

  const selectedKey = getMenuItems().find(
    (item) => location.pathname.startsWith(item.key as string)
  )?.key as string;

  return (
    <Layout className="layout-container">
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {!collapsed && <span className="logo">风险处置系统</span>}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKey ? [selectedKey] : []}
          items={getMenuItems()}
        />
      </Sider>
      <Layout>
        <Header className="header">
          <div className="logo">
            {collapsed ? '证券两融担保品风险处置' : '证券两融担保品风险处置系统'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Space>
              <span style={{ color: 'white', fontSize: 12 }}>
                当前角色: {RoleTexts[role as UserRole]}
              </span>
              <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
                <Button type="text" style={{ color: 'white' }}>
                  <Space>
                    <Avatar size="small" style={{ backgroundColor: '#1890ff' }}>
                      {currentUser?.full_name?.charAt(0)}
                    </Avatar>
                    {currentUser?.full_name}
                  </Space>
                </Button>
              </Dropdown>
            </Space>
          </div>
        </Header>
        {children}
      </Layout>
    </Layout>
  );
};

export default AppLayout;
