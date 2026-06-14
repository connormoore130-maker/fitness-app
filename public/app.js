/* ── APEX Fitness App ──────────────────────────────────── */

const DAYS_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const STRENGTH_KEYWORDS = ['weight training','gym','crossfit','lifting','push','pull','legs','full body','strength','chest','back','shoulder','arm','bicep','tricep','abs','core','squat','deadlift','bench','overhead'];

// ── Settings ──────────────────────────────────────────────
const Settings = {
  defaults: { name:'', calorieGoal:2000, weightUnit:'lbs', proteinGoal:160, goalWeight:null },
  get() { try { return {...this.defaults,...JSON.parse(localStorage.getItem('apex-settings')||'{}')}; } catch { return {...this.defaults}; } },
  set(obj) { localStorage.setItem('apex-settings', JSON.stringify({...this.get(),...obj})); },
};

// ── API ───────────────────────────────────────────────────
const api = {
  async get(p)      { const r=await fetch(p); if(!r.ok) throw new Error(); return r.json(); },
  async post(p,b)   { const r=await fetch(p,{method:'POST',  headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}); if(!r.ok) throw new Error(); return r.json(); },
  async del(p)      { const r=await fetch(p,{method:'DELETE'}); if(!r.ok) throw new Error(); return r.json(); },
  async patch(p,b)  { const r=await fetch(p,{method:'PATCH',  headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}); if(!r.ok) throw new Error(); return r.json(); },
};

// ── NLP ───────────────────────────────────────────────────
function parseWorkout(text) {
  const t = text.toLowerCase();
  let duration_mins = null;
  const mHM=t.match(/(\d+)\s*h(?:ours?|rs?)\s*(?:and\s+)?(\d+)\s*m(?:inutes?|ins?)/);
  const mH=t.match(/(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)/);
  const mM=t.match(/(\d+)\s*m(?:inutes?|ins?)/);
  if(mHM)duration_mins=+mHM[1]*60+ +mHM[2];
  else if(/half\s+(?:an?\s+)?hour/.test(t))duration_mins=30;
  else if(/\ban?\s+hour\b/.test(t))duration_mins=60;
  else if(mH)duration_mins=Math.round(+mH[1]*60);
  else if(mM)duration_mins=+mM[1];
  const am=[
    {keys:['muay thai'],label:'Muay Thai',emoji:'🥊'},
    {keys:['kickboxing','kick boxing'],label:'Kickboxing',emoji:'🥊'},
    {keys:['boxing'],label:'Boxing',emoji:'🥊'},
    {keys:['bjj','jiu jitsu','grappling','wrestling'],label:'BJJ',emoji:'🤼'},
    {keys:['mma','mixed martial'],label:'MMA',emoji:'🥊'},
    {keys:['running','jogging','sprint','jog'],label:'Running',emoji:'🏃'},
    {keys:['cycling','biking','bike'],label:'Cycling',emoji:'🚴'},
    {keys:['swimming','swim'],label:'Swimming',emoji:'🏊'},
    {keys:['rowing','row','erg'],label:'Rowing',emoji:'🚣'},
    {keys:['hiit','circuit training','circuit'],label:'HIIT',emoji:'⚡'},
    {keys:['cardio','aerobics'],label:'Cardio',emoji:'💓'},
    {keys:['crossfit','cross fit','wod'],label:'CrossFit',emoji:'🏋️'},
    {keys:['push day','push'],label:'Weight Training – Push',emoji:'🏋️'},
    {keys:['pull day','pull'],label:'Weight Training – Pull',emoji:'🏋️'},
    {keys:['leg day','legs'],label:'Weight Training – Legs',emoji:'🏋️'},
    {keys:['chest day','chest workout','chest press','chest'],label:'Weight Training – Push',emoji:'🏋️'},
    {keys:['back day','back workout','back training'],label:'Weight Training – Pull',emoji:'🏋️'},
    {keys:['shoulder day','shoulders','ohp','overhead press'],label:'Weight Training',emoji:'🏋️'},
    {keys:['arm day','arms day','bicep','tricep','curls','curl'],label:'Weight Training',emoji:'🏋️'},
    {keys:['abs','core','ab workout','ab day'],label:'Weight Training',emoji:'🏋️'},
    {keys:['weight','lifting','lift','barbell','dumbbell','bench','squat','deadlift','powerlifting'],label:'Weight Training',emoji:'🏋️'},
    {keys:['gym','strength training'],label:'Weight Training',emoji:'🏋️'},
    {keys:['climbing','bouldering'],label:'Climbing',emoji:'🧗'},
    {keys:['yoga','vinyasa'],label:'Yoga',emoji:'🧘'},
    {keys:['pilates'],label:'Pilates',emoji:'🧘'},
    {keys:['stretching','stretch','mobility'],label:'Stretching',emoji:'🤸'},
    {keys:['walking','walk','hiking','hike'],label:'Walking',emoji:'🚶'},
    {keys:['rest','recovery'],label:'Rest',emoji:'💤'},
  ];
  let activity=null,emoji='💪';
  for(const a of am){if(a.keys.some(k=>t.includes(k))){activity=a.label;emoji=a.emoji;break;}}
  const high=['strong','great','amazing','crushed','nailed','powerful','intense','hard','tough','brutal','fire','beast','pb','pr','best','excellent'];
  const low=['tired','exhausted','rough','struggled','easy','light','recovery','slow','meh','weak','sore'];
  let intensity='medium';
  if(high.some(k=>t.includes(k)))intensity='high';
  else if(low.some(k=>t.includes(k)))intensity='low';
  return {activity,duration_mins,intensity,emoji};
}

function isStrengthWorkout(activity) {
  if (!activity) return false;
  const l = activity.toLowerCase();
  return STRENGTH_KEYWORDS.some(k => l.includes(k));
}

function getActivityEmoji(activity) {
  if (!activity) return '💪';
  const l = activity.toLowerCase();
  if (l.includes('muay')||l.includes('boxing')||l.includes('mma')||l.includes('kickbox')) return '🥊';
  if (l.includes('bjj')||l.includes('grappling')||l.includes('wrestling')) return '🤼';
  if (l.includes('run')||l.includes('jog')||l.includes('sprint')) return '🏃';
  if (l.includes('cycl')||l.includes('bike')) return '🚴';
  if (l.includes('swim')) return '🏊';
  if (l.includes('row')) return '🚣';
  if (l.includes('hiit')||l.includes('circuit')) return '⚡';
  if (l.includes('weight')||l.includes('lift')||l.includes('gym')||l.includes('crossfit')||l.includes('push')||l.includes('pull')||l.includes('legs')||l.includes('full body')) return '🏋️';
  if (l.includes('climb')) return '🧗';
  if (l.includes('yoga')||l.includes('pilates')) return '🧘';
  if (l.includes('stretch')||l.includes('mobility')) return '🤸';
  if (l.includes('walk')||l.includes('hike')) return '🚶';
  if (l.includes('rest')) return '💤';
  if (l.includes('cardio')) return '💓';
  return '💪';
}

function movingAverage(data, w=7) {
  return data.map((_,i)=>{const s=data.slice(Math.max(0,i-w+1),i+1);return s.reduce((a,v)=>a+v,0)/s.length;});
}

