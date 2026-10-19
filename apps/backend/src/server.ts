import { createApp } from "./app.js";
import { PRODUCTION_SCRYPT_PARAMS, createPasswordHasher } from "./auth/password.js";
import { createPrisma, prismaPing } from "./db.js";
import { loadEnv } from "./env.js";

const env = loadEnv();
const prisma = createPrisma(env.DATABASE_URL);
const app = createApp({
  ping: prismaPing(prisma),
  prisma,
  hasher: createPasswordHasher(PRODUCTION_SCRYPT_PARAMS),
  jwt: { secret: env.JWT_SECRET },
});

const server = app.listen(env.PORT, () => {
  console.log(`backend listening on http://localhost:${env.PORT}`);
});

server.on("error", (err) => {
  console.error("server failed to start", err);
  process.exit(1);
});

function shutdown(signal: string): void {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
