import 'dotenv/config';
import { createApp } from './app.js';

const app = createApp();
const port = Number(process.env.PORT ?? 3333);

app.listen(port, () => {
  console.log(`API ouvindo em http://localhost:${port}`);
  console.log(`Healthcheck: http://localhost:${port}/health`);
});