function todayStr() { return new Date().toLocaleDateString('en-CA'); }
function fmtDate(d) { const dt=new Date(d+'T12:00:00'); return `${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dt.getDay()]} ${MONTHS[dt.getMonth()]} ${dt.getDate()}`; }
function fmtDateShort(d) { const dt=new Date(d+'T12:00:00'); return `${MONTHS[dt.getMonth()]} ${dt.getDate()}`; }
function escHtml(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── Count-up animation ────────────────────────────────────
function countUp(el, target, duration=700, decimals=0) {
  if (!el || target == null || isNaN(+target)) return;
  const start = performance.now();
  const from = 0;
  const to = +target;
  const step = ts => {
    const p = Math.min((ts - start) / duration, 1);
    // cubic ease-out
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = decimals ? (from + (to - from) * e).toFixed(decimals) : Math.round(from + (to - from) * e);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ── Bottom nav pill ───────────────────────────────────────
function updateNavPill(view) {
  const pill = document.getElementById('bnav-pill');
  const btn  = document.querySelector(`.bnav-item[data-view="${view}"]`);
  const nav  = document.querySelector('.bottom-nav');
  if (!pill || !btn || !nav) return;
  const navRect = nav.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  pill.style.left  = (btnRect.left - navRect.left) + 'px';
  pill.style.width = btnRect.width + 'px';
  pill.classList.add('visible');
}

function toast(msg, type='success') {
  const el=document.getElementById('toast');
  el.textContent=msg; el.className=`show ${type}`;
  clearTimeout(el._t); el._t=setTimeout(()=>{el.className='';},2600);
}

// ── Navigation ────────────────────────────────────────────
let currentView='dashboard';
function navigate(view) {
  document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden'));
  document.getElementById(`view-${view}`)?.classList.remove('hidden');
  document.querySelectorAll('.nav-item,.bnav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  currentView=view;
  updateNavPill(view);
  renderView(view);
}
document.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>navigate(btn.dataset.view)));

function renderView(v) {
  ({dashboard:renderDashboard,log:renderLog,weight:renderWeight,nutrition:renderNutrition,plan:renderPlan,settings:renderSettings,finance:renderFinance}[v]||(() => {}))();
}

// ── Dashboard ─────────────────────────────────────────────
async function renderDashboard() {
  const el = document.getElementById('view-dashboard');
  el.innerHTML = `<div class="page-header"><h1>Loading…</h1></div>`;
  const [stats, plan] = await Promise.all([api.get('/api/stats'), api.get('/api/plan')]);
  checkStreakMilestone(stats.streak);
  const s = Settings.get();
  const todayDow = new Date().getDay();
  const todayPlan = plan.find(p => p.day_of_week === (todayDow===0?7:todayDow));
  const h = new Date().getHours();
  const greeting = h<12?'Good morning':h<17?'Good afternoon':'Good evening';
  const name = s.name ? `, ${s.name}` : '';
  const calPct = Math.min(100, Math.round((stats.today.calories/s.calorieGoal)*100));
  const isOver = stats.today.calories > s.calorieGoal;
  const circ = 2*Math.PI*28;
  const offset = circ - (calPct/100)*circ;
  const wChange = stats.weight.change !== null
    ? `<span class="${stats.weight.change<=0?'pos':'neg'}">${stats.weight.change>0?'+':''}${stats.weight.change} ${stats.weight.unit}</span>`
    : '<span style="color:var(--text-3)">—</span>';
  const netDef = stats.today.net;
  const burned = stats.today.calories_burned;
  const deficitHtml = burned > 0 ? `
    <div class="deficit-banner ${netDef > 0 ? 'surplus' : ''}">
      <div>
        <div class="deficit-banner-label">${netDef <= 0 ? 'Calorie Deficit' : 'Calorie Surplus'}</div>
        <div class="deficit-banner-val">${Math.abs(netDef)} kcal</div>
      </div>
      <div style="font-size:13px;color:var(--text-2)">
        ${stats.today.calories} eaten &minus; ${burned} burned
      </div>
      <div class="deficit-banner-note">${netDef <= 0 ? '🔥 In a deficit — keep it up' : '⚠️ Over today\'s budget'}</div>
    </div>` : '';
  const goalWeight = s.goalWeight;
  const curWeight  = stats.weight.current;
  const goalHtml = goalWeight && curWeight ? (() => {
    const diff = +(curWeight - goalWeight).toFixed(1);
    const start = stats.weight.change !== null ? +(curWeight - stats.weight.change).toFixed(1) : curWeight;
    const totalToLose = Math.max(0.1, +(start - goalWeight).toFixed(1));
    const lost = Math.max(0, +(start - curWeight).toFixed(1));
    const pct = Math.min(100, Math.round((lost / totalToLose) * 100));
    return diff > 0
      ? `<div class="goal-progress">
           <div class="goal-label"><span>${lost} ${stats.weight.unit} lost</span><span>${diff} ${stats.weight.unit} to goal</span></div>
           <div class="goal-bar-wrap"><div class="goal-bar" style="width:${pct}%"></div></div>
           <div style="font-size:12px;color:var(--text-3);margin-top:2px">Goal: ${goalWeight} ${stats.weight.unit}</div>
         </div>`
      : `<div style="font-size:13px;color:var(--green);font-weight:700;margin-top:8px">🎯 Goal weight reached!</div>`;
  })() : '';

  el.innerHTML = `
    <div class="dash-hero">
      <h1>${greeting}${name}</h1>
      <p>${new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</p>
    </div>
    ${deficitHtml}
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Streak</div>
        <div class="stat-value">${stats.streak}</div>
        <div class="stat-sub">${stats.streak===1?'day':'days'} in a row</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">This Week</div>
        <div class="stat-value">${stats.week.workoutCount}</div>
        <div class="stat-sub">${stats.week.totalDuration} min active</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Weight</div>
        <div class="stat-value">${stats.weight.current??'—'}<span style="font-size:14px;font-weight:400;color:var(--text-2)"> ${stats.weight.unit}</span></div>
        <div class="stat-sub">${wChange} total</div>
        ${goalHtml}
      </div>
      <div class="stat-card">
        <div class="stat-label">Calories Today</div>
        <div class="stat-value">${stats.today.calories}</div>
        <div class="stat-sub">of ${s.calorieGoal} · ${calPct}%</div>
      </div>
    </div>
    <div class="grid-2" style="margin-bottom:20px">
      ${todayPlan ? `
        <div class="today-plan-card">
          <div class="today-plan-label">Today's Workout</div>
          <div style="font-size:26px;margin-bottom:6px">${getActivityEmoji(todayPlan.activity)}</div>
          <div class="today-plan-name">${todayPlan.activity}</div>
          <div class="today-plan-meta">${todayPlan.duration_mins>0?`${todayPlan.duration_mins} min · `:''}${todayPlan.intensity.charAt(0).toUpperCase()+todayPlan.intensity.slice(1)} intensity</div>
          ${todayPlan.completed
            ? '<div style="color:var(--green);font-size:13px;margin-top:8px;font-weight:600">✓ Completed</div>'
            : `<button class="btn btn-primary btn-sm" style="margin-top:10px;width:100%" onclick="navigate('log')">Log it →</button>`}
        </div>` : `<div class="card"><div class="card-title">Today</div><p style="color:var(--text-2);font-size:13px">Rest day — enjoy it.</p></div>`}
      <div class="card">
        <div class="card-title">Calories Today</div>
        <div class="cal-ring-wrap">
          <svg class="ring-svg" viewBox="0 0 64 64">
            <circle class="ring-bg" cx="32" cy="32" r="28"/>
            <circle class="ring-fg ${isOver?'over':''}" cx="32" cy="32" r="28" stroke-dasharray="${circ}" stroke-dashoffset="${circ}" data-offset="${offset}" ${calPct===0?'style="display:none"':''}/>
          </svg>
          <div>
            <div class="ring-text">${stats.today.calories}</div>
            <div class="ring-sub">of ${s.calorieGoal} kcal</div>
            <div class="ring-sub" style="margin-top:4px">${stats.today.protein.toFixed(0)}g protein</div>
          </div>
        </div>
      </div>
    </div>
    <div class="card"><div class="card-title">Recent Workouts</div><div id="dash-workouts">Loading…</div></div>
  `;

  // Animate calorie ring draw after paint (no layout shift — only stroke changes)
  requestAnimationFrame(() => {
    const ring = document.querySelector('.ring-fg');
    if (ring && calPct > 0) {
      setTimeout(() => { ring.style.strokeDashoffset = ring.dataset.offset; }, 80);
    }
  });

  const recent = await api.get('/api/workouts?limit=4');
  document.getElementById('dash-workouts').innerHTML = recent.length
    ? `<div class="workout-list">${recent.map(w=>workoutCard(w,false)).join('')}</div>`
    : `<div class="empty-state"><div class="empty-state-icon">🏋️</div><p>No workouts yet.</p><button class="btn btn-primary btn-sm" onclick="navigate('log')">Log Workout</button></div>`;
}

// ── Log Workout ───────────────────────────────────────────
async function renderLog() {
  const el = document.getElementById('view-log');
  const workouts = await api.get('/api/workouts?limit=30');
  const s = Settings.get();

  el.innerHTML = `
    <div class="page-header"><h1>Log Workout</h1><p>Describe your session in plain English</p></div>
    <div class="card" style="margin-bottom:16px">
      <div class="nlp-wrap">
        <textarea class="nlp-input" id="nlp-input" placeholder="e.g. did 45 mins Muay Thai, felt strong&#10;1 hour weight training, push day, crushed it&#10;ran 5k this morning, solid pace"></textarea>
      </div>
      <div id="parse-preview" class="parse-preview empty" style="margin-top:10px">Start typing to see how your workout will be parsed…</div>
      <div style="display:flex;gap:10px;margin-top:14px;align-items:center">
        <button class="btn btn-primary" id="log-btn">Save Workout</button>
        <span style="font-size:12px;color:var(--text-3)">Ctrl+Enter</span>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-title">Exercise Progress Lookup</div>
      <div style="display:flex;gap:10px;align-items:center">
        <input class="form-input" id="ex-search" placeholder="Search an exercise e.g. Bench Press…" style="flex:1" />
        <button class="btn btn-ghost btn-sm" onclick="lookupExercise()">Look Up</button>
      </div>
      <div id="ex-history" style="margin-top:12px"></div>
    </div>

    <div class="card">
      <div class="card-title">Recent Sessions</div>
      <div class="workout-list" id="workout-list">
        ${workouts.length
          ? workouts.map(w=>workoutCard(w,true,s)).join('')
          : `<div class="empty-state"><div class="empty-state-icon">📝</div><p>No workouts yet.</p></div>`}
      </div>
    </div>
  `;

  const input = document.getElementById('nlp-input');
  const preview = document.getElementById('parse-preview');
  const logBtn = document.getElementById('log-btn');

  input.addEventListener('input', () => {
    const text = input.value.trim();
    if (!text) { preview.className='parse-preview empty'; preview.textContent='Start typing to see how your workout will be parsed…'; return; }
    const p = parseWorkout(text);
    if (!p.activity && !p.duration_mins) { preview.className='parse-preview empty'; preview.innerHTML='⚠️ Include an activity (e.g. "Muay Thai") and duration (e.g. "45 mins")'; return; }
    preview.className='parse-preview';
    const chips=[];
    if (p.emoji&&p.activity) chips.push(`<span style="font-size:16px">${p.emoji}</span> <span class="parse-chip">${p.activity}</span>`);
    if (p.duration_mins) chips.push(`<span class="parse-chip">${p.duration_mins} min</span>`);
    chips.push(`<span class="parse-chip intensity-${p.intensity}">${p.intensity.charAt(0).toUpperCase()+p.intensity.slice(1)}</span>`);
    if (isStrengthWorkout(p.activity)) chips.push(`<span class="parse-chip" style="background:rgba(251,191,36,.1);color:var(--amber)">+ log exercises below</span>`);
    preview.innerHTML = chips.join('');
  });

  const doLog = async () => {
    const text = input.value.trim();
    if (!text) { toast('Enter a workout description','error'); return; }
    logBtn.disabled=true; logBtn.textContent='Saving…';
    try {
      const saved = await api.post('/api/workouts', {text});
      toast('Workout logged!');
      input.value=''; preview.className='parse-preview empty'; preview.textContent='Start typing to see how your workout will be parsed…';
      renderLog();
    } catch { toast('Failed to save','error'); logBtn.disabled=false; logBtn.textContent='Save Workout'; }
  };
  logBtn.addEventListener('click', doLog);
  input.addEventListener('keydown', e=>{ if(e.key==='Enter'&&e.ctrlKey) doLog(); });
  document.getElementById('ex-search')?.addEventListener('keydown', e=>{ if(e.key==='Enter') lookupExercise(); });
}

function workoutCard(w, showDelete, s) {
  const emoji = getActivityEmoji(w.activity);
  const name = w.activity || 'Workout';
  const isStrength = isStrengthWorkout(w.activity);
  const chips = [];
  if (w.duration_mins) chips.push(`<span class="chip">${w.duration_mins} min</span>`);
  if (w.intensity) chips.push(`<span class="chip ${w.intensity}">${w.intensity.charAt(0).toUpperCase()+w.intensity.slice(1)}</span>`);

  return `
    <div class="workout-entry intensity-${w.intensity||'medium'}" id="we-${w.id}">
      <div class="workout-emoji">${emoji}</div>
      <div class="workout-body">
        <div class="workout-name">${name}</div>
        <div class="workout-meta">${chips.join('')}</div>
        <div class="workout-raw">${escHtml(w.raw_text)}</div>
        <div style="font-size:12px;color:var(--text-3);margin-top:4px">${fmtDate(w.date)}</div>
        ${isStrength && showDelete ? `
          <button class="btn btn-sm" style="margin-top:10px;background:var(--amber-dim);color:var(--amber);border:1px solid rgba(251,191,36,.2);font-size:12px"
            onclick="toggleExerciseLogger(${w.id}, '${(s||Settings.get()).weightUnit}')">
            + Log Exercises
          </button>
          <div id="ex-logger-${w.id}" class="ex-logger hidden"></div>
        ` : ''}
      </div>
      ${showDelete ? `<button class="delete-btn" onclick="deleteWorkout(${w.id})" title="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>` : ''}
    </div>
  `;
}

// Exercise logger that expands under a workout entry
function toggleExerciseLogger(workoutId, unit) {
  const container = document.getElementById(`ex-logger-${workoutId}`);
  if (!container) return;
  if (!container.classList.contains('hidden')) { container.classList.add('hidden'); return; }
  container.classList.remove('hidden');
  renderExerciseLogger(workoutId, unit, container);
}

async function renderExerciseLogger(workoutId, unit, container) {
  const [existing, recentWeights] = await Promise.all([
    api.get(`/api/exercises?workout_id=${workoutId}`),
    api.get('/api/exercises/recent-weights'),
  ]);

  // Store recent weights in a lookup map by exercise name
  const lastWeightMap = {};
  recentWeights.forEach(e => { lastWeightMap[e.name.toLowerCase()] = e; });

  container.innerHTML = `
    <div class="ex-logger-inner">
      <div class="plan-selector">
        <button class="plan-sel-btn" onclick="loadPlanInLogger(${workoutId}, 'A', '${unit}')">
          <span style="font-size:13px">📋</span> Plan A
        </button>
        <button class="plan-sel-btn" onclick="loadPlanInLogger(${workoutId}, 'B', '${unit}')">
          <span style="font-size:13px">📋</span> Plan B
        </button>
        <button class="plan-sel-btn" onclick="showCustomExercise(${workoutId}, '${unit}')">
          <span style="font-size:13px">✏️</span> Custom
        </button>
      </div>

      <div id="plan-content-${workoutId}"></div>

      ${existing.length ? `
        <div class="saved-exercises-section">
          <div class="saved-ex-label">Logged This Session</div>
          ${existing.map(e => savedExerciseCard(e, unit)).join('')}
        </div>` : ''}
    </div>
  `;

  // Store map on container so loadPlan can access it
  container._lastWeightMap = lastWeightMap;
}

function savedExerciseCard(e, unit) {
  const maxW = e.sets.length ? Math.max(...e.sets.map(s=>s.weight||0)) : 0;
  return `
    <div class="ex-saved" id="exs-${e.id}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div class="ex-saved-name">${escHtml(e.name)}</div>
          <div class="ex-saved-sets">${e.sets.map((s,i)=>`Set ${i+1}: <strong>${s.weight||'—'}${unit}</strong> × ${s.reps}`).join(' · ')}</div>
        </div>
        <button onclick="deleteExercise(${e.id})" class="delete-btn" style="opacity:1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
        </button>
      </div>
    </div>
  `;
}

// Parse reps string to a sensible default integer
function parseDefaultReps(repsStr) {
  if (!repsStr) return '';
  const m = repsStr.match(/^(\d+)/);
  return m ? m[1] : '';
}

async function loadPlanInLogger(workoutId, planId, unit) {
  const programs = await api.get('/api/programs');
  const plan = programs.find(p => p.id === planId);
  if (!plan) return;

  const container = document.getElementById(`ex-logger-${workoutId}`);
  const lastWeightMap = container?._lastWeightMap || {};
  const content = document.getElementById(`plan-content-${workoutId}`);
  if (!content) return;

  // Highlight active plan button
  document.querySelectorAll('.plan-sel-btn').forEach(b => b.classList.remove('active'));
  event?.target?.closest('.plan-sel-btn')?.classList.add('active');

  const exerciseRows = plan.exercises.map((ex, idx) => {
    const setCount = typeof ex.sets === 'string' ? parseInt(ex.sets.split('-')[1]||ex.sets) : ex.sets;
    const last = lastWeightMap[ex.name.toLowerCase()];
    const lastHint = last ? `Last: ${last.sets.map(s=>`${s.weight||'—'}${unit}×${s.reps}`).join(', ')}` : '';
    const isTimed = ex.timed;
    const defaultReps = parseDefaultReps(ex.reps);

    const setsHtml = Array.from({length: setCount}, (_, i) => {
      const lastSetWeight = last?.sets?.[i]?.weight || '';
      if (isTimed) {
        return `
          <div class="ex-set-row">
            <span class="ex-set-label">Set ${i+1}</span>
            <input class="form-input ex-set-input" placeholder="duration / notes" id="pex-note-${workoutId}-${idx}-${i}" style="flex:1;max-width:200px" />
          </div>`;
      }
      return `
        <div class="ex-set-row">
          <span class="ex-set-label">Set ${i+1}</span>
          <input class="form-input ex-set-input" type="number" step="0.5" placeholder="${unit}" id="pex-w-${workoutId}-${idx}-${i}" value="${lastSetWeight}" />
          <span style="color:var(--text-3);font-size:13px">×</span>
          <input class="form-input ex-set-input" type="number" placeholder="reps" id="pex-r-${workoutId}-${idx}-${i}" value="${defaultReps}" />
        </div>`;
    }).join('');

    const metaChips = [
      ex.tempo ? `<span class="ex-meta-chip">⏱ ${ex.tempo}</span>` : '',
      ex.rest   ? `<span class="ex-meta-chip">💤 ${ex.rest}s</span>` : '',
      ex.rpe    ? `<span class="ex-meta-chip">RPE ${ex.rpe}</span>` : '',
    ].filter(Boolean).join('');

    return `
      <div class="plan-ex-item">
        <div class="plan-ex-header">
          <span class="plan-ex-num">${idx+1}</span>
          <div style="flex:1;min-width:0">
            <div class="plan-ex-name">${escHtml(ex.name)}</div>
            <div class="plan-ex-target">
              ${setCount} sets × ${ex.reps}
              ${metaChips}
            </div>
            ${ex.notes ? `<div class="plan-ex-note">📝 ${escHtml(ex.notes)}</div>` : ''}
            ${lastHint ? `<div class="plan-ex-last">↑ ${lastHint}</div>` : ''}
          </div>
        </div>
        <div class="plan-ex-sets">${setsHtml}</div>
      </div>
    `;
  }).join('');

  content.innerHTML = `
    <div class="plan-loaded">
      <div class="plan-loaded-header">
        <span class="plan-loaded-name">${plan.name}</span>
        <span style="font-size:12px;color:var(--text-3)">${plan.exercises.length} exercises</span>
      </div>
      ${exerciseRows}
      <button class="btn btn-primary" style="width:100%;margin-top:4px" onclick="savePlanSession(${workoutId}, '${unit}', ${JSON.stringify(plan.exercises).replace(/"/g,'&quot;')})">
        Save ${plan.name} Session
      </button>
    </div>
  `;
}

async function savePlanSession(workoutId, unit, exercises) {
  const saved = [];
  const skipped = [];

  for (let idx = 0; idx < exercises.length; idx++) {
    const ex = exercises[idx];
    const setCount = typeof ex.sets === 'string' ? parseInt(ex.sets.split('-')[1]||ex.sets) : ex.sets;
    const isTimed = ex.timed;
    const sets = [];

    for (let i = 0; i < setCount; i++) {
      if (isTimed) {
        const note = document.getElementById(`pex-note-${workoutId}-${idx}-${i}`)?.value.trim();
        if (note) sets.push({ weight: 0, reps: 0, note });
      } else {
        const weight = parseFloat(document.getElementById(`pex-w-${workoutId}-${idx}-${i}`)?.value) || 0;
        const reps   = parseInt(document.getElementById(`pex-r-${workoutId}-${idx}-${i}`)?.value)   || 0;
        if (reps > 0) sets.push({ weight, reps });
      }
    }

    if (sets.length > 0) {
      await api.post('/api/exercises', { workout_id: workoutId, name: ex.name, sets, unit });
      saved.push(ex.name);
    } else {
      skipped.push(ex.name);
    }
  }

  if (saved.length === 0) { toast('No sets logged — fill in at least one set','error'); return; }
  toast(`Saved ${saved.length} exercise${saved.length>1?'s':''}!`);

  const container = document.getElementById(`ex-logger-${workoutId}`);
  if (container) renderExerciseLogger(workoutId, unit, container);
}

function showCustomExercise(workoutId, unit) {
  const content = document.getElementById(`plan-content-${workoutId}`);
  if (!content) return;
  const sets = [{ weight:'', reps:'' }];

  const render = () => {
    content.innerHTML = `
      <div class="plan-loaded">
        <div class="plan-loaded-header"><span class="plan-loaded-name">Custom Exercise</span></div>
        <input class="form-input" id="ex-name-${workoutId}" placeholder="Exercise name" style="margin-bottom:10px" />
        <div id="custom-sets-${workoutId}">
          ${sets.map((s,i) => `
            <div class="ex-set-row">
              <span class="ex-set-label">Set ${i+1}</span>
              <input class="form-input ex-set-input" type="number" step="0.5" placeholder="${unit}" id="ex-w-${workoutId}-${i}" value="${s.weight}" />
              <span style="color:var(--text-3);font-size:13px">×</span>
              <input class="form-input ex-set-input" type="number" placeholder="reps" id="ex-r-${workoutId}-${i}" value="${s.reps}" />
            </div>`).join('')}
        </div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn btn-ghost btn-sm" id="add-cset-${workoutId}">+ Set</button>
          <button class="btn btn-primary btn-sm" onclick="saveCustomExercise(${workoutId}, '${unit}', ${sets.length})">Save</button>
        </div>
      </div>
    `;
    document.getElementById(`add-cset-${workoutId}`)?.addEventListener('click', () => {
      sets.push({weight:'',reps:''}); render();
    });
  };
  render();
}

async function saveCustomExercise(workoutId, unit, setCount) {
  const name = document.getElementById(`ex-name-${workoutId}`)?.value.trim();
  if (!name) { toast('Enter an exercise name','error'); return; }
  const sets = [];
  for (let i=0; i<setCount; i++) {
    const weight = parseFloat(document.getElementById(`ex-w-${workoutId}-${i}`)?.value) || 0;
    const reps   = parseInt(document.getElementById(`ex-r-${workoutId}-${i}`)?.value)   || 0;
    if (reps > 0) sets.push({weight,reps});
  }
  if (!sets.length) { toast('Add at least one set','error'); return; }
  await api.post('/api/exercises', {workout_id:workoutId,name,sets,unit});
  toast(`${name} saved!`);
  const container = document.getElementById(`ex-logger-${workoutId}`);
  if (container) renderExerciseLogger(workoutId, unit, container);
}

async function deleteExercise(id) {
  await api.del(`/api/exercises/${id}`);
  document.getElementById(`exs-${id}`)?.remove();
  toast('Exercise removed');
}

async function lookupExercise() {
  const name = document.getElementById('ex-search')?.value.trim();
  const container = document.getElementById('ex-history');
  if (!name || !container) return;
  container.innerHTML = '<p style="color:var(--text-2);font-size:13px">Loading…</p>';
  const history = await api.get(`/api/exercises?name=${encodeURIComponent(name)}`);
  if (!history.length) { container.innerHTML = `<p style="color:var(--text-3);font-size:13px">No history found for "${escHtml(name)}"</p>`; return; }

  // Show progression table
  container.innerHTML = `
    <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);margin-bottom:10px">${escHtml(name)} — ${history.length} session${history.length>1?'s':''}</div>
    <div class="progress-table">
      <div class="progress-header">
        <span>Date</span><span>Sets</span><span>Best Set</span><span>Vol (lbs)</span>
      </div>
      ${history.map(e => {
        const maxWeight = Math.max(...e.sets.map(s=>s.weight||0));
        const bestSet = e.sets.find(s=>s.weight===maxWeight)||e.sets[0];
        const vol = e.sets.reduce((s,st)=>s+(st.weight||0)*(st.reps||0),0);
        return `
          <div class="progress-row">
            <span>${fmtDateShort(e.date)}</span>
            <span>${e.sets.length}</span>
            <span><strong>${maxWeight}${e.unit}</strong> × ${bestSet?.reps}</span>
            <span>${vol.toLocaleString()}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

async function deleteWorkout(id) {
  await api.del(`/api/workouts/${id}`);
  document.getElementById(`we-${id}`)?.remove();
  toast('Workout deleted');
}

// ── Weight ────────────────────────────────────────────────
let weightChart = null;

async function renderWeight() {
  const el = document.getElementById('view-weight');
  const entries = await api.get('/api/weight');
  const s = Settings.get();
  const latest = entries[entries.length-1];
  const first  = entries[0];
  const change = latest && first && latest.id!==first.id ? +(latest.weight-first.weight).toFixed(1) : null;

  el.innerHTML = `
    <div class="page-header"><h1>Weight</h1><p>Track your fat loss trend over time</p></div>
    <div class="grid-2" style="margin-bottom:16px">
      <div class="card">
        <div class="card-title">Current Weight</div>
        <div class="weight-current">${latest?latest.weight:'—'}<span class="weight-unit">${s.weightUnit}</span></div>
        <div class="weight-change">${change!==null?`<span class="${change<=0?'pos':'neg'}" style="font-size:13.5px;font-weight:600">${change>0?'+':''}${change} ${s.weightUnit} since start</span>`:'<span style="color:var(--text-3);font-size:13px">Log more entries to see change</span>'}</div>
      </div>
      <div class="card">
        <div class="card-title">Log Weight</div>
        <div class="form-row" style="margin-bottom:12px">
          <div class="form-group" style="margin-bottom:0"><label class="form-label">Weight (${s.weightUnit})</label><input class="form-input" id="w-weight" type="number" step="0.1" placeholder="e.g. 175.2" /></div>
          <div class="form-group" style="margin-bottom:0"><label class="form-label">Note</label><input class="form-input" id="w-note" placeholder="fasted, PM…" /></div>
        </div>
        <button class="btn btn-primary btn-sm" id="w-save">Save Entry</button>
      </div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="card-title">Trend${entries.length>=3?' · dashed = 7-day avg':''}</div>
      ${entries.length<2?`<div class="empty-state"><div class="empty-state-icon">📈</div><p>Log at least 2 weights to see your trend.</p></div>`:`<div class="chart-container"><canvas id="weight-chart"></canvas></div>`}
    </div>
    <div class="card">
      <div class="card-title">History</div>
      <div class="weight-entries">
        ${entries.length?[...entries].reverse().slice(0,20).map(e=>`
          <div class="weight-row" id="wr-${e.id}">
            <div><div class="weight-row-val">${e.weight} ${e.unit}</div>${e.note?`<div style="font-size:12px;color:var(--text-2)">${escHtml(e.note)}</div>`:''}</div>
            <div style="display:flex;align-items:center;gap:12px">
              <div class="weight-row-date">${fmtDate(e.date)}</div>
              <button class="weight-row-del" onclick="deleteWeight(${e.id})" title="Delete">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
              </button>
            </div>
          </div>`).join(''):`<div class="empty-state"><p style="color:var(--text-3);font-size:13px">No entries yet</p></div>`}
      </div>
    </div>
  `;

  document.getElementById('w-save')?.addEventListener('click', saveWeight);
  document.getElementById('w-weight')?.addEventListener('keydown', e=>{ if(e.key==='Enter') saveWeight(); });
  if (entries.length>=2) setTimeout(()=>initWeightChart(entries), 50);
}

async function saveWeight() {
  const w = parseFloat(document.getElementById('w-weight')?.value);
  if (!w||isNaN(w)) { toast('Enter a valid weight','error'); return; }
  await api.post('/api/weight', {weight:w, unit:Settings.get().weightUnit, note:document.getElementById('w-note')?.value||''});
  toast('Weight saved!');
  renderWeight();
}

async function deleteWeight(id) {
  await api.del(`/api/weight/${id}`);
  document.getElementById(`wr-${id}`)?.remove();
  toast('Entry deleted');
}

function initWeightChart(entries) {
  const canvas = document.getElementById('weight-chart');
  if (!canvas) return;
  if (weightChart) { weightChart.destroy(); weightChart=null; }
  const labels = entries.map(e=>fmtDateShort(e.date));
  const weights = entries.map(e=>e.weight);
  const avg = movingAverage(weights,7);
  Chart.defaults.color = '#8A655A';
  Chart.defaults.borderColor = '#BAAB92';
  weightChart = new Chart(canvas, {
    type:'line',
    data:{
      labels,
      datasets:[
        {label:'Weight',data:weights,borderColor:'#A37764',backgroundColor:'rgba(163,119,100,0.08)',pointRadius:4,pointHoverRadius:6,pointBackgroundColor:'#A37764',pointBorderColor:'#fff',pointBorderWidth:2,tension:0.3,fill:true},
        {label:'7-day avg',data:avg,borderColor:'#6e9174',borderDash:[5,4],borderWidth:2,pointRadius:0,tension:0.4,fill:false},
      ]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{position:'top',labels:{boxWidth:12,boxHeight:2,padding:16,font:{size:12},color:'#8A655A'}},
        tooltip:{backgroundColor:'#fff',titleColor:'#56453F',bodyColor:'#8A655A',borderColor:'#BAAB92',borderWidth:1,padding:10,callbacks:{label:ctx=>` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}`}},
      },
      scales:{
        x:{grid:{color:'rgba(163,119,100,0.08)'},ticks:{maxTicksLimit:8,maxRotation:0,font:{size:11},color:'#A28777'}},
        y:{grid:{color:'rgba(163,119,100,0.08)'},ticks:{font:{size:11},color:'#A28777',callback:v=>v.toFixed(1)}},
      }
    }
  });
}

// ── Nutrition ─────────────────────────────────────────────
let nutritionTab = 'today';

async function renderNutrition() {
  const el = document.getElementById('view-nutrition');
  el.innerHTML = `
    <div class="page-header"><h1>Nutrition</h1></div>
    <div class="tab-bar" style="margin-bottom:20px">
      <button class="tab-btn ${nutritionTab==='today'?'active':''}" onclick="switchNutritionTab('today')">Today</button>
      <button class="tab-btn ${nutritionTab==='plan'?'active':''}" onclick="switchNutritionTab('plan')">Meal Plan</button>
    </div>
    <div id="nutrition-content"></div>
  `;
  if (nutritionTab==='today') renderNutritionToday();
  else renderMealPlan();
}

function switchNutritionTab(tab) {
  nutritionTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active',b.textContent.trim().toLowerCase()===tab||(tab==='plan'&&b.textContent.includes('Meal'))));
  if (tab==='today') renderNutritionToday();
  else renderMealPlan();
}

async function renderNutritionToday() {
  const content = document.getElementById('nutrition-content');
  const today = todayStr();
  const entries = await api.get(`/api/nutrition?date=${today}`);
  const s = Settings.get();
  const tot = entries.reduce((a,e)=>({cal:a.cal+(+e.calories||0),p:a.p+(+e.protein||0),c:a.c+(+e.carbs||0),f:a.f+(+e.fat||0)}),{cal:0,p:0,c:0,f:0});
  const mt = tot.p+tot.c+tot.f;
  const pPct=mt>0?(tot.p/mt*100).toFixed(0):0;
  const cPct=mt>0?(tot.c/mt*100).toFixed(0):0;
  const fPct=mt>0?(tot.f/mt*100).toFixed(0):0;

  content.innerHTML = `
    <div class="grid-2" style="margin-bottom:16px">
      <div class="card">
        <div class="card-title">Today · ${new Date().toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'})}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px 20px;margin-bottom:14px">
          <div><div style="font-size:32px;font-weight:800;letter-spacing:-.03em;line-height:1">${tot.cal}</div><div style="font-size:12px;color:var(--text-2);margin-top:3px">of ${s.calorieGoal} kcal</div></div>
          <div style="display:grid;gap:5px;align-content:center">
            <div style="font-size:12.5px"><span style="color:var(--accent-2);font-weight:600">${tot.p.toFixed(0)}g</span> <span style="color:var(--text-3)">protein</span></div>
            <div style="font-size:12.5px"><span style="color:var(--amber);font-weight:600">${tot.c.toFixed(0)}g</span> <span style="color:var(--text-3)">carbs</span></div>
            <div style="font-size:12.5px"><span style="color:var(--red);font-weight:600">${tot.f.toFixed(0)}g</span> <span style="color:var(--text-3)">fat</span></div>
          </div>
        </div>
        <div class="macro-bar">
          <div class="macro-bar-seg protein" style="width:${pPct}%"></div>
          <div class="macro-bar-seg carbs" style="width:${cPct}%"></div>
          <div class="macro-bar-seg fat" style="width:${fPct}%"></div>
        </div>
        <div class="macro-legend">
          <span class="macro-dot protein">P ${pPct}%</span>
          <span class="macro-dot carbs">C ${cPct}%</span>
          <span class="macro-dot fat">F ${fPct}%</span>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Log Meal</div>
        <div class="form-group"><label class="form-label">Meal</label><input class="form-input" id="n-name" placeholder="Chicken & rice, Protein shake…" /></div>
        <div class="form-row" style="margin-bottom:12px">
          <div class="form-group" style="margin-bottom:0"><label class="form-label">kcal</label><input class="form-input" id="n-cal" type="number" placeholder="0" /></div>
          <div class="form-group" style="margin-bottom:0"><label class="form-label">P (g)</label><input class="form-input" id="n-pro" type="number" placeholder="0" /></div>
          <div class="form-group" style="margin-bottom:0"><label class="form-label">C (g)</label><input class="form-input" id="n-car" type="number" placeholder="0" /></div>
          <div class="form-group" style="margin-bottom:0"><label class="form-label">F (g)</label><input class="form-input" id="n-fat" type="number" placeholder="0" /></div>
        </div>
        <button class="btn btn-primary btn-sm" id="n-save">Add Meal</button>
        <div class="quick-add-row">
          <div class="quick-add-label">Quick Add</div>
          ${[
            {n:'Whey Shake',cal:165,p:30,c:8,f:3},
            {n:'2 Eggs',cal:143,p:13,c:1,f:10},
            {n:'Chicken 150g',cal:248,p:46,c:0,f:5},
            {n:'Rice 150g',cal:195,p:4,c:43,f:1},
            {n:'Banana',cal:89,p:1,c:23,f:0},
            {n:'Greek Yogurt',cal:120,p:10,c:9,f:3},
            {n:'Oats 80g',cal:303,p:10,c:54,f:6},
            {n:'Almonds 30g',cal:173,p:6,c:6,f:15},
          ].map(f=>`<button class="quick-add-btn" onclick="quickAddFood('${f.n}',${f.cal},${f.p},${f.c},${f.f})">${f.n} · ${f.cal} kcal</button>`).join('')}
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Today's Meals</div>
      <div class="meal-list" id="meal-list">
        ${entries.length?entries.map(e=>`
          <div class="meal-row" id="mr-${e.id}">
            <div style="flex:1;min-width:0">
              <div class="meal-name">${escHtml(e.meal_name)}</div>
              <div class="meal-macros">${+e.protein||0}g P · ${+e.carbs||0}g C · ${+e.fat||0}g F</div>
            </div>
            <div class="meal-cal">${+e.calories||0}<span style="font-size:11px;font-weight:400;color:var(--text-2)"> kcal</span></div>
            <button class="meal-del" onclick="deleteMeal(${e.id})" title="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
            </button>
          </div>`).join(''):`<div class="empty-state"><div class="empty-state-icon">🍽️</div><p>No meals logged today.</p></div>`}
      </div>
    </div>
  `;
  document.getElementById('n-save')?.addEventListener('click', saveNutrition);
}

async function saveNutrition() {
  const name = document.getElementById('n-name')?.value.trim();
  if (!name) { toast('Enter a meal name','error'); return; }
  await api.post('/api/nutrition',{meal_name:name,calories:+document.getElementById('n-cal')?.value||0,protein:+document.getElementById('n-pro')?.value||0,carbs:+document.getElementById('n-car')?.value||0,fat:+document.getElementById('n-fat')?.value||0});
  toast('Meal logged!');
  renderNutritionToday();
}

async function deleteMeal(id) {
  await api.del(`/api/nutrition/${id}`);
  document.getElementById(`mr-${id}`)?.remove();
  toast('Meal removed');
}

async function quickAddFood(name, cal, protein, carbs, fat) {
  await api.post('/api/nutrition', { meal_name: name, calories: cal, protein, carbs, fat });
  toast(`${name} added!`);
  renderNutritionToday();
}

// ── Meal Plan ─────────────────────────────────────────────
const MEAL_ORDER = ['breakfast','snack1','lunch','snack2','dinner'];
const MEAL_LABELS = { breakfast:'Breakfast', snack1:'Morning Snack', lunch:'Lunch', snack2:'Afternoon Snack', dinner:'Dinner' };
const MEAL_EMOJI  = { breakfast:'☀️', snack1:'🍎', lunch:'🥗', snack2:'🥜', dinner:'🍽️' };

async function renderMealPlan() {
  const content = document.getElementById('nutrition-content');
  if (!content) return;
  content.innerHTML = '<p style="color:var(--text-2);padding:20px 0">Loading…</p>';
  const s = Settings.get();
  const plan = await api.get(`/api/meal-plan?calorieGoal=${s.calorieGoal}`);
  if (!plan.length) { content.innerHTML='<div class="empty-state"><p>No meal plan generated yet.</p></div>'; return; }

  // Group by day
  const byDay = {};
  plan.forEach(m => {
    if (!byDay[m.day_of_week]) byDay[m.day_of_week] = {};
    byDay[m.day_of_week][m.meal_type] = m;
  });

  const todayDow = new Date().getDay()===0?7:new Date().getDay();
  const dayNames = ['','Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const daysFull = ['','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

  content.innerHTML = `
    <div class="meal-plan-header">
      <div>
        <div style="font-size:14px;font-weight:600">This Week's Meal Plan</div>
        <div style="font-size:12px;color:var(--text-2);margin-top:2px">Targets ~${s.calorieGoal} kcal/day</div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="regenerateMealPlan()">↺ Regenerate</button>
    </div>

    <div class="day-tabs">
      ${Object.keys(byDay).map(d=>`
        <button class="day-tab ${+d===todayDow?'active':''}" onclick="showMealDay(${d})" data-day="${d}">${dayNames[d]}</button>
      `).join('')}
    </div>

    <div id="meal-day-content"></div>
  `;

  showMealDay(todayDow, byDay, s);
  window._mealPlanData = { byDay, s };
}

function showMealDay(dow, byDay, s) {
  if (!byDay) { byDay=window._mealPlanData?.byDay; s=window._mealPlanData?.s||Settings.get(); }
  if (!byDay) return;
  document.querySelectorAll('.day-tab').forEach(b=>b.classList.toggle('active',+b.dataset.day===+dow));
  const dayMeals = byDay[dow] || {};
  const dayNames = ['','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const totals = Object.values(dayMeals).reduce((a,m)=>({cal:a.cal+m.calories,p:a.p+m.protein,c:a.c+m.carbs,f:a.f+m.fat}),{cal:0,p:0,c:0,f:0});

  document.getElementById('meal-day-content').innerHTML = `
    <div class="card" style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-weight:600;font-size:15px">${dayNames[dow]}</div>
        <div style="font-size:13px;color:var(--text-2)">${totals.cal} kcal · ${totals.p.toFixed(0)}g P</div>
      </div>
      ${MEAL_ORDER.map(type => {
        const m = dayMeals[type];
        if (!m) return '';
        return `
          <div class="meal-plan-item">
            <div class="meal-plan-type">
              <span class="meal-plan-emoji">${MEAL_EMOJI[type]}</span>
              <span>${MEAL_LABELS[type]}</span>
            </div>
            <div class="meal-plan-name">${escHtml(m.name)}</div>
            <div class="meal-plan-meta">${m.calories} kcal · ${m.protein}g P · ${m.carbs}g C · ${m.fat}g F</div>
            ${m.notes?`<div class="meal-plan-notes">${escHtml(m.notes)}</div>`:''}
            <button class="btn btn-sm" style="margin-top:8px;font-size:11.5px;background:var(--accent-dim);color:var(--accent-2);border:1px solid rgba(124,106,238,.2)"
              onclick="logMealFromPlan(${JSON.stringify(m).replace(/"/g,'&quot;')})">
              + Log This
            </button>
          </div>
        `;
      }).join('')}
    </div>
    <div style="text-align:center;font-size:12px;color:var(--text-3);margin-top:8px">
      Daily total: ${totals.cal} kcal · ${totals.p.toFixed(0)}g protein · ${totals.c.toFixed(0)}g carbs · ${totals.f.toFixed(0)}g fat
    </div>
  `;
}

async function logMealFromPlan(meal) {
  await api.post('/api/nutrition', { meal_name: meal.name, calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat });
  toast(`${meal.name} logged!`);
}

async function regenerateMealPlan() {
  const s = Settings.get();
  await api.post('/api/meal-plan/regenerate', { calorieGoal: s.calorieGoal });
  toast('New meal plan generated!');
  renderMealPlan();
}

// ── Training Plan ─────────────────────────────────────────
async function renderPlan() {
  const el = document.getElementById('view-plan');
  el.innerHTML = `<div class="page-header"><h1>Training Plan</h1></div><div class="card"><p style="color:var(--text-2)">Loading…</p></div>`;
  const plan = await api.get('/api/plan');
  const todayDow = new Date().getDay()===0?7:new Date().getDay();

  el.innerHTML = `
    <div class="page-header">
      <h1>Training Plan</h1>
      <p>Rotates every 4 weeks · adapts based on what you complete</p>
    </div>
    <div class="card">
      <div class="card-title">This Week</div>
      <div class="plan-grid">
        ${plan.map(p=>{
          const isToday=p.day_of_week===todayDow;
          const dayLabel=['','Mon','Tue','Wed','Thu','Fri','Sat','Sun'][p.day_of_week]||'?';
          return `
            <div class="plan-day ${isToday?'today':''} ${p.completed?'completed':''}" id="pd-${p.id}">
              <div class="plan-day-label">${dayLabel}</div>
              <div class="plan-emoji">${getActivityEmoji(p.activity)}</div>
              <div class="plan-body">
                <div class="plan-activity">${p.activity}</div>
                <div class="plan-meta">
                  ${p.duration_mins>0?`<span class="chip">${p.duration_mins} min</span>`:''}
                  <span class="chip ${p.intensity}">${p.intensity.charAt(0).toUpperCase()+p.intensity.slice(1)}</span>
                  ${isToday?'<span class="chip" style="background:var(--accent-dim);color:var(--accent-2)">Today</span>':''}
                </div>
              </div>
              <button class="plan-check ${p.completed?'done':''}" onclick="togglePlan(${p.id},${p.completed})" title="Toggle complete">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
            </div>
          `;
        }).join('')}
      </div>
      <p style="font-size:12px;color:var(--text-3);margin-top:16px;line-height:1.6">
        Week templates rotate every 4 weeks for variety. High completion last week → increased intensity this week. Deload week included every 4th week.
      </p>
    </div>
  `;
}

async function togglePlan(id, currently) {
  const completed = currently ? 0 : 1;
  await api.patch(`/api/plan/${id}`, {completed});
  const row   = document.getElementById(`pd-${id}`);
  const check = row?.querySelector('.plan-check');
  row?.classList.toggle('completed', !!completed);
  check?.classList.toggle('done', !!completed);
  if (completed && check) {
    check.classList.remove('bounce');
    // force reflow so the animation restarts cleanly if toggled rapidly
    void check.offsetWidth;
    check.classList.add('bounce');
    check.addEventListener('animationend', () => check.classList.remove('bounce'), { once: true });
  }
  toast(completed ? 'Marked complete ✓' : 'Marked incomplete');
}

// ── Settings ──────────────────────────────────────────────
function renderSettings() {
  const el = document.getElementById('view-settings');
  const s = Settings.get();
  el.innerHTML = `
    <div class="page-header"><h1>Settings</h1></div>
    <div class="card" style="max-width:480px">
      <div class="settings-section">
        <div class="settings-title">Profile</div>
        <div class="form-group"><label class="form-label">Your name</label><input class="form-input" id="s-name" placeholder="e.g. Alex" value="${escHtml(s.name)}" /></div>
      </div>
      <div class="divider"></div>
      <div class="settings-section">
        <div class="settings-title">Goals</div>
        <div class="form-group"><label class="form-label">Daily calorie goal (kcal)</label><input class="form-input" id="s-cal" type="number" value="${s.calorieGoal}" /></div>
        <div class="form-group"><label class="form-label">Daily protein goal (g)</label><input class="form-input" id="s-pro" type="number" value="${s.proteinGoal}" /></div>
        <div class="form-group"><label class="form-label">Goal weight (${s.weightUnit}) — for progress tracking</label><input class="form-input" id="s-goal" type="number" step="0.1" placeholder="e.g. 165" value="${s.goalWeight||''}" /></div>
      </div>
      <div class="divider"></div>
      <div class="settings-section">
        <div class="settings-title">Units</div>
        <div class="form-group"><label class="form-label">Weight unit</label>
          <select class="form-input" id="s-unit"><option value="lbs" ${s.weightUnit==='lbs'?'selected':''}>Pounds (lbs)</option><option value="kg" ${s.weightUnit==='kg'?'selected':''}>Kilograms (kg)</option></select>
        </div>
      </div>
      <button class="btn btn-primary" id="s-save">Save Settings</button>
      <div class="divider"></div>
      <div class="settings-section">
        <div class="settings-title">Reminders</div>
        <p style="font-size:13px;color:var(--text-2);margin-bottom:14px;line-height:1.6">
          Daily push notifications: morning workout reminder at 8am, and an evening nudge at 9pm if you haven't logged yet.
          <br>You need to add this app to your Home Screen first.
        </p>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" id="s-notif-enable">Enable Reminders</button>
          <button class="btn btn-ghost btn-sm" id="s-notif-disable">Disable</button>
          <button class="btn btn-ghost btn-sm" id="s-notif-test">Send Test</button>
        </div>
        <div id="s-notif-status" style="font-size:12px;color:var(--text-3);margin-top:10px"></div>
      </div>
    </div>
  `;
  document.getElementById('s-save')?.addEventListener('click',()=>{
    const gw = parseFloat(document.getElementById('s-goal').value);
    Settings.set({name:document.getElementById('s-name').value.trim(),calorieGoal:+document.getElementById('s-cal').value||2000,proteinGoal:+document.getElementById('s-pro').value||160,weightUnit:document.getElementById('s-unit').value,goalWeight:isNaN(gw)?null:gw});
    toast('Settings saved!');
  });

  const statusEl = document.getElementById('s-notif-status');
  Push.isSubscribed().then(active => {
    statusEl.textContent = active ? '✓ Reminders are enabled' : 'Reminders are off';
  });

  document.getElementById('s-notif-enable')?.addEventListener('click', async () => {
    if (!('Notification' in window)) { toast('Notifications not supported on this browser','error'); return; }
    statusEl.textContent = 'Requesting permission…';
    const ok = await Push.subscribe();
    if (ok) { statusEl.textContent = '✓ Reminders enabled! You\'ll get a morning heads-up daily.'; toast('Reminders on!'); }
    else { statusEl.textContent = 'Permission denied — enable notifications in your browser/phone settings.'; toast('Permission denied','error'); }
  });

  document.getElementById('s-notif-disable')?.addEventListener('click', async () => {
    await Push.unsubscribe();
    statusEl.textContent = 'Reminders disabled.';
    toast('Reminders off');
  });

  document.getElementById('s-notif-test')?.addEventListener('click', async () => {
    const subscribed = await Push.isSubscribed();
    if (!subscribed) { toast('Enable reminders first','error'); return; }
    await api.post('/api/push/test', {});
    toast('Test notification sent!');
  });
}

// ── Push Notifications ────────────────────────────────────
const Push = {
  async getPublicKey() {
    const { publicKey } = await api.get('/api/push/vapid-public-key');
    return publicKey;
  },
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  },
  async subscribe() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;
    const reg = await navigator.serviceWorker.ready;
    const publicKey = await this.getPublicKey();
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: this.urlBase64ToUint8Array(publicKey),
    });
    await api.post('/api/push/subscribe', sub.toJSON());
    localStorage.setItem('push-enabled', '1');
    return true;
  },
  async unsubscribe() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await api.del('/api/push/subscribe', { endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
    localStorage.removeItem('push-enabled');
  },
  async isSubscribed() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  },
};

// ── Streak milestones ─────────────────────────────────────
const STREAK_MILESTONES = [3, 7, 14, 21, 30, 50, 100];
function checkStreakMilestone(streak) {
  if (!STREAK_MILESTONES.includes(streak)) return;
  const key = `streak-milestone-${streak}`;
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, '1');
  const messages = {
    3: "3 days in a row — you're building momentum! 🔥",
    7: "One full week of training. Habit forming. 🏆",
    14: "Two week streak! You're consistent now. 💪",
    21: "21 days — science says this is where habits stick. 🧠",
    30: "30-DAY STREAK. That's elite-level commitment. 🥊",
    50: "50 days straight. You are unstoppable. 🔥🔥",
    100: "100 DAYS. Absolute legend. 🏆🏆🏆",
  };
  showMilestoneBanner(streak, messages[streak]);
}

function showMilestoneBanner(streak, message) {
  const existing = document.getElementById('milestone-banner');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = 'milestone-banner';
  el.innerHTML = `
    <div class="milestone-inner">
      <div class="milestone-streak">${streak} day streak</div>
      <div class="milestone-msg">${message}</div>
      <button class="milestone-close" onclick="this.closest('#milestone-banner').remove()">✕</button>
    </div>
  `;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 6000);
}

// ── Finance ───────────────────────────────────────────────

const FINANCE_CATEGORIES = ['housing','bills','food','transport','subscriptions','debt','savings','income','other'];
const FINANCE_CATEGORY_LABELS = { housing:'Rent / Housing', bills:'Bills', food:'Food', transport:'Transport', subscriptions:'Subscriptions', debt:'Debt', savings:'Savings', income:'Income', other:'Other' };
const FINANCE_CATEGORY_EMOJI  = { housing:'🏠', bills:'💡', food:'🛒', transport:'🚗', subscriptions:'📱', debt:'💳', savings:'🏦', income:'💰', other:'📦' };

function fmtGBP(n, decimals=2) {
  if (n == null || isNaN(n)) return '£0.00';
  return '£' + Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtGBPShort(n) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1000) return sign + '£' + (abs/1000).toFixed(1) + 'k';
  return sign + fmtGBP(n, 0);
}

// Format with explicit sign (for balance columns that can go negative)
function fmtGBPBalance(n) {
  if (n < 0) return '−' + fmtGBP(n);
  return fmtGBP(n);
}

// Return the monthly equivalent amount for a payment
function monthlyAmount(p) {
  if (!p.isRecurring) return 0; // one-offs handled separately
  if (p.frequency === 'weekly')  return p.amount * 52 / 12;
  if (p.frequency === 'yearly')  return p.amount / 12;
  return p.amount; // monthly
}

// Annual cost of a recurring payment
function annualCost(p) {
  if (!p.isRecurring) return p.amount;
  if (p.frequency === 'weekly')  return p.amount * 52;
  if (p.frequency === 'yearly')  return p.amount;
  return p.amount * 12;
}

// Compute month-by-month projections for `numMonths` months starting from this month.
// scenarioPayments are additional payments only included in the "what-if" projection.
function computeProjections(payments, settings, numMonths = 12, scenarioPayments = []) {
  const allPayments = [...payments, ...scenarioPayments];
  const results = [];
  let balance = +(settings.currentBalance || 0);
  const now = new Date();

  for (let m = 0; m < numMonths; m++) {
    const mDate = new Date(now.getFullYear(), now.getMonth() + m, 1);
    const mYear = mDate.getFullYear();
    const mMonth = mDate.getMonth(); // 0-indexed

    let income   = +(settings.monthlyIncome || 0);
    let expenses = 0;
    let savings  = 0;
    let debt     = 0;

    for (const p of allPayments) {
      const amt = +p.amount || 0;
      let contribution = 0;

      if (p.isRecurring) {
        // Check payment is active this month
        const pStart = new Date(p.date + 'T12:00:00');
        const pStartMonth = new Date(pStart.getFullYear(), pStart.getMonth(), 1);
        if (mDate < pStartMonth) continue;

        if (p.endDate) {
          const pEnd = new Date(p.endDate + 'T12:00:00');
          const pEndMonth = new Date(pEnd.getFullYear(), pEnd.getMonth(), 1);
          if (mDate > pEndMonth) continue;
        }

        if (p.frequency === 'monthly') contribution = amt;
        else if (p.frequency === 'weekly') contribution = amt * 52 / 12;
        else if (p.frequency === 'yearly') {
          // only count in the month it falls
          if (pStart.getMonth() === mMonth) contribution = amt;
        }
      } else {
        // One-off: only count in the exact month
        const pDate = new Date(p.date + 'T12:00:00');
        if (pDate.getFullYear() === mYear && pDate.getMonth() === mMonth) {
          contribution = amt;
        }
      }

      if (contribution === 0) continue;

      if (p.type === 'income')  income   += contribution;
      else if (p.type === 'savings') savings += contribution;
      else if (p.type === 'debt')    debt    += contribution;
      else                           expenses += contribution; // expense (default)
    }

    const net        = income - expenses - savings - debt;
    const endBalance = balance + net;

    results.push({
      month: `${mYear}-${String(mMonth+1).padStart(2,'0')}`,
      label: mDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
      startBalance: balance,
      income,
      expenses,
      savings,
      debt,
      net,
      endBalance,
    });

    balance = endBalance;
  }

  return results;
}

// Affordability label based on projections
function getAffordability(projections, monthlyIncome) {
  if (!projections.length) return { label: 'Unknown', cls: 'safe' };
  const first = projections[0];
  const negIdx = projections.findIndex(p => p.endBalance < 0);
  const expRatio = first.income > 0 ? (first.expenses + first.savings + first.debt) / first.income : 1;

  if (negIdx === 0) return { label: 'Not Affordable', cls: 'danger' };
  if (negIdx > 0 && negIdx <= 2) return { label: 'Risky', cls: 'risky' };
  if (negIdx > 0) return { label: 'Caution', cls: 'caution' };
  if (expRatio > 0.95) return { label: 'Risky', cls: 'risky' };
  if (expRatio > 0.80) return { label: 'Caution', cls: 'caution' };
  return { label: 'Safe', cls: 'safe' };
}

// Plain-English insights
function generateInsights(projections, payments, settings) {
  const tips = [];
  if (!projections.length) return tips;
  const first = projections[0];
  const income = first.income;

  // Surplus/deficit this month
  const surplus = first.net;
  if (surplus > 0) {
    tips.push(`You have <strong>${fmtGBP(surplus)}</strong> left after all planned payments this month.`);
  } else if (surplus < 0) {
    tips.push(`⚠️ You are projected to spend <strong>${fmtGBP(Math.abs(surplus))}</strong> more than you earn this month.`);
  }

  // Expense ratio
  if (income > 0) {
    const outgoing = first.expenses + first.savings + first.debt;
    const ratio = Math.round(outgoing / income * 100);
    tips.push(`Your fixed payments are <strong>${ratio}%</strong> of your monthly income.`);
  }

  // First negative month warning
  const negMonth = projections.find(p => p.endBalance < 0);
  if (negMonth) {
    tips.push(`⚠️ Your balance is projected to go negative in <strong>${negMonth.label}</strong> unless income increases or expenses reduce.`);
  }

  // Annual cost of all recurring expenses
  const recurringExpenses = payments.filter(p => p.isRecurring && p.type === 'expense');
  if (recurringExpenses.length) {
    const totalAnnual = recurringExpenses.reduce((s, p) => s + annualCost(p), 0);
    tips.push(`Your recurring expenses cost <strong>${fmtGBP(totalAnnual)}</strong> per year in total.`);
  }

  // Biggest recurring cost
  const sorted = payments.filter(p => p.isRecurring && (p.type === 'expense' || p.type === 'debt')).sort((a,b) => monthlyAmount(b) - monthlyAmount(a));
  if (sorted[0]) {
    const top = sorted[0];
    tips.push(`Your biggest recurring cost is <strong>"${escHtml(top.name)}"</strong> at ${fmtGBP(top.amount)}/${top.frequency} (${fmtGBP(annualCost(top))}/year).`);
  }

  // 3-month and 6-month projected balance
  if (projections[2]) tips.push(`Projected balance in 3 months: <strong>${fmtGBPBalance(projections[2].endBalance)}</strong>.`);
  if (projections[5]) tips.push(`Projected balance in 6 months: <strong>${fmtGBPBalance(projections[5].endBalance)}</strong>.`);

  return tips;
}

// Category totals for a list of payments (monthly equivalents)
function categoryTotals(payments) {
  const totals = {};
  for (const p of payments.filter(p => p.type === 'expense' && p.isRecurring)) {
    const cat = p.category || 'other';
    totals[cat] = (totals[cat] || 0) + monthlyAmount(p);
  }
  return totals;
}

// ── Finance state ─────────────────────────────────────────
let financeTab = 'overview';
let financePayments = [];
let financeSettings = { monthlyIncome: 0, currentBalance: 0 };
// Scenario mode holds what-if payments in memory only
let scenarioPayments = [];
let scenarioActive = false;

async function renderFinance() {
  const el = document.getElementById('view-finance');
  el.innerHTML = `<div class="page-header"><h1>Finance</h1><p>Loading…</p></div>`;

  // Load data
  [financePayments, financeSettings] = await Promise.all([
    api.get('/api/payments'),
    api.get('/api/finance/settings'),
  ]);

  renderFinanceShell();
}

function renderFinanceShell() {
  const el = document.getElementById('view-finance');
  el.innerHTML = `
    <div class="page-header">
      <h1>Finance</h1>
      <p>Understand your spending and plan ahead</p>
    </div>
    <div class="tab-bar" style="margin-bottom:20px">
      <button class="tab-btn ${financeTab==='overview'?'active':''}" onclick="switchFinanceTab('overview')">Overview</button>
      <button class="tab-btn ${financeTab==='payments'?'active':''}" onclick="switchFinanceTab('payments')">Payments</button>
      <button class="tab-btn ${financeTab==='projections'?'active':''}" onclick="switchFinanceTab('projections')">Projections</button>
      <button class="tab-btn ${financeTab==='whatif'?'active':''}" onclick="switchFinanceTab('whatif')">What If?</button>
    </div>
    <div id="finance-content"></div>
  `;
  renderFinanceTab();
}

function switchFinanceTab(tab) {
  financeTab = tab;
  document.querySelectorAll('#view-finance .tab-btn').forEach(b => {
    const label = b.textContent.trim().toLowerCase().replace(/[^a-z]/g,'');
    b.classList.toggle('active', label === tab || (tab==='whatif' && b.textContent.includes('What')));
  });
  renderFinanceTab();
}

function renderFinanceTab() {
  const fn = { overview: renderFinanceOverview, payments: renderFinancePayments, projections: renderFinanceProjections, whatif: renderFinanceWhatIf };
  (fn[financeTab] || renderFinanceOverview)();
}

// ── Overview tab ──────────────────────────────────────────
function renderFinanceOverview() {
  const el = document.getElementById('finance-content');
  const projections = computeProjections(financePayments, financeSettings, 12);
  const first = projections[0] || { income:0, expenses:0, savings:0, debt:0, net:0, endBalance:0 };
  const afford = getAffordability(projections, financeSettings.monthlyIncome);
  const insights = generateInsights(projections, financePayments, financeSettings);
  const catTotals = categoryTotals(financePayments);
  const catEntries = Object.entries(catTotals).sort((a,b) => b[1]-a[1]);
  const totalMonthlyExpenses = catEntries.reduce((s,[,v])=>s+v,0);

  const needsSetup = !financeSettings.monthlyIncome && !financePayments.length;

  el.innerHTML = `
    ${needsSetup ? `
      <div class="fin-setup-banner">
        <div class="fin-setup-icon">💷</div>
        <div>
          <div style="font-weight:700;margin-bottom:4px">Set up your finances</div>
          <div style="font-size:13px;color:var(--text-2)">Add your monthly income and current balance to get started with projections.</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="switchFinanceTab('payments')">Get started →</button>
      </div>` : ''}

    <div class="grid-2" style="margin-bottom:16px">
      <div class="card">
        <div class="card-title">This Month</div>
        <div class="fin-month-grid">
          <div class="fin-month-row">
            <span>Income</span>
            <span class="fin-pos">${fmtGBP(first.income)}</span>
          </div>
          <div class="fin-month-row">
            <span>Expenses</span>
            <span class="fin-neg">−${fmtGBP(first.expenses)}</span>
          </div>
          ${first.savings ? `<div class="fin-month-row"><span>Savings</span><span class="fin-neg">−${fmtGBP(first.savings)}</span></div>` : ''}
          ${first.debt    ? `<div class="fin-month-row"><span>Debt repayments</span><span class="fin-neg">−${fmtGBP(first.debt)}</span></div>` : ''}
          <div class="fin-month-divider"></div>
          <div class="fin-month-row fin-month-net">
            <span>${first.net >= 0 ? 'Surplus' : 'Shortfall'}</span>
            <span class="${first.net >= 0 ? 'fin-pos' : 'fin-neg fin-warn'}">${first.net >= 0 ? '+' : '−'}${fmtGBP(Math.abs(first.net))}</span>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Financial Health</div>
        <div style="margin-bottom:14px">
          <div class="fin-afford-badge fin-afford-${afford.cls}">${afford.label}</div>
          <div style="font-size:12px;color:var(--text-3);margin-top:6px">Based on ${projections.length} months projected</div>
        </div>
        <div class="fin-balance-row">
          <div>
            <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);margin-bottom:4px">Current Balance</div>
            <div class="fin-balance-val ${+(financeSettings.currentBalance||0) < 0 ? 'fin-neg' : ''}">${fmtGBPBalance(+(financeSettings.currentBalance||0))}</div>
          </div>
          <div>
            <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);margin-bottom:4px">In 6 Months</div>
            <div class="fin-balance-val ${projections[5]?.endBalance < 0 ? 'fin-neg fin-warn' : 'fin-pos'}">${projections[5] ? fmtGBPBalance(projections[5].endBalance) : '—'}</div>
          </div>
          <div>
            <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-3);margin-bottom:4px">In 12 Months</div>
            <div class="fin-balance-val ${projections[11]?.endBalance < 0 ? 'fin-neg fin-warn' : 'fin-pos'}">${projections[11] ? fmtGBPBalance(projections[11].endBalance) : '—'}</div>
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" style="width:100%;margin-top:14px" onclick="showFinanceSettingsModal()">Edit income & balance</button>
      </div>
    </div>

    ${insights.length ? `
      <div class="card" style="margin-bottom:16px">
        <div class="card-title">💡 Insights</div>
        <div class="fin-insights">
          ${insights.map(i => `<div class="fin-insight-row">${i}</div>`).join('')}
        </div>
      </div>` : ''}

    ${catEntries.length ? `
      <div class="card" style="margin-bottom:16px">
        <div class="card-title">Monthly Spending by Category</div>
        <div class="fin-cat-list">
          ${catEntries.map(([cat, amt]) => {
            const pct = totalMonthlyExpenses > 0 ? Math.round(amt / totalMonthlyExpenses * 100) : 0;
            const incPct = first.income > 0 ? Math.round(amt / first.income * 100) : 0;
            return `
              <div class="fin-cat-row">
                <span class="fin-cat-emoji">${FINANCE_CATEGORY_EMOJI[cat]||'📦'}</span>
                <div class="fin-cat-body">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                    <span style="font-size:13.5px;font-weight:600">${FINANCE_CATEGORY_LABELS[cat]||cat}</span>
                    <span style="font-size:13px;font-weight:700">${fmtGBP(amt)}<span style="font-size:11px;font-weight:400;color:var(--text-3)">/mo</span></span>
                  </div>
                  <div class="fin-cat-bar-wrap"><div class="fin-cat-bar" style="width:${pct}%"></div></div>
                  <div style="font-size:11px;color:var(--text-3);margin-top:3px">${pct}% of expenses · ${incPct}% of income · ${fmtGBP(amt*12)}/year</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>` : ''}

    <div id="fin-settings-modal" class="fin-modal hidden">
      <div class="fin-modal-inner">
        <div style="font-weight:700;font-size:15px;margin-bottom:16px">Income & Balance</div>
        <div class="form-group"><label class="form-label">Monthly income (£)</label><input class="form-input" id="fin-income" type="number" step="0.01" placeholder="e.g. 2500" value="${financeSettings.monthlyIncome||''}" /></div>
        <div class="form-group"><label class="form-label">Current balance (£)</label><input class="form-input" id="fin-balance" type="number" step="0.01" placeholder="e.g. 1200" value="${financeSettings.currentBalance||''}" /></div>
        <div style="display:flex;gap:10px;margin-top:4px">
          <button class="btn btn-primary btn-sm" onclick="saveFinanceSettings()">Save</button>
          <button class="btn btn-ghost btn-sm" onclick="hideFinanceSettingsModal()">Cancel</button>
        </div>
      </div>
    </div>
  `;
}

