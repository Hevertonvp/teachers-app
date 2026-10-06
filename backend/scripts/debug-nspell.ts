import { readFileSync } from 'fs';
import nspell from 'nspell';

const aff = readFileSync('../public/dictionaries/pt-br/pt-br.aff', 'utf8');
const dic = readFileSync('../public/dictionaries/pt-br/pt-br.dic', 'utf8');
console.log('aff length:', aff.length, '| primeiros 100 chars:', JSON.stringify(aff.slice(0, 100)));
console.log('dic length:', dic.length, '| primeira linha:', JSON.stringify(dic.slice(0, 50)));

try {
  const corretor = nspell({ aff, dic });
  console.log('nspell construído com sucesso');
  console.log('correct("casa"):', corretor.correct('casa'));
  console.log('correct("desemvolvimento"):', corretor.correct('desemvolvimento'));
  console.log('suggest("desemvolvimento"):', corretor.suggest('desemvolvimento'));
} catch (err) {
  console.error('ERRO ao construir/usar nspell:', err);
}
