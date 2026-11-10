'use strict';
/* ===================== Мой день — личный планер, v2 =====================
   Расписание на 7 дней недели, правка «только на сегодня», привычки с целями
   на неделю, статистика, цели, голосовой дневник. Данные — localStorage +
   синхронизация через приватный репозиторий GitHub (data.json).          */

const LS_STATE = 'lp-state-v1';
const LS_CFG = 'lp-cfg-v1';
const VERSION = 2;

const CATS = {
  god:     { n: 'Бог',          c: 'var(--c-god)',     i: 'ti-sparkles' },
  family:  { n: 'Семья',        c: 'var(--c-family)',  i: 'ti-heart' },
  work:    { n: 'Работа',       c: 'var(--c-work)',    i: 'ti-briefcase' },
  sport:   { n: 'Спорт',        c: 'var(--c-sport)',   i: 'ti-barbell' },
  english: { n: 'Английский',   c: 'var(--c-english)', i: 'ti-language' },
  growth:  { n: 'Цели',         c: 'var(--c-growth)',  i: 'ti-rocket' },
  reading: { n: 'Чтение',       c: 'var(--c-reading)', i: 'ti-book' },
  food:    { n: 'Еда',          c: 'var(--c-food)',    i: 'ti-tools-kitchen-2' },
  home:    { n: 'Дом',          c: 'var(--c-home)',    i: 'ti-home' },
  rest:    { n: 'Отдых',        c: 'var(--c-rest)',    i: 'ti-device-gamepad-2' },
  sleep:   { n: 'Сон',          c: 'var(--c-sleep)',   i: 'ti-moon' },
  walk:    { n: 'Прогулка',     c: 'var(--c-sport)',   i: 'ti-walk' },
};
const DAYS = [['d1', 'Пн', 'Понедельник'], ['d2', 'Вт', 'Вторник'], ['d3', 'Ср', 'Среда'], ['d4', 'Чт', 'Четверг'],
  ['d5', 'Пт', 'Пятница'], ['d6', 'Сб', 'Суббота'], ['d7', 'Вс', 'Воскресенье']];
const DAY_ACC = { d1: 'понедельники', d2: 'вторники', d3: 'среды', d4: 'четверги', d5: 'пятницы', d6: 'субботы', d7: 'воскресенья' };
const COLLECTIONS = ['plan', 'days', 'habits', 'goals', 'reviews', 'weights', 'books'];

/* ---------- utils ---------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const now = () => Date.now();
const pad = n => String(n).padStart(2, '0');
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const toMin = t => { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + m; };
const sortKey = t => { const m = toMin(t); return m < 300 ? m + 1440 : m; };
const fmtH = min => { min = Math.round(min); const h = Math.floor(min / 60), m = min % 60; return h ? `${h} ч${m ? ' ' + m + ' мин' : ''}` : `${m} мин`; };
const dayCode = d => 'd' + (((d.getDay() + 6) % 7) + 1);
const weekStart = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return addDays(x, -((x.getDay() + 6) % 7)); };
const live = obj => Object.entries(obj || {}).filter(([, v]) => v && !v.deleted);
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
const longDate = k => cap(parseKey(k).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(' г.', ''));
const shortDate = d => cap(d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }));
const blockLen = b => { let l = toMin(b.end) - toMin(b.start); if (l <= 0) l += 1440; return l; };
const fmtShort = min => { const h = Math.floor(min / 60), m = min % 60; return h ? `${h} ч${m ? ' ' + m + ' мин' : ''}` : `${m} мин`; };
const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const LN = NATIVE ? window.Capacitor.Plugins.LocalNotifications : null;
const APK_URL = 'https://serhiiorobchenko.github.io/Life_Planner/MoyDen.apk';
const blockNotify = b => b.n !== undefined ? !!b.n : (!['food', 'home', 'sleep'].includes(b.cat) || /^Экраны/.test(b.title));
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const catOf = b => CATS[b.cat] || CATS.home;
const icon = (cat, size = 38) => { const c = CATS[cat] || CATS.home;
  return `<span class="ic" style="width:${size}px;height:${size}px;background:color-mix(in srgb,${c.c} 15%,transparent);color:${c.c}"><i class="ti ${c.i}"></i></span>`; };

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2000);
}

/* ---------- default plan ---------- */
const WORK_A = 'Тренировка А (≈25 мин):\n• приседания 3×12\n• отжимания от стола 3×8–12\n• тяга гантели/резинки в наклоне 3×12\n• бицепс 3×12\n• планка 3×30 с';
const WORK_B = 'Тренировка Б (≈25 мин):\n• выпады 3×8 на ногу\n• австралийские подтягивания (низкая перекладина) 3×8\n• узкие отжимания от стола 3×8\n• бицепс «молот» 3×12\n• ягодичный мост 3×15';
const WORK_C = 'Лёгкий день:\n• растяжка 10 мин\n• планка 3×30 с\n• вечером — прогулка с семьёй';
const B = (start, end, title, cat, h = '', note = '') => ({ id: uid(), start, end, title, cat, h, note });

function weekdayBlocks(n) {
  const sport = { 1: ['Тренировка А', WORK_A], 2: ['Тренировка Б', WORK_B], 3: ['Растяжка и планка', WORK_C], 4: ['Тренировка А', WORK_A], 5: ['Тренировка Б', WORK_B] }[n];
  const eve = {
    1: ['Английский: разговорная практика', 'english', 'h-english', 'С преподавателем онлайн или вслух: пересказать день по-английски.'],
    2: ['Книга по психологии / воспитанию', 'reading', 'h-reading', ''],
    3: ['Английский: разговорная практика', 'english', 'h-english', 'С преподавателем онлайн или вслух.'],
    4: ['Книга по психологии / воспитанию', 'reading', 'h-reading', ''],
    5: ['Художественная книга', 'reading', 'h-reading', 'Пятница — можно одну партию в шахматы.'],
  }[n];
  return [
    B('07:00', '07:25', 'Молитва и Библия', 'god', 'h-prayer', 'Встать раньше Марка. Вода, умыться — и тихое время с Богом.'),
    B('07:25', '08:00', 'Марк: завтрак, сборы', 'family'),
    B('08:00', '08:15', 'Отвести Марка в садик', 'family'),
    B('08:15', '08:45', 'Ходьба домой + английский подкаст', 'english', 'h-english', 'Быстрым шагом. В наушниках — подкаст на английском (30 мин).'),
    B('08:45', '09:10', sport[0], 'sport', 'h-sport', sport[1]),
    B('09:10', '09:20', 'Душ', 'home'),
    B('09:20', '13:30', 'Работа — блок 1', 'work', '', 'Телефон в другой комнате. Сначала самая важная задача.'),
    B('13:30', '14:00', 'Обед (когда позовут)', 'food'),
    B('14:00', '18:30', 'Работа — блок 2', 'work', 'h-work', 'В конце: записать, на чём остановился, и закрыть работу.'),
    B('18:30', '20:00', 'Время с Марком', 'family', 'h-mark', 'Без телефона.'),
    B('20:00', '20:30', 'Посуда, порядок, план на завтра', 'home'),
    B('20:30', '22:00', 'Время с женой, вечерняя молитва', 'family'),
    B('22:00', '22:40', eve[0], eve[1], eve[2], eve[3]),
    B('22:40', '23:00', 'Экраны выключены', 'home', '', 'Телефон на зарядку не у кровати.'),
    B('23:00', '07:00', 'Сон', 'sleep', 'h-sleep'),
  ];
}
function defaultPlan(t) {
  const p = {};
  for (let n = 1; n <= 5; n++) p['d' + n] = { u: t, blocks: weekdayBlocks(n) };
  p.d6 = { u: t, blocks: [
    B('07:30', '08:00', 'Подъём, молитва', 'god', 'h-prayer'),
    B('08:00', '08:45', 'Завтрак с семьёй', 'food'),
    B('08:45', '12:30', 'Утро с Марком', 'family', 'h-mark', 'Прогулка, площадка, игры. У жены — время для себя.'),
    B('12:30', '13:00', 'Обед', 'food'),
    B('13:00', '15:00', 'Upwork: профиль, резюме, портфолио', 'growth', 'h-goals', 'Марк спит.'),
    B('15:00', '18:30', 'Семья, прогулка', 'walk'),
    B('18:30', '20:00', 'Марк: ужин, игры', 'family'),
    B('20:00', '22:00', 'Время с женой', 'family'),
    B('22:00', '22:40', 'Художественная книга', 'reading', 'h-reading'),
    B('23:00', '07:30', 'Сон', 'sleep', 'h-sleep'),
  ] };
  p.d7 = { u: t, blocks: [
    B('07:30', '08:00', 'Подъём, молитва', 'god', 'h-prayer'),
    B('08:00', '09:30', 'Завтрак, сборы', 'food'),
    B('09:30', '12:30', 'Церковь', 'god'),
    B('12:30', '13:00', 'Обед', 'food'),
    B('13:00', '15:00', 'Грин-карта и английский', 'growth', 'h-goals', 'Марк спит.'),
    B('15:00', '18:30', 'Семья', 'walk'),
    B('18:30', '20:00', 'Время с Марком', 'family', 'h-mark'),
    B('20:00', '20:20', 'Разбор недели', 'growth', '', 'Вкладка «Статистика» → «Разбор недели».'),
    B('20:20', '22:00', 'Время с женой', 'family'),
    B('22:00', '22:40', 'Чтение', 'reading', 'h-reading'),
    B('23:00', '07:00', 'Сон', 'sleep', 'h-sleep'),
  ] };
  return p;
}
function defaultHabits(t) {
  const H = {};
  [['h-prayer', 'Утренняя молитва', 'god', 7], ['h-sport', 'Тренировка', 'sport', 5], ['h-english', 'Английский', 'english', 5],
   ['h-reading', 'Чтение', 'reading', 4], ['h-work', 'Работа 8+ часов', 'work', 5], ['h-mark', 'Марк без телефона', 'family', 7],
   ['h-goals', 'Upwork / грин-карта', 'growth', 2], ['h-sweet', 'Без сладкого', 'food', 7], ['h-late', 'Не ем после 20:30', 'food', 7],
   ['h-chess', 'Шахматы ≤ 1 партии', 'rest', 7], ['h-sleep', 'Отбой до 23:00', 'sleep', 7]]
    .forEach(([id, name, cat, n], i) => { H[id] = { u: t, name, cat, target: n, order: i }; });
  return H;
}
function defaultGoals(t) {
  const G = {};
  [
    { title: 'Английский: свободно говорить и понимать на слух', cat: 'english', why: 'Уверенность в работе с клиентами и при переезде в США.',
      metric: 'Сдать IELTS на 6.5 (через ~6 мес.)',
      steps: ['Слушать подкаст 30 мин каждый будний день', 'Найти преподавателя для разговорной практики 2×/нед', 'Пройти пробный тест IELTS через 3 месяца'] },
    { title: 'Похудеть с 97 до 80 кг', cat: 'food', why: 'Больше сил, здоровье, пример для Марка.', metric: '−0,5…0,7 кг в неделю, взвешивание раз в неделю',
      steps: ['Убрать сладкое и печенье из дома', 'Не есть после 20:30', 'Белок в каждом приёме пищи', 'Купить гантели или набор резинок'] },
    { title: 'Сила и выносливость', cat: 'sport', why: 'Руки, бицепс, стройнее, больше энергии.', metric: 'Первое подтягивание; 20 отжиманий подряд',
      steps: ['4–5 тренировок в неделю по программе', 'Австралийские подтягивания на брусьях'] },
    { title: 'Грин-карта и Upwork', cat: 'growth', why: 'Переезд в США и своё дело.', metric: 'Обновлённый профиль Upwork + портфолио; план по грин-карте',
      steps: ['Обновить резюме и профиль Upwork', 'Собрать портфолио (3–5 проектов)', 'Разобраться в вариантах грин-карты и документах'] },
  ].forEach((g, i) => { G[['g-english', 'g-weight', 'g-strength', 'g-greencard'][i]] = { u: t, order: i, cat: g.cat, title: g.title, why: g.why, metric: g.metric,
    steps: g.steps.map(x => ({ id: uid(), t: x, done: false })) }; });
  return G;
}

