/**
 * Drizzle Kit — geração de migrations versionadas a partir de `src/db/schema.js`.
 * Uso:
 *   npm run db:generate  → gera SQL em ./drizzle
 *   npm run db:push      → aplica direto no SQLite local (dev)
 *   npm run db:studio    → abre o Drizzle Studio
 */
module.exports = {
  schema: './src/db/schema.js',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: './database.sqlite',
  },
};
