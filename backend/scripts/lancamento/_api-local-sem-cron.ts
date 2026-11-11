// Sobe só a API (createApp), SEM o scheduler, para testes de carga locais. Uso exclusivo do teste de 11/11/2026.
import 'dotenv/config';
import { createApp } from '../../src/api/app.js';
const port = Number(process.env.PORT_TESTE ?? 3350);
createApp().listen(port, () => console.log(`API de teste (sem cron) em http://localhost:${port}`));
