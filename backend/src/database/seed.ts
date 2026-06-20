import { query } from './db';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const seedDatabase = async () => {
  console.log('Starting database initialization...');

  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await query(schemaSql);
    console.log('Database schema created');

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
    console.log('Users created');

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
    console.log('Customers created');

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
    console.log('Securities created');

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
    console.log('Margin accounts created');

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
        positionId5, positionId6
      ]
    );
    console.log('Collateral positions created');

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
    console.log('Risk history data created');

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
    console.log('Risk warnings created');

    console.log('Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Database seeding failed:', error);
    process.exit(1);
  }
};

seedDatabase();
