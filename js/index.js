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
let selectedCoupon = 0;
let selectedAmount = 200;
let selectedPayMethod = 'wechat';
let uploadedFile = null;
let currentOrderId = '';
const settingsCache = {};

// ============ 充值档位配置（金额、优惠券、实付） ============
const rechargeOptions = [
    { value: 200, coupon: 30, pay: 170 },
    { value: 300, coupon: 45, pay: 255 },
    { value: 400, coupon: 60, pay: 340 },
    { value: 500, coupon: 90, pay: 410 },
    { value: 1000, coupon: 180, pay: 820 },
    { value: 2000, coupon: 360, pay: 1640 }
];

// ============ 工具函数 ============
function showToast(msg) {
    const t = document.getElementById('toast');
    if (t) {
        t.textContent = msg;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 2200);
    }
}

function validatePhone(phone) {
    return /^1[3-9]\d{9}$/.test(phone);
}

function generateCouponCode() {
    let code = '';
    for (let i = 0; i < 12; i++) code += Math.floor(Math.random() * 10);
    return code;
}

function generateOrderId() {
    const now = new Date();
    const dateStr = now.getFullYear().toString() + 
        String(now.getMonth()+1).padStart(2,'0') + 
        String(now.getDate()).padStart(2,'0') + 
        String(now.getHours()).padStart(2,'0') + 
        String(now.getMinutes()).padStart(2,'0') + 
        String(now.getSeconds()).padStart(2,'0');
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
    document.title = siteName + ' - 充值中心';
    
    const notice = settingsCache['notice'];
    if (notice) {
        const noticeEl = document.getElementById('noticeBar');
        if (noticeEl) { noticeEl.textContent = notice; noticeEl.style.display = 'block'; }
    }
    
    const maintenance = settingsCache['maintenance'];
    if (maintenance === 'on') {
        const form = document.getElementById('rechargeForm');
        if (form) {
            form.style.opacity = '0.5';
            form.style.pointerEvents = 'none';
        }
        showToast('⚠️ 系统维护中，暂停充值');
    }
}

// ============ 选择充值金额 ============
function selectAmount(item) {
    // 检查是否缺货
    if (item.classList.contains('out-of-stock')) {
        showToast('⚠️ 该档位补货中，请选择其他金额');
        return;
    }
    
    // 移除所有选中状态
    document.querySelectorAll('.amount-item').forEach(el => {
        el.classList.remove('selected');
    });
    
    // 添加选中状态
    item.classList.add('selected');
    
    // 从 data 属性读取充值金额、优惠券、实付金额
    const recharge = parseInt(item.dataset.recharge) || 200;
    const coupon = parseInt(item.dataset.coupon) || 0;
    const pay = parseInt(item.dataset.pay) || recharge;
    
    // 更新全局变量
    selectedRecharge = recharge;
    selectedCoupon = coupon;
    selectedAmount = pay;
    
    // 更新摘要显示
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

// ============ 更新订单摘要 ============
function updateOrderSummary() {
    const orderIdEl = document.getElementById('sumOrderId');
    const couponCodeEl = document.getElementById('sumCouponCode');
    const rechargeEl = document.getElementById('sumRecharge');
    const couponEl = document.getElementById('sumCoupon');
    const payEl = document.getElementById('sumPay');
    
    if (orderIdEl) orderIdEl.textContent = 'ORD' + Date.now().toString().slice(-8);
    if (couponCodeEl) couponCodeEl.textContent = couponCode || '-';
    if (rechargeEl) rechargeEl.textContent = '¥' + selectedRecharge;
    if (couponEl) couponEl.textContent = '- ¥' + selectedCoupon;
    if (payEl) payEl.textContent = '¥' + selectedAmount;
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

// ============ 领取代金券 ============
async function claimCoupon() {
    const phoneInput = document.getElementById('phoneInput');
    if (!phoneInput) return;
    
    const phone = phoneInput.value.trim();
    
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
    
    if (!statusEl || !nextBtn || !claimBtn) return;
    
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

// ============ 上传截图 ============
function handleUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
        showToast('图片大小不能超过5MB');
        event.target.value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        uploadedFile = e.target.result;
        const preview = document.getElementById('previewImg');
        const uploadText = document.getElementById('uploadText');
        
        if (preview) preview.src = uploadedFile;
        if (uploadText) uploadText.textContent = '✅ 已选择图片，点击可重新选择';
        
        // 显示预览
        if (preview) preview.classList.add('show');
        
        // 更新上传区域样式
        const uploadArea = document.getElementById('uploadArea');
        if (uploadArea) uploadArea.classList.add('has-image');
    };
    reader.readAsDataURL(file);
}

// ============ 提交订单 ============
async function submitOrder() {
    const phoneInput = document.getElementById('phoneInput');
    if (!phoneInput) return;
    
    const phone = phoneInput.value.trim();
    
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
        
        // 跳转到结果页并显示成功
        currentOrderId = orderId;
        goStep(4);
        showSuccess();
        
        // 清空表单
        phoneInput.value = '';
        uploadedFile = null;
        
    } catch(e) {
        console.error('提交订单失败：', e);
        showToast('❌ 提交失败：' + e.message);
    }
}

