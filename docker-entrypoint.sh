#!/bin/sh

# اجرای Xray در پس‌زمینه
/xray/xray -c /app/xray/config.json &

# اجرای پنل Node.js
node /app/server.js
