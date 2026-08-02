// ============================================================
//  管理后台逻辑（拆分自 admin.html）
//  ⚠️ 配置区：请填入与 index.html 相同的 Supabase 信息
// ============================================================
const SUPABASE_URL = 'https://unytaslvyaytlqdmwavm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVueXRhc2x2eWF5dGxxZG13YXZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5OTY4NTIsImV4cCI6MjEwMDU3Mjg1Mn0.lU5OU0tWSzeYPiBWskH1jJ83BvgOEeCFm8DAYNLUET0';

// 注意：supabase 是库全局变量，实例用 sbClient 避免重名冲突
let sbClient = null;
try {
    if (SUPABASE_URL && SUPABASE_URL.startsWith('http')) {
        sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        console.warn('⚠️ 尚未配置 Supabase 凭证，仅可登录预览，数据功能不可用。');
    }
} catch (e) {
    console.warn('⚠️ Supabase 初始化失败：', e);
}

// ============================================================
//  全局变量
// ============================================================
let currentOrderData = null;   // 当前查看的订单
let allOrders = [];             // 缓存的订单列表

// 超时包装器：防止 Supabase 不可用时请求长时间挂起卡住页面
function withTimeout(promise, ms, errMsg) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(errMsg || '操作超时')), ms))
    ]);
}

// 图片最大体积（上传预览与实际保存统一使用，避免两处限制不一致造成困惑）
const MAX_IMG_SIZE = 2 * 1024 * 1024; // 2MB

// HTML 转义：防止订单/设置等外部数据拼入 innerHTML 时引发 XSS 注入
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&' + 'amp;')
        .replace(/</g, '&' + 'lt;')
        .replace(/>/g, '&' + 'gt;')
        .replace(/"/g, '&' + 'quot;')
        .replace(/'/g, '&' + '#39;');
}

// 清洗图片地址：只接受 http(s) 或 base64(data:) 格式，其余清空（防脏数据/注入）
function cleanImgUrl(val) {
    if (typeof val !== 'string') return '';
    if (val.startsWith('http') || val.startsWith('data:')) return val;
    return '';
}

// ============================================================
//  Toast
// ============================================================
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3500);
}

// ============================================================
//  登录（使用 Supabase 账号密码认证）
// ============================================================
async function doLogin() {
    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value.trim();
    const errEl = document.getElementById('loginError');

    if (!user || !pass) {
        errEl.textContent = '请输入账号和密码';
        errEl.style.display = 'block';
        return;
    }

    errEl.style.display = 'none';
    showToast('正在登录...');
    
    try {
        // 使用 Supabase Auth 登录
        const { data, error } = await sbClient.auth.signInWithPassword({
            email: user + '@admin.local',  // 将账号转为邮箱格式
            password: pass
        });
        
        if (error) throw error;
        
        // 登录成功
        localStorage.setItem('admin_logged_in', '1');
        localStorage.setItem('admin_user', user);
        enterDashboard();
        showToast('✅ 登录成功！');
    } catch(e) {
        errEl.textContent = '❌ 账号或密码错误！';
        errEl.style.display = 'block';
        console.error('登录失败：', e);
    }
}

// ============================================================
//  进入后台主界面（登录成功 / 刷新后自动恢复登录态 共用）
// ============================================================
function enterDashboard() {
    document.getElementById('loginPage').classList.remove('active');
    document.getElementById('adminHeader').style.display = 'flex';
    document.getElementById('dashboardArea').style.display = 'block';
    document.getElementById('tabBar').style.display = 'flex';
    loadSettings();
    renderOrderList();
}

// ============================================================
//  退出登录
// ============================================================
async function logout() {
    await sbClient.auth.signOut();
    localStorage.removeItem('admin_logged_in');
    localStorage.removeItem('admin_user');
    document.getElementById('dashboardArea').style.display = 'none';
    document.getElementById('adminHeader').style.display = 'none';
    document.getElementById('tabBar').style.display = 'none';
    document.getElementById('loginPage').classList.add('active');
    document.getElementById('loginUser').value = '';
    document.getElementById('loginPass').value = '';
    showToast('👋 已退出登录');
}