/* ---------- state & migration ---------- */
let S, CFG;
try { S = JSON.parse(localStorage.getItem(LS_STATE)); } catch { S = null; }
function freshState() { const t = now();
  return { v: VERSION, plan: defaultPlan(t), days: {}, habits: defaultHabits(t), goals: defaultGoals(t), reviews: {}, weights: { [dkey(new Date())]: { u: t, kg: 97 } } }; }
function migrate(s) {
  if (!s || !s.v) return freshState();
  if (s.v >= VERSION) { COLLECTIONS.forEach(c => s[c] = s[c] || {}); return s; }
  // v1 → v2: новое расписание на 7 дней и новые привычки; дневник, вес, цели, разборы сохраняются
  const t = now(), n = freshState();
  const habits = n.habits;
  Object.keys(s.habits || {}).forEach(id => { if (!habits[id]) habits[id] = { u: t, deleted: true }; });
  const days = {};
  Object.entries(s.days || {}).forEach(([k, d]) => { if (d && (d.note || '').trim()) days[k] = { u: t, note: d.note, habits: {}, marks: {} }; });
  return { v: VERSION, plan: n.plan, days, habits,
    goals: Object.keys(s.goals || {}).length ? s.goals : n.goals,
    reviews: s.reviews || {}, weights: Object.keys(s.weights || {}).length ? s.weights : n.weights };
}
S = migrate(S);
// Убрать дубли целей (раньше каждое устройство создавало свои копии стартовых целей)
function dedupeGoals() {
  const groups = {}; let changed = false;
  live(S.goals).forEach(([id, g]) => { const key = (g.title || '').trim().toLowerCase(); (groups[key] = groups[key] || []).push([id, g]); });
  Object.values(groups).forEach(list => {
    if (list.length < 2) return;
    const score = ([id, g]) => (g.steps || []).filter(x => x.done).length * 1e13 + (id.startsWith('g-') ? 1e12 : 0) + (g.u || 0);
    list.sort((a, b) => score(b) - score(a));
    list.slice(1).forEach(([id]) => { S.goals[id] = { u: now(), deleted: true }; changed = true; });
  });
  return changed;
}
dedupeGoals();
try { CFG = JSON.parse(localStorage.getItem(LS_CFG)) || {}; } catch { CFG = {}; }
CFG.owner = CFG.owner || 'SerhiiOrobchenko';
if (!CFG.repo || CFG.repo === 'life-planner-data') CFG.repo = 'Life_Planner_Data';
CFG.notif = Object.assign({ on: true, sound: true, lead: 0 }, CFG.notif || {});
function applySetupLink(str) {
  const m = String(str).match(/#setup=([A-Za-z0-9+/=]+)/); if (!m) return false;
  const c = JSON.parse(decodeURIComponent(escape(atob(m[1])))); Object.assign(CFG, { owner: c.o, repo: c.r, token: c.t }); localStorage.setItem(LS_CFG, JSON.stringify(CFG)); return true;
}
if (location.hash.startsWith('#setup=')) {
  try {
    const c = JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(7)))));
    Object.assign(CFG, { owner: c.o, repo: c.r, token: c.t });
    localStorage.setItem(LS_CFG, JSON.stringify(CFG));
    setTimeout(() => toast('Устройство подключено'), 300);
  } catch {}
  history.replaceState(null, '', location.pathname);
}

function persist(silent) {
  scheduleNotifs();
  try { localStorage.setItem(LS_STATE, JSON.stringify(S)); } catch { toast('Не удалось сохранить'); }
  if (!silent) scheduleSync();
}
function saveCfg() { try { localStorage.setItem(LS_CFG, JSON.stringify(CFG)); } catch {} }

function day(k) { return S.days[k] || { u: 0, marks: {}, habits: {}, note: '' }; }
function setDay(k, fn) { const d = structuredClone(day(k)); d.marks = d.marks || {}; d.habits = d.habits || {}; fn(d); d.u = now(); S.days[k] = d; persist(); }
function planBlocks(code) { return (S.plan[code]?.blocks || []); }
function blocksFor(k) {
  const d = day(k); const list = d.blocks || planBlocks(dayCode(parseKey(k)));
  return [...list].sort((a, b) => sortKey(a.start) - sortKey(b.start));
}
function habitsList() { return live(S.habits).sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0)); }
function habitDone(k, hid) {
  const d = day(k); const v = d.habits?.[hid];
  if (v === true) return true; if (v === false) return false;
  return blocksFor(k).some(b => b.h === hid && d.marks?.[b.id]);
}
function isCurrent(b, m) { const s = toMin(b.start), e = toMin(b.end); return s < e ? m >= s && m < e : m >= s || m < e; }

/* ---------- notifications (Android app) ---------- */
let notifTimer = null;
function scheduleNotifs() { if (!LN) return; clearTimeout(notifTimer); notifTimer = setTimeout(rescheduleNotifs, 1500); }
async function ensureNotifPerm() {
  let p = await LN.checkPermissions(); if (p.display !== 'granted') p = await LN.requestPermissions();
  return p.display === 'granted';
}
async function rescheduleNotifs() {
  if (!LN) return;
  try {
    const pend = await LN.getPending();
    if (pend.notifications.length) await LN.cancel({ notifications: pend.notifications.map(n => ({ id: n.id })) });
    if (!CFG.notif.on || !(await ensureNotifPerm())) return;
    try {
      await LN.createChannel({ id: 'plan-sound', name: 'Расписание (со звуком)', importance: 4, visibility: 1, vibration: true });
      await LN.createChannel({ id: 'plan-quiet', name: 'Расписание (без звука)', importance: 2, visibility: 1, vibration: false });
    } catch {}
    const list = [], t = now(), lead = (CFG.notif.lead || 0) * 60000;
    for (let i = 0; i < 14; i++) {
      const date = addDays(new Date(), i), k = dkey(date);
      blocksFor(k).forEach((b, j) => {
        if (!blockNotify(b)) return;
        const at = new Date(date.getFullYear(), date.getMonth(), date.getDate(), ...b.start.split(':').map(Number)).getTime() - lead;
        if (at <= t + 5000) return;
        list.push({ id: i * 1000 + j + 1, title: (CFG.notif.lead ? `Через ${CFG.notif.lead} мин: ` : '') + b.title,
          body: `${b.start}–${b.end} · ${fmtShort(blockLen(b))}` + (b.note ? '\n' + b.note.split('\n')[0] : ''),
          schedule: { at: new Date(at), allowWhileIdle: true }, channelId: CFG.notif.sound ? 'plan-sound' : 'plan-quiet', smallIcon: 'ic_stat_notify' });
      });
    }
    if (list.length) await LN.schedule({ notifications: list });
    CFG.notif.count = list.length; saveCfg();
  } catch (e) { console.log('notif', e); }
}
async function testNotif() {
  if (!LN) return toast('Уведомления работают в Android-приложении');
  if (!(await ensureNotifPerm())) return toast('Разрешите уведомления в настройках телефона');
  await LN.schedule({ notifications: [{ id: 999999, title: 'Мой день', body: 'Так будут выглядеть напоминания', schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true },
    channelId: CFG.notif.sound ? 'plan-sound' : 'plan-quiet', smallIcon: 'ic_stat_notify' }] });
  toast('Уведомление придёт через 5 секунд');
}

/* ---------- sync (GitHub contents API) ---------- */
function merge(a, b) {
  const out = { v: Math.max(a.v || 0, b.v || 0, VERSION) };
  COLLECTIONS.forEach(c => {
    const x = a[c] || {}, y = b[c] || {}, r = {};
    new Set([...Object.keys(x), ...Object.keys(y)]).forEach(k => {
      const p = x[k], q = y[k]; r[k] = !p ? q : !q ? p : ((q.u || 0) > (p.u || 0) ? q : p);
    });
    out[c] = r;
  });
  return out;
}
function b64enc(str) { const bytes = new TextEncoder().encode(str); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); }
function b64dec(b64) { const bin = atob(b64.replace(/\s/g, '')); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new TextDecoder().decode(u); }
const syncReady = () => CFG.owner && CFG.repo && CFG.token;
function setDot(cls) { $('#syncDot').className = cls || ''; }
let syncTimer = null, syncing = false, syncAgain = false;
function scheduleSync() { if (!syncReady()) return; clearTimeout(syncTimer); syncTimer = setTimeout(sync, 2500); }
async function sync(manual) {
  if (!syncReady()) { if (manual) toast('Сначала введите ключ доступа'); return; }
  if (syncing) { syncAgain = true; return; }
  syncing = true; setDot('busy');
  const url = `https://api.github.com/repos/${encodeURIComponent(CFG.owner)}/${encodeURIComponent(CFG.repo)}/contents/data.json`;
  const headers = { Authorization: `Bearer ${CFG.token}`, Accept: 'application/vnd.github+json' };
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const g = await fetch(url + '?t=' + now(), { headers, cache: 'no-store' });
      let sha, remote = null;
      if (g.status === 200) { const j = await g.json(); sha = j.sha; remote = JSON.parse(b64dec(j.content)); }
      else if (g.status === 401) throw new Error('ключ неверный или истёк — создайте новый');
      else if (g.status !== 404) throw new Error('GitHub ответил ' + g.status);
      if (remote && (remote.v || 1) < VERSION) remote = { ...remote, v: VERSION,
        days: Object.fromEntries(Object.entries(remote.days || {}).filter(([, d]) => d && d.note).map(([k, d]) => [k, { u: d.u || 0, note: d.note, marks: {}, habits: {} }])) };
      const merged = remote ? merge(S, remote) : S;
      { const keep = S; S = merged; dedupeGoals(); S = keep; }
      const body = JSON.stringify(merged);
      S = merged; persist(true);
      if (remote && JSON.stringify(remote) === body) break;
      const p = await fetch(url, { method: 'PUT', headers, body: JSON.stringify({
        message: 'sync ' + new Date().toISOString(), content: b64enc(body), ...(sha ? { sha } : {}) }) });
      if (p.ok) break;
      if (p.status === 409 || p.status === 422) continue;
      if (p.status === 404) throw new Error(`нет доступа к ${CFG.owner}/${CFG.repo} — проверьте название и ключ`);
      if (p.status === 403) throw new Error('у ключа нет права Contents: Read and write');
      throw new Error('GitHub ответил ' + p.status);
    }
    CFG.lastSync = now(); CFG.lastErr = ''; saveCfg(); setDot('ok');
    if (manual) toast('Синхронизировано');
    if ($('#dlg').classList.contains('hidden') && !recOn && !document.activeElement?.matches('input,textarea')) render();
  } catch (e) {
    CFG.lastErr = e.message; saveCfg(); setDot('err');
    if (manual) toast('Ошибка: ' + e.message);
  } finally { syncing = false; if (syncAgain) { syncAgain = false; scheduleSync(); } }
}

