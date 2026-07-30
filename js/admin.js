// ============================================================
//  管理后台逻辑（拆分自 admin.html）
//  ⚠️ 配置区：请填入与 index.html 相同的 Supabase 信息
// ============================================================
const SUPABASE_URL = 'https://recharge.qwert168202606.workers.dev';
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

// ============================================================
//  Toast
// ============================================================
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2200);
}

// ============================================================
//  登录（前端模拟，账号密码存浏览器 localStorage）
// ============================================================
function doLogin() {
    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value.trim();
    const errEl = document.getElementById('loginError');

    if (!user || !pass) {
        errEl.textContent = '请输入账号和密码';
        errEl.style.display = 'block';
        return;
    }

    let adminInfo = JSON.parse(localStorage.getItem('admin_info') || '{}');
    const savedUser = adminInfo.username || 'admin';
    const savedPass = adminInfo.password || 'admin123';

    if (user === savedUser && pass === savedPass) {
        errEl.style.display = 'none';
        document.getElementById('loginPage').classList.remove('active');
        document.getElementById('adminHeader').style.display = 'flex';
        document.getElementById('dashboardArea').style.display = 'block';
        document.getElementById('tabBar').style.display = 'flex';

        loadSettings();
        renderOrderList();
        showToast('✅ 登录成功！');
    } else {
        errEl.textContent = '❌ 账号或密码错误！';
        errEl.style.display = 'block';
    }
}

