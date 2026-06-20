export const toNumber = (val: string | number | null | undefined): number => {
  if (val === null || val === undefined || val === '') return 0;
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  return isNaN(num) ? 0 : num;
};

export const formatPercent = (val: string | number | null | undefined, decimals: number = 2): string => {
  return `${toNumber(val).toFixed(decimals)}%`;
};

export const formatMoney = (val: string | number | null | undefined, decimals: number = 2): string => {
  return `¥${toNumber(val).toFixed(decimals)}`;
};

export const formatNumber = (val: string | number | null | undefined, decimals: number = 4): string => {
  return toNumber(val).toFixed(decimals);
};

export const formatRatio = (val: string | number | null | undefined, decimals: number = 4): string => {
  return toNumber(val).toFixed(decimals);
};

export const formatLocaleNumber = (val: string | number | null | undefined): string => {
  return toNumber(val).toLocaleString();
};