/* ---------- sheet ---------- */
function openSheet(html, mount) { $('#sheet').innerHTML = '<div class="grab"></div>' + html; $('#dlg').classList.remove('hidden'); mount && mount($('#sheet')); }
function closeSheet() { $('#dlg').classList.add('hidden'); $('#sheet').innerHTML = ''; }
$('#dlg').addEventListener('click', e => { if (e.target.id === 'dlg') closeSheet(); });
const catPicker = sel => `<div class="catpick" id="catpick">${Object.entries(CATS).map(([k, v]) =>
  `<button type="button" data-cat="${k}" class="${k === sel ? 'on' : ''}"><i class="ti ${v.i}" style="color:${v.c}"></i>${v.n}</button>`).join('')}</div>`;
function bindCatPicker(root) { root.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => {
  root.querySelectorAll('[data-cat]').forEach(x => x.classList.toggle('on', x === b)); }); }
const pickedCat = root => root.querySelector('[data-cat].on')?.dataset.cat || 'home';
const habitOptions = sel => `<option value="">— не связан —</option>` + habitsList().map(([id, h]) =>
  `<option value="${id}" ${id === sel ? 'selected' : ''}>${esc(h.name)}</option>`).join('');

/* ---------- router ---------- */
let VIEW = 'today', viewDate = new Date(), planDay = dayCode(new Date()), statWeek = 0, diaryQ = '';
const TITLES = { books: 'Книги', book: 'Книга', today: 'Сегодня', plan: 'Неделя', stats: 'Статистика', goals: 'Цели', diary: 'Дневник', settings: 'Настройки' };
function go(v) {
  stopDictation(); VIEW = v; if (v === 'today') viewDate = new Date();
  $$('#nav button').forEach(x => x.classList.toggle('on', x.dataset.v === v));
  render(); window.scrollTo(0, 0);
}
$('#nav').addEventListener('click', e => { const b = e.target.closest('button'); if (b) go(b.dataset.v); });
$('#gear').onclick = () => go('settings');
function render() {
  $('#title').textContent = TITLES[VIEW]; $('#sub').textContent = '';
  ({ today: renderToday, plan: renderPlan, stats: renderStats, goals: renderGoals, books: renderBooks, book: renderBook, diary: renderDiary, settings: renderSettings })[VIEW]();
}

/* ---------- TODAY ---------- */
function ringSvg(p, color, size = 54, w = 6) {
  const r = (size - w) / 2, c = 2 * Math.PI * r;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--card2)" stroke-width="${w}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.min(1, p))}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
}
function renderToday() {
  if (recOn) stopDictation();
  const k = dkey(viewDate), isToday = k === dkey(new Date()), d = day(k);
  const blocks = blocksFor(k), m = nowMin();
  const cur = isToday ? blocks.find(b => isCurrent(b, m)) : null;
  const curIdx = cur ? blocks.indexOf(cur) : -1, next = curIdx >= 0 ? blocks[curIdx + 1] : null;
  const checkable = blocks.filter(b => b.cat !== 'sleep');
  const done = checkable.filter(b => d.marks?.[b.id]).length;
  const habits = habitsList(), hDone = habits.filter(([id]) => habitDone(k, id)).length;
  const overridden = !!d.blocks;
  $('#title').textContent = isToday ? 'Сегодня' : (k < dkey(new Date()) ? 'Прошедший день' : 'План дня');
  $('#sub').textContent = shortDate(viewDate);

  let nowCard = '';
  if (cur) {
    const s = toMin(cur.start), e = toMin(cur.end); let len = e - s; if (len <= 0) len += 1440;
    let passed = m - s; if (passed < 0) passed += 1440; const left = len - passed, c = catOf(cur);
    nowCard = `<div class="now" style="background:${c.c}">
      <i class="ti ${c.i} bg"></i>
      <div class="k">Сейчас · ${cur.start}–${cur.end} · ${fmtShort(len)}</div><div class="tt">${esc(cur.title)}</div>
      <div class="bar"><div style="width:${Math.round(passed / len * 100)}%"></div></div>
      <div class="row" style="font-size:13px;font-weight:600"><span class="grow">Осталось ${fmtH(left)}</span>${next ? `<span style="opacity:.85">Дальше: ${esc(next.title)}</span>` : ''}</div>
    </div>`;
  }

  $('#view').innerHTML = `
  <div class="row" style="margin:6px 0 14px">
    <div class="ring">${ringSvg(checkable.length ? done / checkable.length : 0, 'var(--ok)')}<b>${checkable.length ? Math.round(done / checkable.length * 100) : 0}%</b></div>
    <div class="grow"><div style="font-weight:800">${done} из ${checkable.length} дел</div><div class="mute">привычки: ${hDone} из ${habits.length}</div></div>
    <button class="iconbtn" id="prevD" aria-label="Предыдущий день"><i class="ti ti-chevron-left"></i></button>
    <button class="iconbtn" id="nextD" aria-label="Следующий день"><i class="ti ti-chevron-right"></i></button>
  </div>
  ${!isToday ? `<div class="banner"><i class="ti ti-calendar"></i><span class="grow">${esc(shortDate(viewDate))}</span><button class="link" id="toToday">К сегодня</button></div>` : ''}
  ${nowCard}
  ${overridden ? `<div class="banner"><i class="ti ti-pencil"></i><span class="grow">План этого дня изменён только для него</span><button class="link" id="resetDay">Вернуть</button></div>` : ''}
  <div class="tl">
    ${blocks.map(b => {
      const mk = !!d.marks?.[b.id], c = catOf(b), past = isToday && !isCurrent(b, m) && sortKey(b.end) <= (m < 300 ? m + 1440 : m) && b.cat !== 'sleep';
      const hn = b.h && S.habits[b.h] && !S.habits[b.h].deleted ? S.habits[b.h].name : '';
      return `<div class="blk ${b === cur ? 'cur' : ''} ${mk ? 'done' : ''} ${past && !mk ? 'past' : ''}">
        <div class="tm">${b.start}<small>${b.end}</small></div>
        ${icon(b.cat)}
        <div class="body" data-open="${b.id}">
          <div class="ttl">${esc(b.title)}</div>
          <div class="meta"><span style="font-weight:700;color:var(--ink2)">${fmtShort(blockLen(b))}</span>${NATIVE && CFG.notif.on && blockNotify(b) ? ' <i class="ti ti-bell"></i>' : ''}${b.note ? ' <i class="ti ti-notes"></i>' : ''}${hn ? ` <span class="tag" style="background:color-mix(in srgb,${c.c} 13%,transparent);color:${c.c}"><i class="ti ti-repeat"></i>${esc(hn)}</span>` : ''}</div>
          ${b.note ? `<div class="note hidden" id="n-${b.id}">${esc(b.note)}</div>` : ''}
          ${b.cat === 'reading' ? readingLine() : ''}
        </div>
        ${b.cat !== 'sleep' || b.h ? `<button class="chk ${mk ? 'on' : ''}" data-mark="${b.id}" aria-label="Отметить"><i class="ti ti-check"></i></button>` : '<span style="width:32px"></span>'}
      </div>`; }).join('')}
  </div>
  <div class="row" style="margin-top:10px;gap:8px">
    <button class="btn2 acc" id="addBlock"><i class="ti ti-plus"></i> Добавить в этот день</button>
    <span class="grow"></span>
    <button class="link" id="toPlan">План на ${DAY_ACC[dayCode(viewDate)]} →</button>
  </div>

  <div class="sec"><h2>Привычки дня</h2><span class="mute">${hDone}/${habits.length}</span></div>
  <div class="chips">${habits.map(([id, h]) => { const on = habitDone(k, id), c = CATS[h.cat] || CATS.home;
    return `<div class="chip ${on ? 'on' : ''}" data-hab="${id}"><i class="ti ${on ? 'ti-circle-check' : c.i}" style="${on ? '' : 'color:' + c.c}"></i>${esc(h.name)}</div>`; }).join('')}</div>
  <div class="mute" style="margin:8px 2px 0">Галочка в расписании сама отмечает связанную привычку.</div>

  <div class="sec"><h2>Как прошёл день?</h2><button class="link" id="toDiary">Весь дневник →</button></div>
  <div class="card">
    <textarea id="dayNote" style="min-height:110px;background:var(--card2)" placeholder="Что получилось, что мешало, за что благодарен…">${esc(d.note || '')}</textarea>
    <div class="row" style="margin-top:10px"><button class="btn" id="micBtn"><i class="ti ti-microphone"></i> Надиктовать</button>
      <span class="mute grow" id="micState"></span></div>
  </div>`;

  $('#prevD').onclick = () => { viewDate = addDays(viewDate, -1); render(); };
  $('#nextD').onclick = () => { viewDate = addDays(viewDate, 1); render(); };
  $('#toToday') && ($('#toToday').onclick = () => { viewDate = new Date(); render(); });
  $('#resetDay') && ($('#resetDay').onclick = () => { setDay(k, x => { delete x.blocks; }); render(); toast('Возвращён план недели'); });
  $$('[data-mark]').forEach(el => el.onclick = () => setDay(k, x => {
    const id = el.dataset.mark; if (x.marks[id]) delete x.marks[id]; else x.marks[id] = true;
    const b = blocks.find(b => b.id === id); if (b?.h && x.habits[b.h] === false && x.marks[id]) delete x.habits[b.h];
    render(); }));
  $$('[data-open]').forEach(el => el.onclick = () => { const n = $('#n-' + el.dataset.open);
    if (n && n.classList.contains('hidden')) { n.classList.remove('hidden'); return; } editBlock('day', k, el.dataset.open); });
  $$('[data-hab]').forEach(el => el.onclick = () => setDay(k, x => { const id = el.dataset.hab;
    x.habits[id] = !habitDone(k, id); render(); }));
  $('#addBlock').onclick = () => editBlock('day', k, null);
  $('#toPlan').onclick = () => { planDay = dayCode(viewDate); go('plan'); };
  $('#toDiary').onclick = () => go('diary');
  $$('[data-book]').forEach(el => el.onclick = e => { e.stopPropagation(); openBook(el.dataset.book); });
  const note = $('#dayNote'); let nt;
  note.oninput = () => { clearTimeout(nt); nt = setTimeout(() => setDay(k, x => { x.note = note.value; }), 600); };
  $('#micBtn').onclick = () => toggleDictation(note, $('#micBtn'), $('#micState'));
}

