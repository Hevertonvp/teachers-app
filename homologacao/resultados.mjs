// Registro da matriz de testes (ID, módulo, cenário, esperado, observado, status). Acumula em resultados.json.
import fs from 'node:fs';
const arq = new URL('./resultados.json', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
export function registrar(id, modulo, cenario, esperado, observado, status, evidencia = '', nota = '') {
  const todos = fs.existsSync(arq) ? JSON.parse(fs.readFileSync(arq, 'utf8')) : [];
  const i = todos.findIndex(t => t.id === id);
  const linha = { id, modulo, cenario, esperado, observado, status, evidencia, nota, quando: new Date().toISOString() };
  if (i >= 0) todos[i] = linha; else todos.push(linha);
  fs.writeFileSync(arq, JSON.stringify(todos, null, 2));
  console.log(`[${status}] ${id} — ${cenario} → ${observado}`);
}
