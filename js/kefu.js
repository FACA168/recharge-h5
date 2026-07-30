// ============ 在线客服页逻辑（拆分自 kefu.html） ============
// 说明：SUPABASE_URL / SUPABASE_ANON_KEY 需与 index.html、admin.html 保持一致

// ============================================================
//  配置区：请填入你的 Supabase 信息
// ============================================================
const SUPABASE_URL = 'https://recharge.qwert168202606.workers.dev';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVueXRhc2x2eWF5dGxxZG13YXZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5OTY4NTIsImV4cCI6MjEwMDU3Mjg1Mn0.lU5OU0tWSzeYPiBWskH1jJ83BvgOEeCFm8DAYNLUET0';

// 注意：supabase 是库全局变量，实例用 sbClient 避免重名冲突
let sbClient = null;
try {
    if (SUPABASE_URL && SUPABASE_URL.startsWith('http')) {
        sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
} catch (e) {}

// 客服数据缓存
const kefuData = {
    name: '',
    link: '',
    wechat: '',
    qq: '',
    phone: ''
};

// 页面加载时读取设置
window.addEventListener('DOMContentLoaded', function() {
    loadKefuSettings();
});

async function loadKefuSettings() {
    try {
        if (!sbClient) return;
        const { data, error } = await sbClient.from('settings').select('key, value');
        if (!error && data) {
            data.forEach(row => { kefuData[row.key] = row.value; });
            updateKefuPage();
        }
    } catch(e) {}
}

// 更新客服页面内容
function updateKefuPage() {
    // 更新客服名称
    if (kefuData['kefu_name']) {
        document.getElementById('kefuNameDisplay').textContent = kefuData['kefu_name'];
        document.title = kefuData['kefu_name'];
    }

    // 后台设了客服链接 → 显示"前往客服平台"大按钮
    if (kefuData['kefu_link']) {
        document.getElementById('gotoLinkBtn').classList.remove('hidden');
    }

    // 微信号
    if (kefuData['kefu_wechat']) {
        document.getElementById('wechatAccountDesc').textContent = kefuData['kefu_wechat'];
    }
    // QQ号
    if (kefuData['kefu_qq']) {
        document.getElementById('qqAccountDesc').textContent = kefuData['kefu_qq'];
    }
    // 电话
    if (kefuData['kefu_phone']) {
        document.getElementById('phoneAccountDesc').textContent = kefuData['kefu_phone'];
    }
}

// 点击"前往客服平台"按钮 → 转跳到后台设置的链接
function openKefuLink() {
    const link = kefuData['kefu_link'] || '';
    if (link) {
        window.location.href = link;
    } else {
        showToast('管理员暂未配置客服链接');
    }
}

// 复制联系方式
function copyContact(type, key) {
    let value = kefuData['kefu_' + key] || '';
    if (!value) {
        showToast('管理员暂未设置' + type + '，请在平台公告中查看联系方式');
        return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(() => {
            showToast(type + '已复制：' + value);
        }).catch(() => {
            fallbackCopy(value, type);
        });
    } else {
        fallbackCopy(value, type);
    }
}

// 兼容旧浏览器的复制方法
function fallbackCopy(text, type) {
    const input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    try {
        document.execCommand('copy');
        showToast(type + '已复制：' + text);
    } catch(e) {
        showToast('请手动复制：' + text);
    }
    document.body.removeChild(input);
}

// 拨打电话
function callPhone() {
    const phone = kefuData['kefu_phone'] || '';
    if (phone) {
        window.location.href = 'tel:' + phone.replace(/[^0-9+]/g, '');
    } else {
        showToast('管理员暂未设置联系电话，请在平台公告中查看');
    }
}

// 返回上一页
function goBack() {
    if (window.history.length > 1) {
        window.history.back();
    } else {
        window.location.href = './index.html';
    }
}

// Toast 提示
function showToast(msg) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%)scale(0.85);background:#5B9BD5;color:#fff;padding:13px 26px;border-radius:10px;font-size:14px;z-index:9999;opacity:0;visibility:hidden;transition:all 0.25s ease;';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    toast.style.opacity = '1';
    toast.style.visibility = 'visible';
    toast.style.transform = 'translate(-50%,-50%)scale(1)';
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.visibility = 'hidden';
        toast.style.transform = 'translate(-50%,-50%)scale(0.85)';
    }, 2200);
}
