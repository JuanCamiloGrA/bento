FROM node:22-alpine AS deps

WORKDIR /app/apps/web
COPY apps/web/package*.json ./
RUN npm install

FROM node:22-alpine AS runtime

WORKDIR /app/apps/web
COPY --from=deps /app/apps/web/node_modules ./node_modules
COPY apps/web ./

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]