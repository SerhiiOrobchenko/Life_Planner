'use strict';
/* ===================== Мой день — личный планер =====================
   Данные хранятся локально (localStorage) и синхронизируются через
   приватный репозиторий GitHub (файл data.json) между устройствами.  */

const LS_STATE = 'lp-state-v1';
const LS_CFG = 'lp-cfg-v1';

const CATS = {
  work:    { n: 'Работа',        c: 'var(--c-work)' },
  family:  { n: 'Семья',         c: 'var(--c-family)' },
  god:     { n: 'Бог',           c: 'var(--c-god)' },
  sport:   { n: 'Спорт',         c: 'var(--c-sport)' },
  english: { n: 'Английский',    c: 'var(--c-english)' },
  growth:  { n: 'Цели, развитие', c: 'var(--c-growth)' },
  reading: { n: 'Чтение',        c: 'var(--c-reading)' },
  home:    { n: 'Быт, еда',      c: 'var(--c-home)' },
  rest:    { n: 'Отдых, шахматы', c: 'var(--c-rest)' },
  sleep:   { n: 'Сон',           c: 'var(--c-sleep)' },
};
const DAY_TYPES = { weekday: 'Будни', sat: 'Суббота', sun: 'Воскресенье' };
const WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const COLLECTIONS = ['templates', 'days', 'habits', 'log', 'goals', 'reviews', 'weights'];

const WORKOUT = `Пн, Чт — тренировка А (≈25 мин):
• приседания 3×12 • отжимания от стола 3×8–12
• тяга гантели/резинки в наклоне 3×12 • бицепс 3×12 • планка 3×30 с
Вт, Пт — тренировка Б (≈25 мин):
• выпады 3×8 на ногу • австралийские подтягивания на низкой перекладине 3×8
• отжимания узкие от стола 3×8 • бицепс «молот» 3×12 • ягодичный мост 3×15
Ср — быстрая ходьба 40 мин + растяжка 10 мин
Каждую неделю: +1 повтор или чуть сложнее вариант.`;

/* ---------- utils ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const now = () => Date.now();
const pad = n => String(n).padStart(2, '0');
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const toMin = t => { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + m; };
const durMin = (s, e) => { let d = toMin(e) - toMin(s); if (d <= 0) d += 1440; return d; };
const fmtH = min => { min = Math.round(min); const h = Math.floor(min / 60), m = min % 60; return h ? `${h} ч ${m ? m + ' м' : ''}`.trim() : `${m} м`; };
const fmtClock = ms => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`; };
const hm = ms => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const dayType = d => d.getDay() === 6 ? 'sat' : d.getDay() === 0 ? 'sun' : 'weekday';
const weekStart = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const wd = (x.getDay() + 6) % 7; return addDays(x, -wd); };
const live = obj => Object.entries(obj || {}).filter(([, v]) => v && !v.deleted);

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1800);
}

/* ---------- default data ---------- */
function B(start, end, title, cat, note = '') { return { id: uid(), start, end, title, cat, note }; }
function seed() {
  const t = now();
  const s = { v: 1, templates: {}, days: {}, habits: {}, log: {}, goals: {}, reviews: {}, weights: {} };
  s.templates.weekday = { u: t, blocks: [
    B('07:00', '07:25', 'Молитва и Библия в тишине', 'god', 'Встать раньше Марка. Вода, умыться — и тихое время с Богом.'),
    B('07:25', '08:00', 'Марк: завтрак, сборы', 'family'),
    B('08:00', '08:15', 'Отвести Марка в садик', 'family'),
    B('08:15', '09:00', 'Ходьба домой + тренировка', 'sport', 'В наушниках — английский подкаст.\n' + WORKOUT),
    B('09:00', '09:15', 'Душ', 'home'),
    B('09:15', '13:30', 'Работа — блок 1', 'work', 'Телефон в другой комнате. Сначала самая важная задача.'),
    B('13:30', '14:00', 'Обед', 'home'),
    B('14:00', '18:30', 'Работа — блок 2', 'work', 'В конце: записать, на чём остановился, и закрыть работу.'),
    B('18:30', '20:00', 'Время с Марком', 'family', 'Без телефона.'),
    B('20:00', '20:30', 'Посуда, порядок, план на завтра', 'home'),
    B('20:30', '22:00', 'Время с женой, вечерняя молитва', 'family'),
    B('22:00', '22:40', 'Своё: чтение или разговорный английский', 'reading', 'Шахматы — максимум 1 партия, не позже 22:00.'),
    B('22:40', '23:00', 'Экраны выключены, подготовка ко сну', 'home'),
    B('23:00', '07:00', 'Сон', 'sleep'),
  ] };
  s.templates.sat = { u: t, blocks: [
    B('07:30', '08:00', 'Подъём, молитва', 'god'),
    B('08:00', '08:45', 'Завтрак с семьёй', 'family'),
    B('08:45', '12:30', 'Утро с Марком (жена отдыхает)', 'family', 'Прогулка, площадка, игры. У жены — время для себя.'),
    B('12:30', '13:00', 'Обед', 'home'),
    B('13:00', '15:00', 'Upwork: профиль, резюме, портфолио', 'growth', 'Марк спит.'),
    B('15:00', '18:30', 'Семья, прогулка', 'family'),
    B('18:30', '20:00', 'Марк: ужин, игры', 'family'),
    B('20:00', '22:00', 'Время с женой', 'family'),
    B('22:00', '22:40', 'Чтение (художественное)', 'reading'),
    B('23:00', '07:30', 'Сон', 'sleep'),
  ] };
  s.templates.sun = { u: t, blocks: [
    B('07:30', '08:00', 'Подъём, молитва', 'god'),
    B('08:00', '09:30', 'Завтрак, сборы', 'family'),
    B('09:30', '12:30', 'Церковь', 'god'),
    B('12:30', '13:00', 'Обед', 'home'),
    B('13:00', '15:00', 'Грин-карта и английский', 'growth', 'Марк спит.'),
    B('15:00', '18:30', 'Семья', 'family'),
    B('18:30', '20:00', 'Марк', 'family'),
    B('20:00', '20:20', 'Разбор недели и план', 'growth', 'Вкладка «Неделя» → ответить на 3 вопроса.'),
    B('20:20', '22:00', 'Время с женой', 'family'),
    B('22:00', '22:40', 'Чтение', 'reading'),
    B('23:00', '07:00', 'Сон', 'sleep'),
  ] };
  ['Утренняя молитва', 'Тренировка / ходьба', 'Английский 30 мин', 'Без сладкого и перекусов',
   'Не ем после 20:30', 'Работа 8+ часов', 'Марк без телефона', 'Чтение', 'Шахматы ≤ 1 партии', 'Отбой до 23:00']
    .forEach((n, i) => { s.habits[uid() + i] = { u: t, name: n, order: i }; });
  const goals = [
    { title: 'Английский: свободнее говорить и понимать на слух', why: 'Уверенность в работе с клиентами и при переезде в США.',
      metric: 'Сдать IELTS на 6.5 (через ~6 мес.)',
      steps: ['Слушать подкаст 30 мин каждый будний день', 'Найти преподавателя для разговорной практики 2×/нед', 'Пройти пробный тест IELTS через 3 месяца'] },
    { title: 'Похудеть с 97 до 80 кг', why: 'Больше сил, здоровье, пример для Марка.',
      metric: '−0,5…0,7 кг в неделю, взвешивание раз в неделю',
      steps: ['Убрать сладкое и печенье из дома', 'Не есть после 20:30', 'Белок в каждом приёме пищи', 'Купить гантели или набор резинок'] },
    { title: 'Сила и выносливость', why: 'Руки, бицепс, стройнее, больше энергии.',
      metric: 'Первое подтягивание; 20 отжиманий подряд от пола',
      steps: ['4 тренировки в неделю по программе', 'Австралийские подтягивания на брусьях'] },
    { title: 'Грин-карта и Upwork', why: 'Переезд в США и своё дело.',
      metric: 'Обновлённый профиль Upwork + портфолио; план по грин-карте',
      steps: ['Обновить резюме и профиль Upwork', 'Собрать портфолио (3–5 проектов)', 'Разобраться в вариантах грин-карты и документах'] },
  ];
  goals.forEach((g, i) => { s.goals[uid() + i] = { u: t, order: i, title: g.title, why: g.why, metric: g.metric,
    steps: g.steps.map(x => ({ id: uid(), t: x, done: false })) }; });
  s.weights[dkey(new Date())] = { u: t, kg: 97 };
  return s;
}

