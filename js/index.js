// ============ 充值中心前台逻辑（index.js） ============
// ============ 配置区 ============
const SUPABASE_URL = 'https://unytaslvyaytlqdmwavm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVueXRhc2x2eWF5dGxxZG13YXZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5OTY4NTIsImV4cCI6MjEwMDU3Mjg1Mn0.lU5OU0tWSzeYPiBWskH1jJ83BvgOEeCFm8DAYNLUET0';

let sbClient = null;
try {
    if (SUPABASE_URL && SUPABASE_URL.startsWith('http')) {
        sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        console.warn('尚未配置 Supabase 凭证');
    }
} catch (e) { console.warn('Supabase 初始化失败：', e); }

// ============ 全局变量 ============
let currentPhone = '';
let couponCode = '';
let selectedRecharge = 200;
let selectedCoupon = 28;
let selectedAmount = 172;
let selectedPayMethod = 'wechat';
let uploadedFile = null;
let currentOrderId = '';
const settingsCache = {};

// ============ 工具函数 ============
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2200);
}
function validatePhone(phone) { return /^1[3-9]\d{9}$/.test(phone); }
function generateCouponCode() {
    let code = ''; for (let i = 0; i < 12; i++) code += Math.floor(Math.random() * 10); return code;
}
function generateOrderId() {
    const now = new Date();
    const dateStr = now.getFullYear().toString() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0') + String(now.getHours()).padStart(2,'0') + String(now.getMinutes()).padStart(2,'0') + String(now.getSeconds()).padStart(2,'0');
    const rand = Math.floor(Math.random() * 9000 + 1000);
    return 'ORD' + dateStr + rand;
}

// 超时包装器
function withTimeout(promise, ms, errMsg) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(errMsg || '操作超时')), ms))
    ]);
}

// HTML 转义
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// 清洗图片地址
function cleanImgUrl(val) {
    if (typeof val !== 'string') return '';
    if (val.startsWith('http') || val.startsWith('data:')) return val;
    return '';
}

// ============ 加载设置 ============
async function loadSettings() {
    if (!sbClient) { console.warn('未配置 Supabase'); return; }
    try {
        const { data, error } = await withTimeout(
            sbClient.from('settings').select('key, value'),
            10000,
            '读取设置超时'
        );
        if (error) throw error;
        if (data) {
            data.forEach(r => { settingsCache[r.key] = r.value; });
            applySettings();
        }
    } catch(e) {
        console.warn('加载设置失败：', e);
    }
}

function applySettings() {
    const siteName = settingsCache['site_name'] || '充值中心';
    document.title = siteName + ' - 管理后台';
    const notice = settingsCache['notice'];
    if (notice) {
        const noticeEl = document.getElementById('noticeBar');
        if (noticeEl) { noticeEl.textContent = notice; noticeEl.style.display = 'block'; }
    }
    const banner = settingsCache['banner'];
    if (banner) {
        const bannerEl = document.getElementById('bannerImg');
        if (bannerEl) { bannerEl.src = cleanImgUrl(banner); bannerEl.style.display = 'block'; }
    }
    const kefuName = settingsCache['kefu_name'];
    const kefuLink = settingsCache['kefu_link'];
    if (kefuName && kefuLink) {
        const linkEl = document.getElementById('kefuLink');
        if (linkEl) { linkEl.textContent = kefuName; linkEl.href = cleanImgUrl(kefuLink); }
    }
    const maintenance = settingsCache['maintenance'];
    if (maintenance === 'on') {
        document.getElementById('rechargeForm').style.opacity = '0.5';
        document.getElementById('rechargeForm').style.pointerEvents = 'none';
        showToast('⚠️ 系统维护中，暂停充值');
    }
}

// ============ 充值档位 & 优惠券联动 ============
const rechargeOptions = [
    { value: 100, discount: 0 },
    { value: 200, discount: 28 },
    { value: 300, discount: 58 },
    { value: 500, discount: 128 },
    { value: 1000, discount: 180 }
];

