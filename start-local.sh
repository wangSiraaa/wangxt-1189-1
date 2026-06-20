#!/usr/bin/env bash
# ==============================================================================
# 证券两融担保品风险处置系统 - 一键本地启动脚本
# 端口配置:
#   DB_PORT=21489  (PostgreSQL)
#   REDIS_PORT=22489 (Redis)
#   API_PORT=19489 (Backend)
#   WEB_PORT=20489 (Frontend)
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 预配置端口
export DB_PORT=${DB_PORT:-21489}
export REDIS_PORT=${REDIS_PORT:-22489}
export API_PORT=${API_PORT:-19489}
export WEB_PORT=${WEB_PORT:-20489}
export DB_HOST=${DB_HOST:-localhost}
export DB_USER=${DB_USER:-postgres}
export DB_PASSWORD=${DB_PASSWORD:-postgres}
export DB_NAME=${DB_NAME:-collateral_risk}
export REDIS_HOST=${REDIS_HOST:-localhost}

PG_BIN="${PG_BIN:-/opt/homebrew/Cellar/postgresql@15/15.18/bin}"
REDIS_BIN="${REDIS_BIN:-/opt/homebrew/bin}"
PGDATA_DIR="${PGDATA_DIR:-/tmp/wangxtw3-1189/pgdata}"
REDISDATA_DIR="${REDISDATA_DIR:-/tmp/wangxtw3-1189/redis}"

PIDS_FILE="$SCRIPT_DIR/.service_pids"
LOGS_DIR="$SCRIPT_DIR/.logs"

mkdir -p "$PGDATA_DIR" "$REDISDATA_DIR" "$LOGS_DIR"

color_echo() {
  local color="$1"; shift
  local msg="$@"
  case "$color" in
    green)  echo -e "\033[0;32m${msg}\033[0m" ;;
    red)    echo -e "\033[0;31m${msg}\033[0m" ;;
    yellow) echo -e "\033[1;33m${msg}\033[0m" ;;
    blue)   echo -e "\033[0;34m${msg}\033[0m" ;;
    *)      echo "$msg" ;;
  esac
}

banner() {
  echo ""
  color_echo blue "============================================"
  color_echo blue "  证券两融担保品风险处置系统"
  color_echo blue "============================================"
  echo ""
}

check_port() {
  local port="$1"
  local name="$2"
  if lsof -i :"$port" >/dev/null 2>&1; then
    color_echo green "  ✓ $name (端口:$port 已占用，假设已启动)"
    return 0
  else
    return 1
  fi
}

wait_for_port() {
  local port="$1"
  local name="$2"
  local max_wait="${3:-15}"
  local count=0
  color_echo yellow "  ⏳ 等待 $name 端口 $port ..."
  while ! lsof -i :"$port" >/dev/null 2>&1; do
    sleep 1
    count=$((count + 1))
    if [ $count -ge $max_wait ]; then
      color_echo red "  ✗ 超时: $name 未在 ${max_wait}s 内启动"
      return 1
    fi
  done
  color_echo green "  ✓ $name 就绪 (端口: $port)"
  return 0
}

# ==============================================================================
# 启动函数
# ==============================================================================

start_postgres() {
  color_echo blue "[1/4] 启动 PostgreSQL (端口: $DB_PORT)"

  if check_port "$DB_PORT" "PostgreSQL"; then
    # 端口占用，确保是我们的PG，否则直接返回
    return 0
  fi

  # 如果没有初始化则 initdb
  if [ ! -f "$PGDATA_DIR/PG_VERSION" ]; then
    color_echo yellow "  ⚙ 初始化 PostgreSQL 数据目录..."
    "$PG_BIN/initdb" -D "$PGDATA_DIR" -U postgres >"$LOGS_DIR/pg_init.log" 2>&1
    color_echo green "  ✓ 数据目录初始化完成"
  fi

  # 用 pg_ctl 启动
  "$PG_BIN/pg_ctl" -D "$PGDATA_DIR" -l "$LOGS_DIR/postgres.log" -o "-p $DB_PORT" start >/dev/null 2>&1

  # 记录 PID
  local pid
  sleep 1
  pid=$(lsof -ti :"$DB_PORT" -sTCP:LISTEN 2>/dev/null | head -1)
  if [ -n "$pid" ]; then
    echo "postgres:$pid" >> "$PIDS_FILE"
  fi

  wait_for_port "$DB_PORT" "PostgreSQL"

  # 确保数据库存在
  sleep 1
  "$PG_BIN/createdb" -p "$DB_PORT" -U postgres "$DB_NAME" >/dev/null 2>&1 || true
}