/* ---------- block editor (day override or weekly plan) ---------- */
function editBlock(scope, key, id) {
  const src = scope === 'day' ? blocksFor(key) : planBlocks(key);
  const b = id ? src.find(x => x.id === id) : { start: '10:00', end: '11:00', title: '', cat: 'home', h: '', note: '' };
  if (!b) return;
  const dn = scope === 'day' ? null : DAYS.find(x => x[0] === key)[2];
  openSheet(`<h3>${id ? 'Дело' : 'Новое дело'}</h3>
    <div class="mute" style="margin-top:2px">${scope === 'day' ? 'Изменится только ' + esc(shortDate(parseKey(key)).toLowerCase()) + '. План недели не меняется.' : 'Изменится каждый ' + esc(dn.toLowerCase()) + ' (если день не изменён отдельно).'}</div>
    <div class="row"><div class="grow"><label class="l">Начало</label><input type="time" id="bs" value="${b.start}"></div>
    <div class="grow"><label class="l">Конец</label><input type="time" id="be" value="${b.end}"></div></div>
    <label class="l">Название</label><input id="bt" value="${esc(b.title)}" placeholder="Например: Английский — грамматика">
    <label class="l">Сфера</label>${catPicker(b.cat)}
    <label class="row chip" style="margin-top:14px;box-shadow:none;background:var(--card2)"><input type="checkbox" id="bnot" style="width:auto" ${blockNotify(b) ? 'checked' : ''}><i class="ti ti-bell"></i><span class="grow">Напоминание в начале</span></label>
    <label class="l">Галочка засчитывается в привычку</label><select id="bh">${habitOptions(b.h)}</select>
    <label class="l">Что именно делать</label><textarea id="bn" placeholder="Упражнения, книга, тема…">${esc(b.note || '')}</textarea>
    <div class="row" style="margin-top:16px">${id ? '<button class="btn2 danger" id="bdel"><i class="ti ti-trash"></i> Удалить</button>' : ''}<span class="grow"></span>
    <button class="btn2" id="bx">Отмена</button><button class="btn" id="bok">Сохранить</button></div>`, root => {
    bindCatPicker(root);
    $('#bx').onclick = closeSheet;
    const apply = fn => {
      if (scope === 'day') setDay(key, x => { x.blocks = structuredClone(x.blocks || planBlocks(dayCode(parseKey(key)))); x.blocks = fn(x.blocks); });
      else { S.plan[key] = { u: now(), blocks: fn(structuredClone(planBlocks(key))) }; persist(); }
      closeSheet(); render();
    };
    $('#bdel') && ($('#bdel').onclick = () => apply(list => list.filter(x => x.id !== id)));
    $('#bok').onclick = () => {
      if (!$('#bt').value.trim()) return toast('Введите название');
      const nb = { id: id || uid(), start: $('#bs').value, end: $('#be').value, title: $('#bt').value.trim(), cat: pickedCat(root), h: $('#bh').value, note: $('#bn').value.trim(), n: $('#bnot').checked };
      apply(list => id ? list.map(x => x.id === id ? nb : x) : [...list, nb]);
    };
  });
}

/* ---------- WEEK PLAN ---------- */
function renderPlan() {
  const today = dayCode(new Date()), blocks = [...planBlocks(planDay)].sort((a, b) => sortKey(a.start) - sortKey(b.start));
  const dn = DAYS.find(x => x[0] === planDay);
  const totals = {}; blocks.forEach(b => { let l = toMin(b.end) - toMin(b.start); if (l <= 0) l += 1440; totals[b.cat] = (totals[b.cat] || 0) + l; });
  $('#sub').textContent = 'Свой план на каждый день недели';
  $('#view').innerHTML = `
  <div class="days">${DAYS.map(([c, s]) => `<button data-d="${c}" class="${c === planDay ? 'on' : ''} ${c === today ? 'today' : ''}">${s}<small>${c === today ? 'сегодня' : '&nbsp;'}</small></button>`).join('')}</div>
  <div class="chips" style="margin-bottom:12px">${Object.entries(totals).filter(([c]) => c !== 'sleep').sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c, v]) =>
    `<span class="tag" style="background:color-mix(in srgb,${CATS[c].c} 13%,transparent);color:${CATS[c].c};font-size:12px;padding:5px 9px"><i class="ti ${CATS[c].i}"></i>${CATS[c].n} ${fmtH(v)}</span>`).join('')}</div>
  <div class="tl">${blocks.map(b => `<div class="blk" data-pe="${b.id}" style="cursor:pointer">
      <div class="tm">${b.start}<small>${b.end}</small></div>${icon(b.cat)}
      <div class="body"><div class="ttl">${esc(b.title)}</div><div class="meta"><b style="color:var(--ink2)">${fmtShort(blockLen(b))}</b>${blockNotify(b) ? ' <i class="ti ti-bell"></i>' : ''}${b.note ? ' · ' + esc(b.note.split('\n')[0]).slice(0, 60) : ''}</div></div>
      <i class="ti ti-chevron-right" style="color:var(--mute)"></i></div>`).join('') || '<div class="mute" style="padding:14px">Пусто</div>'}</div>
  <div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap">
    <button class="btn2 acc" id="padd"><i class="ti ti-plus"></i> Добавить в ${dn[2].toLowerCase()}</button>
    <button class="btn2" id="pcopy"><i class="ti ti-copy"></i> Скопировать в другие дни</button>
  </div>
  <div class="mute" style="margin:12px 2px">Правки здесь меняют все будущие ${DAY_ACC[planDay]}. Чтобы поменять только один день — нажмите на дело во вкладке «Сегодня».</div>`;
  $$('[data-d]').forEach(b => b.onclick = () => { planDay = b.dataset.d; render(); });
  $$('[data-pe]').forEach(b => b.onclick = () => editBlock('plan', planDay, b.dataset.pe));
  $('#padd').onclick = () => editBlock('plan', planDay, null);
  $('#pcopy').onclick = () => openSheet(`<h3>Скопировать ${dn[2].toLowerCase()}</h3><div class="mute">План выбранных дней заменится этим.</div>
    <div class="chips" style="margin:14px 0">${DAYS.filter(x => x[0] !== planDay).map(([c, , n]) => `<label class="chip"><input type="checkbox" value="${c}" style="width:auto"> ${n}</label>`).join('')}</div>
    <div class="row"><span class="grow"></span><button class="btn2" id="cx">Отмена</button><button class="btn" id="cok">Скопировать</button></div>`, root => {
    $('#cx').onclick = closeSheet;
    $('#cok').onclick = () => { const t = now(); let n = 0;
      root.querySelectorAll('input:checked').forEach(i => { S.plan[i.value] = { u: t, blocks: planBlocks(planDay).map(b => ({ ...b, id: uid() })) }; n++; });
      persist(); closeSheet(); render(); toast(n ? 'Скопировано' : 'Дни не выбраны'); };
  });
}

