import { describe, expect, it } from "vitest";
import { databaseUrlFrom, devServerEnv } from "./config.js";

const neonUrl = "postgres://user:secret@neon.example/db";

describe("dev server environment", () => {
  it("ignores a database URL in .env files unless the neon mode is chosen", () => {
    const env = devServerEnv({ mode: "development", fileEnv: { DATABASE_URL: neonUrl }, processEnv: {} });

    expect(databaseUrlFrom(env)).toBeUndefined();
  });

  it("uses the database URL from .env files in neon mode", () => {
    const env = devServerEnv({ mode: "neon", fileEnv: { DATABASE_URL: neonUrl }, processEnv: {} });

    expect(databaseUrlFrom(env)).toBe(neonUrl);
  });

  it("always uses a database URL set explicitly in the shell", () => {
    const shellUrl = "postgres://localhost/trips";
    const env = devServerEnv({ mode: "development", fileEnv: { DATABASE_URL: neonUrl }, processEnv: { DATABASE_URL: shellUrl } });

    expect(databaseUrlFrom(env)).toBe(shellUrl);
  });
});
