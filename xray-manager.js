const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const XRAY_CONFIG_PATH = path.join(__dirname, 'xray', 'config.json');
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// تابع تولید UUID
function generateUUID() {
    return crypto.randomUUID();
}

// تابع تولید کانفیگ Xray از لیست کاربران فعال
function generateXrayConfig(users) {
    const activeUsers = users.filter(u => u.active && !u.expired);
    
    const config = {
        "log": {
            "loglevel": "warning"
        },
        "inbounds": [{
            "port": 443,
            "protocol": "vless",
            "settings": {
                "clients": activeUsers.map(u => ({
                    "id": u.uuid,
                    "email": u.username,
                    "flow": "xtls-rprx-vision"
                })),
                "decryption": "none"
            },
            "streamSettings": {
                "network": "ws",
                "wsSettings": {
                    "path": "/" + generateUUID().substring(0, 8)
                },
                "security": "tls",
                "tlsSettings": {
                    "serverName": "www.google.com"
                }
            }
        }],
        "outbounds": [{
            "protocol": "freedom",
            "tag": "direct"
        }]
    };
    
    return config;
}

// به‌روزرسانی فایل کانفیگ Xray
function updateXrayConfig(users) {
    const config = generateXrayConfig(users);
    fs.writeFileSync(XRAY_CONFIG_PATH, JSON.stringify(config, null, 2));
    return true;
}

// تابع ساخت کانفیگ جدید
function createUser(username, volumeGB, days) {
    const users = getUsers();
    
    // بررسی تکراری نبودن اسم
    if (users.find(u => u.username === username)) {
        return { success: false, error: 'نام کاربری تکراری است!' };
    }
    
    const uuid = generateUUID();
    const now = Date.now();
    const expiryDate = new Date(now + days * 24 * 60 * 60 * 1000);
    
    const newUser = {
        username: username,
        uuid: uuid,
        volumeLimit: volumeGB * 1024 * 1024 * 1024, // تبدیل به بایت
        volumeUsed: 0,
        createdAt: now,
        expiryDate: expiryDate.getTime(),
        active: true,
        expired: false
    };
    
    users.push(newUser);
    saveUsers(users);
    updateXrayConfig(users);
    
    // ساخت لینک کانفیگ
    const configLink = generateConfigLink(uuid, username);
    
    return {
        success: true,
        user: newUser,
        configLink: configLink
    };
}

// تابع تولید لینک کانفیگ
function generateConfigLink(uuid, username) {
    const ip = getPublicIP();
    return `vless://${uuid}@${ip}:443?encryption=none&flow=xtls-rprx-vision&security=tls&sni=www.google.com&fp=chrome&type=ws&path=%2F${uuid.substring(0, 8)}#${username}`;
}

// دریافت آیپی عمومی
function getPublicIP() {
    try {
        const os = require('os');
        const interfaces = os.networkInterfaces();
        for (const iface of Object.values(interfaces)) {
            for (const addr of iface) {
                if (addr.family === 'IPv4' && !addr.internal) {
                    return addr.address;
                }
            }
        }
    } catch (e) {
        return '0.0.0.0';
    }
    return '0.0.0.0';
}

// توابع مدیریت فایل کاربران
function getUsers() {
    try {
        if (fs.existsSync(USERS_FILE)) {
            const data = fs.readFileSync(USERS_FILE);
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('خطا در خواندن فایل کاربران:', e);
    }
    return [];
}

function saveUsers(users) {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    } catch (e) {
        console.error('خطا در ذخیره کاربران:', e);
    }
}

// تابع بررسی و بروزرسانی وضعیت کاربران
function checkAndUpdateUsers() {
    const users = getUsers();
    let updated = false;
    const now = Date.now();
    
    for (const user of users) {
        // بررسی انقضای زمان
        if (user.expiryDate && now > user.expiryDate) {
            user.expired = true;
            user.active = false;
            updated = true;
        }
        
        // بررسی اتمام حجم
        if (user.volumeLimit && user.volumeUsed >= user.volumeLimit) {
            user.active = false;
            updated = true;
        }
    }
    
    if (updated) {
        saveUsers(users);
        updateXrayConfig(users);
    }
    return users;
}

// تابع دریافت آمار کلی
function getStats() {
    const users = getUsers();
    const activeUsers = users.filter(u => u.active && !u.expired);
    const totalVolumeUsed = users.reduce((sum, u) => sum + (u.volumeUsed || 0), 0);
    const totalVolumeLimit = users.reduce((sum, u) => sum + (u.volumeLimit || 0), 0);
    
    return {
        totalUsers: users.length,
        activeUsers: activeUsers.length,
        totalVolumeUsed: formatBytes(totalVolumeUsed),
        totalVolumeLimit: formatBytes(totalVolumeLimit),
        totalVolumeUsedRaw: totalVolumeUsed,
        totalVolumeLimitRaw: totalVolumeLimit
    };
}

// تابع فرمت حجم
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// تابع محاسبه حجم و زمان باقی‌مونده برای یک کاربر
function getUserRemaining(user) {
    const now = Date.now();
    const timeRemaining = Math.max(0, user.expiryDate - now);
    const volumeRemaining = Math.max(0, user.volumeLimit - user.volumeUsed);
    
    return {
        volumeRemaining: formatBytes(volumeRemaining),
        volumeRemainingRaw: volumeRemaining,
        timeRemaining: formatTime(timeRemaining),
        timeRemainingRaw: timeRemaining
    };
}

// تابع فرمت زمان
function formatTime(ms) {
    if (ms <= 0) return 'منقضی شده';
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    
    if (days > 0) return `${days} روز ${hours} ساعت`;
    if (hours > 0) return `${hours} ساعت ${minutes} دقیقه`;
    return `${minutes} دقیقه`;
}

// تابع حذف کاربر
function deleteUser(username) {
    let users = getUsers();
    users = users.filter(u => u.username !== username);
    saveUsers(users);
    updateXrayConfig(users);
    return true;
}

module.exports = {
    createUser,
    getUsers,
    saveUsers,
    checkAndUpdateUsers,
    getStats,
    getUserRemaining,
    deleteUser,
    generateConfigLink
};