/* ---------- STATS ---------- */
function weightChart() {
  const pts = live(S.weights).map(([k, w]) => [parseKey(k).getTime(), w.kg]).sort((a, b) => a[0] - b[0]);
  if (pts.length < 2) return '<div class="mute">График появится после второго взвешивания.</div>';
  const W = 320, H = 130, P = 26, x0 = pts[0][0], x1 = pts[pts.length - 1][0];
  const ys = pts.map(p => p[1]).concat(80); const y0 = Math.min(...ys) - 1, y1 = Math.max(...ys) + 1;
  const X = t => P + (t - x0) / ((x1 - x0) || 1) * (W - P - 8), Y = v => 8 + (y1 - v) / (y1 - y0) * (H - 24);
  return `<svg viewBox="0 0 ${W} ${H}" width="100%">
    <line x1="${P}" x2="${W - 8}" y1="${Y(80)}" y2="${Y(80)}" stroke="var(--ok)" stroke-dasharray="4 4"/>
    <text x="${W - 8}" y="${Y(80) - 4}" text-anchor="end">цель 80</text>
    <polyline fill="none" stroke="var(--accent)" stroke-width="3" stroke-linejoin="round" points="${pts.map(p => X(p[0]) + ',' + Y(p[1])).join(' ')}"/>
    ${pts.map(p => `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="3.5" fill="var(--accent)"/>`).join('')}
    <text x="0" y="${Y(y1 - 1) + 4}">${Math.round(y1 - 1)}</text><text x="0" y="${Y(y0 + 1) + 4}">${Math.round(y0 + 1)}</text></svg>`;
}
function weekHabitCount(ws, hid, upTo) {
  let n = 0; for (let i = 0; i < 7; i++) { const d = addDays(ws, i); if (dkey(d) > upTo) break; if (habitDone(dkey(d), hid)) n++; } return n;
}
function renderStats() {
  const ws = addDays(weekStart(new Date()), statWeek * 7), todayK = dkey(new Date()), days = [...Array(7)].map((_, i) => addDays(ws, i));
  const habits = habitsList();
  let sumT = 0, sumD = 0, bAll = 0, bDone = 0;
  habits.forEach(([id, h]) => { sumT += h.target || 7; sumD += Math.min(h.target || 7, weekHabitCount(ws, id, todayK)); });
  days.filter(d => dkey(d) <= todayK).forEach(d => { const k = dkey(d), bl = blocksFor(k).filter(b => b.cat !== 'sleep'), dd = day(k);
    bAll += bl.length; bDone += bl.filter(b => dd.marks?.[b.id]).length; });
  const ws2 = live(S.weights).sort((a, b) => a[0] < b[0] ? 1 : -1), last = ws2[0]?.[1].kg, first = ws2[ws2.length - 1]?.[1].kg;
  const label = `${ws.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} – ${addDays(ws, 6).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`;
  const rv = S.reviews['w-' + dkey(ws)] || {};
  const weeks = [3, 2, 1, 0].map(i => addDays(weekStart(new Date()), -7 * i));
  $('#sub').textContent = statWeek === 0 ? 'Эта неделя' : label;
  $('#view').innerHTML = `
  <div class="row" style="margin:4px 0 12px"><button class="iconbtn" id="pw"><i class="ti ti-chevron-left"></i></button>
    <div class="grow" style="text-align:center;font-weight:800">${label}</div><button class="iconbtn" id="nw"><i class="ti ti-chevron-right"></i></button></div>
  <div class="metrics">
    <div class="metric"><div class="v">${sumT ? Math.round(sumD / sumT * 100) : 0}%</div><div class="n">привычки недели</div></div>
    <div class="metric"><div class="v">${bAll ? Math.round(bDone / bAll * 100) : 0}%</div><div class="n">дел по плану</div></div>
    <div class="metric" id="wTile" style="cursor:pointer"><div class="v">${last ?? '—'}</div><div class="n">вес, кг${first && last && last !== first ? ` · ${(last - first > 0 ? '+' : '')}${(last - first).toFixed(1)}` : ''}</div></div>
  </div>
  <div class="sec"><h2>Привычки</h2><span class="mute">сделано / цель</span></div>
  <div class="tiles">${habits.map(([id, h]) => { const c = CATS[h.cat] || CATS.home, n = weekHabitCount(ws, id, todayK), t = h.target || 7, okk = n >= t;
    return `<div class="tile" data-ht="${id}">
      <div class="row">${icon(h.cat, 34)}${okk ? '<i class="ti ti-trophy" style="margin-left:auto;color:var(--warn);font-size:20px"></i>' : ''}</div>
      <div class="v">${n}<small> / ${t}</small></div><div class="n">${esc(h.name)}</div>
      <div class="pbar"><div style="width:${Math.min(100, n / t * 100)}%;background:${c.c}"></div></div>
      <div class="dots">${days.map(d => `<i style="${habitDone(dkey(d), id) ? 'background:' + c.c : ''}"></i>`).join('')}</div>
    </div>`; }).join('')}</div>
  <div class="sec"><h2>Последние 4 недели</h2></div>
  <div class="card"><div class="heat" style="grid-template-columns:minmax(0,1.6fr) repeat(4,1fr)">
    <span></span>${weeks.map(w => `<span class="mute" style="text-align:center;font-size:11px">${w.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>`).join('')}
    ${habits.map(([id, h]) => { const c = CATS[h.cat] || CATS.home, t = h.target || 7;
      return `<span style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(h.name)}</span>` + weeks.map(w => {
        const n = weekHabitCount(w, id, todayK), p = Math.min(1, n / t);
        return `<span class="c" style="background:color-mix(in srgb,${c.c} ${Math.round(12 + p * 88)}%,var(--card2));${p < .5 ? 'color:var(--ink2)' : ''}">${n}/${t}</span>`; }).join(''); }).join('')}
  </div></div>
  <div class="sec"><h2>Вес</h2><button class="link" id="wAdd"><i class="ti ti-plus"></i> Записать вес</button></div>
  <div class="card">${weightChart()}${last ? `<div class="mute" style="margin-top:6px">Сейчас ${last} кг · до цели ${(last - 80).toFixed(1)} кг</div>` : ''}</div>
  <div class="sec"><h2>Разбор недели</h2></div>
  <div class="card">
    <label class="l" style="margin-top:0">Что получилось хорошо?</label><textarea id="r1">${esc(rv.good || '')}</textarea>
    <label class="l">Что не получилось и почему?</label><textarea id="r2">${esc(rv.bad || '')}</textarea>
    <label class="l">Что меняю на следующей неделе?</label><textarea id="r3">${esc(rv.change || '')}</textarea>
    <div class="row" style="margin-top:12px"><span class="grow mute">${rv.u ? 'Сохранено' : ''}</span><button class="btn" id="rs">Сохранить</button></div></div>`;
  $('#pw').onclick = () => { statWeek--; render(); };
  $('#nw').onclick = () => { statWeek++; render(); };
  const addW = () => openSheet(`<h3>Записать вес</h3><label class="l">Вес, кг</label><input type="number" step="0.1" inputmode="decimal" id="wkg" value="${last ?? ''}">
    <label class="l">Дата</label><input type="date" id="wd" value="${todayK}">
    <div class="row" style="margin-top:16px"><span class="grow"></span><button class="btn2" id="wx">Отмена</button><button class="btn" id="wok">Сохранить</button></div>`, () => {
    $('#wx').onclick = closeSheet;
    $('#wok').onclick = () => { const v = parseFloat(String($('#wkg').value).replace(',', '.')); if (!(v > 30 && v < 250)) return toast('Введите вес в кг');
      S.weights[$('#wd').value || todayK] = { u: now(), kg: v }; persist(); closeSheet(); render(); toast('Вес записан'); };
  });
  $('#wAdd').onclick = addW; $('#wTile').onclick = addW;
  $$('[data-ht]').forEach(t => t.onclick = () => editHabit(t.dataset.ht));
  $('#rs').onclick = () => { S.reviews['w-' + dkey(ws)] = { u: now(), good: $('#r1').value, bad: $('#r2').value, change: $('#r3').value };
    persist(); toast('Разбор сохранён'); render(); };
}
function editHabit(id) {
  const h = id ? S.habits[id] : { name: '', cat: 'home', target: 7 };
  openSheet(`<h3>${id ? 'Привычка' : 'Новая привычка'}</h3>
    <label class="l">Название</label><input id="hn" value="${esc(h.name)}" placeholder="Например: 10 000 шагов">
    <label class="l">Цель: раз в неделю</label>
    <div class="days" id="ht">${[1, 2, 3, 4, 5, 6, 7].map(n => `<button type="button" data-n="${n}" class="${n === (h.target || 7) ? 'on' : ''}">${n}</button>`).join('')}</div>
    <label class="l">Сфера и иконка</label>${catPicker(h.cat)}
    <div class="row" style="margin-top:16px">${id ? '<button class="btn2 danger" id="hdel"><i class="ti ti-trash"></i> Удалить</button>' : ''}<span class="grow"></span>
    <button class="btn2" id="hx">Отмена</button><button class="btn" id="hok">Сохранить</button></div>`, root => {
    bindCatPicker(root);
    root.querySelectorAll('[data-n]').forEach(b => b.onclick = () => root.querySelectorAll('[data-n]').forEach(x => x.classList.toggle('on', x === b)));
    $('#hx').onclick = closeSheet;
    $('#hdel') && ($('#hdel').onclick = () => { S.habits[id] = { u: now(), deleted: true }; persist(); closeSheet(); render(); });
    $('#hok').onclick = () => { if (!$('#hn').value.trim()) return toast('Введите название');
      S.habits[id || uid()] = { u: now(), name: $('#hn').value.trim(), cat: pickedCat(root), target: +(root.querySelector('[data-n].on')?.dataset.n || 7),
        order: h.order ?? (Math.max(0, ...habitsList().map(([, x]) => x.order ?? 0)) + 1) };
      persist(); closeSheet(); render(); };
  });
}

/* ---------- GOALS ---------- */
function renderGoals() {
  const goals = live(S.goals).sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0));
  const allSteps = goals.reduce((a, [, g]) => a + (g.steps || []).length, 0), doneSteps = goals.reduce((a, [, g]) => a + (g.steps || []).filter(s => s.done).length, 0);
  $('#sub').textContent = `${goals.length} целей · шагов сделано ${doneSteps} из ${allSteps}`;
  $('#view').innerHTML = goals.map(([id, g]) => { const st = g.steps || [], dn = st.filter(s => s.done).length, c = CATS[g.cat] || CATS.growth;
    return `<div class="card goal">
      <div class="h">${icon(g.cat || 'growth', 42)}<div class="grow"><div class="t">${esc(g.title)}</div>${g.why ? `<div class="mute">${esc(g.why)}</div>` : ''}</div>
        <button class="iconbtn" style="width:34px;height:34px;font-size:17px;box-shadow:none;background:var(--card2)" data-ge="${id}"><i class="ti ti-pencil"></i></button></div>
      ${g.metric ? `<div style="margin:12px 0 4px;font-size:14px"><i class="ti ti-flag-3" style="color:${c.c}"></i> <b>${esc(g.metric)}</b></div>` : ''}
      <div class="row" style="margin-top:8px"><div class="pbar grow" style="margin:0"><div style="width:${st.length ? dn / st.length * 100 : 0}%;background:${c.c}"></div></div><span class="mute">${dn}/${st.length}</span></div>
      <div style="margin-top:6px">${st.map(s => `<div class="step ${s.done ? 'done' : ''}"><button class="chk ${s.done ? 'on' : ''}" data-gs="${id}|${s.id}"><i class="ti ti-check"></i></button><span>${esc(s.t)}</span></div>`).join('')}</div>
      <div class="row" style="margin-top:6px"><input placeholder="Новый шаг…" data-gn="${id}" style="padding:8px 10px"><button class="btn2 acc" data-ga="${id}"><i class="ti ti-plus"></i></button></div>
    </div>`; }).join('') + `<button class="btn" id="gadd" style="width:100%"><i class="ti ti-plus"></i> Новая цель</button>`;
  $('#gadd').onclick = () => editGoal(null);
  $$('[data-ge]').forEach(b => b.onclick = () => editGoal(b.dataset.ge));
  $$('[data-gs]').forEach(b => b.onclick = () => { const [gid, sid] = b.dataset.gs.split('|'); const g = structuredClone(S.goals[gid]);
    const s = g.steps.find(x => x.id === sid); s.done = !s.done; g.u = now(); S.goals[gid] = g; persist(); render(); });
  const addStep = gid => { const inp = $(`[data-gn="${gid}"]`), t = inp.value.trim(); if (!t) return;
    const g = structuredClone(S.goals[gid]); g.steps = [...(g.steps || []), { id: uid(), t, done: false }]; g.u = now(); S.goals[gid] = g; persist(); render(); };
  $$('[data-ga]').forEach(b => b.onclick = () => addStep(b.dataset.ga));
  $$('[data-gn]').forEach(i => i.onkeydown = e => { if (e.key === 'Enter') addStep(i.dataset.gn); });
}
function editGoal(id) {
  const g = id ? S.goals[id] : { title: '', why: '', metric: '', cat: 'growth', steps: [] };
  openSheet(`<h3>${id ? 'Цель' : 'Новая цель'}</h3>
    <label class="l">Цель</label><input id="gt" value="${esc(g.title)}" placeholder="Например: Купить пианино и выучить 3 пьесы">
    <label class="l">Зачем мне это</label><input id="gw" value="${esc(g.why)}">
    <label class="l">Измеримый результат и срок</label><input id="gm" value="${esc(g.metric)}" placeholder="Что будет сделано и к какой дате">
    <label class="l">Сфера</label>${catPicker(g.cat || 'growth')}
    <label class="l">Шаги (каждый с новой строки)</label><textarea id="gs" style="min-height:120px">${esc((g.steps || []).map(s => s.t).join('\n'))}</textarea>
    <div class="row" style="margin-top:16px">${id ? '<button class="btn2 danger" id="gdel"><i class="ti ti-trash"></i> Удалить</button>' : ''}<span class="grow"></span>
    <button class="btn2" id="gx">Отмена</button><button class="btn" id="gok">Сохранить</button></div>`, root => {
    bindCatPicker(root); $('#gx').onclick = closeSheet;
    $('#gdel') && ($('#gdel').onclick = () => { S.goals[id] = { u: now(), deleted: true }; persist(); closeSheet(); render(); });
    $('#gok').onclick = () => {
      if (!$('#gt').value.trim()) return toast('Введите цель');
      const old = g.steps || [];
      const steps = $('#gs').value.split('\n').map(x => x.trim()).filter(Boolean).map(t => old.find(s => s.t === t) || { id: uid(), t, done: false });
      S.goals[id || uid()] = { u: now(), order: g.order ?? live(S.goals).length, cat: pickedCat(root), title: $('#gt').value.trim(),
        why: $('#gw').value.trim(), metric: $('#gm').value.trim(), steps };
      persist(); closeSheet(); render();
    };
  });
}