// ============================================================
//  底部 Tab 切换
// ============================================================
function switchTab(tabName) {
    document.querySelectorAll('.tab-item').forEach((item, idx) => {
        item.classList.toggle('active', (tabName==='orders'&&idx===0)||(tabName==='settings'&&idx===1));
    });
    document.getElementById('tabOrders').classList.toggle('active', tabName==='orders');
    document.getElementById('tabSettings').classList.toggle('active', tabName==='settings');
}

// ============================================================
//  从 Supabase 读取订单列表
// ============================================================
async function renderOrderList(filterText) {
    const listEl = document.getElementById('orderList');
    if (!sbClient) {
        listEl.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>尚未配置 Supabase 凭证，无法读取订单</p></div>';
        return;
    }
    const countEl = document.getElementById('orderCount');
    listEl.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>加载中...</p></div>';

    try {
        let query = sbClient.from('orders').select('*').order('created_at', { ascending: false });
        const { data, error } = await withTimeout(query, 15000, '读取订单超时');
        if (error) throw error;

        allOrders = data || [];

        // 更新统计
        document.getElementById('statTotal').textContent = allOrders.length;
        document.getElementById('statPending').textContent = allOrders.filter(o=>o.status==='pending').length;
        document.getElementById('statApproved').textContent = allOrders.filter(o=>o.status==='approved').length;

        // 搜索过滤
        let showList = allOrders;
        if (filterText) {
            filterText = filterText.toLowerCase();
            showList = allOrders.filter(o =>
                (o.phone && o.phone.includes(filterText)) ||
                (o.order_id && o.order_id.toLowerCase().includes(filterText)) ||
                (o.coupon_code && o.coupon_code.toLowerCase().includes(filterText))
            );
        }

        countEl.textContent = showList.length + ' 条';

        if (showList.length === 0) {
            listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>${filterText?'没有找到匹配的订单':'暂无订单数据'}</p></div>`;
            return;
        }

        let html = '';
        showList.forEach(order => {
            const statusMap = {
                pending: { text:'待审核', cls:'status-pending' },
                approved: { text:'已通过', cls:'status-approved' },
                rejected: { text:'已拒绝', cls:'status-rejected' }
            };
            const st = statusMap[order.status] || statusMap.pending;
            const payLabel = order.pay_method === 'wechat' ? '微信' : '支付宝';
            const deductLine = (order.coupon_deduct != null)
                ? `<div class="order-info-row"><span class="order-info-label">充值 ¥${escapeHtml(order.recharge)} · 券 -¥${escapeHtml(order.coupon_deduct)}</span><span class="order-info-value"></span></div>`
                : '';
            html += `
                <div class="order-item" data-oid="${escapeHtml(order.order_id)}">
                    <div class="order-top">
                        <span class="order-id">${escapeHtml(order.order_id)}</span>
                        <span class="order-status ${st.cls}">${st.text}</span>
                    </div>
                    <div class="order-info-row"><span class="order-info-label">手机号</span><span class="order-info-value">${escapeHtml(order.phone||'-')}</span></div>
                    <div class="order-info-row"><span class="order-info-label">实付金额</span><span class="order-info-value" style="color:#e8941c;font-weight:700;">¥${escapeHtml(order.amount)}</span></div>
                    ${deductLine}
                    <div class="order-info-row"><span class="order-info-label">支付方式</span><span class="order-info-value">${payLabel}</span></div>
                    <div class="order-info-row"><span class="order-info-label">时间</span><span class="order-info-value" style="font-size:12px;">${escapeHtml(formatTime(order.created_at))}</span></div>
                </div>`;
        });
        listEl.innerHTML = html;
    } catch(e) {
        console.error('读取订单失败：', e);
        listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>读取失败：${escapeHtml(e.message)}</p></div>`;
    }
}

// 时间格式化
function formatTime(t) {
    if (!t) return '-';
    try { return new Date(t).toLocaleString('zh-CN'); } catch(e) { return t; }
}

// ============================================================
//  搜索订单
// ============================================================
function searchOrders() {
    const kw = document.getElementById('searchInput').value.trim();
    renderOrderList(kw);
}

// ============================================================
//  订单详情弹窗（截图从 screenshot_url 显示）
// ============================================================
async function showOrderDetail(orderId) {
    if (!sbClient) {
        showToast('⚠️ 尚未配置 Supabase 凭证，无法读取订单');
        return;
    }
    let data, error;
    try {
        const res = await withTimeout(
            sbClient.from('orders').select('*').eq('order_id', orderId).single(),
            12000,
            '读取订单详情超时'
        );
        data = res.data; error = res.error;
    } catch(e) {
        console.error('读取订单详情失败：', e);
        showToast('⚠️ 读取订单详情失败：' + (e.message || '未知错误'));
        return;
    }

    if (error || !data) {
        showToast('❌ 未找到该订单');
        return;
    }
    currentOrderData = data;

    const payLabel = data.pay_method === 'wechat' ? '💚 微信支付' : '💙 支付宝支付';
    const statusMap = {
        pending: { text:'待审核', color:'#d97706' },
        approved: { text:'已通过', color:'#16a34a' },
        rejected: { text:'已拒绝', color:'#dc2626' }
    };
    const st = statusMap[data.status] || statusMap.pending;
    // 付款截图仅允许 http(s) 或 data: 图片协议，杜绝 javascript: 等危险地址
    const shotOk = typeof data.screenshot_url === 'string'
        && (/^https?:\/\//i.test(data.screenshot_url) || /^data:image\//i.test(data.screenshot_url));

    let detailHtml = `
        <div class="detail-row"><span class="detail-label">订单编号</span><span class="detail-value">${escapeHtml(data.order_id)}</span></div>
        <div class="detail-row"><span class="detail-label">手机号码</span><span class="detail-value">${escapeHtml(data.phone||'-')}</span></div>
        <div class="detail-row"><span class="detail-label">电子券编号</span><span class="detail-value">${escapeHtml(data.coupon_code||'-')}</span></div>
        <div class="detail-row"><span class="detail-label">充值档位</span><span class="detail-value" style="color:#1e40af;font-weight:700;">¥${escapeHtml(data.recharge!=null?data.recharge:data.amount)}</span></div>
        ${data.coupon_deduct!=null ? `<div class="detail-row"><span class="detail-label">代金券抵扣</span><span class="detail-value" style="color:#ef4444;font-weight:700;">-¥${escapeHtml(data.coupon_deduct)}</span></div>` : ''}
        <div class="detail-row"><span class="detail-label">实付金额</span><span class="detail-value" style="color:#e8941c;font-weight:700;">¥${escapeHtml(data.amount)}</span></div>
        <div class="detail-row"><span class="detail-label">支付方式</span><span class="detail-value">${payLabel}</span></div>
        <div class="detail-row"><span class="detail-label">订单状态</span><span class="detail-value" style="color:${st.color};font-weight:700;">${st.text}</span></div>
        <div class="detail-row"><span class="detail-label">提交时间</span><span class="detail-value">${escapeHtml(formatTime(data.created_at))}</span></div>`;

    if (shotOk) {
        detailHtml += `
            <div style="margin-top:14px;">
                <p style="font-size:13px;color:#64748b;margin-bottom:6px;">📷 付款凭证截图：</p>
                <img class="detail-screenshot" src="${escapeHtml(data.screenshot_url)}" alt="付款截图" onerror="this.style.display='none'">
            </div>`;
    }

    document.getElementById('modalDetailBody').innerHTML = detailHtml;

    let actionsHtml = '';
    if (data.status === 'pending') {
        actionsHtml = `
            <button class="action-btn btn-approve" onclick="updateOrderStatus('approved')">✅ 通过审核</button>
            <button class="action-btn btn-reject" onclick="updateOrderStatus('rejected')">❌ 拒绝订单</button>`;
    }
    actionsHtml += `<button class="action-btn btn-close-modal" onclick="closeModal()">关闭</button>`;
    document.getElementById('modalActions').innerHTML = actionsHtml;

    document.getElementById('orderModal').classList.add('show');
}

// ============================================================
//  关闭弹窗
// ============================================================
function closeModal() {
    document.getElementById('orderModal').classList.remove('show');
    currentOrderData = null;
}
document.getElementById('orderModal').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
});
// 订单列表点击委托：根据 data-oid 打开详情，避免内联 onclick 拼接 order_id 引发 XSS
document.getElementById('orderList').addEventListener('click', function(e) {
    const item = e.target.closest('.order-item');
    if (item && item.dataset.oid) showOrderDetail(item.dataset.oid);
});

