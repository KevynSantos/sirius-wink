FROM node:22-alpine AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM php:8.4-apache
RUN php -r 'exit(extension_loaded("pdo_sqlite") ? 0 : 1);' && a2enmod rewrite headers
COPY docker/apache.conf /etc/apache2/sites-available/000-default.conf
COPY docker/php.ini /usr/local/etc/php/conf.d/app.ini
WORKDIR /var/www/html
COPY --from=frontend /app/dist ./
COPY backend /var/www/backend
RUN mkdir -p /var/www/data && chown www-data:www-data /var/www/data
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD php -r 'exit(@file_get_contents("http://127.0.0.1/api/health") === false ? 1 : 0);'