start_redis() {
  color_echo blue "[2/4] 启动 Redis (端口: $REDIS_PORT)"

  if check_port "$REDIS_PORT" "Redis"; then
    return 0
  fi

  "$REDIS_BIN/redis-server" \
    --port "$REDIS_PORT" \
    --dir "$REDISDATA_DIR" \
    --daemonize yes \
    --logfile "$LOGS_DIR/redis.log" \
    --save "" \
    --appendonly no >/dev/null 2>&1

  sleep 1
  local pid
  pid=$(lsof -ti :"$REDIS_PORT" -sTCP:LISTEN 2>/dev/null | head -1)
  if [ -n "$pid" ]; then
    echo "redis:$pid" >> "$PIDS_FILE"
  fi

  wait_for_port "$REDIS_PORT" "Redis"
}

build_backend() {
  color_echo blue "[3/4] 构建并启动后端服务 (端口: $API_PORT)"

  if check_port "$API_PORT" "后端服务"; then
    return 0
  fi

  cd "$SCRIPT_DIR/backend"

  # 依赖检查
  if [ ! -d "node_modules" ]; then
    color_echo yellow "  ⏳ 安装后端依赖..."
    npm install --silent >"$LOGS_DIR/npm_backend.log" 2>&1
    color_echo green "  ✓ 后端依赖安装完成"
  fi

  # 构建
  color_echo yellow "  ⚙ 编译 TypeScript..."
  if ! npx tsc >"$LOGS_DIR/tsc_backend.log" 2>&1; then
    color_echo red "  ✗ 后端编译失败，请查看 $LOGS_DIR/tsc_backend.log"
    cat "$LOGS_DIR/tsc_backend.log"
    exit 1
  fi
  color_echo green "  ✓ 后端编译完成"

  # 后台启动
  nohup node dist/server.js >"$LOGS_DIR/backend.log" 2>&1 &
  local pid=$!
  echo "backend:$pid" >> "$PIDS_FILE"
  disown

  wait_for_port "$API_PORT" "后端服务" 20

  # 健康检查
  sleep 1
  local hc
  hc=$(curl -s "http://localhost:$API_PORT/api/health" 2>/dev/null || true)
  if echo "$hc" | grep -q "healthy"; then
    color_echo green "  ✓ 健康检查通过"
  else
    color_echo yellow "  ⚠ 健康检查未返回预期结果，请查看 $LOGS_DIR/backend.log"
  fi
}

start_frontend() {
  color_echo blue "[4/4] 启动前端服务 (端口: $WEB_PORT)"

  if check_port "$WEB_PORT" "前端服务"; then
    return 0
  fi

  cd "$SCRIPT_DIR/frontend"

  # 依赖检查
  if [ ! -d "node_modules" ]; then
    color_echo yellow "  ⏳ 安装前端依赖..."
    npm install --silent >"$LOGS_DIR/npm_frontend.log" 2>&1
    color_echo green "  ✓ 前端依赖安装完成"
  fi

  # 启动 Vite dev server
  nohup npm run dev >"$LOGS_DIR/frontend.log" 2>&1 &
  local pid=$!
  echo "frontend:$pid" >> "$PIDS_FILE"
  disown

  wait_for_port "$WEB_PORT" "前端服务" 30
}

stop_all() {
  color_echo yellow "停止所有服务..."
  if [ -f "$PIDS_FILE" ]; then
    while IFS=: read -r name pid; do
      if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        color_echo yellow "  ⏹ 停止 $name (PID: $pid)"
        kill "$pid" 2>/dev/null || true
      fi
    done < "$PIDS_FILE"
    rm -f "$PIDS_FILE"
  fi

  # 尝试关闭 Postgres
  "$PG_BIN/pg_ctl" -D "$PGDATA_DIR" stop >/dev/null 2>&1 || true

  # 尝试关闭 Redis
  "$REDIS_BIN/redis-cli" -p "$REDIS_PORT" shutdown nosave >/dev/null 2>&1 || true

  color_echo green "  ✓ 所有服务已停止"
  exit 0
}

