# 证券两融担保品风险处置系统

## 项目概述

本系统是面向证券融资融券业务的担保品风险处置平台，实现风控、客户经理和交易运营三个角色的协同作业，确保担保品风险得到及时、合规的处置。

## 系统架构

### 技术栈

- **后端**: Node.js + Express + TypeScript + PostgreSQL + Redis
- **前端**: React + TypeScript + Vite + Ant Design + Chart.js
- **部署**: Docker + Nginx

### 核心模块

| 模块 | 职责 | 主要功能 |
|------|------|----------|
| **风控** | 计算维持担保比例，生成风险预警 | 风险计算、预警生成、批量计算、风险历史 |
| **客户经理** | 联系客户追加担保品 | 沟通记录、担保品追加登记、客户跟进 |
| **交易运营** | 执行强平或撤销操作 | 强平指令创建、执行、撤销、停牌证券处理 |
| **审计追踪** | 保存完整操作流水 | 预警、沟通、追加、处置全流程记录 |

## 关键业务规则

### 1. 未入账担保品保护
> **客户已追加但未入账时不能误触强平**
>
> 系统在创建和执行强平指令前，自动检查该客户是否存在状态为 `pending` 的担保品追加记录。如有，禁止执行强平并提示操作人员。

```typescript
// [tradingOperationsService.ts](backend/src/services/tradingOperationsService.ts#L95-L100)
const pendingAddition = await hasPendingAddition(warning.customer_id);
if (pendingAddition) {
  throw new Error('客户已追加担保品但尚未入账，不能触发强平');
}
```

### 2. 停牌证券单独计算可处置比例
> **停牌证券要单独计算可处置比例**
>
> 每只证券配置独立的 `disposable_ratio`（可处置比例）字段。停牌证券默认设置为较低比例（如 0.3 = 30%），计算维持担保比例时单独应用。

```typescript
// [risk.ts](backend/src/utils/risk.ts#L27-L33)
export const calculateDisposableValue = (
  positionValue: number,
  isSuspended: boolean,
  disposableRatio: number
): number => {
  if (isSuspended) {
    return positionValue * disposableRatio;
  }
  return positionValue;
};
```

### 3. 强平触发时点锁定
> **强平完成后不能修改触发时点**
>
> 强平指令执行完成后，`is_trigger_time_locked` 字段置为 `true`，后续任何修改触发时间的操作都将被拒绝。

```typescript
// [tradingOperationsService.ts](backend/src/services/tradingOperationsService.ts#L413-L423)
if (oldLiquidation.is_trigger_time_locked) {
  throw new Error('强平完成后不能修改触发时点');
}
if (oldLiquidation.status === 'completed') {
  throw new Error('强平完成后不能修改触发时点');
}
```

## 数据库设计

### 核心数据表

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| `customers` | 客户信息 | 客户ID、账号、联系方式、客户经理 |
| `securities` | 证券信息 | 是否停牌、可处置比例、当前价格 |
| `collateral_positions` | 担保品持仓 | 持仓数量、市值、最后计算时间 |
| `margin_accounts` | 信用账户 | 担保品价值、负债、维持比例、预警线、平仓线 |
| `risk_warnings` | 风险预警 | 预警等级、状态、触发时间、备注 |
| `communications` | 沟通记录 | 沟通方式、内容、客户回复、下次跟进时间 |
| `collateral_additions` | 担保品追加 | 类型、金额、状态（待确认/已确认/已拒绝） |
| `forced_liquidations` | 强平指令 | 触发比例、触发时间、锁定状态、待平仓持仓、执行状态 |
| `risk_history` | 风险历史 | 每日维持比例快照，用于趋势分析 |
| `audit_logs` | 审计日志 | 所有操作的完整记录 |

## 风险可视化

系统提供 **风险变化曲线** 展示，基于 `risk_history` 表的历史数据：

- **X轴**: 日期
- **Y轴**: 维持担保比例（%）
- **参考线**: 预警线（150%）、平仓线（130%）
- **点颜色**: 根据风险等级动态着色（正常/预警/警戒/平仓）

## 角色权限

| 角色 | 风控 | 客户经理 | 交易运营 | 管理员 |
|------|------|----------|----------|--------|
| 计算风险 | ✓ | - | - | ✓ |
| 生成预警 | ✓ | - | - | ✓ |
| 查看预警 | ✓ | ✓ | ✓ | ✓ |
| 记录沟通 | - | ✓ | - | ✓ |
| 登记担保品追加 | - | ✓ | - | ✓ |
| 确认担保品追加 | ✓ | - | - | ✓ |
| 创建强平指令 | - | - | ✓ | ✓ |
| 执行强平 | - | - | ✓ | ✓ |
| 撤销强平 | - | - | ✓ | ✓ |
| 修改触发时间 | - | - | ✓ | ✓ |
| 查看审计日志 | - | - | - | ✓ |

## 快速开始

### 环境要求

- Docker Engine 24.0+
- Docker Compose v2+
- 可用端口: 19489 (API), 20489 (WEB), 21489 (DB), 22489 (Redis)

### 一键启动

```bash
# 进入项目目录
cd /path/to/project

# 启动全部服务
docker-compose up -d --build

# 查看服务状态
docker-compose ps

# 初始化数据库（首次启动需要执行数据库种子数据）
docker-compose exec backend node dist/server.js &
# 等待服务启动后，在容器内执行 seed
docker-compose exec backend npx ts-node src/database/seed.ts
```

### 本地开发