function updateRechargeOptions() {
    const select = document.getElementById('rechargeSelect');
    select.innerHTML = '';
    rechargeOptions.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = `充值 ¥${opt.value}`;
        if (opt.value === selectedRecharge) option.selected = true;
        select.appendChild(option);
    });
    calculateAmount();
}

function calculateAmount() {
    const recharge = parseInt(document.getElementById('rechargeSelect').value) || 200;
    const coupon = parseInt(document.getElementById('couponSelect').value) || 0;
    const discount = rechargeOptions.find(o => o.value === recharge)?.discount || 0;
    const amount = Math.max(0, recharge - discount - coupon);
    selectedRecharge = recharge;
    selectedCoupon = coupon;
    selectedAmount = amount;
    document.getElementById('amountDisplay').textContent = '¥' + amount;
}

document.getElementById('rechargeSelect')?.addEventListener('change', calculateAmount);
document.getElementById('couponSelect')?.addEventListener('change', calculateAmount);

// ============ 手机号 & 优惠券验证 ============
document.getElementById('phoneInput')?.addEventListener('blur', function() {
    const phone = this.value.trim();
    if (phone && !validatePhone(phone)) {
        showToast('❌ 手机号格式错误，请输入11位手机号');
    }
});
document.getElementById('phoneInput')?.addEventListener('input', function() {
    this.setCustomValidity('');
});

// ============ 上传截图 ============
function handleUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('图片大小不能超过5MB'); event.target.value = ''; return; }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        uploadedFile = e.target.result;
        const preview = document.getElementById('previewImg');
        preview.src = uploadedFile;
        preview.classList.add('show');
        document.getElementById('uploadText').textContent = '✅ 已选择图片，点击可重新选择';
    };
    reader.readAsDataURL(file);
}

// ============ 提交订单 ============
async function submitOrder() {
    const phone = document.getElementById('phoneInput').value.trim();
    const couponCode = document.getElementById('couponSelect').value;
    
    if (!phone || !validatePhone(phone)) {
        showToast('❌ 请输入正确的手机号');
        return;
    }
    
    if (!uploadedFile) {
        showToast('❌ 请上传付款截图');
        return;
    }
    
    if (!sbClient) {
        showToast('⚠️ 未配置数据库');
        return;
    }
    
    const orderId = generateOrderId();
    const coupon = generateCouponCode();
    
    try {
        // 上传截图
        const fileName = `order_${orderId}_${Date.now()}.jpg`;
        const { error: uploadError } = await withTimeout(
            sbClient.storage.from('screenshots').upload(fileName, base64ToFile(uploadedFile), { contentType: 'image/jpeg' }),
            30000,
            '上传截图超时'
        );
        
        if (uploadError) throw uploadError;
        
        // 获取公开URL
        const { data: urlData } = sbClient.storage.from('screenshots').getPublicUrl(fileName);
        const screenshotUrl = urlData?.publicUrl || '';
        
        // 保存订单
        const { error: insertError } = await withTimeout(
            sbClient.from('orders').insert({
                order_id: orderId,
                phone: phone,
                coupon_code: coupon,
                recharge: selectedRecharge,
                coupon_deduct: selectedCoupon,
                amount: selectedAmount,
                pay_method: selectedPayMethod,
                screenshot_url: screenshotUrl,
                status: 'pending'
            }),
            15000,
            '保存订单超时'
        );
        
        if (insertError) throw insertError;
        
        showToast('✅ 订单提交成功！');
        
        // 清空表单
        document.getElementById('phoneInput').value = '';
        document.getElementById('couponSelect').value = '0';
        document.getElementById('previewImg').classList.remove('show');
        document.getElementById('uploadText').textContent = '点击上传付款截图';
        uploadedFile = null;
        
    } catch(e) {
        console.error('提交订单失败：', e);
        showToast('❌ 提交失败：' + e.message);
    }
}