// ============ 显示订单结果 ============
function showOrderResult() {
    const orderIdEl = document.getElementById('resultOrderId');
    const orderIdFailEl = document.getElementById('resultOrderIdFail');
    
    if (orderIdEl) orderIdEl.textContent = '订单编号：' + currentOrderId;
    if (orderIdFailEl) orderIdFailEl.textContent = '订单编号：' + currentOrderId;
}

// ============ 提交成功 ============
function showSuccess() {
    // 隐藏处理中状态
    const progressState = document.getElementById('resultProgressState');
    const failState = document.getElementById('resultFailState');
    
    if (progressState) progressState.style.display = 'none';
    if (failState) failState.style.display = 'none';
    
    // 显示成功状态（创建一个新的成功提示）
    const step4 = document.getElementById('step4');
    if (step4) {
        // 创建成功提示卡片
        const successCard = document.createElement('div');
        successCard.style.cssText = 'position:relative;z-index:2;text-align:center;padding:40px 20px;';
        successCard.innerHTML = `
            <div style="font-size:80px;margin-bottom:20px;">✅</div>
            <h2 style="font-size:24px;font-weight:800;color:#16A34A;margin-bottom:10px;">提交成功！</h2>
            <p style="font-size:14px;color:#6b7280;line-height:1.75;margin-bottom:8px;">您的充值订单已提交，请耐心等待审核。</p>
            <p style="font-size:16px;font-weight:700;color:#1f2937;margin:20px 0;padding:15px;background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d6;">
                订单编号：<span id="finalOrderId" style="font-family:monospace;">${currentOrderId}</span>
            </p>
            <p style="font-size:12px;color:#9ca3af;margin-bottom:25px;">客服将在24小时内处理，如有问题请联系客服</p>
            <button onclick="goHome()" style="width:100%;padding:14px;background:linear-gradient(135deg,#5B9BD5,#6BB5D6);border:none;border-radius:25px;color:#fff;font-size:16px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(91,155,213,0.3);">
                返回首页继续充值
            </button>
        `;
        
        // 清除旧内容并添加新内容
        step4.innerHTML = '';
        step4.appendChild(successCard);
    }
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

// ============ Base64 转文件 ============
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

// ============ 初始化 ============
document.addEventListener('DOMContentLoaded', function() {
    // 初始化摘要
    updateOrderSummary();
    
    // 加载设置
    loadSettings();
    
    // 绑定上传事件
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleUpload);
    }
    
    // 默认选中第一个充值金额
    const firstAmount = document.querySelector('.amount-item');
    if (firstAmount) {
        firstAmount.classList.add('selected');
        selectedRecharge = parseInt(firstAmount.dataset.recharge) || 200;
        selectedCoupon = parseInt(firstAmount.dataset.coupon) || 0;
        selectedAmount = parseInt(firstAmount.dataset.pay) || selectedRecharge;
        updateOrderSummary();
    }
    
    // 默认选中微信支付
    const firstPay = document.querySelector('.pay-method');
    if (firstPay) {
        firstPay.classList.add('selected');
        selectedPayMethod = firstPay.dataset.pay || 'wechat';
    }
});
