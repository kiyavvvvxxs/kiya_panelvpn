// ذخیره رمز عبور
const PASSWORD = localStorage.getItem('panelPassword');

// تنظیم هدر برای درخواست‌ها
const headers = {
    'Content-Type': 'application/json',
    'x-password': PASSWORD
};

// ==================== بارگذاری اولیه ====================
document.addEventListener('DOMContentLoaded', function() {
    if (!PASSWORD) {
        window.location.href = '/';
        return;
    }
    
    loadStats();
    loadUsers();
    
    // فرم ساخت کانفیگ
    document.getElementById('createForm').addEventListener('submit', createUser);
    
    // دکمه خروج
    document.getElementById('logoutBtn').addEventListener('click', function() {
        localStorage.removeItem('panelPassword');
        window.location.href = '/';
    });
    
    // آپدیت خودکار هر 30 ثانیه
    setInterval(() => {
        loadStats();
        loadUsers();
    }, 30000);
});

// ==================== دریافت آمار ====================
async function loadStats() {
    try {
        const response = await fetch('/api/stats', { headers });
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('totalUsers').textContent = data.stats.totalUsers;
            document.getElementById('activeUsers').textContent = data.stats.activeUsers;
            document.getElementById('totalVolume').textContent = data.stats.totalVolumeUsed;
            document.getElementById('statsBadge').textContent = `${data.stats.activeUsers} فعال از ${data.stats.totalUsers}`;
        }
    } catch (e) {
        console.error('خطا در دریافت آمار:', e);
    }
}

// ==================== دریافت لیست کاربران ====================
async function loadUsers() {
    try {
        const response = await fetch('/api/users', { headers });
        const data = await response.json();
        
        if (data.success) {
            renderUsers(data.users);
        }
    } catch (e) {
        console.error('خطا در دریافت کاربران:', e);
    }
}

// ==================== رندر کاربران ====================
function renderUsers(users) {
    const container = document.getElementById('usersList');
    
    if (!users || users.length === 0) {
        container.innerHTML = '<p class="empty-msg">هیچ کانفیگی ساخته نشده است.</p>';
        return;
    }
    
    container.innerHTML = users.map(user => {
        const status = user.active && !user.expired ? 'فعال' : 'غیرفعال';
        const statusClass = user.active && !user.expired ? 'active' : 'expired';
        const remaining = user.remaining || { volumeRemaining: 'نامشخص', timeRemaining: 'نامشخص' };
        
        return `
            <div class="user-item">
                <div class="user-header">
                    <span class="user-name">👤 ${user.username}</span>
                    <span class="user-status ${statusClass}">${status}</span>
                </div>
                <div class="user-details">
                    <span>📦 حجم باقی‌مانده: ${remaining.volumeRemaining}</span>
                    <span>⏳ زمان باقی‌مانده: ${remaining.timeRemaining}</span>
                    <span>📊 حجم مصرفی: ${user.volumeUsed ? formatBytes(user.volumeUsed) : '۰'}</span>
                </div>
                <div class="user-actions">
                    <button class="btn-show-config" onclick="showConfig('${user.username}')">🔗 نمایش کانفیگ</button>
                    <button class="btn-delete" onclick="deleteUser('${user.username}')">🗑️ حذف</button>
                </div>
            </div>
        `;
    }).join('');
}

// ==================== ساخت کاربر جدید ====================
async function createUser(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const volume = document.getElementById('volume').value;
    const days = document.getElementById('days').value;
    
    const resultBox = document.getElementById('createResult');
    resultBox.style.display = 'block';
    resultBox.innerHTML = '<p>⏳ در حال ساخت...</p>';
    
    try {
        const response = await fetch('/api/create-user', {
            method: 'POST',
            headers,
            body: JSON.stringify({ username, volume, days })
        });
        
        const data = await response.json();
        
        if (data.success) {
            resultBox.innerHTML = `
                <div style="color: #00ff00; font-weight: bold;">✅ کانفیگ با موفقیت ساخته شد!</div>
                <div class="config-link">${data.configLink}</div>
                <div class="qr-code">
                    <img src="${data.qrCode}" alt="QR Code" style="max-width: 200px;">
                </div>
                <button class="btn-copy" onclick="copyToClipboard('${data.configLink}')">📋 کپی لینک</button>
                <button class="btn-copy" onclick="copyQR('${data.qrCode}')">📱 کپی QR</button>
            `;
            
            // آپدیت لیست و آمار
            loadUsers();
            loadStats();
            
            // ریست فرم
            document.getElementById('createForm').reset();
        } else {
            resultBox.innerHTML = `<div style="color: #ff0000;">❌ ${data.error}</div>`;
        }
    } catch (e) {
        resultBox.innerHTML = `<div style="color: #ff0000;">❌ خطا در ارتباط با سرور!</div>`;
        console.error(e);
    }
}

// ==================== حذف کاربر ====================
async function deleteUser(username) {
    if (!confirm(`آیا از حذف کانفیگ "${username}" مطمئن هستید؟`)) return;
    
    try {
        const response = await fetch('/api/delete-user', {
            method: 'DELETE',
            headers,
            body: JSON.stringify({ username })
        });
        
        const data = await response.json();
        
        if (data.success) {
            loadUsers();
            loadStats();
        }
    } catch (e) {
        console.error('خطا در حذف کاربر:', e);
    }
}

// ==================== نمایش کانفیگ ====================
async function showConfig(username) {
    try {
        const response = await fetch('/api/users', { headers });
        const data = await response.json();
        
        if (data.success) {
            const user = data.users.find(u => u.username === username);
            if (user) {
                const link = `vless://${user.uuid}@${getIP()}:443?encryption=none&flow=xtls-rprx-vision&security=tls&sni=www.google.com&fp=chrome&type=ws&path=%2F${user.uuid.substring(0, 8)}#${user.username}`;
                
                // ساخت QR
                const qr = await QRCode.toDataURL(link);
                
                alert(`🔗 لینک کانفیگ ${username}:\n\n${link}\n\n📱 QR کد در کنسول نمایش داده شد.`);
                console.log('QR Code:', qr);
            }
        }
    } catch (e) {
        console.error('خطا:', e);
    }
}

// ==================== توابع کمکی ====================
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('✅ لینک کپی شد!');
    }).catch(() => {
        // راه حل جایگزین
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('✅ لینک کپی شد!');
    });
}

function copyQR(qrDataUrl) {
    // کپی QR به صورت تصویر
    const link = document.createElement('a');
    link.download = 'qrcode.png';
    link.href = qrDataUrl;
    link.click();
}

function getIP() {
    // دریافت آیپی از سرور
    return window.location.hostname;
}

// ==================== تابع تولید QR (برای نمایش) ====================
// این تابع برای مواقعی که نیاز به تولید QR در کلاینت داریم
async function generateQR(text) {
    try {
        const response = await fetch(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`);
        return response.url;
    } catch (e) {
        console.error('خطا در تولید QR:', e);
        return null;
    }
}