function showFinanceSettingsModal() {
  document.getElementById('fin-settings-modal')?.classList.remove('hidden');
}
function hideFinanceSettingsModal() {
  document.getElementById('fin-settings-modal')?.classList.add('hidden');
}
async function saveFinanceSettings() {
  const income  = parseFloat(document.getElementById('fin-income')?.value) || 0;
  const balance = parseFloat(document.getElementById('fin-balance')?.value) || 0;
  financeSettings = { ...financeSettings, monthlyIncome: income, currentBalance: balance };
  await api.post('/api/finance/settings', financeSettings);
  toast('Settings saved!');
  hideFinanceSettingsModal();
  renderFinanceOverview();
}

// ── Payments tab ──────────────────────────────────────────
function renderFinancePayments() {
  const el = document.getElementById('finance-content');
  const groups = {};
  for (const p of financePayments) {
    const key = p.type || 'expense';
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }

  el.innerHTML = `
    <div class="grid-2" style="margin-bottom:16px">
      <div class="card" style="grid-column: 1 / -1">
        <div class="card-title">Add Payment</div>
        <div class="fin-form-grid">
          <div class="form-group"><label class="form-label">Name / Description</label><input class="form-input" id="fp-name" placeholder="e.g. Rent, Netflix, Salary" /></div>
          <div class="form-group"><label class="form-label">Amount (£)</label><input class="form-input" id="fp-amount" type="number" step="0.01" placeholder="0.00" /></div>
          <div class="form-group"><label class="form-label">Date</label><input class="form-input" id="fp-date" type="date" value="${todayStr()}" /></div>
          <div class="form-group"><label class="form-label">Category</label>
            <select class="form-input" id="fp-category">
              ${FINANCE_CATEGORIES.map(c => `<option value="${c}">${FINANCE_CATEGORY_EMOJI[c]} ${FINANCE_CATEGORY_LABELS[c]}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label class="form-label">Type</label>
            <select class="form-input" id="fp-type" onchange="toggleRecurringUI()">
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="savings">Savings</option>
              <option value="debt">Debt Repayment</option>
            </select>
          </div>
          <div class="form-group"><label class="form-label">Recurring?</label>
            <select class="form-input" id="fp-recurring" onchange="toggleRecurringUI()">
              <option value="0">One-off payment</option>
              <option value="1">Recurring</option>
            </select>
          </div>
          <div class="form-group fin-recurring-field hidden" id="fp-freq-group"><label class="form-label">Frequency</label>
            <select class="form-input" id="fp-frequency">
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div class="form-group fin-recurring-field hidden" id="fp-end-group"><label class="form-label">End Date (optional)</label><input class="form-input" id="fp-enddate" type="date" /></div>
          <div class="form-group" style="grid-column:1/-1"><label class="form-label">Notes (optional)</label><input class="form-input" id="fp-notes" placeholder="Any details…" /></div>
        </div>

        <!-- Impact preview — shown before saving -->
        <div id="fp-impact-preview" class="fin-impact-preview hidden"></div>

        <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" onclick="previewPaymentImpact()">Preview Impact</button>
          <button class="btn btn-primary" onclick="savePayment()">Add Payment</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">All Payments (${financePayments.length})</div>
      ${financePayments.length === 0 ? `
        <div class="empty-state"><div class="empty-state-icon">💳</div><p>No payments added yet. Add your income, rent, bills, and subscriptions above.</p></div>
      ` : `
        <div class="fin-payment-list">
          ${['income','expense','savings','debt'].flatMap(type => {
            const items = (groups[type]||[]).sort((a,b) => b.amount - a.amount);
            if (!items.length) return [];
            const typeLabels = { income:'Income', expense:'Expenses', savings:'Savings', debt:'Debt Repayments' };
            return [
              `<div class="fin-payment-group-label">${typeLabels[type]}</div>`,
              ...items.map(p => paymentCard(p)),
            ];
          }).join('')}
        </div>
      `}
    </div>
  `;
}

function toggleRecurringUI() {
  const isRecurring = document.getElementById('fp-recurring')?.value === '1';
  document.querySelectorAll('.fin-recurring-field').forEach(el => el.classList.toggle('hidden', !isRecurring));
}

function paymentCard(p) {
  const isIncome = p.type === 'income';
  const recLabel = p.isRecurring ? `${p.frequency}` : 'one-off';
  const annLabel = fmtGBP(annualCost(p)) + '/yr';
  const typeColors = { income: 'fin-pos', expense: 'fin-neg', savings: 'fin-blue', debt: 'fin-amber' };
  return `
    <div class="fin-payment-row" id="fpr-${p.id}">
      <span class="fin-cat-emoji">${FINANCE_CATEGORY_EMOJI[p.category]||'📦'}</span>
      <div class="fin-payment-body">
        <div class="fin-payment-name">${escHtml(p.name)}</div>
        <div class="fin-payment-meta">
          ${FINANCE_CATEGORY_LABELS[p.category]||p.category} · ${recLabel}
          ${p.isRecurring ? ` · ${annLabel}` : ''}
          ${p.notes ? ` · <em>${escHtml(p.notes)}</em>` : ''}
        </div>
      </div>
      <div class="fin-payment-amount ${typeColors[p.type]||'fin-neg'}">
        ${isIncome ? '+' : '−'}${fmtGBP(p.amount)}
        <div style="font-size:10px;font-weight:400;text-align:right;color:var(--text-3)">${recLabel}</div>
      </div>
      <button class="delete-btn" style="opacity:1" onclick="deletePayment(${p.id})" title="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
      </button>
    </div>
  `;
}

function previewPaymentImpact() {
  const preview = document.getElementById('fp-impact-preview');
  if (!preview) return;

  const p = buildPaymentFromForm();
  if (!p) { preview.classList.add('hidden'); return; }

  const baseProj    = computeProjections(financePayments, financeSettings, 6);
  const newProj     = computeProjections(financePayments, financeSettings, 6, [p]);

  // Net impact per month
  const rows = newProj.slice(0, 6).map((m, i) => {
    const base = baseProj[i] || m;
    const diff = m.endBalance - base.endBalance;
    return `
      <div class="fin-impact-row">
        <span class="fin-impact-month">${m.label}</span>
        <span class="fin-impact-base ${base.endBalance < 0 ? 'fin-neg' : ''}">${fmtGBPBalance(base.endBalance)}</span>
        <span class="fin-impact-arrow">→</span>
        <span class="fin-impact-new ${m.endBalance < 0 ? 'fin-neg fin-warn' : 'fin-pos'}">${fmtGBPBalance(m.endBalance)}</span>
        <span class="fin-impact-diff ${diff >= 0 ? 'fin-pos' : 'fin-neg'}">${diff >= 0 ? '+' : '−'}${fmtGBP(Math.abs(diff))}</span>
      </div>`;
  }).join('');

  const afford = getAffordability(newProj, financeSettings.monthlyIncome);
  const annNote = p.isRecurring ? `<br>This payment costs <strong>${fmtGBP(annualCost(p))}</strong> per year.` : '';

  preview.className = 'fin-impact-preview';
  preview.innerHTML = `
    <div class="fin-impact-title">Impact Preview <span class="fin-afford-badge fin-afford-${afford.cls}" style="font-size:11px;padding:2px 8px">${afford.label}</span></div>
    <div class="fin-impact-header">
      <span>Month</span><span>Before</span><span></span><span>After</span><span>Change</span>
    </div>
    ${rows}
    <div style="font-size:12.5px;color:var(--text-2);margin-top:10px;line-height:1.6">${generateImpactNote(p, baseProj, newProj)}${annNote}</div>
  `;
}

function generateImpactNote(p, baseProj, newProj) {
  if (!baseProj.length || !newProj.length) return '';
  const firstDiff = newProj[0].endBalance - baseProj[0].endBalance;
  const isIncome = p.type === 'income';

  if (isIncome) {
    return `This adds <strong>${fmtGBP(Math.abs(firstDiff))}</strong> to your balance each month.`;
  }
  if (firstDiff < 0) {
    const negMonth = newProj.find(m => m.endBalance < 0);
    if (negMonth) return `⚠️ This payment would reduce your balance by <strong>${fmtGBP(Math.abs(firstDiff))}/month</strong> and your balance goes negative in <strong>${negMonth.label}</strong>.`;
    return `This reduces your monthly surplus by <strong>${fmtGBP(Math.abs(firstDiff))}</strong>.`;
  }
  return `This payment is affordable based on your current projections.`;
}

function buildPaymentFromForm() {
  const name   = document.getElementById('fp-name')?.value.trim();
  const amount = parseFloat(document.getElementById('fp-amount')?.value);
  const date   = document.getElementById('fp-date')?.value;
  if (!name || !amount || !date || isNaN(amount)) return null;

  return {
    name,
    amount,
    date,
    category:    document.getElementById('fp-category')?.value || 'other',
    type:        document.getElementById('fp-type')?.value || 'expense',
    isRecurring: document.getElementById('fp-recurring')?.value === '1',
    frequency:   document.getElementById('fp-frequency')?.value || 'monthly',
    endDate:     document.getElementById('fp-enddate')?.value || null,
    notes:       document.getElementById('fp-notes')?.value.trim() || '',
  };
}

async function savePayment() {
  const p = buildPaymentFromForm();
  if (!p) { toast('Fill in name, amount, and date','error'); return; }
  const saved = await api.post('/api/payments', p);
  financePayments.push(saved);
  financePayments.sort((a,b) => a.date.localeCompare(b.date));
  toast('Payment added!');
  renderFinancePayments();
}

async function deletePayment(id) {
  await api.del(`/api/payments/${id}`);
  financePayments = financePayments.filter(p => p.id !== id);
  document.getElementById(`fpr-${id}`)?.remove();
  toast('Payment removed');
}

// ── Projections tab ───────────────────────────────────────
function renderFinanceProjections() {
  const el = document.getElementById('finance-content');
  const projections = computeProjections(financePayments, financeSettings, 12);

  el.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="card-title">12-Month Projection</div>
      ${projections.length === 0 ? `
        <div class="empty-state"><p>Add your income and payments to see projections.</p></div>
      ` : `
        <div class="fin-proj-table">
          <div class="fin-proj-header">
            <span>Month</span>
            <span>Income</span>
            <span>Out</span>
            <span>Net</span>
            <span>Balance</span>
          </div>
          ${projections.map(m => {
            const outgoing = m.expenses + m.savings + m.debt;
            const isNeg = m.endBalance < 0;
            return `
              <div class="fin-proj-row ${isNeg ? 'fin-proj-row-neg' : ''}">
                <span class="fin-proj-month">${m.label}</span>
                <span class="fin-pos">${fmtGBPShort(m.income)}</span>
                <span class="fin-neg">−${fmtGBPShort(outgoing)}</span>
                <span class="${m.net >= 0 ? 'fin-pos' : 'fin-neg'}">${m.net >= 0 ? '+' : '−'}${fmtGBPShort(Math.abs(m.net))}</span>
                <span class="${isNeg ? 'fin-neg fin-warn' : ''}" style="font-weight:700">${fmtGBPShort(m.endBalance)}</span>
              </div>
            `;
          }).join('')}
        </div>
        <div style="font-size:12px;color:var(--text-3);margin-top:12px">
          Starting balance: ${fmtGBP(+(financeSettings.currentBalance||0))} ·
          Monthly income includes base income and any recurring income payments.
          ${projections.some(m => m.endBalance < 0) ? '<br><strong style="color:var(--red)">⚠️ One or more months are projected negative.</strong>' : ''}
        </div>
      `}
    </div>

    ${projections.length ? `
      <div class="card">
        <div class="card-title">Cumulative Balance Over Time</div>
        <div class="chart-container"><canvas id="fin-balance-chart"></canvas></div>
      </div>` : ''}
  `;

  if (projections.length) {
    setTimeout(() => initFinanceChart(projections), 50);
  }
}

