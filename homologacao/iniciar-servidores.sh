#!/bin/sh
# Backend (porta 3340) e frontend (https 5180) APONTANDO PARA O BANCO LOCAL. Nunca o Neon.
export DATABASE_URL="postgresql://homolog:homolog@localhost:54329/nexo_homolog"
export DIRECT_URL="$DATABASE_URL"
export PORT=3340
export FRONTEND_ORIGIN="https://localhost:5180"
export FRONTEND_URL="https://localhost:5180"
cd "$(dirname "$0")/../backend" && (npx tsx src/api/server.ts > ../homologacao/backend.log 2>&1 &)
cd .. && VITE_API_URL="http://localhost:3340" npx vite --port 5180 --strictPort > homologacao/frontend.log 2>&1 &