/* ---------- voice dictation ---------- */
let REC = null, recOn = false;
function stopDictation() { const was = recOn; recOn = false; try { REC && REC.stop(); } catch {} if (was && nativeSR) { nativeSR.stop(); nativeSR = null; } }
let nativeSR = null;
async function nativeDictation(ta, btn, state) {
  const SRp = window.Capacitor.Plugins.SpeechRecognition;
  if (recOn) { stopDictation(); try { await SRp.stop(); } catch {} return; }
  try { const p = await SRp.requestPermissions(); if (p.speechRecognition !== 'granted') return toast('Разрешите доступ к микрофону'); } catch {}
  let committed = ta.value; if (committed && !/\n$/.test(committed)) committed += '\n';
  let current = '';
  const save = () => ta.dispatchEvent(new Event('input'));
  const commit = () => { const t = current.trim(); current = ''; if (!t) return;
    const sep = !committed || /\n$/.test(committed) ? '' : /[.!?]\s*$/.test(committed) ? ' ' : '. ';
    committed += sep + cap(t); ta.value = committed; save(); };
  const finish = () => { commit(); recOn = false; btn.innerHTML = '<i class="ti ti-microphone"></i> Надиктовать'; btn.style.background = ''; state.textContent = ''; SRp.removeAllListeners(); };
  await SRp.removeAllListeners();
  SRp.addListener('partialResults', d => { current = (d.matches && d.matches[0]) || ''; ta.value = committed + (committed && !/\n$/.test(committed) ? ' ' : '') + current; ta.scrollTop = ta.scrollHeight; });
  SRp.addListener('listeningState', d => { if (d.status !== 'stopped') return; commit();
    if (recOn) setTimeout(() => { if (recOn) SRp.start({ language: 'ru-RU', partialResults: true, popup: false }).catch(finish); }, 250); else finish(); });
  recOn = true; btn.innerHTML = '<i class="ti ti-player-stop"></i> Остановить'; btn.style.background = 'var(--danger)'; state.textContent = 'Говорите…';
  nativeSR = { stop: () => SRp.stop().catch(() => {}).finally(finish) };
  SRp.start({ language: 'ru-RU', partialResults: true, popup: false }).catch(() => { finish(); toast('Распознавание речи недоступно'); });
}
function toggleDictation(ta, btn, state) {
  if (NATIVE && window.Capacitor.Plugins.SpeechRecognition) return nativeDictation(ta, btn, state);
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('Этот браузер не распознаёт речь. Откройте в Chrome или нажмите 🎤 на клавиатуре'); return; }
  if (recOn) { stopDictation(); return; }
  const android = /Android/i.test(navigator.userAgent);
  let committed = ta.value;
  const save = () => ta.dispatchEvent(new Event('input'));
  const startOne = () => {
    REC = new SR(); REC.lang = 'ru-RU'; REC.interimResults = true; REC.continuous = !android;
    REC.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript.trim(); if (!t) continue;
        if (e.results[i].isFinal) {
          const sep = !committed || /\n$/.test(committed) ? '' : /[.!?]\s*$/.test(committed) ? ' ' : '. ';
          committed += sep + cap(t);
        } else interim += t + ' ';
      }
      ta.value = committed + (interim ? (committed ? ' ' : '') + interim : '');
      ta.scrollTop = ta.scrollHeight; save();
    };
    REC.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { recOn = false; toast('Разрешите доступ к микрофону'); }
      else if (e.error === 'network') { recOn = false; toast('Для распознавания нужен интернет'); }
    };
    REC.onend = () => {
      if (recOn) { try { startOne(); return; } catch {} }
      recOn = false; ta.value = committed; save();
      btn.innerHTML = '<i class="ti ti-microphone"></i> Надиктовать'; btn.style.background = ''; state.textContent = '';
    };
    REC.start();
  };
  if (committed && !/\n$/.test(committed)) committed += '\n';
  recOn = true; btn.innerHTML = '<i class="ti ti-player-stop"></i> Остановить'; btn.style.background = 'var(--danger)';
  state.textContent = 'Говорите…';
  try { startOne(); } catch { recOn = false; toast('Не удалось включить микрофон'); }
}

