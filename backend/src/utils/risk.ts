import { WarningLevel } from '../types';

export const calculateWarningLevel = (
  maintenanceRatio: number,
  warningLine: number = 150,
  liquidationLine: number = 130
): WarningLevel => {
  if (maintenanceRatio >= warningLine * 1.2) {
    return 'normal';
  } else if (maintenanceRatio >= warningLine) {
    return 'warning';
  } else if (maintenanceRatio >= liquidationLine) {
    return 'danger';
  } else {
    return 'liquidation';
  }
};

export const calculateMaintenanceRatio = (
  totalCollateralValue: number,
  totalDebt: number
): number => {
  if (totalDebt <= 0) return 9999;
  return (totalCollateralValue / totalDebt) * 100;
};

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

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(amount);
};

export const formatPercentage = (value: number): string => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
};
