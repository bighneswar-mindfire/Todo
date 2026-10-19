import "dotenv/config";
import { parseEnv } from "@todo/shared";
import { createApp } from "./app.js";
import { createPrisma, prismaPing } from "./db.js";

const env = parseEnv(process.env);
const prisma = createPrisma(env.DATABASE_URL);
const app = createApp({ ping: prismaPing(prisma) });

app.listen(env.PORT, () => {
  console.log(`backend listening on http://localhost:${env.PORT}`);
});
