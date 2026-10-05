import 'dotenv/config';
import { createApp } from './app.js';
import { iniciarScheduler } from '../scheduler.js';

const app = createApp();
const port = Number(process.env.PORT ?? 3333);

app.listen(port, () => {
  console.log(`API ouvindo em http://localhost:${port}`);
  console.log(`Healthcheck: http://localhost:${port}/health`);
});

// Só aqui (nunca em app.ts): evita disparar o cron ao importar createApp() em teste/script.
iniciarScheduler();
