#!/bin/sh
# Reinicia SÓ o backend da homologação (porta 3340) apontando para o banco LOCAL. Nunca o Neon.
# Derruba antes o processo que estiver ouvindo na 3340 — sem isso o novo não sobe (porta ocupada) e o
# antigo continua respondendo com o código velho (aconteceu: rota nova dava 404).
for pid in $(netstat -ano 2>/dev/null | grep -E ":3340 +.*LISTEN" | awk '{print $NF}' | sort -u); do
  taskkill //PID "$pid" //F > /dev/null 2>&1 || kill "$pid" 2>/dev/null
done
sleep 1
export DATABASE_URL="postgresql://homolog:homolog@localhost:54329/nexo_homolog"
export DIRECT_URL="$DATABASE_URL"
export PORT=3340
export FRONTEND_ORIGIN="https://localhost:5180"
export FRONTEND_URL="https://localhost:5180"
cd "$(dirname "$0")/../backend" && (npx tsx src/api/server.ts > ../homologacao/backend.log 2>&1 &)