/* ---------- state ---------- */
let S, CFG;
try { S = JSON.parse(localStorage.getItem(LS_STATE)); } catch { S = null; }
if (!S || !S.v) S = seed();
COLLECTIONS.forEach(c => S[c] = S[c] || {});
try { CFG = JSON.parse(localStorage.getItem(LS_CFG)) || {}; } catch { CFG = {}; }
CFG.owner = CFG.owner || 'SerhiiOrobchenko';
if (!CFG.repo || CFG.repo === 'life-planner-data') CFG.repo = 'Life_Planner_Data';
// Подключение второго устройства по QR-коду / ссылке: #setup=<base64 json>
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
  try { localStorage.setItem(LS_STATE, JSON.stringify(S)); } catch (e) { toast('Не удалось сохранить локально'); }
  if (!silent) scheduleSync();
}
function saveCfg() { try { localStorage.setItem(LS_CFG, JSON.stringify(CFG)); } catch {} }

function day(k) { return S.days[k] || { u: 0, marks: {}, habits: {}, note: '' }; }
function setDay(k, fn) { const d = structuredClone(day(k)); fn(d); d.u = now(); S.days[k] = d; persist(); }
function templateFor(d) { return S.templates[dayType(d)] || { blocks: [] }; }
function running() { return live(S.log).find(([, e]) => !e.end); }

/* ---------- sync via GitHub ---------- */
function merge(a, b) {
  const out = { v: 1 };
  COLLECTIONS.forEach(c => {
    const x = a[c] || {}, y = b[c] || {}, r = {};
    new Set([...Object.keys(x), ...Object.keys(y)]).forEach(k => {
      const p = x[k], q = y[k];
      r[k] = !p ? q : !q ? p : ((q.u || 0) > (p.u || 0) ? q : p);
    });
    out[c] = r;
  });
  return out;
}
function b64enc(str) {
  const bytes = new TextEncoder().encode(str); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function b64dec(b64) {
  const bin = atob(b64.replace(/\s/g, '')); const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
function syncReady() { return CFG.owner && CFG.repo && CFG.token; }
function setDot(cls, title) { const d = $('#syncDot'); d.className = cls || ''; d.title = title || ''; }

let syncTimer = null, syncing = false, syncAgain = false;
function scheduleSync() { if (!syncReady()) return; clearTimeout(syncTimer); syncTimer = setTimeout(sync, 3000); }

async function sync(manual) {
  if (!syncReady()) { if (manual) toast('Сначала настройте синхронизацию'); return; }
  if (syncing) { syncAgain = true; return; }
  syncing = true; setDot('busy', 'Синхронизация…');
  const url = `https://api.github.com/repos/${encodeURIComponent(CFG.owner)}/${encodeURIComponent(CFG.repo)}/contents/data.json`;
  const headers = { Authorization: `Bearer ${CFG.token}`, Accept: 'application/vnd.github+json' };
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const g = await fetch(url + '?t=' + now(), { headers, cache: 'no-store' });
      let sha, remote = null;
      if (g.status === 200) { const j = await g.json(); sha = j.sha; remote = JSON.parse(b64dec(j.content)); }
      else if (g.status === 401) throw new Error('ключ неверный или истёк — создайте новый');
      else if (g.status !== 404) throw new Error('GitHub ответил ' + g.status);
      const merged = remote ? merge(S, remote) : S;
      const body = JSON.stringify(merged);
      S = merged; persist(true);
      if (remote && JSON.stringify(remote) === body) break; // nothing new to push
      const p = await fetch(url, { method: 'PUT', headers, body: JSON.stringify({
        message: 'sync ' + new Date().toISOString(), content: b64enc(body), ...(sha ? { sha } : {}) }) });
      if (p.ok) break;
      if (p.status === 409 || p.status === 422) continue; // changed meanwhile — retry
      if (p.status === 404) throw new Error(`нет доступа к репозиторию ${CFG.owner}/${CFG.repo} — проверьте название и что ключ выдан на этот репозиторий`);
      if (p.status === 403) throw new Error('у ключа нет права Contents: Read and write');
      throw new Error('GitHub ответил ' + p.status);
    }
    CFG.lastSync = now(); saveCfg();
    setDot('ok', 'Синхронизировано ' + hm(CFG.lastSync));
    if (manual) toast('Синхронизировано');
    render();
  } catch (e) {
    setDot('err', 'Ошибка синхронизации: ' + e.message);
    if (manual) toast('Ошибка: ' + e.message);
  } finally {
    syncing = false;
    if (syncAgain) { syncAgain = false; scheduleSync(); }
  }
}

