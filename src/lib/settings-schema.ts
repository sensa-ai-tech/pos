import { z } from 'zod';

// 通用設定（所有行業共用）
const baseSettingsSchema = z.object({
  taxRate: z.number().min(0).max(1).optional(),
  currency: z.enum(['TWD', 'USD', 'JPY', 'CNY', 'EUR']).optional(),
});

// 各行業專屬設定
const restaurantSettingsSchema = baseSettingsSchema.extend({
  enableTableManagement: z.boolean().optional(),
  enableDineInTakeout: z.boolean().optional(),
  enableKitchenPrint: z.boolean().optional(),
  orderFlow: z.enum(['pay-first', 'dine-first']).optional(),
  tableCount: z.number().int().min(1).max(200).optional(),
});

const cafeSettingsSchema = baseSettingsSchema.extend({
  enableCustomization: z.boolean().optional(),
  enableTakeout: z.boolean().optional(),
  enableLoyaltyStamp: z.boolean().optional(),
  orderFlow: z.enum(['pay-first', 'dine-first']).optional(),
  enableKitchenPrint: z.boolean().optional(),
});

const retailSettingsSchema = baseSettingsSchema.extend({
  enableBarcode: z.boolean().optional(),
  enableVariants: z.boolean().optional(),
  lowStockAlert: z.boolean().optional(),
});

const medicalSettingsSchema = baseSettingsSchema.extend({
  enableAppointment: z.boolean().optional(),
  enablePrescription: z.boolean().optional(),
  enableExpiryTracking: z.boolean().optional(),
});

const serviceSettingsSchema = baseSettingsSchema.extend({
  enableBooking: z.boolean().optional(),
  enableTechnician: z.boolean().optional(),
  enableStoredValue: z.boolean().optional(),
});

const beautySettingsSchema = baseSettingsSchema.extend({
  enableBooking: z.boolean().optional(),
  enableTechnician: z.boolean().optional(),
  enableBeforeAfterPhoto: z.boolean().optional(),
});

const gymSettingsSchema = baseSettingsSchema.extend({
  enableMembership: z.boolean().optional(),
  enableClassBooking: z.boolean().optional(),
  enableTrainerSchedule: z.boolean().optional(),
});

const educationSettingsSchema = baseSettingsSchema.extend({
  enableSchedule: z.boolean().optional(),
  enableAttendance: z.boolean().optional(),
  enableParentNotification: z.boolean().optional(),
});

const petshopSettingsSchema = baseSettingsSchema.extend({
  enablePetProfile: z.boolean().optional(),
  enableGroomingBooking: z.boolean().optional(),
  enableBoardingCalendar: z.boolean().optional(),
});

const repairSettingsSchema = baseSettingsSchema.extend({
  enableRepairTicket: z.boolean().optional(),
  enableWarrantyTracking: z.boolean().optional(),
  enableDeviceHistory: z.boolean().optional(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const settingsSchemaMap: Record<string, z.ZodObject<any>> = {
  restaurant: restaurantSettingsSchema,
  cafe: cafeSettingsSchema,
  retail: retailSettingsSchema,
  medical: medicalSettingsSchema,
  service: serviceSettingsSchema,
  beauty: beautySettingsSchema,
  gym: gymSettingsSchema,
  education: educationSettingsSchema,
  petshop: petshopSettingsSchema,
  repair: repairSettingsSchema,
};

export function getSettingsSchema(industry: string) {
  return settingsSchemaMap[industry] ?? baseSettingsSchema;
}

// 設定欄位的中文標籤（給 UI 用）
export const settingsLabels: Record<string, string> = {
  taxRate: '稅率',
  currency: '幣別',
  enableTableManagement: '桌位管理',
  enableDineInTakeout: '內用/外帶',
  enableKitchenPrint: '後廚出單',
  orderFlow: '點餐流程',
  tableCount: '桌位數量',
  enableCustomization: '客製化選項',
  enableTakeout: '外帶功能',
  enableLoyaltyStamp: '集點卡',
  enableBarcode: '條碼掃描',
  enableVariants: '商品規格',
  lowStockAlert: '低庫存警告',
  enableAppointment: '預約掛號',
  enablePrescription: '處方管理',
  enableExpiryTracking: '效期追蹤',
  enableBooking: '預約功能',
  enableTechnician: '技師管理',
  enableStoredValue: '儲值功能',
  enableBeforeAfterPhoto: '前後對比照',
  enableMembership: '會員制度',
  enableClassBooking: '課程預約',
  enableTrainerSchedule: '教練排程',
  enableSchedule: '課表排程',
  enableAttendance: '出缺勤管理',
  enableParentNotification: '家長通知',
  enablePetProfile: '寵物檔案',
  enableGroomingBooking: '美容預約',
  enableBoardingCalendar: '寄宿日曆',
  enableRepairTicket: '維修工單',
  enableWarrantyTracking: '保固追蹤',
  enableDeviceHistory: '設備歷史',
};

export const orderFlowLabels: Record<string, string> = {
  'pay-first': '先付款再出餐',
  'dine-first': '先用餐再付款',
};