// ============================================================
//  修改订单状态（更新 Supabase）
// ============================================================
async function updateOrderStatus(newStatus) {
    if (!currentOrderData) return;
    if (!sbClient) {
        showToast('⚠️ 尚未配置 Supabase 凭证，无法更新订单');
        return;
    }
    try {
        const { error } = await withTimeout(
            sbClient.from('orders').update({ status: newStatus }).eq('order_id', currentOrderData.order_id),
            12000,
            '更新订单超时'
        );
        if (error) {
            showToast('❌ 更新失败：' + error.message);
            return;
        }
        const msg = newStatus === 'approved' ? '✅ 已标记为通过' : '❌ 已标记为拒绝';
        showToast(msg);
        closeModal();
        renderOrderList();
    } catch(e) {
        console.error('更新订单失败：', e);
        showToast('⚠️ 更新订单失败：' + (e.message || '未知错误'));
    }
}

// ============================================================
//  设置功能（key-value 存 settings 表）
// ============================================================

// 收款码预览
function previewQr(input, previewId, textId) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showToast('⚠️ 图片不能超过2MB'); return; }
    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById(previewId);
        preview.src = e.target.result;
        preview.classList.add('show');
        document.getElementById(textId).textContent = '✅ 已选择图片，点击可重新选择';
    };
    reader.readAsDataURL(file);
}

