// Sobe um PostgreSQL local DESCARTÁVEL para a homologação (nunca o Neon).
// Uso: node db-start.mjs  (fica rodando; Ctrl+C encerra). Dados em ./pgdata (fora do Git).
import EmbeddedPostgres from 'embedded-postgres';
import fs from 'node:fs';

const dir = new URL('./pgdata', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const novo = !fs.existsSync(dir + '/PG_VERSION');
const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'homolog', password: 'homolog', port: 54329, persistent: true });
if (novo) await pg.initialise();
await pg.start();
if (novo) await pg.createDatabase('nexo_homolog');
console.log('POSTGRES_PRONTO postgresql://homolog:***@localhost:54329/nexo_homolog');
process.on('SIGINT', async () => { await pg.stop(); process.exit(0); });
setInterval(() => {}, 1 << 30);
