import { afterAll, describe, expect, it } from "vitest";
import pg from "pg";
import { createPrisma, prismaPing } from "./db.js";
import { loadEnv } from "./env.js";

const connectionString = loadEnv().DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const prisma = createPrisma(connectionString);

afterAll(async () => {
  await pool.end();
  await prisma.$disconnect();
});

describe("database schema", () => {
  it("Migration applies to a clean database: all eight tables exist", async () => {
    const { rows } = await pool.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
    );
    const names = rows.map((r) => r.table_name);
    for (const table of [
      "User",
      "RefreshToken",
      "PasswordResetOtp",
      "Note",
      "Tag",
      "NoteTag",
      "ShareLink",
      "NoteVersion",
    ]) {
      expect(names).toContain(table);
    }
  });

  it("Soft delete column present: Note.deletedAt is a nullable timestamp", async () => {
    const { rows } = await pool.query<{ data_type: string; is_nullable: string }>(
      `SELECT data_type, is_nullable FROM information_schema.columns
       WHERE table_name = 'Note' AND column_name = 'deletedAt'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.data_type).toBe("timestamp without time zone");
    expect(rows[0]?.is_nullable).toBe("YES");
  });

  it("Full-text search index present: generated tsvector column with a GIN index", async () => {
    const col = await pool.query<{ udt_name: string; is_generated: string }>(
      `SELECT udt_name, is_generated FROM information_schema.columns
       WHERE table_name = 'Note' AND column_name = 'searchVector'`,
    );
    expect(col.rows[0]?.udt_name).toBe("tsvector");
    expect(col.rows[0]?.is_generated).toBe("ALWAYS");

    const idx = await pool.query<{ indexdef: string }>(
      "SELECT indexdef FROM pg_indexes WHERE tablename = 'Note' AND indexdef ILIKE '%gin%'",
    );
    expect(idx.rows.some((r) => r.indexdef.includes('"searchVector"'))).toBe(true);
  });

  it("Healthy against the real database: ping resolves", async () => {
    await expect(prismaPing(prisma)()).resolves.toBeUndefined();
  });
});