// 加载设置
async function loadSettings() {
    // 先从 localStorage 兜底，并立即回填表单（保证 Supabase 不可用时也能显示已保存内容）
    const localMap = loadFromLocal();
    if (localMap) {
        fillSettingsToForm(localMap);
        console.log('⚠️ 使用 localStorage 缓存的设置（Supabase 可能不可用）');
    }

    // 再用 Supabase 覆盖（云端优先），带超时防止请求挂起卡住页面
    if (sbClient) {
        try {
            const { data, error } = await withTimeout(
                sbClient.from('settings').select('key, value'),
                10000,
                '读取云端设置超时'
            );
            if (!error && data) {
                const map = {};
                data.forEach(r => { map[r.key] = r.value; });
                fillSettingsToForm(map); // 云端成功后再次回填，覆盖本地缓存
            }
        } catch(e) {
            console.warn('Supabase 读取设置失败，已使用本地缓存：', e);
        }
    }
}

// 把图片文件读取为 base64 DataURL（纯本地处理，不依赖任何云端，瞬间完成）
function readImageAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        if (!file) { resolve(null); return; }
        // 限制大小，避免 base64 过大撑爆浏览器本地存储（与预览限制保持一致）
        if (file.size > MAX_IMG_SIZE) { reject(new Error('图片超过 2MB，请压缩后再上传')); return; }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);   // 结果是 base64 DataURL，可直接当图片地址用
        reader.onerror = () => reject(new Error('图片读取失败'));
        reader.readAsDataURL(file);
    });
}

// 处理收款码/Logo 图片：不再上传到云端，直接转成 base64 存本地，彻底绕过故障的 Supabase 存储
async function uploadQr(file, prefix) {
    if (!file) return null;
    return await readImageAsDataUrl(file);
}

// 保存所有设置
// ============ 收集当前表单所有设置值 ============
function collectFormSettings() {
    const wechatPreview = document.getElementById('previewWechat');
    const alipayPreview = document.getElementById('previewAlipay');
    const logoPreview = document.getElementById('previewLogo');
    let wechatUrl = cleanImgUrl(wechatPreview ? wechatPreview.src : '');
    let alipayUrl = cleanImgUrl(alipayPreview ? alipayPreview.src : '');
    let logoUrl = cleanImgUrl(logoPreview ? logoPreview.src : '');

    const rows = [
        { key: 'site_name',   value: document.getElementById('setSiteName').value.trim() },
        { key: 'notice',      value: document.getElementById('setNotice').value.trim() },
        { key: 'banner',      value: document.getElementById('setBanner').value.trim() },
        { key: 'kefu_name',   value: document.getElementById('setKefuName').value.trim() },
        { key: 'kefu_link',   value: document.getElementById('setKefuLink').value.trim() },
        { key: 'logo_url',    value: logoUrl },
        { key: 'wechat_qr',   value: wechatUrl },
        { key: 'alipay_qr',   value: alipayUrl },
        { key: 'maintenance', value: document.getElementById('setMaintenance').value }
    ];
    // 过滤空值
    return rows.filter(r => r.value && r.value.length > 0);
}

