FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
# NODE_ENV=development so npm ci keeps Jest / RTL / MSW (devDependencies)
ENV NODE_ENV=development
RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
