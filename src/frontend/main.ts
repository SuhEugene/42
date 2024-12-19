import SPMini from 'spwmini-shitless/client';
import { deterministicRandomHue, lerp } from './utlis';
import './style.css';

const loadingEl = document.getElementById('loading') as HTMLDivElement;
const authEl = document.getElementById('auth') as HTMLDivElement;
const numberEl = document.getElementById('number') as HTMLDivElement;
const errorEl = document.getElementById('error') as HTMLDivElement;

const paymentErrorEl = document.getElementById('paymentError') as HTMLDivElement;
const paymentErrorCloseEl = document.getElementById('paymentErrorClose') as HTMLButtonElement;
const paymentErrorTextEl = document.getElementById('paymentErrorText') as HTMLParagraphElement;

const pendingEl = document.getElementById('pending') as HTMLDivElement;

paymentErrorCloseEl.addEventListener('click', hideError);

function showError(text: string) {
  paymentErrorTextEl.innerText = text;
  paymentErrorEl.classList.add('shown');
}

function hideError() {
  paymentErrorEl.classList.remove('shown');
}

function setPending(pending: boolean) {
  pendingEl.classList[pending ? 'add' : 'remove']('shown');
}

function initializeAll() {
  loadingEl.classList.add('initialized');
  authEl.classList.add('initialized');
  errorEl.classList.add('initialized');
  numberEl.classList.add('initialized');
  paymentErrorEl.classList.add('initialized');
  pendingEl.classList.add('initialized');
}
window.addEventListener('load', initializeAll);

function hideAllExcept(el: HTMLElement) {
  loadingEl.classList[el === loadingEl ? 'add' : 'remove']('shown');
  authEl.classList[el === authEl ? 'add' : 'remove']('shown');
  errorEl.classList[el === errorEl ? 'add' : 'remove']('shown');
  numberEl.classList[el === numberEl ? 'add' : 'remove']('shown');
}

const IDS: Record<string, string> = {
  sp: import.meta.env.VITE_SP_APPLICATION_ID,
  spm: import.meta.env.VITE_SPM_APPLICATION_ID
}
const query = new URLSearchParams(window.location.search);
const server = query.get('server');

const app = new SPMini(IDS[server ?? 'a']);
hideAllExcept(loadingEl);

let premiums = 0;
const str = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnopqrstuvwxyz";
function updateHue() {
  if (!app.user) return;
  const hueRotation = deterministicRandomHue(app.user.username + str[premiums % str.length]);
  numberEl.style.filter = `hue-rotate(${hueRotation}deg)`;
}

app.on('ready', async () => {
  if (!app.user) return;

  hideAllExcept(authEl);

  const res = await fetch(`/auth?server=${server}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: app.user }),
    credentials: 'include'
  });
  if (res.status !== 200) {
    hideAllExcept(errorEl);
    return;
  }

  const { premiums: premiumsNumber } = await res.json();
  premiums = premiumsNumber;

  hideAllExcept(numberEl);
  updateHue();
});

numberEl.addEventListener('click', async () => {
  hideError();
  const res = await fetch(`/premium?server=${server}`, { method: 'POST', credentials: 'include' });
  if (res.status !== 200) {
    if (res.status === 500) showError('На сервере какая-то ошибка, купить другой цвет не получится :c');
    else showError('Не удалось создать запрос на покупку');
    return;
  }
  const { code } = await res.json();
  app.openPayment(code);
});

app.on('openPaymentResponse', () => { setPending(true); hideError(); });

app.on('paymentResponse', async (status) => {
  hideError();
  if (status === 'cancel') {
    setPending(false);
    return;
  }

  setPending(true);
  await new Promise(resolve => setTimeout(resolve, 1000));

  const res = await fetch(`/premium?server=${server}`, { credentials: 'include' }).catch(e => {
    setPending(false);
    throw e;
  });

  if (res.status !== 200) {
    showError('Не удалось получить статус покупки');
    setPending(false);
    return;
  }
  const { premiums: premiumsNumber } = await res.json();
  premiums = premiumsNumber;
  updateHue();
  setPending(false);
});

app.on('openPaymentError', (error) => {
  showError(error);
  console.error(error);
  setPending(false);
});

app.on('paymentError', (error) => {
  showError(error);
  console.error(error);
  setPending(false);
});

const position = {
  currentX: 0,
  currentY: 0,
  targetX: 0,
  targetY: 0,
}

document.addEventListener('mousemove', (e) => {
  if (window.innerWidth < 700) return;

  position.targetX = (e.clientX / window.innerWidth - 0.5) * 6;
  position.targetY = (e.clientY / window.innerHeight - 0.5) * 6;
});

let lastTime = 0;
function animate(currentTime: number) {
  const deltaTime = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  position.currentX = lerp(position.currentX, position.targetX, 10 * deltaTime);
  position.currentY = lerp(position.currentY, position.targetY, 10 * deltaTime);

  numberEl.style.transform = `translate(${position.currentX}rem, ${position.currentY}rem)`;

  requestAnimationFrame(animate)
}
animate(0);