```bash
# 后端开发
cd backend
npm install
npm run seed   # 初始化数据库
npm run dev    # 启动开发服务器 (端口: 19489)

# 前端开发
cd frontend
npm install
npm run dev    # 启动开发服务器 (端口: 20489)
```

### 演示账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| `risk01` | `risk123` | 风控 |
| `manager01` | `manager123` | 客户经理 |
| `trading01` | `trading123` | 交易运营 |
| `admin` | `admin123` | 管理员 |

## API 文档

### 风险控制模块

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/risk/calculate/:customerId` | 计算客户风险 |
| POST | `/api/risk/batch-calculate` | 批量计算所有客户 |
| POST | `/api/risk/warnings` | 生成风险预警 |
| GET | `/api/risk/warnings` | 获取预警列表 |
| GET | `/api/risk/warnings/:id` | 获取预警详情 |
| PUT | `/api/risk/warnings/:id` | 更新预警状态 |
| GET | `/api/risk/history/:customerId` | 获取风险历史数据 |

### 客户经理模块

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/customer/communications` | 创建沟通记录 |
| GET | `/api/customer/communications` | 获取沟通列表 |
| POST | `/api/customer/collateral-additions` | 登记担保品追加 |
| GET | `/api/customer/collateral-additions` | 获取追加列表 |
| POST | `/api/customer/collateral-additions/:id/confirm` | 确认担保品追加 |
| POST | `/api/customer/collateral-additions/:id/reject` | 拒绝担保品追加 |

### 交易运营模块

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/trading/positions/:customerId` | 获取可平仓持仓 |
| POST | `/api/trading/liquidations` | 创建强平指令 |
| GET | `/api/trading/liquidations` | 获取强平列表 |
| GET | `/api/trading/liquidations/:id` | 获取强平详情 |
| POST | `/api/trading/liquidations/:id/execute` | 执行强平 |
| POST | `/api/trading/liquidations/:id/cancel` | 撤销强平 |
| PUT | `/api/trading/liquidations/:id/trigger-time` | 修改触发时间 |

## 项目结构

```
.
├── backend/                      # 后端应用
│   ├── src/
│   │   ├── server.ts             # 入口文件
│   │   ├── database/             # 数据库
│   │   │   ├── schema.sql        # 表结构定义
│   │   │   ├── db.ts             # 连接池
│   │   │   └── seed.ts           # 初始化数据
│   │   ├── services/             # 业务逻辑
│   │   │   ├── riskControlService.ts
│   │   │   ├── customerManagerService.ts
│   │   │   └── tradingOperationsService.ts
│   │   ├── routes/               # API 路由
│   │   │   ├── riskControl.ts
│   │   │   ├── customerManager.ts
│   │   │   ├── tradingOperations.ts
│   │   │   └── common.ts
│   │   ├── utils/                # 工具函数
│   │   │   ├── risk.ts           # 风险计算
│   │   │   ├── audit.ts          # 审计日志
│   │   │   └── redis.ts          # 缓存
│   │   └── types/                # 类型定义
│   ├── Dockerfile
│   └── package.json
├── frontend/                     # 前端应用
│   ├── src/
│   │   ├── main.tsx              # 入口
│   │   ├── App.tsx               # 路由配置
│   │   ├── components/           # 公共组件
│   │   │   ├── Layout.tsx        # 布局
│   │   │   └── RiskCurveChart.tsx # 风险曲线
│   │   ├── pages/                # 页面
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── WarningsPage.tsx
│   │   │   ├── WarningDetailPage.tsx
│   │   │   ├── CustomersPage.tsx
│   │   │   ├── CustomerDetailPage.tsx
│   │   │   ├── LiquidationsPage.tsx
│   │   │   ├── LiquidationDetailPage.tsx
│   │   │   ├── CollateralAdditionsPage.tsx
│   │   │   ├── CommunicationsPage.tsx
│   │   │   ├── AuditLogsPage.tsx
│   │   │   └── LoginPage.tsx
│   │   ├── api/                  # API 客户端
│   │   ├── store/                # 状态管理
│   │   └── types/                # 类型定义
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docker-compose.yml            # 容器编排
├── .env                          # 环境变量
└── scripts/
    └── smoke.sh                  # 冒烟测试
```

## 核心代码说明

### 风险计算核心 [risk.ts](backend/src/utils/risk.ts)

```typescript
// 维持担保比例 = (担保品总价值 / 负债总额) × 100%
export const calculateMaintenanceRatio = (
  totalCollateralValue: number,
  totalDebt: number
): number => {
  if (totalDebt <= 0) return 9999;
  return (totalCollateralValue / totalDebt) * 100;
};

// 根据维持比例确定风险等级
export const calculateWarningLevel = (
  maintenanceRatio: number,
  warningLine: number = 150,
  liquidationLine: number = 130
): WarningLevel => {
  if (maintenanceRatio >= warningLine * 1.2) return 'normal';   // >= 180%
  if (maintenanceRatio >= warningLine) return 'warning';         // >= 150%
  if (maintenanceRatio >= liquidationLine) return 'danger';      // >= 130%
  return 'liquidation';                                           // < 130%
};
```

### 强平指令执行 [tradingOperationsService.ts](backend/src/services/tradingOperationsService.ts#L230-L280)

1. 检查客户是否有未入账的担保品追加（防止误触强平）
2. 检查强平是否已完成（防止重复执行）
3. 更新持仓数量（扣除强平部分）
4. 更新信用账户负债和担保品价值
5. 锁定触发时间（后续不可修改）
6. 更新预警状态为「已平仓」

## 许可证

本项目为内部系统，版权所有。
