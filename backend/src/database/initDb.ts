import { query } from './db';
import { v4 as uuidv4 } from 'uuid';

const SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS customers (
    customer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_name VARCHAR(255) NOT NULL,
    account_number VARCHAR(50) UNIQUE NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    manager_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('risk_control', 'customer_manager', 'trading_ops', 'admin')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS securities (
    security_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    security_code VARCHAR(20) UNIQUE NOT NULL,
    security_name VARCHAR(255) NOT NULL,
    is_suspended BOOLEAN DEFAULT false,
    suspension_start_date TIMESTAMP,
    disposable_ratio NUMERIC(10, 4) DEFAULT 1.0,
    current_price NUMERIC(18, 4) NOT NULL DEFAULT 0,
    prev_close_price NUMERIC(18, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS collateral_positions (
    position_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(customer_id) NOT NULL,
    security_id UUID REFERENCES securities(security_id) NOT NULL,
    quantity NUMERIC(18, 4) NOT NULL,
    market_value NUMERIC(18, 4) NOT NULL,
    last_calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(customer_id, security_id)
);

CREATE TABLE IF NOT EXISTS margin_accounts (
    account_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(customer_id) UNIQUE NOT NULL,
    total_collateral_value NUMERIC(18, 4) NOT NULL DEFAULT 0,
    total_debt NUMERIC(18, 4) NOT NULL DEFAULT 0,
    maintenance_ratio NUMERIC(10, 4) NOT NULL DEFAULT 0,
    warning_line NUMERIC(10, 4) NOT NULL DEFAULT 150,
    liquidation_line NUMERIC(10, 4) NOT NULL DEFAULT 130,
    last_calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS risk_warnings (
    warning_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(customer_id) NOT NULL,
    warning_type VARCHAR(50) NOT NULL CHECK (warning_type IN ('maintenance_ratio', 'suspended_security', 'other')),
    warning_level VARCHAR(20) NOT NULL CHECK (warning_level IN ('normal', 'warning', 'danger', 'liquidation')),
    maintenance_ratio NUMERIC(10, 4) NOT NULL,
    total_collateral_value NUMERIC(18, 4) NOT NULL,
    total_debt NUMERIC(18, 4) NOT NULL,
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(user_id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'liquidated', 'cancelled')),
    resolved_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS communications (
    communication_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(customer_id) NOT NULL,
    warning_id UUID REFERENCES risk_warnings(warning_id),
    manager_id UUID REFERENCES users(user_id) NOT NULL,
    communication_type VARCHAR(50) NOT NULL CHECK (communication_type IN ('phone', 'email', 'sms', 'in_person')),
    content TEXT NOT NULL,
    customer_response TEXT,
    next_follow_up_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS collateral_additions (
    addition_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(customer_id) NOT NULL,
    warning_id UUID REFERENCES risk_warnings(warning_id),
    addition_type VARCHAR(50) NOT NULL CHECK (addition_type IN ('cash', 'security')),
    amount NUMERIC(18, 4) NOT NULL,
    security_id UUID REFERENCES securities(security_id),
    quantity NUMERIC(18, 4),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled')),
    submitted_by UUID REFERENCES users(user_id) NOT NULL,
    confirmed_by UUID REFERENCES users(user_id),
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS forced_liquidations (
    liquidation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    warning_id UUID REFERENCES risk_warnings(warning_id) NOT NULL,
    customer_id UUID REFERENCES customers(customer_id) NOT NULL,
    trigger_maintenance_ratio NUMERIC(10, 4) NOT NULL,
    trigger_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_trigger_time_locked BOOLEAN DEFAULT false,
    is_disposal_locked BOOLEAN DEFAULT false,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    positions_to_liquidate JSONB,
    executed_by UUID REFERENCES users(user_id),
    executed_at TIMESTAMP,
    total_liquidated_amount NUMERIC(18, 4),
    cancellation_reason TEXT,
    cancelled_by UUID REFERENCES users(user_id),
    cancelled_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS liquidation_executions (
    execution_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    liquidation_id UUID REFERENCES forced_liquidations(liquidation_id) NOT NULL,
    execution_type VARCHAR(20) NOT NULL CHECK (execution_type IN ('fill', 'cancel')),
    position_id UUID,
    security_id UUID REFERENCES securities(security_id),
    security_code VARCHAR(20),
    security_name VARCHAR(255),
    planned_quantity NUMERIC(18, 4),
    quantity NUMERIC(18, 4) NOT NULL,
    fill_price NUMERIC(18, 4),
    fill_amount NUMERIC(18, 4),
    executed_by UUID REFERENCES users(user_id),
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cancellation_reason TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS risk_history (
    history_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(customer_id) NOT NULL,
    maintenance_ratio NUMERIC(10, 4) NOT NULL,
    total_collateral_value NUMERIC(18, 4) NOT NULL,
    total_debt NUMERIC(18, 4) NOT NULL,
    warning_level VARCHAR(20) NOT NULL,
    intraday_change NUMERIC(10, 4) DEFAULT 0,
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_risk_warnings_customer ON risk_warnings(customer_id);
CREATE INDEX IF NOT EXISTS idx_risk_warnings_status ON risk_warnings(status);
CREATE INDEX IF NOT EXISTS idx_communications_customer ON communications(customer_id);
CREATE INDEX IF NOT EXISTS idx_collateral_additions_customer ON collateral_additions(customer_id);
CREATE INDEX IF NOT EXISTS idx_collateral_additions_status ON collateral_additions(status);
CREATE INDEX IF NOT EXISTS idx_forced_liquidations_customer ON forced_liquidations(customer_id);
CREATE INDEX IF NOT EXISTS idx_forced_liquidations_status ON forced_liquidations(status);
CREATE INDEX IF NOT EXISTS idx_liquidation_executions_liq ON liquidation_executions(liquidation_id);
CREATE INDEX IF NOT EXISTS idx_risk_history_customer ON risk_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_risk_history_calculated_at ON risk_history(calculated_at);
CREATE INDEX IF NOT EXISTS idx_collateral_positions_customer ON collateral_positions(customer_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
`;

const MIGRATION_SQL = `
ALTER TABLE securities ADD COLUMN IF NOT EXISTS prev_close_price NUMERIC(18, 4) NOT NULL DEFAULT 0;
ALTER TABLE risk_history ADD COLUMN IF NOT EXISTS intraday_change NUMERIC(10, 4) DEFAULT 0;
ALTER TABLE forced_liquidations ADD COLUMN IF NOT EXISTS is_disposal_locked BOOLEAN DEFAULT false;
CREATE TABLE IF NOT EXISTS liquidation_executions (
    execution_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    liquidation_id UUID REFERENCES forced_liquidations(liquidation_id) NOT NULL,
    execution_type VARCHAR(20) NOT NULL CHECK (execution_type IN ('fill', 'cancel')),
    position_id UUID,
    security_id UUID REFERENCES securities(security_id),
    security_code VARCHAR(20),
    security_name VARCHAR(255),
    planned_quantity NUMERIC(18, 4),
    quantity NUMERIC(18, 4) NOT NULL,
    fill_price NUMERIC(18, 4),
    fill_amount NUMERIC(18, 4),
    executed_by UUID REFERENCES users(user_id),
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cancellation_reason TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_liquidation_executions_liq ON liquidation_executions(liquidation_id);
`;

export const runSchemaMigrations = async (): Promise<void> => {
  try {
    await query(MIGRATION_SQL);
    console.log('[DB Migration] Schema migrations applied');
  } catch (error) {
    console.error('[DB Migration] Migration failed:', error);
    throw error;
  }
};

export const checkAndInitializeDatabase = async (): Promise<boolean> => {
  try {
    const usersExists = await checkTableExists('users');
    const customersExists = await checkTableExists('customers');

    if (usersExists && customersExists) {
      console.log('[DB Init] Tables already exist, skipping initialization');

      const userCount = await query('SELECT COUNT(*) FROM users');
      const customerCount = await query('SELECT COUNT(*) FROM customers');
      console.log(
        `[DB Init] Found ${userCount.rows[0].count} users, ${customerCount.rows[0].count} customers`
      );

      console.log('[DB Init] Running schema migrations for existing database...');
      await runSchemaMigrations();
      return false;
    }

    console.log('[DB Init] Tables missing, starting full initialization...');
    await initializeDatabase();
    await runSchemaMigrations();
    return true;
  } catch (error) {
    console.error('[DB Init] Check failed:', error);
    throw error;
  }
};

const checkTableExists = async (tableName: string): Promise<boolean> => {
  try {
    const result = await query(
      `SELECT EXISTS (
         SELECT FROM information_schema.tables
         WHERE table_name = $1
       )`,
      [tableName]
    );
    return result.rows[0].exists;
  } catch (error) {
    return false;
  }
};

const initializeDatabase = async () => {
  console.log('[DB Init] Step 1: Creating schema...');
  await query(SCHEMA_SQL);
  console.log('[DB Init] Schema created successfully');

  console.log('[DB Init] Step 2: Creating users...');
  const adminId = uuidv4();
  const riskControlId = uuidv4();
  const customerManagerId = uuidv4();
  const tradingOpsId = uuidv4();

  await query(
    `INSERT INTO users (user_id, username, password, full_name, role) VALUES
       ($1, 'admin', 'admin123', '系统管理员', 'admin'),
       ($2, 'risk01', 'risk123', '张风控', 'risk_control'),
       ($3, 'manager01', 'manager123', '李经理', 'customer_manager'),
       ($4, 'trading01', 'trading123', '王交易', 'trading_ops')
       ON CONFLICT (username) DO NOTHING`,
    [adminId, riskControlId, customerManagerId, tradingOpsId]
  );
  console.log('[DB Init] 4 users created');

  console.log('[DB Init] Step 3: Creating customers...');
  const customerId1 = uuidv4();
  const customerId2 = uuidv4();
  const customerId3 = uuidv4();

  await query(
    `INSERT INTO customers (customer_id, customer_name, account_number, phone, email, manager_id) VALUES
       ($1, '张三', 'ACC001', '13800138001', 'zhangsan@example.com', $4),
       ($2, '李四', 'ACC002', '13800138002', 'lisi@example.com', $4),
       ($3, '王五', 'ACC003', '13800138003', 'wangwu@example.com', $4)
       ON CONFLICT (account_number) DO NOTHING`,
    [customerId1, customerId2, customerId3, customerManagerId]
  );
  console.log('[DB Init] 3 customers created');

  console.log('[DB Init] Step 4: Creating securities...');
  const securityId1 = uuidv4();
  const securityId2 = uuidv4();
  const securityId3 = uuidv4();
  const securityId4 = uuidv4();

  await query(
    `INSERT INTO securities (security_id, security_code, security_name, is_suspended, disposable_ratio, current_price, prev_close_price) VALUES
       ($1, '600519', '贵州茅台', false, 1.0, 1688.00, 1670.00),
       ($2, '000001', '平安银行', false, 1.0, 11.25, 11.40),
       ($3, '300750', '宁德时代', true, 0.3, 188.50, 192.00),
       ($4, '601318', '中国平安', false, 1.0, 42.80, 43.10)
       ON CONFLICT (security_code) DO UPDATE SET
       current_price = EXCLUDED.current_price,
       prev_close_price = EXCLUDED.prev_close_price,
       updated_at = CURRENT_TIMESTAMP`,
    [securityId1, securityId2, securityId3, securityId4]
  );
  console.log('[DB Init] 4 securities created');

  console.log('[DB Init] Step 5: Creating margin accounts...');
  const marginAccount1Id = uuidv4();
  const marginAccount2Id = uuidv4();
  const marginAccount3Id = uuidv4();

  await query(
    `INSERT INTO margin_accounts (account_id, customer_id, total_collateral_value, total_debt, maintenance_ratio, warning_line, liquidation_line) VALUES
       ($1, $4, 1688000.00, 1000000.00, 168.80, 150, 130),
       ($2, $5, 800000.00, 1000000.00, 80.00, 150, 130),
       ($3, $6, 1350000.00, 1000000.00, 135.00, 150, 130)
       ON CONFLICT (customer_id) DO NOTHING`,
    [marginAccount1Id, marginAccount2Id, marginAccount3Id, customerId1, customerId2, customerId3]
  );
  console.log('[DB Init] 3 margin accounts created');

  console.log('[DB Init] Step 6: Creating collateral positions...');
  const positionId1 = uuidv4();
  const positionId2 = uuidv4();
  const positionId3 = uuidv4();
  const positionId4 = uuidv4();
  const positionId5 = uuidv4();
  const positionId6 = uuidv4();

  await query(
    `INSERT INTO collateral_positions (position_id, customer_id, security_id, quantity, market_value) VALUES
       ($1, $5, $7, 1000, 1688000.00),
       ($2, $6, $8, 20000, 225000.00),
       ($3, $6, $9, 3000, 565500.00),
       ($4, $6, $10, 1000, 42800.00),
       ($11, $6, $7, 0, 0),
       ($12, $5, $8, 10000, 112500.00)
       ON CONFLICT (customer_id, security_id) DO UPDATE SET
       quantity = EXCLUDED.quantity,
       market_value = EXCLUDED.market_value,
       updated_at = CURRENT_TIMESTAMP`,
    [
      positionId1, positionId2, positionId3, positionId4,
      customerId1, customerId2,
      securityId1, securityId2, securityId3, securityId4,
      positionId5, positionId6,
    ]
  );
  console.log('[DB Init] 6 collateral positions created');

  console.log('[DB Init] Step 7: Creating risk history (30 days)...');
  const now = new Date();
  for (let i = 30; i >= 0; i--) {
    const historyDate = new Date(now);
    historyDate.setDate(historyDate.getDate() - i);

    const baseRatio1 = 170 + Math.sin(i * 0.3) * 15;
    const baseRatio2 = 95 + Math.sin(i * 0.2) * 20;
    const baseRatio3 = 140 + Math.sin(i * 0.25) * 10;

    const change1 = Number((Math.cos(i * 0.3) * 1.8).toFixed(2));
    const change2 = Number((Math.cos(i * 0.2) * 2.4).toFixed(2));
    const change3 = Number((Math.cos(i * 0.25) * 1.5).toFixed(2));

    const getLevel = (ratio: number) => {
      if (ratio >= 180) return 'normal';
      if (ratio >= 150) return 'warning';
      if (ratio >= 130) return 'danger';
      return 'liquidation';
    };

    await query(
      `INSERT INTO risk_history (history_id, customer_id, maintenance_ratio, total_collateral_value, total_debt, warning_level, intraday_change, calculated_at)
         VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8),
         ($9, $10, $11, $12, $13, $14, $15, $16),
         ($17, $18, $19, $20, $21, $22, $23, $24)`,
      [
        uuidv4(), customerId1, baseRatio1, 1688000 + i * 1000, 1000000, getLevel(baseRatio1), change1, historyDate,
        uuidv4(), customerId2, baseRatio2, 800000 + i * 500, 1000000, getLevel(baseRatio2), change2, historyDate,
        uuidv4(), customerId3, baseRatio3, 1350000 + i * 800, 1000000, getLevel(baseRatio3), change3, historyDate,
      ]
    );
  }
  console.log('[DB Init] 31 days of risk history created for 3 customers');

  console.log('[DB Init] Step 8: Creating risk warnings...');
  const warningId1 = uuidv4();
  await query(
    `INSERT INTO risk_warnings (warning_id, customer_id, warning_type, warning_level, maintenance_ratio, total_collateral_value, total_debt, created_by, status, notes)
       VALUES ($1, $2, 'maintenance_ratio', 'liquidation', 80.00, 800000.00, 1000000.00, $3, 'in_progress', '客户维持担保比例跌破平仓线，需立即处理')
       ON CONFLICT DO NOTHING`,
    [warningId1, customerId2, riskControlId]
  );

  const warningId2 = uuidv4();
  await query(
    `INSERT INTO risk_warnings (warning_id, customer_id, warning_type, warning_level, maintenance_ratio, total_collateral_value, total_debt, created_by, status, notes)
       VALUES ($1, $2, 'maintenance_ratio', 'danger', 135.00, 1350000.00, 1000000.00, $3, 'pending', '客户维持担保比例低于预警线，需关注')
       ON CONFLICT DO NOTHING`,
    [warningId2, customerId3, riskControlId]
  );
  console.log('[DB Init] 2 risk warnings created');

  console.log('[DB Init] Step 9: Creating sample communications...');
  const commId1 = uuidv4();
  await query(
    `INSERT INTO communications (communication_id, customer_id, warning_id, manager_id, communication_type, content, customer_response, next_follow_up_at)
       VALUES ($1, $2, $3, $4, 'phone', '已电话联系客户李四，告知维持担保比例跌破平仓线，要求今日内追加担保品至150%以上', '客户表示今日内将通过银行转账追加50万保证金', $5)`,
    [commId1, customerId2, warningId1, customerManagerId, new Date(Date.now() + 24 * 60 * 60 * 1000)]
  );

  const commId2 = uuidv4();
  await query(
    `INSERT INTO communications (communication_id, customer_id, warning_id, manager_id, communication_type, content)
       VALUES ($1, $2, $3, $4, 'sms', '已发送短信提醒王五，维持担保比例135%接近平仓线，请关注账户风险')`,
    [commId2, customerId3, warningId2, customerManagerId]
  );
  console.log('[DB Init] 2 sample communications created');

  console.log('[DB Init] Step 10: Creating sample collateral additions...');
  const additionId1 = uuidv4();
  await query(
    `INSERT INTO collateral_additions (addition_id, customer_id, warning_id, addition_type, amount, status, submitted_by, submitted_at)
       VALUES ($1, $2, $3, 'cash', 500000.00, 'pending', $4, CURRENT_TIMESTAMP)`,
    [additionId1, customerId2, warningId1, customerManagerId]
  );
  console.log('[DB Init] 1 pending collateral addition created');

  console.log('[DB Init] Database initialization completed successfully!');
};
