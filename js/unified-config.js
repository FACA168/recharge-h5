// ============================================================
// 统一后台配置（整合充值管理 + 在线客服）
// ============================================================

// 油卡充值系统
const RECHARGE_CONFIG = {
  SUPABASE_URL: 'https://unytaslvyaytlqdmwavm.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbG...',
  BRAND: {
    APP_NAME: '油卡充值',
    ADMIN_TITLE: '充值管理后台',
  }
};

// 在线客服系统
const CHAT_CONFIG = {
  SUPABASE_URL: 'https://afomopohtwwytfeeznur.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbG...',
  BRAND: {
    APP_NAME: '在线客服',
    ADMIN_TITLE: '客服工作台',
  }
};

// 合并配置
window.UNIFIED_CONFIG = {
  recharge: RECHARGE_CONFIG,
  chat: CHAT_CONFIG,
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD: 'admin123',
};
