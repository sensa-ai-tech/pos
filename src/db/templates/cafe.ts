export const cafeTemplate = {
  categories: [
    { name: '咖啡', sortOrder: 1 },
    { name: '茶飲', sortOrder: 2 },
    { name: '特調飲品', sortOrder: 3 },
    { name: '輕食', sortOrder: 4 },
    { name: '甜點', sortOrder: 5 },
    { name: '周邊商品', sortOrder: 6 },
  ],
  products: [
    // 咖啡 (含 metadata: 冷熱、大小杯選項)
    { name: '美式咖啡', price: 80, category: '咖啡', stockQuantity: 999, metadata: JSON.stringify({ options: ['熱', '冰'], sizes: ['中杯', '大杯'], sizeUpPrice: 20 }) },
    { name: '拿鐵', price: 120, category: '咖啡', stockQuantity: 999, metadata: JSON.stringify({ options: ['熱', '冰'], sizes: ['中杯', '大杯'], sizeUpPrice: 20 }) },
    { name: '卡布奇諾', price: 120, category: '咖啡', stockQuantity: 999, metadata: JSON.stringify({ options: ['熱'], sizes: ['中杯', '大杯'], sizeUpPrice: 20 }) },
    { name: '摩卡', price: 140, category: '咖啡', stockQuantity: 999, metadata: JSON.stringify({ options: ['熱', '冰'], sizes: ['中杯', '大杯'], sizeUpPrice: 20 }) },
    { name: '手沖單品', price: 180, category: '咖啡', stockQuantity: 999, metadata: JSON.stringify({ options: ['熱'], sizes: ['單杯'] }) },
    // 茶飲
    { name: '伯爵紅茶', price: 80, category: '茶飲', stockQuantity: 999, metadata: JSON.stringify({ options: ['熱', '冰'] }) },
    { name: '茉莉綠茶', price: 70, category: '茶飲', stockQuantity: 999, metadata: JSON.stringify({ options: ['熱', '冰'] }) },
    { name: '烏龍茶', price: 90, category: '茶飲', stockQuantity: 999, metadata: JSON.stringify({ options: ['熱', '冰'] }) },
    // 特調
    { name: '抹茶拿鐵', price: 150, category: '特調飲品', stockQuantity: 999, metadata: JSON.stringify({ options: ['熱', '冰'] }) },
    { name: '水果氣泡飲', price: 130, category: '特調飲品', stockQuantity: 999, metadata: JSON.stringify({ options: ['冰'] }) },
    { name: '蜂蜜柚子茶', price: 120, category: '特調飲品', stockQuantity: 999, metadata: JSON.stringify({ options: ['熱', '冰'] }) },
    // 輕食
    { name: '可頌三明治', price: 120, category: '輕食', stockQuantity: 50 },
    { name: '帕尼尼', price: 150, category: '輕食', stockQuantity: 40 },
    { name: '沙拉碗', price: 180, category: '輕食', stockQuantity: 30 },
    // 甜點
    { name: '提拉米蘇', price: 160, category: '甜點', stockQuantity: 20 },
    { name: '司康', price: 80, category: '甜點', stockQuantity: 30 },
    { name: '肉桂捲', price: 90, category: '甜點', stockQuantity: 25 },
    // 周邊
    { name: '濾掛咖啡禮盒', price: 450, category: '周邊商品', stockQuantity: 20, sku: 'DRIP-001' },
    { name: '隨行杯', price: 380, category: '周邊商品', stockQuantity: 15, sku: 'CUP-001' },
  ],
  settings: {
    enableCustomization: true,  // 客製化選項（冰量、甜度）
    enableTakeout: true,
    enableLoyaltyStamp: true,
    taxRate: 0.05,
    currency: 'TWD',
  },
};
