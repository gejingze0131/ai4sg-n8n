import { defineConfig } from "drizzle-kit";

// Generates the migrations of the website's own tables (schema "web") from src/db/schema.ts.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  schemaFilter: ["web"],
});