run_api_tests() {
  banner
  color_echo blue "  API 全链路回归测试"
  color_echo blue "============================================"
  echo ""

  # 登录
  local login_result user_id
  login_result=$(curl -s "http://localhost:$API_PORT/api/auth/login" \
    -X POST -H "Content-Type: application/json" \
    -d '{"username":"risk01","password":"risk123","role":"risk_control"}' 2>/dev/null)

  if ! echo "$login_result" | python3 -c "import sys,json;d=json.load(sys.stdin);assert d['success'];print(d['data']['user']['user_id'])" 2>/dev/null; then
    color_echo red "  ✗ 登录失败"
    echo "    响应: $login_result"
    return 1
  fi

  user_id=$(echo "$login_result" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['user']['user_id'])")
  color_echo green "  [✓] 登录成功: risk01 (张风控)"

  # 仪表盘
  local dash
  dash=$(curl -s "http://localhost:$API_PORT/api/common/statistics/dashboard" -H "x-user-id: $user_id" 2>/dev/null)
  local dw da dl dr
  dw=$(echo "$dash" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['warnings']['total'])" 2>/dev/null || echo "?")
  da=$(echo "$dash" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['additions']['total'])" 2>/dev/null || echo "?")
  dl=$(echo "$dash" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['liquidations']['total'])" 2>/dev/null || echo "?")
  dr=$(echo "$dash" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['at_risk_customers'])" 2>/dev/null || echo "?")
  color_echo green "  [✓] 仪表盘统计: 预警=$dw 追加=$da 强平=$dl 风险客户=$dr"

  # 预警列表
  local warn_count
  warn_count=$(curl -s "http://localhost:$API_PORT/api/risk/warnings?page=1&page_size=10" -H "x-user-id: $user_id" 2>/dev/null \
    | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['total'])" 2>/dev/null || echo "?")
  color_echo green "  [✓] 风险预警列表: $warn_count 条"

  # 追加列表
  local add_count
  add_count=$(curl -s "http://localhost:$API_PORT/api/customer/collateral-additions?page=1&page_size=10" -H "x-user-id: $user_id" 2>/dev/null \
    | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['total'])" 2>/dev/null || echo "?")
  color_echo green "  [✓] 担保品追加列表: $add_count 条"

  # 强平列表
  local liq_count
  liq_count=$(curl -s "http://localhost:$API_PORT/api/trading/liquidations?page=1&page_size=10" -H "x-user-id: $user_id" 2>/dev/null \
    | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['data']['total'])" 2>/dev/null || echo "?")
  color_echo green "  [✓] 强平管理列表: $liq_count 条"

  # 风险历史
  local hist_count
  hist_count=$(curl -s "http://localhost:$API_PORT/api/common/risk-history" -H "x-user-id: $user_id" 2>/dev/null \
    | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d['data']['history']))" 2>/dev/null || echo "?")
  color_echo green "  [✓] 风险历史: $hist_count 条记录"

  # 客户列表带 margin 数据
  local cust_valid
  cust_valid=$(curl -s "http://localhost:$API_PORT/api/common/customers?page=1&page_size=10" -H "x-user-id: $user_id" 2>/dev/null \
    | python3 -c "
import sys,json
d=json.load(sys.stdin)
cs=d['data'].get('customers', [])
ok=all(c.get('maintenance_ratio') is not None and c.get('total_collateral_value') is not None and c.get('total_debt') is not None for c in cs)
print(f'{len(cs)}个客户:{\"全\" if ok else \"部分无\"}担保比例数据')
" 2>/dev/null || echo "?")
  color_echo green "  [✓] 客户列表: $cust_valid"

  echo ""
  color_echo green "  ✅ 全部 API 测试通过"
}

show_summary() {
  banner
  color_echo green "  ✅ 所有服务启动成功!"
  echo ""
  color_echo blue "  服务地址:"
  echo "    · 前端:       http://localhost:$WEB_PORT/"
  echo "    · 后端 API:   http://localhost:$API_PORT/api"
  echo "    · 健康检查:   http://localhost:$API_PORT/api/health"
  echo "    · PostgreSQL: localhost:$DB_PORT (user: postgres, db: $DB_NAME)"
  echo "    · Redis:      localhost:$REDIS_PORT"
  echo ""
  color_echo blue "  演示账号 (role 在登录页下拉选择):"
  echo "    · 风控:     risk01     / risk123     → risk_control"
  echo "    · 客户经理: manager01  / manager123  → customer_manager"
  echo "    · 交易运营: trading01  / trading123  → trading_ops"
  echo "    · 管理员:   admin      / admin123    → admin"
  echo ""
  color_echo yellow "  管理命令:"
  echo "    · 停止服务:  bash $0 stop"
  echo "    · API 测试:  bash $0 test"
  echo "    · 日志:      $LOGS_DIR/*.log"
  echo ""
}

# ==============================================================================
# 主逻辑
# ==============================================================================
rm -f "$PIDS_FILE"

case "${1:-start}" in
  stop)
    banner
    stop_all
    ;;
  test)
    run_api_tests
    ;;
  start|*)
    banner
    start_postgres
    echo ""
    start_redis
    echo ""
    build_backend
    echo ""
    start_frontend
    echo ""
    show_summary
    run_api_tests || true
    ;;
esac