/* ---------- dialog ---------- */
function openDlg(html, mount) {
  $('#sheet').innerHTML = html; $('#dlg').classList.remove('hidden');
  mount && mount($('#sheet'));
}
function closeDlg() { $('#dlg').classList.add('hidden'); $('#sheet').innerHTML = ''; }
$('#dlg').addEventListener('click', e => { if (e.target.id === 'dlg') closeDlg(); });
const catOptions = sel => Object.entries(CATS).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v.n}</option>`).join('');

/* ---------- router ---------- */
let VIEW = 'today', viewDate = new Date(), weekOffset = 0, tplTab = 'weekday';
const TITLES = { today: 'Сегодня', time: 'Учёт времени', goals: 'Цели', week: 'Неделя', settings: 'Настройки', diary: 'Дневник' };
$('#nav').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  stopDictation(); VIEW = b.dataset.v; if (VIEW === 'today') viewDate = new Date();
  document.querySelectorAll('#nav button').forEach(x => x.classList.toggle('on', x === b));
  render(); window.scrollTo(0, 0);
});
function render() {
  $('#title').textContent = TITLES[VIEW];
  ({ today: renderToday, time: renderTime, goals: renderGoals, week: renderWeek, settings: renderSettings, diary: renderDiary })[VIEW]();
}

/* ---------- TODAY ---------- */
function currentBlock(blocks) {
  const d = new Date(), m = d.getHours() * 60 + d.getMinutes();
  return blocks.find(b => { const s = toMin(b.start), e = toMin(b.end);
    return s < e ? m >= s && m < e : m >= s || m < e; });
}
function streak(hid) {
  let n = 0, d = new Date();
  if (!day(dkey(d)).habits?.[hid]) d = addDays(d, -1);
  while (day(dkey(d)).habits?.[hid]) { n++; d = addDays(d, -1); }
  return n;
}
function renderToday() {
  if (recOn) stopDictation();
  const k = dkey(viewDate), isToday = k === dkey(new Date());
  const dd = day(k), blocks = [...templateFor(viewDate).blocks].sort((a, b) => {
    const fa = toMin(a.start) < 300 ? toMin(a.start) + 1440 : toMin(a.start);
    const fb = toMin(b.start) < 300 ? toMin(b.start) + 1440 : toMin(b.start); return fa - fb; });
  const cur = isToday ? currentBlock(blocks) : null;
  const habits = live(S.habits).sort((a, b) => a[1].order - b[1].order);
  const doneB = blocks.filter(b => dd.marks?.[b.id] === 'done').length;
  const doneH = habits.filter(([id]) => dd.habits?.[id]).length;
  const run = running();
  const dateStr = viewDate.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  let left = '';
  if (cur) { const m = new Date().getHours() * 60 + new Date().getMinutes(); let r = toMin(cur.end) - m; if (r < 0) r += 1440; left = fmtH(r); }

  $('#view').innerHTML = `
  <div class="row" style="margin-bottom:10px">
    <button class="ghost small" id="prevD">◀</button>
    <div class="grow" style="text-align:center;font-weight:600">${esc(dateStr.charAt(0).toUpperCase() + dateStr.slice(1))}${isToday ? '' : ' <button class="ghost small" id="toToday">сегодня</button>'}</div>
    <button class="ghost small" id="nextD">▶</button>
  </div>
  ${cur ? `<div class="card" style="border-color:${CATS[cur.cat]?.c}">
    <div class="mute">Сейчас по плану · осталось ${left}</div>
    <div class="row"><div class="grow" style="font-size:19px;font-weight:700">${esc(cur.title)}</div>
    ${run && run[1].cat === cur.cat ? `<span class="pill" style="background:${CATS[cur.cat].c}">идёт учёт</span>`
      : `<button class="btn" data-start="${cur.cat}">▶ Начать</button>`}</div></div>` : ''}
  <div class="card">
    <h2>Расписание · ${doneB}/${blocks.length}</h2>
    ${blocks.map(b => {
      const mk = dd.marks?.[b.id];
      return `<div class="block ${b === cur ? 'now' : ''} ${mk === 'done' ? 'done' : ''}">
        <div class="bar" style="background:${CATS[b.cat]?.c || 'gray'}"></div>
        <div class="time">${b.start}–${b.end}</div>
        <div class="grow"><div class="title" data-exp="${b.id}">${esc(b.title)}${b.note ? ' <span class="mute">ⓘ</span>' : ''}</div>
          ${b.note ? `<div class="note hidden" id="n-${b.id}">${esc(b.note)}</div>` : ''}</div>
        <div class="acts">
          ${isToday ? `<button class="chk" data-start="${b.cat}" title="Начать учёт">▶</button>` : ''}
          <button class="chk ${mk === 'done' ? 'on' : mk === 'skip' ? 'skip' : ''}" data-mark="${b.id}" title="Сделано / пропущено">${mk === 'done' ? '✓' : mk === 'skip' ? '–' : ''}</button>
        </div></div>`; }).join('')}
    <div class="mute" style="margin-top:6px">Кружок: один тап — сделано ✓, второй — пропущено –, третий — сброс.</div>
  </div>
  <div class="card">
    <h2>Привычки · ${doneH}/${habits.length}</h2>
    <div class="habits">${habits.map(([id, h]) => { const st = streak(id);
      return `<div class="habit ${dd.habits?.[id] ? 'on' : ''}" data-hab="${id}">${dd.habits?.[id] ? '✅' : '⬜'} <span>${esc(h.name)}</span>${st > 1 ? `<span class="streak">🔥${st}</span>` : ''}</div>`; }).join('')}</div>
  </div>
  <div class="card">
    <div class="row" style="margin-bottom:8px"><h2 class="grow" style="margin:0">Дневник · заметка дня</h2>
      <button class="ghost small" id="toDiary">Весь дневник →</button></div>
    <textarea id="dayNote" style="min-height:120px" placeholder="Что получилось, что мешало, за что благодарен…">${esc(dd.note || '')}</textarea>
    <div class="row" style="margin-top:8px"><button class="btn" id="micBtn">🎤 Надиктовать</button>
      <span class="mute grow" id="micState"></span></div>
  </div>`;

  $('#prevD').onclick = () => { viewDate = addDays(viewDate, -1); render(); };
  $('#nextD').onclick = () => { viewDate = addDays(viewDate, 1); render(); };
  $('#toToday') && ($('#toToday').onclick = () => { viewDate = new Date(); render(); });
  $('#view').querySelectorAll('[data-mark]').forEach(el => el.onclick = () => setDay(k, d => {
    d.marks = d.marks || {}; const cur = d.marks[el.dataset.mark];
    d.marks[el.dataset.mark] = !cur ? 'done' : cur === 'done' ? 'skip' : undefined;
    if (!d.marks[el.dataset.mark]) delete d.marks[el.dataset.mark]; render(); }));
  $('#view').querySelectorAll('[data-hab]').forEach(el => el.onclick = () => setDay(k, d => {
    d.habits = d.habits || {}; d.habits[el.dataset.hab] = !d.habits[el.dataset.hab];
    if (!d.habits[el.dataset.hab]) delete d.habits[el.dataset.hab]; render(); }));
  $('#view').querySelectorAll('[data-exp]').forEach(el => el.onclick = () => { const n = $('#n-' + el.dataset.exp); n && n.classList.toggle('hidden'); });
  $('#view').querySelectorAll('[data-start]').forEach(el => el.onclick = () => { startCat(el.dataset.start); });
  const note = $('#dayNote'); let nt;
  note.oninput = () => { clearTimeout(nt); nt = setTimeout(() => setDay(k, d => { d.note = note.value; }), 600); };
  $('#micBtn').onclick = () => toggleDictation(note, $('#micBtn'), $('#micState'));
  $('#toDiary').onclick = () => { stopDictation(); VIEW = 'diary'; render(); window.scrollTo(0, 0); };
}

/* ---------- voice dictation (Web Speech API) ---------- */
let REC = null, recOn = false;
function stopDictation() { recOn = false; try { REC && REC.stop(); } catch {} }
function toggleDictation(ta, btn, state) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('Этот браузер не умеет распознавать речь. Откройте в Chrome или нажмите 🎤 на клавиатуре телефона'); return; }
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
          committed += sep + t.charAt(0).toUpperCase() + t.slice(1);
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
      btn.textContent = '🎤 Надиктовать'; btn.style.background = ''; state.textContent = '';
    };
    REC.start();
  };
  if (committed && !/\n$/.test(committed)) committed += '\n';
  recOn = true; btn.textContent = '■ Остановить'; btn.style.background = 'var(--danger)';
  state.textContent = 'Говорите… текст появится в поле';
  try { startOne(); } catch { recOn = false; toast('Не удалось включить микрофон'); }
}

/* ---------- DIARY ---------- */
let diaryQ = '';
function diaryEntries() {
  return Object.entries(S.days).filter(([, d]) => d && (d.note || '').trim())
    .sort((a, b) => a[0] < b[0] ? 1 : -1);
}
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
const longDate = k => cap(parseKey(k).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(' г.', ''));
function renderDiary() {
  const all = diaryEntries(), q = diaryQ.toLowerCase();
  const list = q ? all.filter(([k, d]) => d.note.toLowerCase().includes(q) || longDate(k).includes(q)) : all;
  $('#view').innerHTML = `
  <div class="row" style="margin-bottom:10px"><button class="ghost small" id="dBack">← Сегодня</button><span class="grow"></span>
    <span class="mute">Записей: ${all.length}</span></div>
  <div class="card"><h2>Скачать дневник</h2>
    <div class="row" style="flex-wrap:wrap"><button class="ghost" data-dl="docx">Word (.doc)</button>
    <button class="ghost" data-dl="txt">Текст (.txt)</button><button class="ghost" data-dl="md">Markdown (.md)</button>
    <button class="ghost" id="dCopy">Скопировать всё</button></div></div>
  <input id="dSearch" placeholder="Поиск по дневнику…" value="${esc(diaryQ)}" style="margin-bottom:12px">
  ${list.map(([k, d]) => `<div class="card"><div class="row"><div class="grow" style="font-weight:700">${esc(longDate(k))}</div>
      <button class="ghost small" data-open="${k}">✎</button></div>
      <div style="white-space:pre-wrap;margin-top:6px">${esc(d.note)}</div></div>`).join('')
    || '<div class="mute">Пока записей нет. Надиктуйте заметку на вкладке «Сегодня».</div>'}`;
  $('#dBack').onclick = () => { VIEW = 'today'; viewDate = new Date(); render(); };
  const si = $('#dSearch'); si.oninput = () => { diaryQ = si.value; const p = si.selectionStart; render(); const n = $('#dSearch'); n.focus(); n.setSelectionRange(p, p); };
  $('#view').querySelectorAll('[data-open]').forEach(b => b.onclick = () => { VIEW = 'today'; viewDate = parseKey(b.dataset.open); render(); setTimeout(() => $('#dayNote')?.focus(), 50); });
  $('#view').querySelectorAll('[data-dl]').forEach(b => b.onclick = () => downloadDiary(b.dataset.dl));
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
    const body = diaryEntries().reverse().map(([k, d]) => `<h2>${esc(longDate(k))}</h2>` +
      d.note.trim().split('\n').map(p => `<p>${esc(p)}</p>`).join('')).join('');
    blob = new Blob(['\ufeff<html><head><meta charset="utf-8"><title>Дневник</title></head><body style="font-family:Calibri,Arial;font-size:12pt"><h1>Дневник</h1>' + body + '</body></html>'], { type: 'application/msword' });
    ext = 'doc';
  } else blob = new Blob(['\ufeff' + diaryText(fmt)], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `Дневник_${dkey(new Date())}.${ext}`; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* ---------- TIME LOG ---------- */
function startCat(cat) {
  const t = now(), r = running();
  if (r) { if (r[1].cat === cat) { toast('Уже идёт: ' + CATS[cat].n); return; } S.log[r[0]] = { ...r[1], end: t, u: t }; }
  S.log[uid()] = { u: t, cat, start: t, end: null };
  persist(); toast('Начат учёт: ' + CATS[cat].n); render();
}
function stopRunning() { const r = running(); if (!r) return; const t = now(); S.log[r[0]] = { ...r[1], end: t, u: t }; persist(); render(); }
function minutesByCat(from, to) {
  const res = {}; const t = now();
  live(S.log).forEach(([, e]) => {
    const s = Math.max(e.start, from), en = Math.min(e.end || t, to);
    if (en > s) res[e.cat] = (res[e.cat] || 0) + (en - s) / 60000;
  });
  return res;
}
function planByCat(fromDate, days) {
  const res = {};
  for (let i = 0; i < days; i++) templateFor(addDays(fromDate, i)).blocks.forEach(b => {
    res[b.cat] = (res[b.cat] || 0) + durMin(b.start, b.end); });
  return res;
}
function bars(actual, plan) {
  const max = Math.max(1, ...Object.keys(CATS).map(c => Math.max(actual[c] || 0, plan?.[c] || 0)));
  return Object.entries(CATS).filter(([c]) => (actual[c] || 0) > 0 || (plan?.[c] || 0) > 0).map(([c, v]) => `
    <div class="hbar"><span class="lbl">${v.n}</span>
      <div class="track"><div class="fill" style="width:${(actual[c] || 0) / max * 100}%;background:${v.c}"></div>
      ${plan?.[c] ? `<div class="plan" style="left:${plan[c] / max * 100}%" title="План"></div>` : ''}</div>
      <span class="val">${fmtH(actual[c] || 0)}${plan?.[c] ? `<br><span class="mute">из ${fmtH(plan[c])}</span>` : ''}</span></div>`).join('')
    || '<div class="mute">Пока нет записей.</div>';
}
let tick;
function renderTime() {
  const r = running(), today = new Date(); const from = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const entries = live(S.log).filter(([, e]) => (e.end || now()) > from).sort((a, b) => b[1].start - a[1].start);
  $('#view').innerHTML = `
  <div class="card">
    <h2>Чем я сейчас занят</h2>
    ${r ? `<div class="row"><span class="pill" style="background:${CATS[r[1].cat].c}">${CATS[r[1].cat].n}</span>
      <span class="mute">с ${hm(r[1].start)}</span></div>
      <div class="row"><div class="timer grow" id="timer">${fmtClock(now() - r[1].start)}</div>
      <button class="btn" id="stop" style="background:var(--danger);color:#fff">■ Стоп</button></div>`
      : '<div class="mute" style="margin-bottom:8px">Учёт не идёт. Нажмите категорию, когда начинаете дело — так будет видно, куда уходит время.</div>'}
    <div class="cats" style="margin-top:10px">${Object.entries(CATS).map(([k, v]) =>
      `<button class="cat ${r && r[1].cat === k ? 'on' : ''}" style="background:${v.c}" data-c="${k}">${v.n}</button>`).join('')}</div>
  </div>
  <div class="card"><h2>Сегодня: факт и план</h2>${bars(minutesByCat(from, from + 86400000), planByCat(today, 1))}
    <div class="mute" style="margin-top:6px">Чёрная черта — сколько запланировано.</div></div>
  <div class="card"><div class="row"><h2 class="grow" style="margin:0">Записи за сегодня</h2>
    <button class="ghost small" id="addLog">+ Добавить вручную</button></div>
    ${entries.map(([id, e]) => `<div class="block"><div class="bar" style="background:${CATS[e.cat]?.c}"></div>
      <div class="time">${hm(e.start)}–${e.end ? hm(e.end) : '…'}</div>
      <div class="grow">${CATS[e.cat]?.n}<div class="mute">${fmtH(((e.end || now()) - e.start) / 60000)}</div></div>
      <button class="ghost small" data-edit="${id}">✎</button></div>`).join('') || '<div class="mute">Нет записей.</div>'}
  </div>`;
  $('#view').querySelectorAll('[data-c]').forEach(b => b.onclick = () => startCat(b.dataset.c));
  $('#stop') && ($('#stop').onclick = stopRunning);
  $('#addLog').onclick = () => editLog(null);
  $('#view').querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editLog(b.dataset.edit));
  clearInterval(tick);
  if (r) tick = setInterval(() => { const t = $('#timer'); if (!t || VIEW !== 'time') return clearInterval(tick); t.textContent = fmtClock(now() - r[1].start); }, 1000);
}
function editLog(id) {
  const e = id ? S.log[id] : { cat: 'work', start: now() - 3600000, end: now() };
  const k = dkey(new Date(e.start));
  openDlg(`<h3>${id ? 'Изменить запись' : 'Новая запись'}</h3>
    <label>Категория</label><select id="lc">${catOptions(e.cat)}</select>
    <label>Дата</label><input type="date" id="ld" value="${k}">
    <div class="row"><div class="grow"><label>Начало</label><input type="time" id="ls" value="${hm(e.start)}"></div>
    <div class="grow"><label>Конец</label><input type="time" id="le" value="${e.end ? hm(e.end) : ''}"></div></div>
    <div class="row" style="margin-top:14px">${id ? '<button class="ghost danger" id="ldel">Удалить</button>' : ''}<span class="grow"></span>
    <button class="ghost" id="lx">Отмена</button><button class="btn" id="lok">Сохранить</button></div>`, () => {
    $('#lx').onclick = closeDlg;
    $('#ldel') && ($('#ldel').onclick = () => { S.log[id] = { u: now(), deleted: true }; persist(); closeDlg(); render(); });
    $('#lok').onclick = () => {
      const base = parseKey($('#ld').value).getTime();
      const s = base + toMin($('#ls').value) * 60000;
      let en = $('#le').value ? base + toMin($('#le').value) * 60000 : null;
      if (en !== null && en <= s) en += 86400000;
      S.log[id || uid()] = { u: now(), cat: $('#lc').value, start: s, end: en };
      persist(); closeDlg(); render();
    };
  });
}

/* ---------- WEEK ---------- */
function weekKey(ws) { return 'w-' + dkey(ws); }
function renderWeek() {
  const ws = addDays(weekStart(new Date()), weekOffset * 7), from = ws.getTime(), to = addDays(ws, 7).getTime();
  const days = [...Array(7)].map((_, i) => addDays(ws, i));
  const habits = live(S.habits).sort((a, b) => a[1].order - b[1].order);
  const rv = S.reviews[weekKey(ws)] || {};
  const blocksDone = days.reduce((a, d) => { const dd = day(dkey(d)); return a + Object.values(dd.marks || {}).filter(x => x === 'done').length; }, 0);
  const blocksAll = days.reduce((a, d) => a + templateFor(d).blocks.length, 0);
  const label = `${ws.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} – ${addDays(ws, 6).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`;
  $('#view').innerHTML = `
  <div class="row" style="margin-bottom:10px"><button class="ghost small" id="pw">◀</button>
    <div class="grow" style="text-align:center;font-weight:600">${label}</div><button class="ghost small" id="nw">▶</button></div>
  <div class="card"><h2>Куда ушло время</h2>${bars(minutesByCat(from, to), planByCat(ws, 7))}</div>
  <div class="card"><h2>Привычки</h2>
    <div class="weekgrid"><span></span>${days.map(d => `<span class="h">${WD[d.getDay()]}</span>`).join('')}
    ${habits.map(([id, h]) => `<span style="padding-right:6px">${esc(h.name)}</span>${days.map(d =>
      `<span class="c ${day(dkey(d)).habits?.[id] ? 'on' : ''}"></span>`).join('')}`).join('')}</div>
    <div class="mute" style="margin-top:8px">Блоков расписания выполнено: ${blocksDone} из ${blocksAll}</div></div>
  <div class="card"><h2>Разбор недели</h2>
    <label>Что получилось хорошо?</label><textarea id="r1">${esc(rv.good || '')}</textarea>
    <label>Что не получилось и почему?</label><textarea id="r2">${esc(rv.bad || '')}</textarea>
    <label>Что меняю на следующей неделе?</label><textarea id="r3">${esc(rv.change || '')}</textarea>
    <div class="row" style="margin-top:10px"><span class="grow mute">${rv.u ? 'Сохранено' : ''}</span><button class="btn" id="rs">Сохранить</button></div></div>`;
  $('#pw').onclick = () => { weekOffset--; render(); };
  $('#nw').onclick = () => { weekOffset++; render(); };
  $('#rs').onclick = () => { S.reviews[weekKey(ws)] = { u: now(), good: $('#r1').value, bad: $('#r2').value, change: $('#r3').value };
    persist(); toast('Разбор сохранён'); render(); };
}

/* ---------- GOALS ---------- */
function weightChart() {
  const pts = live(S.weights).map(([k, w]) => [parseKey(k).getTime(), w.kg]).sort((a, b) => a[0] - b[0]);
  if (pts.length < 2) return '<div class="mute">График появится после второго взвешивания.</div>';
  const W = 320, H = 140, P = 28, x0 = pts[0][0], x1 = pts[pts.length - 1][0] || x0 + 1;
  const ys = pts.map(p => p[1]).concat(80); const y0 = Math.min(...ys) - 1, y1 = Math.max(...ys) + 1;
  const X = t => P + (t - x0) / ((x1 - x0) || 1) * (W - P - 8), Y = v => 8 + (y1 - v) / (y1 - y0) * (H - P);
  return `<svg viewBox="0 0 ${W} ${H}" width="100%">
    <line x1="${P}" x2="${W - 8}" y1="${Y(80)}" y2="${Y(80)}" stroke="var(--c-sport)" stroke-dasharray="4 4"/>
    <text x="${W - 8}" y="${Y(80) - 4}" text-anchor="end">цель 80</text>
    <polyline fill="none" stroke="var(--accent)" stroke-width="2.5" points="${pts.map(p => X(p[0]) + ',' + Y(p[1])).join(' ')}"/>
    ${pts.map(p => `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="3" fill="var(--accent)"/>`).join('')}
    <text x="2" y="${Y(y1 - 1) + 4}">${(y1 - 1).toFixed(0)}</text><text x="2" y="${Y(y0 + 1) + 4}">${(y0 + 1).toFixed(0)}</text>
  </svg>`;
}
function renderGoals() {
  const goals = live(S.goals).sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0));
  const ws = live(S.weights).sort((a, b) => a[0] < b[0] ? 1 : -1);
  const last = ws[0]?.[1].kg, first = ws[ws.length - 1]?.[1].kg;
  $('#view').innerHTML = `
  <div class="card"><h2>Вес</h2>
    <div class="row"><div class="grow"><div style="font-size:26px;font-weight:700">${last ?? '—'} кг</div>
      <div class="mute">${first && last ? `с начала: ${(last - first).toFixed(1)} кг · до цели: ${(last - 80).toFixed(1)} кг` : ''}</div></div>
      <input type="number" step="0.1" id="wkg" placeholder="кг" style="width:90px"><button class="btn" id="wadd">+</button></div>
    <div style="margin-top:10px">${weightChart()}</div></div>
  ${goals.map(([id, g]) => { const done = (g.steps || []).filter(s => s.done).length;
    return `<div class="card"><div class="row"><div class="grow" style="font-weight:700;font-size:17px">${esc(g.title)}</div>
      <button class="ghost small" data-ge="${id}">✎</button></div>
      ${g.why ? `<div class="mute">Зачем: ${esc(g.why)}</div>` : ''}
      ${g.metric ? `<div style="margin:6px 0"><b>Результат:</b> ${esc(g.metric)}</div>` : ''}
      <div class="mute">Шаги ${done}/${(g.steps || []).length}</div>
      ${(g.steps || []).map(s => `<div class="goal-step ${s.done ? 'done' : ''}"><button class="chk ${s.done ? 'on' : ''}" data-gs="${id}|${s.id}" style="width:26px;height:26px;font-size:13px">${s.done ? '✓' : ''}</button><span>${esc(s.t)}</span></div>`).join('')}
    </div>`; }).join('')}
  <button class="ghost" id="gadd" style="width:100%">+ Новая цель</button>`;
  $('#wadd').onclick = () => { const v = parseFloat($('#wkg').value.replace(',', '.')); if (!(v > 30 && v < 250)) return toast('Введите вес в кг');
    S.weights[dkey(new Date())] = { u: now(), kg: v }; persist(); toast('Вес записан'); render(); };
  $('#gadd').onclick = () => editGoal(null);
  $('#view').querySelectorAll('[data-ge]').forEach(b => b.onclick = () => editGoal(b.dataset.ge));
  $('#view').querySelectorAll('[data-gs]').forEach(b => b.onclick = () => {
    const [gid, sid] = b.dataset.gs.split('|'); const g = structuredClone(S.goals[gid]);
    const s = g.steps.find(x => x.id === sid); s.done = !s.done; g.u = now(); S.goals[gid] = g; persist(); render(); });
}
function editGoal(id) {
  const g = id ? S.goals[id] : { title: '', why: '', metric: '', steps: [] };
  openDlg(`<h3>${id ? 'Цель' : 'Новая цель'}</h3>
    <label>Цель</label><input id="gt" value="${esc(g.title)}">
    <label>Зачем мне это</label><input id="gw" value="${esc(g.why)}">
    <label>Измеримый результат и срок</label><input id="gm" value="${esc(g.metric)}">
    <label>Шаги (каждый с новой строки)</label><textarea id="gs" style="min-height:120px">${esc((g.steps || []).map(s => s.t).join('\n'))}</textarea>
    <div class="row" style="margin-top:14px">${id ? '<button class="ghost danger" id="gdel">Удалить</button>' : ''}<span class="grow"></span>
    <button class="ghost" id="gx">Отмена</button><button class="btn" id="gok">Сохранить</button></div>`, () => {
    $('#gx').onclick = closeDlg;
    $('#gdel') && ($('#gdel').onclick = () => { S.goals[id] = { u: now(), deleted: true }; persist(); closeDlg(); render(); });
    $('#gok').onclick = () => {
      if (!$('#gt').value.trim()) return toast('Введите цель');
      const old = g.steps || [];
      const steps = $('#gs').value.split('\n').map(x => x.trim()).filter(Boolean)
        .map(t => old.find(s => s.t === t) || { id: uid(), t, done: false });
      S.goals[id || uid()] = { u: now(), order: g.order ?? live(S.goals).length, title: $('#gt').value.trim(),
        why: $('#gw').value.trim(), metric: $('#gm').value.trim(), steps };
      persist(); closeDlg(); render();
    };
  });
}

/* ---------- SETTINGS ---------- */
function renderSettings() {
  const tpl = S.templates[tplTab] || { blocks: [] };
  const blocks = [...tpl.blocks].sort((a, b) => toMin(a.start) - toMin(b.start));
  const habits = live(S.habits).sort((a, b) => a[1].order - b[1].order);
  $('#view').innerHTML = `
  <div class="card"><h2>Расписание</h2>
    <div class="daytabs">${Object.entries(DAY_TYPES).map(([k, n]) => `<button class="ghost small ${k === tplTab ? 'on' : ''}" data-tt="${k}">${n}</button>`).join('')}</div>
    ${blocks.map(b => `<div class="block"><div class="bar" style="background:${CATS[b.cat]?.c}"></div>
      <div class="time">${b.start}–${b.end}</div><div class="grow">${esc(b.title)}<div class="mute">${CATS[b.cat]?.n}</div></div>
      <button class="ghost small" data-be="${b.id}">✎</button></div>`).join('')}
    <button class="ghost" id="badd" style="width:100%;margin-top:8px">+ Добавить блок</button></div>
  <div class="card"><h2>Привычки</h2>
    ${habits.map(([id, h], i) => `<div class="row" style="margin:6px 0"><input value="${esc(h.name)}" data-hn="${id}">
      <button class="ghost small" data-hu="${id}" ${i === 0 ? 'disabled' : ''}>↑</button>
      <button class="ghost small danger" data-hd="${id}">✕</button></div>`).join('')}
    <button class="ghost" id="hadd" style="width:100%;margin-top:6px">+ Привычка</button></div>
  <div class="card"><h2>Синхронизация телефон ↔ компьютер</h2>
    <div class="mute">Данные хранятся в вашем приватном репозитории GitHub (файл data.json).</div>
    <label>Логин GitHub</label><input id="so" value="${esc(CFG.owner || '')}" autocomplete="off">
    <label>Приватный репозиторий для данных</label><input id="sr" value="${esc(CFG.repo || '')}" placeholder="Life_Planner_Data" autocomplete="off">
    <label>Токен доступа</label><input id="st" type="password" value="${esc(CFG.token || '')}" autocomplete="off">
    <div class="row" style="margin-top:10px"><span class="grow mute">${CFG.lastSync ? 'Последняя синхронизация: ' + new Date(CFG.lastSync).toLocaleString('ru-RU') : 'Ещё не синхронизировано'}</span>
    <button class="btn" id="ssave">Сохранить и синхронизировать</button></div></div>
  ${CFG.token ? `<div class="card"><h2>Подключить телефон</h2>
    <div class="mute">Откройте камеру телефона и наведите на этот код — приложение откроется уже подключённым. Никому не показывайте этот код: в нём ключ доступа к вашим данным.</div>
    <button class="ghost" id="qrbtn" style="margin-top:8px">Показать QR-код</button><div id="qr" style="margin-top:10px;background:#fff;padding:10px;width:max-content" class="hidden"></div></div>` : ''}
  <div class="card"><h2>Резервная копия</h2>
    <div class="row"><button class="ghost" id="exp">Скопировать данные</button><button class="ghost" id="imp">Вставить данные</button></div></div>
  <div class="card"><h2>Установка</h2><div class="mute">
    <b>Android (Chrome):</b> меню ⋮ → «Добавить на главный экран» / «Установить приложение».<br>
    <b>Windows (Chrome/Edge):</b> значок ⊕ «Установить» справа в адресной строке.<br>
    <b>iPhone (Safari):</b> «Поделиться» → «На экран Домой».</div></div>`;
  $('#view').querySelectorAll('[data-tt]').forEach(b => b.onclick = () => { tplTab = b.dataset.tt; render(); });
  $('#badd').onclick = () => editBlock(null);
  $('#view').querySelectorAll('[data-be]').forEach(b => b.onclick = () => editBlock(b.dataset.be));
  $('#view').querySelectorAll('[data-hn]').forEach(inp => inp.onchange = () => {
    S.habits[inp.dataset.hn] = { ...S.habits[inp.dataset.hn], name: inp.value.trim() || S.habits[inp.dataset.hn].name, u: now() }; persist(); });
  $('#view').querySelectorAll('[data-hd]').forEach(b => b.onclick = () => { S.habits[b.dataset.hd] = { u: now(), deleted: true }; persist(); render(); });
  $('#view').querySelectorAll('[data-hu]').forEach(b => b.onclick = () => {
    const i = habits.findIndex(([id]) => id === b.dataset.hu); if (i < 1) return;
    const [a, c] = [habits[i - 1], habits[i]]; const t = now();
    S.habits[a[0]] = { ...a[1], order: c[1].order, u: t }; S.habits[c[0]] = { ...c[1], order: a[1].order, u: t };
    if (a[1].order === c[1].order) S.habits[c[0]].order = a[1].order - 0.5;
    persist(); render(); });
  $('#hadd').onclick = () => { const o = Math.max(0, ...habits.map(([, h]) => h.order)) + 1;
    S.habits[uid()] = { u: now(), name: 'Новая привычка', order: o }; persist(); render(); };
  $('#qrbtn') && ($('#qrbtn').onclick = () => {
    const box = $('#qr'); box.classList.toggle('hidden'); if (box.dataset.done) return;
    const payload = btoa(unescape(encodeURIComponent(JSON.stringify({ o: CFG.owner, r: CFG.repo, t: CFG.token }))));
    const link = location.origin + location.pathname + '#setup=' + payload;
    if (window.QRCode) { new QRCode(box, { text: link, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.L }); box.dataset.done = 1; }
    else box.textContent = 'QR не загрузился (нет интернета?)';
  });
  $('#ssave').onclick = () => { CFG.owner = $('#so').value.trim(); CFG.repo = $('#sr').value.trim(); CFG.token = $('#st').value.trim(); saveCfg(); sync(true); };
  $('#exp').onclick = async () => { try { await navigator.clipboard.writeText(JSON.stringify(S)); toast('Данные скопированы'); } catch { toast('Не удалось скопировать'); } };
  $('#imp').onclick = () => openDlg(`<h3>Вставить данные</h3><div class="mute">Вставьте ранее скопированные данные. Они объединятся с текущими.</div>
    <textarea id="impt" style="min-height:160px"></textarea><div class="row" style="margin-top:10px"><span class="grow"></span>
    <button class="ghost" id="ix">Отмена</button><button class="btn" id="iok">Импорт</button></div>`, () => {
    $('#ix').onclick = closeDlg;
    $('#iok').onclick = () => { try { S = merge(S, JSON.parse($('#impt').value)); persist(); closeDlg(); toast('Импортировано'); render(); } catch { toast('Неверные данные'); } };
  });
}
function editBlock(id) {
  const tpl = structuredClone(S.templates[tplTab] || { blocks: [] });
  const b = id ? tpl.blocks.find(x => x.id === id) : { start: '09:00', end: '10:00', title: '', cat: 'work', note: '' };
  openDlg(`<h3>${id ? 'Блок расписания' : 'Новый блок'} · ${DAY_TYPES[tplTab]}</h3>
    <div class="row"><div class="grow"><label>Начало</label><input type="time" id="bs" value="${b.start}"></div>
    <div class="grow"><label>Конец</label><input type="time" id="be" value="${b.end}"></div></div>
    <label>Название</label><input id="bt" value="${esc(b.title)}">
    <label>Сфера</label><select id="bc">${catOptions(b.cat)}</select>
    <label>Заметка (что именно делать)</label><textarea id="bn">${esc(b.note)}</textarea>
    <div class="row" style="margin-top:14px">${id ? '<button class="ghost danger" id="bdel">Удалить</button>' : ''}<span class="grow"></span>
    <button class="ghost" id="bx">Отмена</button><button class="btn" id="bok">Сохранить</button></div>`, () => {
    $('#bx').onclick = closeDlg;
    $('#bdel') && ($('#bdel').onclick = () => { tpl.blocks = tpl.blocks.filter(x => x.id !== id); tpl.u = now(); S.templates[tplTab] = tpl; persist(); closeDlg(); render(); });
    $('#bok').onclick = () => {
      if (!$('#bt').value.trim()) return toast('Введите название');
      const nb = { id: id || uid(), start: $('#bs').value, end: $('#be').value, title: $('#bt').value.trim(), cat: $('#bc').value, note: $('#bn').value };
      tpl.blocks = id ? tpl.blocks.map(x => x.id === id ? nb : x) : [...tpl.blocks, nb];
      tpl.u = now(); S.templates[tplTab] = tpl; persist(); closeDlg(); render();
    };
  });
}

/* ---------- boot ---------- */
function clock() { $('#clock').textContent = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); }
clock(); setInterval(() => { clock(); if (VIEW === 'today' && !recOn && $('#dlg').classList.contains('hidden') && document.activeElement?.tagName !== 'TEXTAREA') renderToday(); }, 60000);
persist(true); render();
if (syncReady()) { setDot('', 'Ожидает синхронизации'); sync(); } else setDot('', 'Синхронизация не настроена');
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { sync(); render(); } });
setInterval(() => { if (document.visibilityState === 'visible') sync(); }, 120000);
if ('serviceWorker' in navigator) { try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch {} }