// ============ 保存到 localStorage 兜底 ============
function saveToLocal(rows) {
    const map = {};
    rows.forEach(r => { map[r.key] = r.value; });
    try {
        localStorage.setItem('admin_settings_cache', JSON.stringify(map));
        return true;
    } catch(e) {
        console.error('本地存储写入失败（图片可能过大，超出浏览器配额）：', e);
        showToast('⚠️ 本地保存失败：图片总大小可能超出浏览器限制，请压缩图片后再保存');
        return false;
    }
}

// ============ 从 localStorage 读取兜底 ============
function loadFromLocal() {
    try {
        const raw = localStorage.getItem('admin_settings_cache');
        if (!raw) return null;
        return JSON.parse(raw);
    } catch(e) { return null; }
}

// ============ 将设置值填入表单 ============
function fillSettingsToForm(map) {
    if (!map) return;
    const fields = [
        ['setSiteName', 'site_name'], ['setNotice', 'notice'],
        ['setBanner', 'banner'], ['setKefuName', 'kefu_name'],
        ['setKefuLink', 'kefu_link'], ['setMaintenance', 'maintenance']
    ];
    fields.forEach(([id, key]) => {
        const el = document.getElementById(id);
        if (el && map[key] !== undefined) el.value = map[key];
    });
    // 收款码预览
    if (map['wechat_qr']) {
        const pw = document.getElementById('previewWechat');
        if (pw) { pw.src = map['wechat_qr']; pw.classList.add('show'); }
        const wt = document.getElementById('wechatUploadText');
        if (wt) wt.textContent = '✅ 已设置，点击可更换';
    }
    if (map['alipay_qr']) {
        const pa = document.getElementById('previewAlipay');
        if (pa) { pa.src = map['alipay_qr']; pa.classList.add('show'); }
        const at = document.getElementById('alipayUploadText');
        if (at) at.textContent = '✅ 已设置，点击可更换';
    }
    // Logo 预览
    if (map['logo_url']) {
        const pl = document.getElementById('previewLogo');
        if (pl) { pl.src = map['logo_url']; pl.classList.add('show'); }
        const lt = document.getElementById('logoUploadText');
        if (lt) lt.textContent = '✅ 已设置，点击可更换';
    }
}

