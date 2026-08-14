# Runs the API anywhere that takes a container — Railway, Fly, Render, Cloud Run.
#
# Two stages so the shipped image doesn't carry the TypeScript compiler and the
# dev dependencies around with it.

FROM node:22-alpine AS build

# Prisma's query engine is linked against OpenSSL; alpine doesn't ship it.
RUN apk add --no-cache openssl

WORKDIR /app

# Copy manifests first so `npm ci` is cached and only re-runs when deps change.
COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm run build


FROM node:22-alpine AS runtime

RUN apk add --no-cache openssl

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# The generated Prisma client and the migrations both have to travel: `npm start`
# runs `prisma migrate deploy` before booting, so the database schema is brought
# up to date by the deploy itself rather than by hand.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist

# Listing photos. Mount a persistent volume here or they vanish on every deploy.
RUN mkdir -p /app/uploads
ENV UPLOAD_DIR=/app/uploads
VOLUME ["/app/uploads"]

EXPOSE 4000

CMD ["npm", "start"]
