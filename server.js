const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const QRCode = require('qrcode');
const xrayManager = require('./xray-manager');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'kia123456';

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// بررسی رمز عبور (برای APIها)
const checkAuth = (req, res, next) => {
    const password = req.headers['x-password'] || req.body.password;
    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, error: 'رمز عبور اشتباه است!' });
    }
    next();
};

// ==================== APIها ====================

// دریافت لیست کاربران
app.get('/api/users', checkAuth, (req, res) => {
    const users = xrayManager.getUsers();
    const usersWithRemaining = users.map(u => ({
        ...u,
        remaining: xrayManager.getUserRemaining(u)
    }));
    res.json({ success: true, users: usersWithRemaining });
});

// ساخت کاربر جدید
app.post('/api/create-user', checkAuth, (req, res) => {
    const { username, volume, days } = req.body;
    
    if (!username || !volume || !days) {
        return res.json({ success: false, error: 'همه فیلدها الزامی هستند!' });
    }
    
    const result = xrayManager.createUser(username, parseFloat(volume), parseInt(days));
    
    if (result.success) {
        // تولید QR کد
        QRCode.toDataURL(result.configLink, (err, qrCode) => {
            res.json({
                success: true,
                user: result.user,
                configLink: result.configLink,
                qrCode: qrCode || null
            });
        });
    } else {
        res.json(result);
    }
});

// حذف کاربر
app.delete('/api/delete-user', checkAuth, (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.json({ success: false, error: 'نام کاربری الزامی است!' });
    }
    xrayManager.deleteUser(username);
    res.json({ success: true });
});

// دریافت آمار
app.get('/api/stats', checkAuth, (req, res) => {
    const stats = xrayManager.getStats();
    res.json({ success: true, stats });
});

// بررسی وضعیت کاربران (برای به‌روزرسانی خودکار)
app.post('/api/check-users', checkAuth, (req, res) => {
    const users = xrayManager.checkAndUpdateUsers();
    res.json({ success: true, users });
});

// ==================== صفحات HTML ====================

// صفحه اصلی
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// صفحه داشبورد
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// شروع سرور
app.listen(PORT, () => {
    console.log(`🔥 پنل Kia روی پورت ${PORT} اجرا شد`);
    console.log(`🔑 رمز عبور: ${ADMIN_PASSWORD}`);
    console.log(`📱 آدرس: http://localhost:${PORT}`);
});

// چک کردن خودکار وضعیت کاربران هر 10 دقیقه
setInterval(() => {
    console.log('🔄 بررسی وضعیت کاربران...');
    xrayManager.checkAndUpdateUsers();
}, 10 * 60 * 1000);