/* ---------- DIARY ---------- */
function diaryEntries() { return Object.entries(S.days).filter(([, d]) => d && (d.note || '').trim()).sort((a, b) => a[0] < b[0] ? 1 : -1); }
function renderDiary() {
  const all = diaryEntries(), q = diaryQ.toLowerCase();
  const list = q ? all.filter(([k, d]) => d.note.toLowerCase().includes(q) || longDate(k).toLowerCase().includes(q)) : all;
  $('#sub').textContent = `Записей: ${all.length}`;
  $('#view').innerHTML = `
  <button class="btn" id="dToday" style="width:100%;margin:4px 0 12px"><i class="ti ti-microphone"></i> Записать сегодняшний день</button>
  <input id="dSearch" placeholder="Поиск по дневнику…" value="${esc(diaryQ)}" style="margin-bottom:12px;background:var(--card)">
  ${list.map(([k, d]) => `<div class="card" data-open="${k}" style="cursor:pointer">
      <div class="row"><span class="tag" style="background:var(--accent-soft);color:var(--accent);font-size:12px;padding:4px 9px"><i class="ti ti-calendar"></i>${esc(longDate(k))}</span></div>
      <div style="white-space:pre-wrap;margin-top:10px;font-size:15px;line-height:1.6">${esc(d.note)}</div></div>`).join('')
    || '<div class="card mute">Пока записей нет. Вечером нажмите «Надиктовать» на вкладке «Сегодня».</div>'}
  <div class="sec"><h2>Скачать дневник</h2></div>
  <div class="row" style="flex-wrap:wrap;gap:8px"><button class="btn2" data-dl="docx"><i class="ti ti-file-word"></i> Word</button>
    <button class="btn2" data-dl="txt"><i class="ti ti-file-text"></i> Текст</button><button class="btn2" data-dl="md"><i class="ti ti-markdown"></i> Markdown</button>
    <button class="btn2" id="dCopy"><i class="ti ti-copy"></i> Скопировать</button></div>`;
  $('#dToday').onclick = () => { go('today'); setTimeout(() => { $('#dayNote')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); $('#micBtn')?.click(); }, 80); };
  const si = $('#dSearch'); si.oninput = () => { diaryQ = si.value; const p = si.selectionStart; render(); const n = $('#dSearch'); n.focus(); n.setSelectionRange(p, p); };
  $$('[data-open]').forEach(b => b.onclick = () => { VIEW = 'today'; $$('#nav button').forEach(x => x.classList.toggle('on', x.dataset.v === 'today'));
    viewDate = parseKey(b.dataset.open); render(); setTimeout(() => $('#dayNote')?.scrollIntoView({ block: 'center' }), 50); });
  $$('[data-dl]').forEach(b => b.onclick = () => downloadDiary(b.dataset.dl));
  $('#dCopy').onclick = async () => { try { await navigator.clipboard.writeText(diaryText('txt')); toast('Дневник скопирован'); } catch { toast('Не удалось скопировать'); } };
}
function diaryText(fmt) {
  const e = diaryEntries().reverse();
  if (fmt === 'md') return '# Дневник\n\n' + e.map(([k, d]) => `## ${longDate(k)}\n\n${d.note.trim()}\n`).join('\n');
  return 'ДНЕВНИК\n\n' + e.map(([k, d]) => `${longDate(k).toUpperCase()}\n\n${d.note.trim()}\n`).join('\n————————————\n\n');
}
function downloadDiary(fmt) {
  let blob, ext = fmt;
  if (fmt === 'docx') {
    const body = diaryEntries().reverse().map(([k, d]) => `<h2>${esc(longDate(k))}</h2>` + d.note.trim().split('\n').map(p => `<p>${esc(p)}</p>`).join('')).join('');
    blob = new Blob(['﻿<html><head><meta charset="utf-8"><title>Дневник</title></head><body style="font-family:Calibri,Arial;font-size:12pt"><h1>Дневник</h1>' + body + '</body></html>'], { type: 'application/msword' });
    ext = 'doc';
  } else blob = new Blob(['﻿' + diaryText(fmt)], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Дневник_${dkey(new Date())}.${ext}`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* ---------- BOOKS ---------- */
const BOOK_CATS = {
  psych:  { n: 'Психология',  c: '#7F77DD' }, parent: { n: 'Воспитание', c: '#E57A44' },
  faith:  { n: 'Вера',        c: '#9B6BC4' }, fiction: { n: 'Художественная', c: '#14A3A3' },
  prof:   { n: 'Профессия',   c: '#3D7BE0' }, english: { n: 'На английском', c: '#D4537E' },
  self:   { n: 'Саморазвитие', c: '#1FA971' }, other: { n: 'Другое', c: '#8A93A0' },
};
const BOOK_ST = { reading: ['Читаю', 'ti-book-2'], want: ['Хочу прочитать', 'ti-bookmark'], done: ['Прочитано', 'ti-circle-check'], paused: ['Отложено', 'ti-player-pause'] };
let bookTab = 'reading', curBook = null;
const booksList = () => live(S.books);
const bPct = b => b.pages ? Math.min(100, Math.round((b.read || 0) / b.pages * 100)) : (b.status === 'done' ? 100 : 0);
function cover(b, w = 54) {
  const c = (BOOK_CATS[b.cat] || BOOK_CATS.other).c, h = Math.round(w * 1.42);
  const ini = (b.title || '?').split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
  return `<div style="width:${w}px;height:${h}px;flex:none;border-radius:6px 10px 10px 6px;background:${c};color:#fff;position:relative;overflow:hidden;
    box-shadow:inset 4px 0 0 rgba(0,0,0,.18),0 2px 6px rgba(0,0,0,.12);display:flex;align-items:flex-end;padding:6px">
    <b style="font-size:${Math.round(w * .32)}px;line-height:1;letter-spacing:-.02em">${esc(ini)}</b>
    <span style="position:absolute;top:6px;right:6px;width:${Math.round(w * .28)}px;height:${Math.round(w * .28)}px;border-radius:50%;background:rgba(255,255,255,.25)"></span></div>`;
}
function readingLine() {
  const r = booksList().filter(([, b]) => b.status === 'reading');
  if (!r.length) return `<div class="meta" style="margin-top:4px"><span class="link" data-book="new" style="padding:0">+ выбрать книгу</span></div>`;
  return r.slice(0, 2).map(([id, b]) => `<div data-book="${id}" style="display:flex;align-items:center;gap:8px;margin-top:6px;font-size:12px;color:var(--ink2);cursor:pointer">
    <i class="ti ti-book-2"></i><span class="grow" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(b.title)}</span>
    <b>${b.pages ? `${b.read || 0}/${b.pages}` : bPct(b) + '%'}</b></div>`).join('');
}
function pagesInRange(from, to) {
  let n = 0; booksList().forEach(([, b]) => { (b.log || []).forEach(l => { if (l.d >= from && l.d <= to) n += Math.max(0, l.delta || 0); }); }); return n;
}
function openBook(id) { if (id === 'new') return editBook(null); curBook = id; VIEW = 'book'; $$('#nav button').forEach(x => x.classList.toggle('on', x.dataset.v === 'books')); render(); window.scrollTo(0, 0); }
function renderBooks() {
  const all = booksList(), year = String(new Date().getFullYear());
  const ws = weekStart(new Date()), weekPages = pagesInRange(dkey(ws), dkey(addDays(ws, 6)));
  const doneYear = all.filter(([, b]) => b.status === 'done' && (b.finished || '').startsWith(year)).length;
  const counts = Object.fromEntries(Object.keys(BOOK_ST).map(k => [k, all.filter(([, b]) => b.status === k).length]));
  const list = all.filter(([, b]) => b.status === bookTab).sort((a, b) => (b[1].u || 0) - (a[1].u || 0));
  $('#sub').textContent = `${all.length} книг в библиотеке`;
  $('#view').innerHTML = `
  <div class="metrics">
    <div class="metric"><div class="v">${counts.reading}</div><div class="n">читаю сейчас</div></div>
    <div class="metric"><div class="v">${weekPages}</div><div class="n">страниц за неделю</div></div>
    <div class="metric"><div class="v">${doneYear}</div><div class="n">прочитано в ${year}</div></div>
  </div>
  <div class="days" style="margin-top:12px">${Object.entries(BOOK_ST).map(([k, [n]]) => `<button data-bt="${k}" class="${k === bookTab ? 'on' : ''}" style="min-width:auto;padding:8px 6px;font-size:12px">${n}<small>${counts[k]}</small></button>`).join('')}</div>
  ${list.map(([id, b]) => { const p = bPct(b), bc = (BOOK_CATS[b.cat] || BOOK_CATS.other);
    return `<div class="card" data-bo="${id}" style="display:flex;gap:14px;cursor:pointer;align-items:center">
      ${cover(b)}
      <div class="grow">
        <div style="font-weight:800;font-size:16px;line-height:1.25">${esc(b.title)}</div>
        <div class="mute">${esc(b.author || '')}${b.author ? ' · ' : ''}<span style="color:${bc.c};font-weight:600">${bc.n}</span></div>
        ${b.status === 'done' ? `<div style="margin-top:6px;color:var(--warn);letter-spacing:2px">${'★'.repeat(b.rating || 0)}<span style="color:var(--line)">${'★'.repeat(5 - (b.rating || 0))}</span></div>`
          : `<div class="row" style="margin-top:8px"><div class="pbar grow" style="margin:0"><div style="width:${p}%;background:${bc.c}"></div></div><span class="mute" style="font-weight:700">${p}%</span></div>
             <div class="mute" style="margin-top:3px">${b.pages ? `${b.read || 0} из ${b.pages} стр.` : 'страниц не указано'}${(b.notes || []).length ? ` · <i class="ti ti-notes"></i> ${(b.notes || []).length}` : ''}</div>`}
      </div></div>`; }).join('') || `<div class="card mute" style="text-align:center;padding:26px">${bookTab === 'reading' ? 'Сейчас ничего не читаете. Добавьте книгу или начните одну из списка «Хочу прочитать».' : 'Здесь пока пусто.'}</div>`}
  <button class="btn" id="badd" style="width:100%"><i class="ti ti-plus"></i> Добавить книгу</button>`;
  $$('[data-bt]').forEach(b => b.onclick = () => { bookTab = b.dataset.bt; render(); });
  $$('[data-bo]').forEach(b => b.onclick = () => openBook(b.dataset.bo));
  $('#badd').onclick = () => editBook(null);
}
function updBook(id, fn) { const b = structuredClone(S.books[id]); fn(b); b.u = now(); S.books[id] = b; persist(); }
function setPage(id, page) {
  updBook(id, b => { page = Math.max(0, Math.round(page)); if (b.pages) page = Math.min(page, b.pages);
    const delta = page - (b.read || 0); b.read = page; b.log = [...(b.log || []), { d: dkey(new Date()), p: page, delta }];
    if (b.status === 'want' || b.status === 'paused') { b.status = 'reading'; b.started = b.started || dkey(new Date()); }
    if (b.pages && page >= b.pages && b.status !== 'done') { b.status = 'done'; b.finished = dkey(new Date()); toast('Книга прочитана! Поставьте оценку и напишите отзыв'); } });
  render();
}
function renderBook() {
  const id = curBook, b = S.books[id];
  if (!b || b.deleted) { go('books'); return; }
  const bc = BOOK_CATS[b.cat] || BOOK_CATS.other, p = bPct(b);
  $('#title').textContent = 'Книга'; $('#sub').textContent = BOOK_ST[b.status][0];
  $('#view').innerHTML = `
  <button class="link" id="bkBack" style="margin:0 0 10px -4px"><i class="ti ti-arrow-left"></i> Все книги</button>
  <div class="card" style="display:flex;gap:16px;align-items:center">
    ${cover(b, 84)}
    <div class="grow"><div style="font-weight:800;font-size:19px;line-height:1.2">${esc(b.title)}</div>
      <div class="mute" style="margin-top:3px">${esc(b.author || '')}</div>
      <div style="margin-top:6px"><span class="tag" style="background:color-mix(in srgb,${bc.c} 14%,transparent);color:${bc.c}">${bc.n}</span></div>
      ${b.started ? `<div class="mute" style="margin-top:6px;font-size:12px">Начал ${parseKey(b.started).toLocaleDateString('ru-RU')}${b.finished ? ' · закончил ' + parseKey(b.finished).toLocaleDateString('ru-RU') : ''}</div>` : ''}</div>
    <button class="iconbtn" id="bkEdit" style="box-shadow:none;background:var(--card2)"><i class="ti ti-pencil"></i></button>
  </div>
  <div class="days">${Object.entries(BOOK_ST).map(([k, [n, i]]) => `<button data-st="${k}" class="${k === b.status ? 'on' : ''}" style="min-width:auto;font-size:11px;padding:8px 4px"><i class="ti ${i}" style="font-size:18px"></i><small>${n}</small></button>`).join('')}</div>
  ${b.status !== 'want' ? `<div class="card">
    <div class="row"><div class="ring" style="width:64px;height:64px">${ringSvg(p / 100, bc.c, 64, 7)}<b>${p}%</b></div>
      <div class="grow"><div style="font-weight:800;font-size:18px">${b.read || 0}${b.pages ? ` <span class="mute" style="font-size:14px">из ${b.pages} стр.</span>` : ' стр.'}</div>
      <div class="mute">${b.pages ? `осталось ${Math.max(0, b.pages - (b.read || 0))} стр.` : 'укажите число страниц в книге (✎)'}</div></div></div>
    <label class="l">На какой я странице</label>
    <div class="row"><input type="number" inputmode="numeric" id="bkPage" value="${b.read || 0}"><button class="btn" id="bkSave">OK</button></div>
    <div class="row" style="margin-top:8px;gap:6px">${[5, 10, 20, 50].map(n => `<button class="btn2 grow" data-plus="${n}">+${n}</button>`).join('')}</div>
  </div>` : ''}
  ${b.status === 'done' ? `<div class="card"><b>Моя оценка</b><div style="font-size:30px;letter-spacing:4px;margin-top:4px">${[1, 2, 3, 4, 5].map(n => `<span data-rate="${n}" style="cursor:pointer;color:${n <= (b.rating || 0) ? 'var(--warn)' : 'var(--line)'}">★</span>`).join('')}</div>
    <label class="l">Отзыв: что взял из книги</label><textarea id="bkReview" placeholder="Главные мысли, что применю в жизни…">${esc(b.review || '')}</textarea></div>` : ''}
  <div class="sec"><h2>Мои заметки</h2><span class="mute">${(b.notes || []).length}</span></div>
  <div class="card">
    <textarea id="bkNote" placeholder="Мысль, цитата своими словами, вывод…" style="min-height:80px"></textarea>
    <div class="row" style="margin-top:8px;gap:8px"><button class="btn2" id="bkMic"><i class="ti ti-microphone"></i> Надиктовать</button><span class="mute grow" id="bkMicSt"></span>
      <button class="btn" id="bkAddNote">Сохранить</button></div>
  </div>
  ${[...(b.notes || [])].reverse().map(n => `<div class="card" style="padding:14px">
      <div class="row"><span class="tag" style="background:var(--card2);color:var(--ink2)"><i class="ti ti-calendar"></i>${parseKey(n.d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}${n.page ? ` · стр. ${n.page}` : ''}</span>
      <span class="grow"></span><button class="link" data-dn="${n.id}" style="color:var(--mute)"><i class="ti ti-trash"></i></button></div>
      <div style="white-space:pre-wrap;margin-top:8px;line-height:1.6">${esc(n.t)}</div></div>`).join('')}`;
  $('#bkBack').onclick = () => go('books');
  $('#bkEdit').onclick = () => editBook(id);
  $$('[data-st]').forEach(x => x.onclick = () => updBook(id, bb => { const st = x.dataset.st; bb.status = st;
    if (st === 'reading') bb.started = bb.started || dkey(new Date());
    if (st === 'done') { bb.finished = dkey(new Date()); if (bb.pages) bb.read = bb.pages; } else delete bb.finished; }) || render());
  $('#bkSave') && ($('#bkSave').onclick = () => setPage(id, +$('#bkPage').value || 0));
  $$('[data-plus]').forEach(x => x.onclick = () => setPage(id, (b.read || 0) + +x.dataset.plus));
  $$('[data-rate]').forEach(x => x.onclick = () => { updBook(id, bb => { bb.rating = +x.dataset.rate; }); render(); });
  $('#bkReview') && ($('#bkReview').onchange = e => updBook(id, bb => { bb.review = e.target.value; }));
  $('#bkMic').onclick = () => toggleDictation($('#bkNote'), $('#bkMic'), $('#bkMicSt'));
  $('#bkAddNote').onclick = () => { const t = $('#bkNote').value.trim(); if (!t) return toast('Напишите или надиктуйте заметку');
    stopDictation(); updBook(id, bb => { bb.notes = [...(bb.notes || []), { id: uid(), d: dkey(new Date()), page: bb.read || 0, t }]; }); render(); toast('Заметка сохранена'); };
  $$('[data-dn]').forEach(x => x.onclick = () => { updBook(id, bb => { bb.notes = (bb.notes || []).filter(n => n.id !== x.dataset.dn); }); render(); });
}
function editBook(id) {
  const b = id ? S.books[id] : { title: '', author: '', pages: '', cat: 'psych', status: 'want' };
  openSheet(`<h3>${id ? 'Изменить книгу' : 'Новая книга'}</h3>
    <label class="l">Название</label><input id="kt" value="${esc(b.title)}" placeholder="Название книги">
    <label class="l">Автор</label><input id="ka" value="${esc(b.author || '')}">
    <label class="l">Страниц в книге</label><input id="kp" type="number" inputmode="numeric" value="${b.pages || ''}" placeholder="Например: 320">
    <label class="l">Тема</label><div class="chips" id="kc">${Object.entries(BOOK_CATS).map(([k, v]) => `<button type="button" class="chip ${k === b.cat ? 'on' : ''}" data-kc="${k}" style="border-color:${k === b.cat ? v.c : 'transparent'}"><span style="width:10px;height:10px;border-radius:50%;background:${v.c}"></span>${v.n}</button>`).join('')}</div>
    ${id ? '' : `<label class="l">Статус</label><div class="days" id="ks">${Object.entries(BOOK_ST).map(([k, [n]]) => `<button type="button" data-ks="${k}" class="${k === b.status ? 'on' : ''}" style="min-width:auto;font-size:12px;padding:8px 4px">${n}</button>`).join('')}</div>`}
    <div class="row" style="margin-top:16px">${id ? '<button class="btn2 danger" id="kdel"><i class="ti ti-trash"></i> Удалить</button>' : ''}<span class="grow"></span>
    <button class="btn2" id="kx">Отмена</button><button class="btn" id="kok">Сохранить</button></div>`, root => {
    root.querySelectorAll('[data-kc]').forEach(x => x.onclick = () => root.querySelectorAll('[data-kc]').forEach(y => { const on = y === x; y.classList.toggle('on', on); y.style.borderColor = on ? BOOK_CATS[y.dataset.kc].c : 'transparent'; }));
    root.querySelectorAll('[data-ks]').forEach(x => x.onclick = () => root.querySelectorAll('[data-ks]').forEach(y => y.classList.toggle('on', y === x)));
    $('#kx').onclick = closeSheet;
    $('#kdel') && ($('#kdel').onclick = () => { S.books[id] = { u: now(), deleted: true }; persist(); closeSheet(); go('books'); });
    $('#kok').onclick = () => {
      if (!$('#kt').value.trim()) return toast('Введите название');
      const nid = id || uid(), st = id ? b.status : (root.querySelector('[data-ks].on')?.dataset.ks || 'want');
      S.books[nid] = { ...(id ? S.books[id] : { read: 0, notes: [], log: [], added: dkey(new Date()) }), u: now(), title: $('#kt').value.trim(), author: $('#ka').value.trim(),
        pages: +$('#kp').value || 0, cat: root.querySelector('[data-kc].on')?.dataset.kc || 'other', status: st,
        ...(id ? {} : st === 'reading' ? { started: dkey(new Date()) } : st === 'done' ? { finished: dkey(new Date()) } : {}) };
      persist(); closeSheet(); if (!id) bookTab = st; if (VIEW === 'book' || VIEW === 'books') render(); else openBook(nid);
    };
  });
}

/* ---------- SETTINGS ---------- */
function renderSettings() {
  $$('#nav button').forEach(x => x.classList.remove('on'));
  const habits = habitsList();
  $('#sub').textContent = CFG.lastSync ? 'Синхронизировано ' + new Date(CFG.lastSync).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  $('#view').innerHTML = `
  <div class="sec" style="margin-top:4px"><h2>Привычки</h2><button class="link" id="hadd"><i class="ti ti-plus"></i> Добавить</button></div>
  <div class="tl">${habits.map(([id, h], i) => `<div class="blk"><div style="cursor:pointer" class="row grow" data-he="${id}">${icon(h.cat, 34)}<div class="grow"><div class="ttl">${esc(h.name)}</div><div class="meta">${h.target || 7} раз в неделю</div></div></div>
    <button class="chk" data-hu="${id}" aria-label="Выше" style="color:var(--ink2);${i === 0 ? 'visibility:hidden' : ''}"><i class="ti ti-arrow-up"></i></button></div>`).join('')}</div>
  <div class="sec"><h2>Уведомления</h2></div>
  <div class="card">
    ${NATIVE ? `
    <label class="row" style="padding:4px 0"><span class="grow"><b>Напоминания по расписанию</b><div class="mute">Колокольчик у дела включается в его настройках</div></span><input type="checkbox" id="nOn" style="width:auto;transform:scale(1.4)" ${CFG.notif.on ? 'checked' : ''}></label>
    <label class="row" style="padding:10px 0 4px"><span class="grow"><b>Звук</b></span><input type="checkbox" id="nSnd" style="width:auto;transform:scale(1.4)" ${CFG.notif.sound ? 'checked' : ''}></label>
    <label class="l">Когда напоминать</label>
    <div class="days" id="nLead">${[[0, 'в начале'], [5, 'за 5 мин'], [10, 'за 10 мин']].map(([v, t]) => `<button type="button" data-lead="${v}" class="${(CFG.notif.lead || 0) === v ? 'on' : ''}">${t}</button>`).join('')}</div>
    <div class="row"><span class="mute grow">Запланировано: ${CFG.notif.count ?? 0} на 2 недели вперёд</span><button class="btn2 acc" id="nTest"><i class="ti ti-bell-ringing"></i> Проверить</button></div>`
    : `<div class="mute">Напоминания со звуком работают в Android-приложении. Установите его, откройте и вставьте ссылку подключения (ниже).</div>
       <a class="btn" href="${APK_URL}" style="display:inline-flex;gap:6px;margin-top:12px;text-decoration:none"><i class="ti ti-brand-android"></i> Скачать приложение для Android</a>`}
  </div>
  <div class="sec"><h2>Синхронизация</h2></div>
  <div class="card">
    <div class="mute">Данные хранятся в вашем закрытом репозитории GitHub.${CFG.lastErr ? ` <span style="color:var(--danger)">Ошибка: ${esc(CFG.lastErr)}</span>` : ''}</div>
    <label class="l">Логин GitHub</label><input id="so" value="${esc(CFG.owner || '')}" autocomplete="off">
    <label class="l">Репозиторий для данных</label><input id="sr" value="${esc(CFG.repo || '')}" autocomplete="off">
    <label class="l">Ключ доступа</label><input id="st" type="password" value="${esc(CFG.token || '')}" autocomplete="off">
    <button class="btn" id="ssave" style="width:100%;margin-top:14px"><i class="ti ti-refresh"></i> Сохранить и синхронизировать</button>
    ${CFG.token ? `<button class="btn2" id="copyLink" style="width:100%;margin-top:8px"><i class="ti ti-link"></i> Скопировать ссылку подключения</button>` : ''}
    <label class="l">Подключить по ссылке</label><div class="row"><input id="linkIn" placeholder="Вставьте ссылку подключения"><button class="btn2 acc" id="linkOk">OK</button></div>
  </div>
  ${CFG.token ? `<div class="card"><div class="row"><i class="ti ti-qrcode" style="font-size:24px;color:var(--accent)"></i><div class="grow"><b>Подключить телефон</b><div class="mute">Наведите камеру телефона на код — приложение откроется подключённым. Не показывайте код другим.</div></div></div>
    <button class="btn2 acc" id="qrbtn" style="margin-top:10px">Показать QR-код</button><div id="qr" class="hidden" style="margin-top:12px;background:#fff;padding:12px;border-radius:14px;width:max-content"></div></div>` : ''}
  <div class="card"><b>Установка</b><div class="mute" style="margin-top:4px">Android (Chrome): ⋮ → «Установить приложение».<br>Windows (Chrome/Edge): значок «Установить» в адресной строке.<br>iPhone (Safari): «Поделиться» → «На экран Домой».</div></div>
  <div class="card"><b>Резервная копия</b><div class="row" style="margin-top:10px;gap:8px;flex-wrap:wrap"><button class="btn2" id="exp"><i class="ti ti-copy"></i> Скопировать данные</button><button class="btn2" id="imp"><i class="ti ti-clipboard"></i> Вставить данные</button>
    <button class="btn2 danger" id="resetPlan"><i class="ti ti-restore"></i> Сбросить план недели</button></div></div>`;
  $('#hadd').onclick = () => editHabit(null);
  $$('[data-he]').forEach(b => b.onclick = () => editHabit(b.dataset.he));
  $$('[data-hu]').forEach(b => b.onclick = () => { const i = habits.findIndex(([id]) => id === b.dataset.hu); if (i < 1) return;
    const t = now(), [a, c] = [habits[i - 1], habits[i]], oa = a[1].order ?? i - 1, oc = c[1].order ?? i;
    S.habits[a[0]] = { ...a[1], order: oc === oa ? oa + 1 : oc, u: t }; S.habits[c[0]] = { ...c[1], order: oa, u: t }; persist(); render(); });
  if (NATIVE) {
    $('#nOn').onchange = e => { CFG.notif.on = e.target.checked; saveCfg(); rescheduleNotifs().then(render); };
    $('#nSnd').onchange = e => { CFG.notif.sound = e.target.checked; saveCfg(); rescheduleNotifs(); };
    $$('[data-lead]').forEach(b => b.onclick = () => { CFG.notif.lead = +b.dataset.lead; saveCfg(); rescheduleNotifs().then(render); });
    $('#nTest').onclick = testNotif;
  }
  const setupLink = () => 'https://serhiiorobchenko.github.io/Life_Planner/#setup=' + btoa(unescape(encodeURIComponent(JSON.stringify({ o: CFG.owner, r: CFG.repo, t: CFG.token }))));
  $('#copyLink') && ($('#copyLink').onclick = async () => { try { await navigator.clipboard.writeText(setupLink()); toast('Ссылка скопирована. Не отправляйте её другим людям'); } catch { toast('Не удалось скопировать'); } });
  $('#linkOk').onclick = () => { try { if (applySetupLink($('#linkIn').value)) { toast('Подключено'); sync(true).then(render); } else toast('Это не ссылка подключения'); } catch { toast('Ссылка повреждена'); } };
  $('#ssave').onclick = () => { CFG.owner = $('#so').value.trim(); CFG.repo = $('#sr').value.trim(); CFG.token = $('#st').value.trim(); saveCfg(); sync(true).then(render); };
  $('#qrbtn') && ($('#qrbtn').onclick = () => { const box = $('#qr'); box.classList.toggle('hidden'); if (box.dataset.done) return;
    const payload = btoa(unescape(encodeURIComponent(JSON.stringify({ o: CFG.owner, r: CFG.repo, t: CFG.token }))));
    const link = 'https://serhiiorobchenko.github.io/Life_Planner/#setup=' + payload;
    if (window.QRCode) { new QRCode(box, { text: link, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.L }); box.dataset.done = 1; }
    else box.textContent = 'QR не загрузился — нужен интернет'; });
  $('#exp').onclick = async () => { try { await navigator.clipboard.writeText(JSON.stringify(S)); toast('Данные скопированы'); } catch { toast('Не удалось скопировать'); } };
  $('#imp').onclick = () => openSheet(`<h3>Вставить данные</h3><div class="mute">Данные объединятся с текущими.</div><textarea id="impt" style="min-height:160px;margin-top:10px"></textarea>
    <div class="row" style="margin-top:12px"><span class="grow"></span><button class="btn2" id="ix">Отмена</button><button class="btn" id="iok">Импорт</button></div>`, () => {
    $('#ix').onclick = closeSheet;
    $('#iok').onclick = () => { try { S = merge(S, migrate(JSON.parse($('#impt').value))); persist(); closeSheet(); toast('Импортировано'); render(); } catch { toast('Неверные данные'); } };
  });
  $('#resetPlan').onclick = () => openSheet(`<h3>Сбросить план недели?</h3><div class="mute" style="margin-top:6px">Расписание на все 7 дней вернётся к исходному. Привычки, цели, дневник и вес не изменятся.</div>
    <div class="row" style="margin-top:16px"><span class="grow"></span><button class="btn2" id="rx">Отмена</button><button class="btn" id="rok" style="background:var(--danger)">Сбросить</button></div>`, () => {
    $('#rx').onclick = closeSheet; $('#rok').onclick = () => { S.plan = defaultPlan(now()); persist(); closeSheet(); toast('План сброшен'); render(); };
  });
}

/* ---------- boot ---------- */
persist(true); render(); scheduleNotifs();
setDot(syncReady() ? '' : 'err');
if (syncReady()) sync();
setInterval(() => { if (VIEW === 'today' && !recOn && $('#dlg').classList.contains('hidden') && !document.activeElement?.matches('input,textarea')) renderToday(); }, 60000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { sync(); scheduleNotifs(); if (VIEW === 'today' && !recOn) render(); } });
setInterval(() => { if (document.visibilityState === 'visible') sync(); }, 120000);
if (!NATIVE && 'serviceWorker' in navigator) { try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch {} }