// ============================================================
//  退出登录
// ============================================================
function logout() {
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
        const { data, error } = await query;
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
                ? `<div class="order-info-row"><span class="order-info-label">充值 ¥${order.recharge} · 券 -¥${order.coupon_deduct}</span><span class="order-info-value"></span></div>`
                : '';
            html += `
                <div class="order-item" onclick="showOrderDetail('${order.order_id}')">
                    <div class="order-top">
                        <span class="order-id">${order.order_id}</span>
                        <span class="order-status ${st.cls}">${st.text}</span>
                    </div>
                    <div class="order-info-row"><span class="order-info-label">手机号</span><span class="order-info-value">${order.phone||'-'}</span></div>
                    <div class="order-info-row"><span class="order-info-label">实付金额</span><span class="order-info-value" style="color:#e8941c;font-weight:700;">¥${order.amount}</span></div>
                    ${deductLine}
                    <div class="order-info-row"><span class="order-info-label">支付方式</span><span class="order-info-value">${payLabel}</span></div>
                    <div class="order-info-row"><span class="order-info-label">时间</span><span class="order-info-value" style="font-size:12px;">${formatTime(order.created_at)}</span></div>
                </div>`;
        });
        listEl.innerHTML = html;
    } catch(e) {
        console.error('读取订单失败：', e);
        listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>读取失败：${e.message}</p></div>`;
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
    const { data, error } = await sbClient
        .from('orders')
        .select('*')
        .eq('order_id', orderId)
        .single();

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

    let detailHtml = `
        <div class="detail-row"><span class="detail-label">订单编号</span><span class="detail-value">${data.order_id}</span></div>
        <div class="detail-row"><span class="detail-label">手机号码</span><span class="detail-value">${data.phone||'-'}</span></div>
        <div class="detail-row"><span class="detail-label">电子券编号</span><span class="detail-value">${data.coupon_code||'-'}</span></div>
        <div class="detail-row"><span class="detail-label">充值档位</span><span class="detail-value" style="color:#1e40af;font-weight:700;">¥${data.recharge!=null?data.recharge:data.amount}</span></div>
        ${data.coupon_deduct!=null ? `<div class="detail-row"><span class="detail-label">代金券抵扣</span><span class="detail-value" style="color:#ef4444;font-weight:700;">-¥${data.coupon_deduct}</span></div>` : ''}
        <div class="detail-row"><span class="detail-label">实付金额</span><span class="detail-value" style="color:#e8941c;font-weight:700;">¥${data.amount}</span></div>
        <div class="detail-row"><span class="detail-label">支付方式</span><span class="detail-value">${payLabel}</span></div>
        <div class="detail-row"><span class="detail-label">订单状态</span><span class="detail-value" style="color:${st.color};font-weight:700;">${st.text}</span></div>
        <div class="detail-row"><span class="detail-label">提交时间</span><span class="detail-value">${formatTime(data.created_at)}</span></div>`;

    if (data.screenshot_url) {
        detailHtml += `
            <div style="margin-top:14px;">
                <p style="font-size:13px;color:#64748b;margin-bottom:6px;">📷 付款凭证截图：</p>
                <img class="detail-screenshot" src="${data.screenshot_url}" alt="付款截图">
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

// ============================================================
//  修改订单状态（更新 Supabase）
// ============================================================
async function updateOrderStatus(newStatus) {
    if (!currentOrderData) return;
    const { error } = await sbClient
        .from('orders')
        .update({ status: newStatus })
        .eq('order_id', currentOrderData.order_id);

    if (error) {
        showToast('❌ 更新失败：' + error.message);
        return;
    }
    const msg = newStatus === 'approved' ? '✅ 已标记为通过' : '❌ 已标记为拒绝';
    showToast(msg);
    closeModal();
    renderOrderList();
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
    try {
        if (!sbClient) return; // 未配置凭证则不读取
        const { data, error } = await sbClient.from('settings').select('key, value');
        if (error) throw error;
        const map = {};
        (data || []).forEach(r => map[r.key] = r.value);

        document.getElementById('setSiteName').value = map['site_name'] || '';
        document.getElementById('setNotice').value = map['notice'] || '';
        document.getElementById('setBanner').value = map['banner'] || '';
        document.getElementById('setKefuName').value = map['kefu_name'] || '';
        document.getElementById('setKefuLink').value = map['kefu_link'] || '';
        document.getElementById('setMaintenance').value = map['maintenance'] || '';

        if (map['wechat_qr']) {
            const pw = document.getElementById('previewWechat');
            pw.src = map['wechat_qr']; pw.classList.add('show');
            document.getElementById('wechatUploadText').textContent = '✅ 已设置，点击可更换';
        }
        if (map['alipay_qr']) {
            const pa = document.getElementById('previewAlipay');
            pa.src = map['alipay_qr']; pa.classList.add('show');
            document.getElementById('alipayUploadText').textContent = '✅ 已设置，点击可更换';
        }
    } catch(e) {
        console.warn('读取设置失败：', e);
    }
}

// 上传收款码到 Storage，返回公开 URL
async function uploadQr(file, prefix) {
    if (!file) return null;
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `qr_${prefix}_${Date.now()}.${ext}`;
    const { error } = await sbClient.storage.from('screenshots').upload(path, file, { upsert: true });
    if (error) throw error;
    return sbClient.storage.from('screenshots').getPublicUrl(path).data.publicUrl;
}

// 保存所有设置
async function saveSettings() {
    try {
        if (!sbClient) {
            showToast('⚠️ 尚未配置 Supabase，无法保存设置');
            return;
        }

        const wechatFile = document.getElementById('fileWechat').files[0];
        const alipayFile = document.getElementById('fileAlipay').files[0];

        let wechatUrl = document.getElementById('previewWechat').src;
        let alipayUrl = document.getElementById('previewAlipay').src;

        // 如果有新文件，逐个上传（单个失败不影响其他）
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

        // 只保留真实的 http(s) URL
        if (!wechatUrl || !wechatUrl.startsWith('http')) wechatUrl = '';
        if (!alipayUrl || !alipayUrl.startsWith('http')) alipayUrl = '';

        // 构建设置行，过滤掉值为空的（避免 No content provided 错误）
        const allRows = [
            { key: 'site_name',  value: document.getElementById('setSiteName').value.trim() },
            { key: 'notice',     value: document.getElementById('setNotice').value.trim() },
            { key: 'banner',     value: document.getElementById('setBanner').value.trim() },
            { key: 'kefu_name',  value: document.getElementById('setKefuName').value.trim() },
            { key: 'kefu_link',  value: document.getElementById('setKefuLink').value.trim() },
            { key: 'wechat_qr',  value: wechatUrl },
            { key: 'alipay_qr',  value: alipayUrl }
        ];
        // 只保留有值的行
        const rows = allRows.filter(r => r.value && r.value.length > 0);

        // 维护模式开关：始终写入（确保关闭时能还原为正常营业）
        rows.push({ key: 'maintenance', value: document.getElementById('setMaintenance').value });

        if (rows.length === 0) {
            showToast('⚠️ 没有需要保存的设置内容');
            return;
        }

        const { error } = await sbClient.from('settings').upsert(rows, { onConflict: 'key' });
        if (error) throw error;

        showToast('✅ 所有设置已保存！前台将自动生效');
    } catch(e) {
        console.error('保存失败：', e);
        // 给用户友好的中文提示
        let msg = e.message || '未知错误';
        if (msg.includes('No content')) msg = '部分设置项为空或格式异常';
        if (msg.includes('permission') || msg.includes('RLS')) msg = '数据库权限异常，请检查 Supabase 配置';
        if (msg.includes('storage') || msg.includes('bucket')) msg = '图片存储桶异常，请确认 screenshots 桶已创建';
        showToast('❌ 保存失败：' + msg);
    }
}

// ============================================================
//  修改管理员密码（前端模拟）
// ============================================================
function changePassword() {
    const oldPass = document.getElementById('oldPass').value;
    const newPass = document.getElementById('newPass').value;
    const confirmPass = document.getElementById('confirmPass').value;

    if (!oldPass || !newPass || !confirmPass) {
        showToast('⚠️ 请填写完整所有密码字段');
        return;
    }
    let adminInfo = JSON.parse(localStorage.getItem('admin_info') || '{}');
    const currentSavedPass = adminInfo.password || 'admin123';
    if (oldPass !== currentSavedPass) { showToast('❌ 当前密码不正确'); return; }
    if (newPass.length < 6) { showToast('⚠️ 新密码至少6位'); return; }
    if (newPass !== confirmPass) { showToast('❌ 两次输入的新密码不一致'); return; }

    adminInfo.password = newPass;
    if (!adminInfo.username) adminInfo.username = 'admin';
    localStorage.setItem('admin_info', JSON.stringify(adminInfo));

    document.getElementById('oldPass').value = '';
    document.getElementById('newPass').value = '';
    document.getElementById('confirmPass').value = '';
    showToast('✅ 密码修改成功！');
}

// ============================================================
//  回车键快捷操作
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    const si = document.getElementById('searchInput');
    if (si) si.addEventListener('keydown', e => { if (e.key==='Enter') searchOrders(); });
    const lp = document.getElementById('loginPass');
    if (lp) lp.addEventListener('keydown', e => { if (e.key==='Enter') doLogin(); });
});
