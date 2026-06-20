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
CREATE INDEX IF NOT EXISTS idx_risk_history_customer ON risk_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_risk_history_calculated_at ON risk_history(calculated_at);
CREATE INDEX IF NOT EXISTS idx_collateral_positions_customer ON collateral_positions(customer_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