let financeChart = null;
function initFinanceChart(projections) {
  const canvas = document.getElementById('fin-balance-chart');
  if (!canvas) return;
  if (financeChart) { financeChart.destroy(); financeChart = null; }

  const labels   = projections.map(m => m.label);
  const balances = projections.map(m => m.endBalance);
  const colors   = balances.map(b => b < 0 ? 'rgba(192,88,64,0.8)' : 'rgba(110,145,116,0.8)');

  Chart.defaults.color = '#8A655A';
  Chart.defaults.borderColor = '#BAAB92';
  financeChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Projected Balance',
        data: balances,
        backgroundColor: colors,
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#fff',
          titleColor: '#56453F',
          bodyColor: '#8A655A',
          borderColor: '#BAAB92',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: ctx => ` Balance: ${fmtGBP(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: { grid: { color: 'rgba(163,119,100,0.08)' }, ticks: { font: { size: 11 }, color: '#A28777' } },
        y: {
          grid: { color: 'rgba(163,119,100,0.08)' },
          ticks: { font: { size: 11 }, color: '#A28777', callback: v => fmtGBPShort(v) },
        },
      },
    },
  });
}

// ── What If tab ───────────────────────────────────────────
function renderFinanceWhatIf() {
  const el = document.getElementById('finance-content');
  const baseProj     = computeProjections(financePayments, financeSettings, 6);
  const scenarioProj = computeProjections(financePayments, financeSettings, 6, scenarioPayments);

  el.innerHTML = `
    <div class="fin-whatif-banner ${scenarioActive ? 'active' : ''}">
      <div>
        <div style="font-weight:700">Scenario Mode ${scenarioActive ? '(Active)' : ''}</div>
        <div style="font-size:12.5px;color:var(--text-2);margin-top:2px">
          Test payments without saving them. Nothing here affects your real finances.
        </div>
      </div>
      ${scenarioActive ? `<button class="btn btn-ghost btn-sm" onclick="clearScenario()">Clear scenario</button>` : ''}
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-title">Add a Hypothetical Payment</div>
      <div class="fin-form-grid">
        <div class="form-group"><label class="form-label">Name</label><input class="form-input" id="wi-name" placeholder='e.g. "What if I pay £900 rent?"' /></div>
        <div class="form-group"><label class="form-label">Amount (£)</label><input class="form-input" id="wi-amount" type="number" step="0.01" placeholder="0.00" /></div>
        <div class="form-group"><label class="form-label">Type</label>
          <select class="form-input" id="wi-type">
            <option value="expense">Expense</option>
            <option value="income">Income increase</option>
            <option value="savings">Savings</option>
            <option value="debt">Debt Repayment</option>
          </select>
        </div>
        <div class="form-group"><label class="form-label">Frequency</label>
          <select class="form-input" id="wi-frequency">
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="yearly">Yearly (one-off)</option>
          </select>
        </div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="addScenarioPayment()">Add to Scenario</button>
    </div>

    ${scenarioPayments.length ? `
      <div class="card" style="margin-bottom:16px">
        <div class="card-title">Scenario Payments (not saved)</div>
        ${scenarioPayments.map((p, i) => `
          <div class="fin-scenario-row">
            <span>${escHtml(p.name)} · ${fmtGBP(p.amount)}/${p.frequency} (${p.type})</span>
            <button class="delete-btn" style="opacity:1" onclick="removeScenarioPayment(${i})" title="Remove">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
            </button>
          </div>
        `).join('')}
      </div>` : ''}

    ${scenarioActive ? `
      <div class="card">
        <div class="card-title">6-Month Impact Comparison</div>
        <div class="fin-whatif-compare">
          <div class="fin-whatif-header">
            <span>Month</span>
            <span>Current Plan</span>
            <span>With Scenario</span>
            <span>Difference</span>
          </div>
          ${scenarioProj.map((m, i) => {
            const base = baseProj[i] || m;
            const diff = m.endBalance - base.endBalance;
            return `
              <div class="fin-whatif-row">
                <span>${m.label}</span>
                <span class="${base.endBalance < 0 ? 'fin-neg' : ''}">${fmtGBPBalance(base.endBalance)}</span>
                <span class="${m.endBalance < 0 ? 'fin-neg fin-warn' : 'fin-pos'}">${fmtGBPBalance(m.endBalance)}</span>
                <span class="${diff >= 0 ? 'fin-pos' : 'fin-neg'}">${diff >= 0 ? '+' : '−'}${fmtGBP(Math.abs(diff))}</span>
              </div>
            `;
          }).join('')}
        </div>
        ${(() => {
          const afford = getAffordability(scenarioProj, financeSettings.monthlyIncome);
          return `<div style="margin-top:14px;display:flex;align-items:center;gap:10px">
            <span class="fin-afford-badge fin-afford-${afford.cls}">${afford.label}</span>
            <span style="font-size:12.5px;color:var(--text-2)">With scenario applied</span>
          </div>`;
        })()}
      </div>` : ''}
  `;
}

function addScenarioPayment() {
  const name   = document.getElementById('wi-name')?.value.trim();
  const amount = parseFloat(document.getElementById('wi-amount')?.value);
  const type   = document.getElementById('wi-type')?.value || 'expense';
  const freq   = document.getElementById('wi-frequency')?.value || 'monthly';

  if (!name || !amount || isNaN(amount)) { toast('Enter name and amount','error'); return; }

  scenarioPayments.push({ id: -Date.now(), name, amount, date: todayStr(), type, category:'other', isRecurring: true, frequency: freq, endDate: null, notes: '' });
  scenarioActive = true;
  toast(`"${name}" added to scenario`);
  renderFinanceWhatIf();
}

function removeScenarioPayment(idx) {
  scenarioPayments.splice(idx, 1);
  if (!scenarioPayments.length) scenarioActive = false;
  renderFinanceWhatIf();
}

function clearScenario() {
  scenarioPayments = [];
  scenarioActive = false;
  renderFinanceWhatIf();
}

// ── Bootstrap ─────────────────────────────────────────────
document.body.insertAdjacentHTML('beforeend','<div id="toast"></div>');
navigate('dashboard');
// Init pill after layout is ready
requestAnimationFrame(() => updateNavPill('dashboard'));
