import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from 'antd';
import AppLayout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import WarningsPage from './pages/WarningsPage';
import WarningDetailPage from './pages/WarningDetailPage';
import CustomersPage from './pages/CustomersPage';
import CustomerDetailPage from './pages/CustomerDetailPage';
import LiquidationsPage from './pages/LiquidationsPage';
import LiquidationDetailPage from './pages/LiquidationDetailPage';
import CollateralAdditionsPage from './pages/CollateralAdditionsPage';
import CommunicationsPage from './pages/CommunicationsPage';
import AuditLogsPage from './pages/AuditLogsPage';
import RiskCurvePage from './pages/RiskCurvePage';
import { useAppStore } from './store/appStore';

const { Content } = Layout;

const App: React.FC = () => {
  const currentUser = useAppStore((state) => state.currentUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return null;
  }

  if (!currentUser) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <AppLayout>
      <Content className="content">
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/warnings" element={<WarningsPage />} />
          <Route path="/warnings/:id" element={<WarningDetailPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/customers/:id" element={<CustomerDetailPage />} />
          <Route path="/liquidations" element={<LiquidationsPage />} />
          <Route path="/liquidations/:id" element={<LiquidationDetailPage />} />
          <Route path="/additions" element={<CollateralAdditionsPage />} />
          <Route path="/risk-curve" element={<RiskCurvePage />} />
          <Route path="/communications" element={<CommunicationsPage />} />
          <Route path="/audit-logs" element={<AuditLogsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Content>
    </AppLayout>
  );
};

export default App;