function base64ToFile(dataUrl) {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

// ============ 领取代金券 ============
async function claimCoupon() {
    const phone = document.getElementById('phoneInput').value.trim();
    
    if (!phone) {
        showToast('⚠️ 请输入手机号码');
        return;
    }
    
    if (!validatePhone(phone)) {
        showToast('❌ 手机号格式错误，请输入11位手机号');
        return;
    }
    
    currentPhone = phone;
    couponCode = generateCouponCode();
    
    const statusEl = document.getElementById('statusText1');
    const nextBtn = document.getElementById('nextBtn1');
    const claimBtn = document.getElementById('claimBtn');
    
    // 显示加载中
    claimBtn.disabled = true;
    claimBtn.textContent = '领取中...';
    statusEl.innerHTML = '<span class="status-dot"></span> 正在生成代金券...';
    
    try {
        // 保存到数据库
        if (sbClient) {
            await withTimeout(
                sbClient.from('coupons').insert({
                    phone: phone,
                    coupon_code: couponCode,
                    status: 'active',
                    created_at: new Date().toISOString()
                }),
                10000,
                '保存代金券超时'
            );
        }
        
        // 成功
        statusEl.innerHTML = '<span class="status-dot" style="background:#16A34A"></span> 代金券领取成功！';
        statusEl.className = 'status-text status-success';
        nextBtn.disabled = false;
        claimBtn.style.display = 'none';
        
        showToast('✅ 代金券已领取！');
        
    } catch(e) {
        console.error('领取代金券失败：', e);
        statusEl.innerHTML = '<span class="status-dot"></span> 领取失败，请重试';
        claimBtn.disabled = false;
        claimBtn.textContent = '立即领取电子代金券';
        showToast('❌ 领取失败：' + e.message);
    }
}

// ============ 切换步骤 ============
function goStep(step) {
    // 隐藏所有步骤
    document.querySelectorAll('.page-section').forEach(el => {
        el.classList.remove('active');
    });
    
    // 显示目标步骤
    const targetEl = document.getElementById('step' + step);
    if (targetEl) {
        targetEl.classList.add('active');
        window.scrollTo(0, 0);
    }
    
    // 如果是第二步，更新摘要
    if (step === 2) {
        updateOrderSummary();
    }
}

// ============ 更新订单摘要 ============
function updateOrderSummary() {
    document.getElementById('sumOrderId').textContent = 'ORD' + Date.now().toString().slice(-8);
    document.getElementById('sumCouponCode').textContent = couponCode;
    document.getElementById('sumRecharge').textContent = '¥' + selectedRecharge;
    document.getElementById('sumPay').textContent = '¥' + selectedAmount;
}

// ============ 选择充值金额 ============
function selectAmount(item) {
    // 移除所有选中状态
    document.querySelectorAll('.amount-item').forEach(el => {
        el.classList.remove('selected');
    });
    
    // 添加选中状态
    item.classList.add('selected');
    
    // 更新数据
    selectedRecharge = parseInt(item.dataset.recharge) || 200;
    selectedCoupon = parseInt(item.dataset.coupon) || 0;
    selectedAmount = parseInt(item.dataset.pay) || 170;
    
    // 更新摘要
    updateOrderSummary();
}

// ============ 选择支付方式 ============
function selectPay(methodEl) {
    // 移除所有选中状态
    document.querySelectorAll('.pay-method').forEach(el => {
        el.classList.remove('selected');
    });
    
    // 添加选中状态
    methodEl.classList.add('selected');
    
    // 更新支付方式
    selectedPayMethod = methodEl.dataset.pay || 'wechat';
}

// ============ 联系客服 ============
function contactKefu() {
    const kefuLink = document.getElementById('kefuLink');
    if (kefuLink) {
        kefuLink.click();
    } else {
        showToast('请联系客服');
    }
}

// ============ 返回首页 ============
function goHome() {
    window.location.reload();
}

// ============ 初始化 ============
document.addEventListener('DOMContentLoaded', function() {
    updateOrderSummary();
    loadSettings();
    
    // 上传截图
    document.getElementById('fileInput')?.addEventListener('change', handleUpload);
    
    // 选择充值金额（默认选中第一个）
    const firstAmount = document.querySelector('.amount-item');
    if (firstAmount) {
        firstAmount.classList.add('selected');
    }
    
    // 选择支付方式（默认选中微信）
    const firstPay = document.querySelector('.pay-method');
    if (firstPay) {
        firstPay.classList.add('selected');
    }
});