// Simple encryption for POC (use proper RSA in production)
export const mockEncrypt = (data: any): string => {
  return btoa(JSON.stringify(data));
};

export const generateOrderId = (): string => {
  return `ORD-${Date.now()}`;
};

export const createUpgHash = (
  appKey: string,
  orderId: string,
  amount: string,
  paymentType: string
): string => {
  const hashData = `${appKey}|${orderId}|${amount}|${paymentType}`;
  return mockEncrypt(hashData);
};