async function saveSettings() {
    // 先收集表单数据
    const rows = collectFormSettings();
    if (rows.length === 0) {
        showToast('⚠️ 没有需要保存的设置内容');
        return;
    }

    // ★ 无论 Supabase 是否可用，先存一份到 localStorage 兜底
    saveToLocal(rows);

    // 处理收款码图片上传
    const wechatFile = document.getElementById('fileWechat') ? document.getElementById('fileWechat').files[0] : null;
    const alipayFile = document.getElementById('fileAlipay') ? document.getElementById('fileAlipay').files[0] : null;
    const logoFile = document.getElementById('fileLogo') ? document.getElementById('fileLogo').files[0] : null;

    let wechatUrl = rows.find(r => r.key === 'wechat_qr') ? (rows.find(r => r.key === 'wechat_qr').value || '') : '';
    let alipayUrl = rows.find(r => r.key === 'alipay_qr') ? (rows.find(r => r.key === 'alipay_qr').value || '') : '';
    let logoUrl = rows.find(r => r.key === 'logo_url') ? (rows.find(r => r.key === 'logo_url').value || '') : '';

    if (wechatFile) {
        try { wechatUrl = await uploadQr(wechatFile, 'wechat'); } catch(e) {
            console.warn('微信收款码上传失败：', e);
            showToast('⚠️ 微信收款码上传失败，其他设置继续保存…');
        }
    }
    if (alipayFile) {
        try { alipayUrl = await uploadQr(alipayFile, 'alipay'); } catch(e) {
            console.warn('支付宝收款码上传失败：', e);
            showToast('⚠️ 支付宝收款码上传失败，其他设置继续保存…');
        }
    }
    if (logoFile) {
        try { logoUrl = await uploadQr(logoFile, 'logo'); } catch(e) {
            console.warn('Logo 上传失败：', e);
            showToast('⚠️ Logo 上传失败，其他设置继续保存…');
        }
    }
    wechatUrl = cleanImgUrl(wechatUrl);
    alipayUrl = cleanImgUrl(alipayUrl);
    logoUrl = cleanImgUrl(logoUrl);

    // 更新 rows 中的 URL
    rows.forEach(r => { if (r.key === 'wechat_qr') r.value = wechatUrl; });
    rows.forEach(r => { if (r.key === 'alipay_qr') r.value = alipayUrl; });
    rows.forEach(r => { if (r.key === 'logo_url') r.value = logoUrl; });

    // 再次更新本地缓存（含上传后的 URL）
    saveToLocal(rows);

    // 尝试写入 Supabase
    if (!sbClient) {
        showToast('✅ 设置已保存到本地（Supabase 未配置）');
        return;
    }

    try {
        const { error } = await withTimeout(
            sbClient.from('settings').upsert(rows, { onConflict: 'key' }),
            12000,
            '云端保存超时'
        );
        if (error) throw error;
        showToast('✅ 所有设置已保存！前台将自动生效');
    } catch(e) {
        console.error('Supabase 保存失败，已使用本地缓存：', e);
        // Supabase 不可用时，localStorage 已经存好了，提示用户
        let msg = e.message || '未知错误';
        if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('SSL_ERROR')) {
            showToast('✅ 已保存到本机浏览器（云端暂不可用，恢复后点保存即可同步）');
        } else if (msg.includes('No content')) {
            showToast('⚠️ 部分设置项为空或格式异常（已存本地）');
        } else if (msg.includes('permission') || msg.includes('RLS')) {
            showToast('❌ 数据库权限异常（已存本地）：' + msg);
        } else {
            showToast('⚠️ 云端保存失败，已使用本地缓存：' + msg);
        }
    }
}

// ============================================================
//  修改管理员密码（使用 Supabase Auth）
// ============================================================
async function changePassword() {
    const oldPass = document.getElementById('oldPass').value;
    const newPass = document.getElementById('newPass').value;
    const confirmPass = document.getElementById('confirmPass').value;

    if (!oldPass || !newPass || !confirmPass) {
        showToast('⚠️ 请填写完整所有密码字段');
        return;
    }
    if (newPass.length < 6) { showToast('⚠️ 新密码至少6位'); return; }
    if (newPass !== confirmPass) { showToast('❌ 两次输入的新密码不一致'); return; }

    try {
        const { error } = await sbClient.auth.updateUser({ password: newPass });
        if (error) throw error;
        
        showToast('✅ 密码修改成功！');
        document.getElementById('oldPass').value = '';
        document.getElementById('newPass').value = '';
        document.getElementById('confirmPass').value = '';
    } catch(e) {
        showToast('❌ 修改失败：' + e.message);
    }
}

// ============================================================
//  回车键快捷操作
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    // 刷新后自动恢复登录态（检查 Supabase Auth 会话）
    sbClient.auth.onAuthStateChange((event, session) => {
        if (session) {
            enterDashboard();
        } else {
            // 未登录，显示登录页
            document.getElementById('loginPage').classList.add('active');
            document.getElementById('adminHeader').style.display = 'none';
            document.getElementById('dashboardArea').style.display = 'none';
            document.getElementById('tabBar').style.display = 'none';
        }
    });
    
    // 回车键快捷操作
    const si = document.getElementById('searchInput');
    if (si) si.addEventListener('keydown', e => { if (e.key==='Enter') searchOrders(); });
    const lp = document.getElementById('loginPass');
    if (lp) lp.addEventListener('keydown', e => { if (e.key==='Enter') doLogin(); });
});
