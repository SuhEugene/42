import express from 'express';
import session from 'express-session';
import SessionFileStore from 'session-file-store';
import { createServer } from 'vite';
import { config } from 'dotenv';
import { checkUser } from 'spwmini-shitless/middleware';
import { UserData } from 'spwmini-shitless/types';
import { createHmac, timingSafeEqual } from 'crypto'
import { ArrayIO } from './src/backend/arrayIO';
import { checkEnv } from './src/backend/checkEnv';

config();

checkEnv('HOST', process.env.HOST);
checkEnv('SPWORLDS_HOST', process.env.SPWORLDS_HOST);
checkEnv('EXPRESS_SECRET', process.env.EXPRESS_SECRET);
checkEnv('VITE_SPM_APPLICATION_ID', process.env.VITE_SPM_APPLICATION_ID);
checkEnv('SPM_APPLICATION_TOKEN', process.env.SPM_APPLICATION_TOKEN);
checkEnv('SPM_CARD_ID', process.env.SPM_CARD_ID);
checkEnv('SPM_CARD_TOKEN', process.env.SPM_CARD_TOKEN);
checkEnv('VITE_SP_APPLICATION_ID', process.env.VITE_SP_APPLICATION_ID);
checkEnv('SP_APPLICATION_TOKEN', process.env.SP_APPLICATION_TOKEN);
checkEnv('SP_CARD_ID', process.env.SP_CARD_ID);
checkEnv('SP_CARD_TOKEN', process.env.SP_CARD_TOKEN);
const APP_PORT = process.env.PORT || 5173;

const serversData = {
  sp: {
    name: 'sp',
    auth: `Bearer ${Buffer.from(`${process.env.SP_CARD_ID}:${process.env.SP_CARD_TOKEN}`).toString('base64')}`,
    cardId: process.env.SP_CARD_ID,
    cardToken: process.env.SP_CARD_TOKEN,
    applicationId: process.env.VITE_SP_APPLICATION_ID,
    applicationToken: process.env.SP_APPLICATION_TOKEN
  },
  spm: {
    name: 'spm',
    auth: `Bearer ${Buffer.from(`${process.env.SPM_CARD_ID}:${process.env.SPM_CARD_TOKEN}`).toString('base64')}`,
    cardId: process.env.SPM_CARD_ID,
    cardToken: process.env.SPM_CARD_TOKEN,
    applicationId: process.env.VITE_SPM_APPLICATION_ID,
    applicationToken: process.env.SPM_APPLICATION_TOKEN
  }
} as const;

async function requestAPI(auth: string, method: string, path: string, body?: any) {
  const res = await fetch(`${process.env.SPWORLDS_HOST}/api/public/${path}`, {
    method,
    body: body ? JSON.stringify(body) : null,
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json'
    }
  });

  if (![200, 201, 404].includes(res.status))
    throw new Error(`Ошибка при запросе к API ${res.status} ${res.statusText}`);
  return await res.json();
};

const getServer = (server: string):
  typeof serversData[keyof typeof serversData] | null =>
  serversData[server] ?? null;


const app = express();
app.disable('x-powered-by');
app.use(express.json());

const FileStore = SessionFileStore(session);

declare module 'express-session' {
  interface SessionData { username: UserData['username']; }
}
app.set('trust proxy', 1);
app.use((req, res, next) => {
  // @ts-expect-error Абузим проверку на защищенность соединения потому что trust proxy не робит
  req.connection.encrypted = true
  return session({
    store: new FileStore({
      path: './data/sessions',
      ttl: 60 * 60,
    }),
    secret: process.env.EXPRESS_SECRET!,
    resave: true,
    saveUninitialized: false,
    cookie: { maxAge: 60 * 60 * 1000, httpOnly: true, sameSite: 'none', secure: 'auto' }
  })(req, res, next);
});

const premiums = new ArrayIO<string>('./data/premiums.json');

const throttle: Record<string, number> = {};
const customThrottle: Record<string, number> = {
  '/premium': 5000,
  '/auth': 1000
};

app.use((req, res, next) => {
  if (req.path === '/') return next();
  if (!req.sessionID) return next();

  const id = `${req.sessionID}:${req.method}:${req.path}`;

  if (throttle[id] > Date.now()) {
    res.sendStatus(429);
    return;
  }

  const throttleTime = customThrottle[req.path];
  if (!throttleTime) return next();

  throttle[id] = Date.now() + throttleTime;
  next();
});

app.post("/auth", (req, res) => {
  const server = getServer(req.query.server as string);
  if (!server) {
    res.sendStatus(400);
    return;
  }

  const user = req.body.user as UserData;
  if (!checkUser(user, server.applicationToken)) {
    res.sendStatus(401);
    return;
  }
  console.log(`User ${user.username} logged in on ${server.name}`);
  req.session.username = `${user.username}:${server.name}`;
  req.session.save();
  res.status(200).json({ premiums: premiums.data.filter(username => username === req.session.username).length });
});

app.post('/premium', async (req, res) => {
  if (!req.session.username) {
    res.sendStatus(401);
    return;
  }
  const server = getServer(req.query.server as string);
  if (!server) {
    res.sendStatus(400);
    return;
  }

  try {
    const { card, code } = await requestAPI(server.auth, 'POST', `payments`, {
      data: '42',
      redirectUrl: '#MINIAPP',
      items: [{ name: 'СП42 - Реролл цвета', count: 1, price: 42 }],
      webhookUrl: `${process.env.HOST}/paymentHook?server=${server.name}`
    });

    res.send({ card, code });
  } catch (e) {
    res.sendStatus(500);
  }
});

app.get('/premium', (req, res) => {
  if (!req.session.username) {
    res.sendStatus(401);
    return;
  }
  res.json({ premiums: premiums.data.filter(username => username === req.session.username).length });
});

function validateHash(body: string | object, hashHeader: string, token: string): boolean {
  return timingSafeEqual(
    Buffer.from(
      createHmac('sha256', token)
        .update(typeof body === 'string' ? body : JSON.stringify(body))
        .digest('base64')
    ),
    Buffer.from(hashHeader)
  )
}

app.post('/paymentHook', (req, res) => {
  console.log("PaymentHook Reached", req.body);
  console.log("Hash", req.headers['x-body-hash']);
  const server = getServer(req.query.server as string);
  console.log("Server", server?.name);
  if (!server) {
    res.status(200).send("OK");
    return;
  }
  console.log("Server found");
  const isHookValid = validateHash(req.body, req.headers['x-body-hash'] as string, server.cardToken);
  if (!isHookValid) {
    console.log("Hook invalid")
    res.status(200).send("OK");
    return;
  }
  console.log("Hook valid");

  premiums.push(`${req.body.payer}:${server.name}`);
  console.log("Pushed");
  res.sendStatus(200);
});

if (process.argv.includes('prod')) {
  app.use(express.static('dist'));
} else {
  const vite = await createServer({ server: { middlewareMode: true } });
  app.use(vite.middlewares);
}

app.listen(APP_PORT, () => console.log(`Listening *:${APP_PORT}`));
