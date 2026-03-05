import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';

import { parseClientMessage, type ScreenMessage } from './protocol.js';
import { renderHello } from './screens/hello.js';
import { createSession } from './session.js';

const app = Fastify({ logger: true });

await app.register(websocket);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

await app.register(fastifyStatic, {
  root: path.join(__dirname, '../public'),
  prefix: '/'
});

app.get('/', (_request, reply) => {
  reply.sendFile('index.html');
});

app.get('/ws', { websocket: true }, (connection) => {
  const session = createSession();

  const sendScreen = () => {
    const screen: ScreenMessage = {
      type: 'screen',
      frame: renderHello(session, { cols: session.cols, rows: session.rows })
    };
    connection.socket.send(JSON.stringify(screen));
  };

  sendScreen();

  connection.socket.on('message', (raw) => {
    let payload: unknown;
    try {
      payload = JSON.parse(raw.toString());
    } catch {
      return;
    }

    const message = parseClientMessage(payload);
    if (!message) {
      return;
    }

    if (message.type === 'resize') {
      session.cols = message.cols;
      session.rows = message.rows;
      app.log.info({ sessionId: session.id, cols: session.cols, rows: session.rows }, 'Resize received');
      sendScreen();
      return;
    }

    const prettyKey = message.key || message.code;
    session.lastKey = prettyKey;
    app.log.info({ sessionId: session.id, key: message.key, code: message.code }, 'Key received');
    sendScreen();
  });
});

await app.listen({ host: '0.0.0.0', port: 3000 });
