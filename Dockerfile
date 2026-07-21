FROM node:18-alpine

# نصب ابزارهای مورد نیاز
RUN apk add --no-cache wget unzip curl

# دانلود و نصب Xray-core
RUN wget https://github.com/XTLS/Xray-core/releases/download/v1.8.6/Xray-linux-64.zip && \
    unzip Xray-linux-64.zip -d /xray && \
    rm Xray-linux-64.zip && \
    chmod +x /xray/xray

# ایجاد پوشه‌های مورد نیاز
WORKDIR /app
RUN mkdir -p /app/data /app/xray

# کپی فایل‌های پروژه
COPY package*.json ./
RUN npm install
COPY . .

# اسکریپت ورودی
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 443
EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
