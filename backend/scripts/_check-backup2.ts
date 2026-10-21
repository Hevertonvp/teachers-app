import fs from "fs";
const dump = JSON.parse(fs.readFileSync(String.raw`C:\Users\hevertonvp\Documents\teachers-app-backups\neondb_antes_de_zerar_20261021.json`, "utf8"));
console.log(JSON.stringify(dump.modeloAnamnese, null, 1));
console.log("--- primeiras 2 perguntas ---");
console.log(JSON.stringify(dump.perguntaAnamnese.slice(0,2), null, 1));
