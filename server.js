const express = require('express');
const fs = require('fs');
const path = require('path');
const webpush = require('web-push');
const cron = require('node-cron');

const app = express();
const DB_FILE = path.join(__dirname, 'db.json');

// ── Persistence ───────────────────────────────────────────
const DB_DEFAULTS = { workouts:[], weights:[], nutrition:[], trainingPlan:[], exercises:[], mealPlan:[], pushSubscriptions:[], vapid:null };
function readDB() {
  try { return { ...DB_DEFAULTS, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) }; }
  catch { return { ...DB_DEFAULTS }; }
}
function writeDB(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data)); }
function nextId(arr) { return arr.length === 0 ? 1 : Math.max(...arr.map(i => i.id)) + 1; }

// ── NLP parser ────────────────────────────────────────────
function parseWorkoutText(text) {
  const t = text.toLowerCase();
  let duration_mins = null;
  const mHM = t.match(/(\d+)\s*h(?:ours?|rs?)\s*(?:and\s+)?(\d+)\s*m(?:inutes?|ins?)/);
  const mH  = t.match(/(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)/);
  const mM  = t.match(/(\d+)\s*m(?:inutes?|ins?)/);
  if (mHM) duration_mins = +mHM[1]*60 + +mHM[2];
  else if (/half\s+(?:an?\s+)?hour/.test(t)) duration_mins = 30;
  else if (/\ban?\s+hour\b/.test(t)) duration_mins = 60;
  else if (mH) duration_mins = Math.round(+mH[1]*60);
  else if (mM) duration_mins = +mM[1];

  const activityMap = [
    { keys:['muay thai'],                                         label:'Muay Thai',        cat:'martial-arts' },
    { keys:['kickboxing','kick boxing'],                          label:'Kickboxing',        cat:'martial-arts' },
    { keys:['boxing'],                                            label:'Boxing',            cat:'martial-arts' },
    { keys:['bjj','jiu jitsu','grappling','wrestling'],           label:'BJJ',               cat:'martial-arts' },
    { keys:['mma','mixed martial'],                               label:'MMA',               cat:'martial-arts' },
    { keys:['running','jogging','sprint','jog'],                  label:'Running',           cat:'cardio' },
    { keys:['cycling','biking','bike'],                           label:'Cycling',           cat:'cardio' },
    { keys:['swimming','swim'],                                   label:'Swimming',          cat:'cardio' },
    { keys:['rowing','row','erg'],                                label:'Rowing',            cat:'cardio' },
    { keys:['hiit','circuit training','circuit'],                 label:'HIIT',              cat:'cardio' },
    { keys:['cardio','aerobics'],                                 label:'Cardio',            cat:'cardio' },
    { keys:['crossfit','cross fit','wod'],                        label:'CrossFit',          cat:'strength' },
    { keys:['push day','push'],                                    label:'Weight Training – Push', cat:'strength' },
    { keys:['pull day','pull'],                                    label:'Weight Training – Pull', cat:'strength' },
    { keys:['leg day','legs'],                                     label:'Weight Training – Legs', cat:'strength' },
    { keys:['chest day','chest workout','chest press','chest'],    label:'Weight Training – Push', cat:'strength' },
    { keys:['back day','back workout','back training'],            label:'Weight Training – Pull', cat:'strength' },
    { keys:['shoulder day','shoulders','ohp','overhead press'],   label:'Weight Training',   cat:'strength' },
    { keys:['arm day','arms day','bicep','tricep','curls','curl'], label:'Weight Training',   cat:'strength' },
    { keys:['abs','core','ab workout','ab day'],                   label:'Weight Training',   cat:'strength' },
    { keys:['weight','lifting','lift','barbell','dumbbell','bench','squat','deadlift','powerlifting'], label:'Weight Training', cat:'strength' },
    { keys:['gym','strength training'],                            label:'Weight Training',   cat:'strength' },
    { keys:['climbing','bouldering'],                             label:'Climbing',          cat:'strength' },
    { keys:['yoga','vinyasa','hot yoga'],                         label:'Yoga',              cat:'mobility' },
    { keys:['pilates'],                                           label:'Pilates',           cat:'mobility' },
    { keys:['stretching','stretch','mobility','flexibility'],     label:'Stretching',        cat:'mobility' },
    { keys:['walking','walk','hiking','hike'],                    label:'Walking',           cat:'cardio' },
  ];

  let activity = null, category = 'other';
  for (const a of activityMap) {
    if (a.keys.some(k => t.includes(k))) { activity = a.label; category = a.cat; break; }
  }

  const highWords = ['strong','great','amazing','crushed','nailed','powerful','intense','hard','tough','brutal','fire','beast','pb','pr','best','excellent'];
  const lowWords  = ['tired','exhausted','rough','struggled','easy','light','recovery','slow','meh','weak','sore'];
  let intensity = 'medium';
  if (highWords.some(k => t.includes(k))) intensity = 'high';
  else if (lowWords.some(k => t.includes(k))) intensity = 'low';

  return { activity, duration_mins, intensity, category };
}

// ── MET-based calorie burn estimate ──────────────────────
function getMET(activity) {
  if (!activity) return 5;
  const l = activity.toLowerCase();
  if (['muay thai','boxing','kickboxing','mma'].some(a => l.includes(a))) return 10;
  if (['bjj','grappling','wrestling'].some(a => l.includes(a))) return 9;
  if (['running','sprint','jog','interval sprints'].some(a => l.includes(a))) return 10;
  if (['hiit','circuit'].some(a => l.includes(a))) return 8.5;
  if (['crossfit'].some(a => l.includes(a))) return 8;
  if (['cycling','biking'].some(a => l.includes(a))) return 7;
  if (['swimming'].some(a => l.includes(a))) return 7;
  if (['rowing'].some(a => l.includes(a))) return 7;
  if (['climbing','bouldering'].some(a => l.includes(a))) return 8;
  if (['weight','lifting','gym','push','pull','legs','chest','back','shoulder','arm','squat','deadlift','bench','full body'].some(a => l.includes(a))) return 5;
  if (['walking','hike'].some(a => l.includes(a))) return 3.5;
  if (['zone 2'].some(a => l.includes(a))) return 5;
  if (['yoga','pilates','stretch','mobility','shadow boxing'].some(a => l.includes(a))) return 3;
  if (['rest','recovery'].some(a => l.includes(a))) return 1;
  return 5;
}

// ── Training plan variety ─────────────────────────────────
function getWeekRotation(weekStart) {
  const ref = new Date('2024-01-01');
  const start = new Date(weekStart);
  const weeks = Math.floor((start - ref) / (7 * 86400000));
  return ((weeks % 4) + 4) % 4;
}

function getCategoryFromActivity(activity) {
  if (!activity) return 'other';
  const l = activity.toLowerCase();
  if (['muay thai','boxing','bjj','mma','kickboxing'].some(a => l.includes(a))) return 'martial-arts';
  if (['running','cycling','swimming','rowing','hiit','cardio','walking','sprint'].some(a => l.includes(a))) return 'cardio';
  if (['weight','crossfit','climbing','push','pull','legs','full body'].some(a => l.includes(a))) return 'strength';
  if (['yoga','pilates','stretching','mobility'].some(a => l.includes(a))) return 'mobility';
  return 'other';
}

const MARTIAL_ARTS_TEMPLATES = [
  [ // Week A – technique focus
    { day:1, activity:'Muay Thai – Technique',      dur:75, int:'medium' },
    { day:2, activity:'Weight Training – Push',     dur:60, int:'high',   prog:'A' },
    { day:3, activity:'Zone 2 Run',                  dur:45, int:'low'    },
    { day:4, activity:'Muay Thai – Sparring',        dur:75, int:'high'   },
    { day:5, activity:'Weight Training – Pull',     dur:60, int:'high',   prog:'B' },
    { day:6, activity:'Muay Thai – Pad Work',        dur:75, int:'high'   },
    { day:7, activity:'Rest & Recovery',             dur:0,  int:'low'    },
  ],
  [ // Week B – conditioning focus
    { day:1, activity:'Weight Training – Legs',     dur:65, int:'high',   prog:'A' },
    { day:2, activity:'Muay Thai – Conditioning',    dur:60, int:'high'   },
    { day:3, activity:'Rest',                        dur:0,  int:'low'    },
    { day:4, activity:'Interval Sprints',            dur:35, int:'high'   },
    { day:5, activity:'Muay Thai – Technique',       dur:75, int:'medium' },
    { day:6, activity:'Weight Training – Full Body', dur:60, int:'high',   prog:'B' },
    { day:7, activity:'Rest',                        dur:0,  int:'low'    },
  ],
  [ // Week C – power focus
    { day:1, activity:'Muay Thai – Heavy Bag',       dur:60, int:'high'   },
    { day:2, activity:'Weight Training – Push',     dur:65, int:'high',   prog:'A' },
    { day:3, activity:'Rowing',                      dur:40, int:'medium' },
    { day:4, activity:'Muay Thai – Pad Work',        dur:75, int:'high'   },
    { day:5, activity:'Weight Training – Pull',     dur:65, int:'high',   prog:'B' },
    { day:6, activity:'BJJ / Grappling',             dur:60, int:'high'   },
    { day:7, activity:'Rest',                        dur:0,  int:'low'    },
  ],
  [ // Week D – deload
    { day:1, activity:'Muay Thai – Shadow Boxing',   dur:45, int:'low'    },
    { day:2, activity:'Weight Training – Full Body', dur:45, int:'low',   prog:'A' },
    { day:3, activity:'Rest',                        dur:0,  int:'low'    },
    { day:4, activity:'Zone 2 Run',                  dur:40, int:'low'    },
    { day:5, activity:'Muay Thai – Technique',       dur:60, int:'low'    },
    { day:6, activity:'Rest',                        dur:0,  int:'low'    },
    { day:7, activity:'Rest',                        dur:0,  int:'low'    },
  ],
];

const STRENGTH_TEMPLATES = [
  [ // Week A – push/pull/legs
    { day:1, activity:'Weight Training – Push',     dur:70, int:'high',   prog:'A' },
    { day:2, activity:'Weight Training – Pull',     dur:70, int:'high',   prog:'B' },
    { day:3, activity:'Zone 2 Run',                  dur:45, int:'low'    },
    { day:4, activity:'Weight Training – Legs',     dur:70, int:'high',   prog:'A' },
    { day:5, activity:'HIIT',                        dur:35, int:'high'   },
    { day:6, activity:'Weight Training – Full Body', dur:60, int:'medium', prog:'B' },
    { day:7, activity:'Rest',                        dur:0,  int:'low'    },
  ],
  [ // Week B – heavy + cardio
    { day:1, activity:'Weight Training – Legs',     dur:75, int:'high',   prog:'A' },
    { day:2, activity:'Cycling',                     dur:45, int:'medium' },
    { day:3, activity:'Weight Training – Push',     dur:75, int:'high',   prog:'B' },
    { day:4, activity:'Rest',                        dur:0,  int:'low'    },
    { day:5, activity:'Weight Training – Pull',     dur:75, int:'high',   prog:'A' },
    { day:6, activity:'Interval Sprints',            dur:30, int:'high'   },
    { day:7, activity:'Rest',                        dur:0,  int:'low'    },
  ],
  [ // Week C – volume
    { day:1, activity:'Weight Training – Full Body', dur:75, int:'high',   prog:'A' },
    { day:2, activity:'Running',                     dur:40, int:'medium' },
    { day:3, activity:'Weight Training – Push',     dur:70, int:'high',   prog:'B' },
    { day:4, activity:'Rest',                        dur:0,  int:'low'    },
    { day:5, activity:'Weight Training – Pull',     dur:70, int:'high',   prog:'A' },
    { day:6, activity:'Weight Training – Legs',     dur:70, int:'high',   prog:'B' },
    { day:7, activity:'Rest',                        dur:0,  int:'low'    },
  ],
  [ // Week D – deload
    { day:1, activity:'Weight Training – Full Body', dur:50, int:'low',   prog:'A' },
    { day:2, activity:'Zone 2 Run',                  dur:40, int:'low'    },
    { day:3, activity:'Weight Training – Full Body', dur:50, int:'low',   prog:'B' },
    { day:4, activity:'Rest',                        dur:0,  int:'low'    },
    { day:5, activity:'Weight Training – Full Body', dur:50, int:'low',   prog:'A' },
    { day:6, activity:'Swimming',                    dur:40, int:'low'    },
    { day:7, activity:'Rest',                        dur:0,  int:'low'    },
  ],
];

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function generateAdaptivePlan(weekStart, db) {
  const cutoff = new Date(weekStart);
  cutoff.setDate(cutoff.getDate() - 14);
  const recent = db.workouts.filter(w => w.date >= cutoff.toISOString().split('T')[0]);
  const cats = recent.reduce((acc, w) => {
    const c = getCategoryFromActivity(w.activity);
    acc[c] = (acc[c] || 0) + 1; return acc;
  }, {});
  const total = recent.length;
  const maRatio  = total > 0 ? (cats['martial-arts']||0) / total : 0;
  const strRatio = total > 0 ? (cats['strength']||0) / total : 0;

  const rotation = getWeekRotation(weekStart);
  const template = maRatio > 0.35 ? MARTIAL_ARTS_TEMPLATES[rotation]
    : strRatio > 0.35 ? STRENGTH_TEMPLATES[rotation]
    : MARTIAL_ARTS_TEMPLATES[rotation]; // default to martial arts (matches user profile)

  // Check last week's completion to scale intensity
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastPlan = db.trainingPlan.filter(p => p.week_start === lastWeekStart.toISOString().split('T')[0]);
  const completionRate = lastPlan.length > 0 ? lastPlan.filter(p => p.completed).length / lastPlan.length : null;
  const bump = completionRate !== null && completionRate >= 0.8 ? 'up' : completionRate !== null && completionRate <= 0.4 ? 'down' : null;
  const iUp   = { low:'medium', medium:'high', high:'high' };
  const iDown = { high:'medium', medium:'low', low:'low' };

  const baseId = nextId(db.trainingPlan);
  const items = template.map((d, i) => ({
    id: baseId + i,
    week_start: weekStart,
    day_of_week: d.day,
    activity: d.activity,
    program_id: d.prog || null,
    duration_mins: bump==='up' ? d.dur+5 : bump==='down' ? Math.max(d.dur-10,0) : d.dur,
    intensity: bump==='up' ? iUp[d.int] : bump==='down' ? iDown[d.int] : d.int,
    completed: false,
    created_at: new Date().toISOString(),
  }));

  db.trainingPlan.push(...items);
  writeDB(db);
  return items;
}

// ── Meal plan library ─────────────────────────────────────
// must = fresh/perishable items only. nice = pantry staples to check you have.
const MEALS = {
  breakfast: [
    { name:'Porridge with Berries & Honey',      calories:380, protein:14, carbs:60, fat:8,  easy:true,  must:['Blueberries','Milk'],                    nice:['Rolled oats','Honey'],           notes:'Mix oats and milk, microwave 3 mins, top with berries and honey.' },
    { name:'Scrambled Eggs on Toast',             calories:360, protein:24, carbs:36, fat:14, easy:true,  must:['Eggs','Wholemeal bread'],                nice:['Butter'],                        notes:'Whisk eggs, cook slowly in buttered pan on low heat, serve on toast.' },
    { name:'Greek Yogurt, Granola & Banana',      calories:390, protein:20, carbs:55, fat:8,  easy:true,  must:['Greek yogurt','Banana'],                 nice:['Granola','Honey'],               notes:'Layer yogurt, granola and sliced banana. Drizzle honey.' },
    { name:'Protein Porridge with Peanut Butter', calories:460, protein:32, carbs:54, fat:14, easy:true,  must:['Banana','Milk'],                         nice:['Rolled oats','Protein powder','Peanut butter'], notes:'Cook oats in milk, stir in protein powder, top with peanut butter and banana.' },
    { name:'Spinach & Mushroom Omelette',         calories:320, protein:28, carbs:6,  fat:18, easy:true,  must:['Eggs','Spinach','Mushrooms'],            nice:['Olive oil'],                     notes:'Fry mushrooms, add spinach, pour in whisked eggs, fold when just set.' },
    { name:'Overnight Oats with Chia & Berries',  calories:400, protein:18, carbs:56, fat:10, easy:true,  must:['Mixed berries','Oat milk'],              nice:['Rolled oats','Chia seeds'],      notes:'Mix oats, oat milk and chia seeds in a jar overnight. Top with berries.' },
    { name:'Smoked Salmon & Eggs on Toast',       calories:420, protein:36, carbs:20, fat:20, easy:true,  must:['Eggs','Smoked salmon','Wholemeal bread'],nice:[],                                notes:'Scramble eggs, serve on toast with smoked salmon.' },
  ],
  snack: [
    { name:'Protein Shake & Banana',    calories:280, protein:28, carbs:30, fat:3,  easy:true, must:['Banana'],                    nice:['Protein powder','Milk'],  notes:'Shake protein powder with milk and banana.' },
    { name:'Oatcakes & Peanut Butter',  calories:230, protein:7,  carbs:28, fat:10, easy:true, must:[],                            nice:['Oatcakes','Peanut butter'],notes:'Spread peanut butter on oatcakes.' },
    { name:'Apple & Cottage Cheese',    calories:185, protein:18, carbs:20, fat:3,  easy:true, must:['Apple','Cottage cheese'],    nice:[],                         notes:'Slice apple, serve with cottage cheese.' },
    { name:'Greek Yogurt & Honey',      calories:190, protein:16, carbs:22, fat:4,  easy:true, must:['Greek yogurt'],              nice:['Honey'],                  notes:'Top yogurt with honey.' },
    { name:'Mixed Nuts & Dried Fruit',  calories:210, protein:6,  carbs:20, fat:13, easy:true, must:[],                            nice:['Mixed nuts','Dried fruit'],notes:'Combine and eat.' },
    { name:'Tuna & Oatcakes',           calories:200, protein:24, carbs:16, fat:4,  easy:true, must:['Tinned tuna'],               nice:['Oatcakes'],               notes:'Drain tuna, serve on oatcakes.' },
    { name:'Hard-Boiled Eggs',          calories:155, protein:13, carbs:1,  fat:10, easy:true, must:['Eggs'],                      nice:[],                         notes:'Boil eggs 8 mins, cool and peel.' },
    { name:'Rice Cakes & Cream Cheese', calories:175, protein:6,  carbs:26, fat:5,  easy:true, must:['Cream cheese','Cucumber'],   nice:['Rice cakes'],             notes:'Spread cream cheese, top with cucumber.' },
  ],
  lunch: [
    { name:'Tuna Mayo Jacket Potato',   calories:520, protein:38, carbs:62, fat:10, easy:true,  must:['Baking potato','Tinned tuna','Salad leaves'],  nice:['Light mayo'],   notes:'Microwave potato 8–10 mins, fill with tuna mayo, serve with salad.' },
    { name:'Chicken & Sweetcorn Wrap',  calories:490, protein:40, carbs:48, fat:12, easy:true,  must:['Chicken breast','Wholemeal wraps'],             nice:['Sweetcorn','Light mayo'], notes:'Slice chicken, layer in wrap with sweetcorn and roll up.' },
    { name:'Prawn & Avocado Roll',      calories:460, protein:28, carbs:44, fat:16, easy:true,  must:['Cooked prawns','Avocado','Bread roll'],         nice:[],               notes:'Mash avocado, spread on roll, top with prawns.' },
    { name:'Chicken & Rice Salad',      calories:480, protein:42, carbs:50, fat:10, easy:true,  must:['Chicken breast','Cucumber','Tomatoes'],         nice:['Basmati rice','Light dressing'], notes:'Cook rice, cool, toss with chicken and veg.' },
    { name:'Ham & Cheese Toastie',      calories:450, protein:30, carbs:42, fat:16, easy:true,  must:['Lean ham','Cheddar','Wholemeal bread'],         nice:[],               notes:'Layer ham and cheese, toast until golden.' },
    { name:'Smoked Salmon Pasta Salad', calories:500, protein:34, carbs:54, fat:14, easy:false, must:['Smoked salmon','Cucumber'],                     nice:['Wholemeal pasta','Capers','Lemon'], notes:'Cook pasta, cool, toss with salmon and cucumber.',
      recipe:['Cook pasta, drain and rinse cold.','Tear salmon, dice cucumber.','Toss with lemon juice and olive oil.','Season and serve.'] },
    { name:'Lentil & Vegetable Soup',   calories:380, protein:22, carbs:52, fat:6,  easy:true,  must:['Carrot','Onion','Crusty bread'],                nice:['Tinned lentils','Vegetable stock'], notes:'Fry veg, add lentils and stock, simmer 15 mins.' },
  ],
  dinner: [
    { name:'Chicken Traybake with Veg',             calories:520, protein:46, carbs:38, fat:14, easy:true,  must:['Chicken thighs','Potatoes','Courgette','Red pepper'],  nice:['Smoked paprika','Olive oil'],   notes:'Toss with oil and paprika, roast at 200°C for 40 mins.' },
    { name:'One-Pot Chicken & Rice',                calories:510, protein:46, carbs:52, fat:10, easy:true,  must:['Chicken thighs','Frozen peas'],                        nice:['Basmati rice','Chicken stock'], notes:'Brown chicken, add rice and stock, simmer covered 20 mins, stir in peas.' },
    { name:'Baked Salmon with New Potatoes & Peas', calories:540, protein:52, carbs:32, fat:22, easy:true,  must:['Salmon fillet','New potatoes','Frozen peas'],          nice:['Butter','Lemon'],              notes:'Bake salmon 12 mins, boil potatoes, crush peas with butter.' },
    { name:'Turkey Mince Bolognese',                calories:520, protein:50, carbs:54, fat:10, easy:true,  must:['Turkey mince','Courgette'],                            nice:['Wholemeal spaghetti','Tinned tomatoes'], notes:'Brown mince, add tomatoes, simmer 20 mins, serve with pasta.' },
    { name:'Sausage & Veg Traybake',                calories:520, protein:28, carbs:46, fat:22, easy:true,  must:['Lean pork sausages','New potatoes','Red pepper'],      nice:[],                               notes:'Roast everything on one tray at 200°C for 35–40 mins.' },
    { name:'Butter Bean & Tomato Stew',             calories:440, protein:20, carbs:60, fat:10, easy:true,  must:['Spinach','Crusty bread'],                              nice:['Tinned butter beans','Tinned tomatoes'], notes:'Fry onion, add tomatoes and beans, simmer 15 mins, stir in spinach.' },
    { name:'Healthy Chicken Tikka Masala',          calories:540, protein:50, carbs:44, fat:14, easy:false, must:['Chicken breast'],                                      nice:['Tikka paste','Tinned tomatoes','Basmati rice','Yogurt'], notes:'Brown chicken with tikka paste, add tomatoes, simmer 15 mins, serve with rice.',
      recipe:['Fry onion 5 mins.','Add tikka paste, cook 1 min.','Add chicken, brown 3–4 mins.','Add tomatoes, simmer 15 mins.','Stir in yogurt off heat. Serve with rice.'] },
    { name:'Easy Prawn & Tomato Spaghetti',         calories:520, protein:36, carbs:66, fat:10, easy:false, must:['Raw king prawns'],                                     nice:['Wholemeal spaghetti','Tinned tomatoes'], notes:'Cook pasta, fry prawns with garlic, add tomatoes, toss and serve.',
      recipe:['Cook spaghetti per packet.','Fry garlic and chilli 1 min.','Add prawns, cook until pink.','Add tomatoes, simmer 5 mins.','Toss with pasta and serve.'] },
    { name:'Smoked Haddock & New Potatoes',         calories:470, protein:46, carbs:44, fat:10, easy:true,  must:['Smoked haddock','New potatoes','Frozen peas'],         nice:['Butter','Lemon'],              notes:'Boil potatoes, poach haddock 6–8 mins, crush peas with butter.' },
    { name:'Sweet Potato & Lentil Dhal',            calories:480, protein:22, carbs:70, fat:10, easy:false, must:['Sweet potato','Spinach','Naan bread'],                 nice:['Red lentils','Tinned coconut milk','Cumin','Turmeric'], notes:'Simmer lentils, sweet potato and coconut milk 20–25 mins, stir in spinach.',
      recipe:['Dice sweet potato.','Fry garlic with cumin and turmeric 1 min.','Add lentils, coconut milk and sweet potato.','Simmer 20–25 mins until soft.','Stir in spinach. Serve with naan.'] },
    { name:'Chicken & Chorizo One-Pot',             calories:560, protein:48, carbs:50, fat:16, easy:false, must:['Chicken thighs','Chorizo','Red pepper'],               nice:['Basmati rice','Tinned tomatoes','Chicken stock'], notes:'Fry chorizo, brown chicken, add everything and simmer covered 20 mins.',
      recipe:['Fry chorizo until oils release.','Brown chicken in same pan.','Add pepper, rice, tomatoes and stock.','Cover and simmer 20 mins.'] },
  ],
};

function generateMealPlan(weekStart, calorieGoal, db) {
  // Shuffle arrays to avoid repeats
  const shuffle = arr => arr.slice().sort(() => Math.random() - 0.5);
  const breakfasts = shuffle(MEALS.breakfast);
  const snacks1    = shuffle(MEALS.snack);
  const snacks2    = shuffle(MEALS.snack);
  const lunches    = shuffle(MEALS.lunch);
  const dinners    = shuffle(MEALS.dinner);

  const baseId = nextId(db.mealPlan);
  const items = [];
  let id = baseId;

  for (let day = 1; day <= 7; day++) {
    const idx = day - 1;
    const b = breakfasts[idx % breakfasts.length];
    const s1 = snacks1[idx % snacks1.length];
    const l = lunches[idx % lunches.length];
    const s2 = snacks2[(idx + 4) % snacks2.length];
    const d = dinners[idx % dinners.length];

    for (const [type, meal] of [['breakfast',b],['snack1',s1],['lunch',l],['snack2',s2],['dinner',d]]) {
      items.push({ id: id++, week_start: weekStart, day_of_week: day, meal_type: type, ...meal, created_at: new Date().toISOString() });
    }
  }

  db.mealPlan.push(...items);
  writeDB(db);
  return items;
}

// ── Setup ─────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Workout Programs (from Google Sheets) ─────────────────
const PROGRAMS = [
  {
    id: 'A',
    name: 'Plan A',
    exercises: [
      { name:'Ant Tib Cables',                    sets:2,     reps:'8-10es',           tempo:'2010', rest:120, rpe:'8→8.5' },
      { name:'Neutral Grip Lat Pulldown',          sets:3,     reps:'10-15',            tempo:'2010', rest:120, rpe:'8→8.5' },
      { name:'Neutral Grip Seated Cable Row',      sets:3,     reps:'8-12',             tempo:'3010', rest:60,  rpe:'8→8.5' },
      { name:'DB Goblet Squats on Ramp',           sets:3,     reps:'10',               tempo:'2111', rest:60,  rpe:'8→8.5' },
      { name:'DB Bench Press Unilateral Flat',     sets:3,     reps:'8-12',             tempo:'3010', rest:60,  rpe:'8→8.5' },
      { name:'DB Bulgarian Split Squats',          sets:3,     reps:'8es',              tempo:'3111', rest:60,  rpe:'8→8.5', notes:'Go lighter on Saturday' },
      { name:'Seated Shoulder Press',              sets:3,     reps:'10',               tempo:'2111', rest:60,  rpe:'8→8.5' },
      { name:'Hamstring Curl Machine',             sets:3,     reps:'10-12',            tempo:'2010', rest:60,  rpe:'8→8.5' },
      { name:'Farmers Walks',                      sets:2,     reps:'max hold',         tempo:'',     rest:null, rpe:'',    timed:true },
      { name:'DAP Cable Flys',                     sets:3,     reps:'10-12',            tempo:'2010', rest:60,  rpe:'8→8.5' },
      { name:'Press Ups on Handles',               sets:2,     reps:'8-20',             tempo:'2111', rest:60,  rpe:'8→8.5' },
      { name:'Copenhagen Side Planks',             sets:2,     reps:'20 secs',          tempo:'-',    rest:60,  rpe:'8→8.5', timed:true },
    ],
  },
  {
    id: 'B',
    name: 'Plan B',
    exercises: [
      { name:'Ant Tib Cables',                    sets:2,     reps:'8-10es',           tempo:'2010', rest:120, rpe:'8→8.5' },
      { name:'Reverse Grip Pulldown',             sets:3,     reps:'10-12',            tempo:'2010', rest:60,  rpe:'8→8.5' },
      { name:'DB Bench Press Decline',            sets:4,     reps:'8-10',             tempo:'2111', rest:60,  rpe:'8→8.5' },
      { name:'Single Leg TRX Ring RDLs',          sets:3,     reps:'8es',              tempo:'2010', rest:60,  rpe:'8→8.5' },
      { name:'DAP Cable Flys + Incline Press Ups',sets:3,     reps:'15-25',            tempo:'2111', rest:60,  rpe:'8→8.5' },
      { name:'DB Step Ups',                       sets:3,     reps:'8es',              tempo:'2010', rest:60,  rpe:'8→8.5' },
      { name:'Single Arm DB Row',                 sets:4,     reps:'8-10es',           tempo:'3010', rest:60,  rpe:'8→8.5' },
      { name:'Arnold Press Standing',             sets:4,     reps:'10-12',            tempo:'2010', rest:90,  rpe:'8→8.5' },
      { name:'Hammer Bicep Curls',                sets:3,     reps:'8',                tempo:'3010', rest:60,  rpe:'8→8.5' },
      { name:'Bent Knee Calf Raises',             sets:2,     reps:'10-20',            tempo:'2111', rest:60,  rpe:'8→8.5' },
    ],
  },
];

function localToday() { return new Date().toLocaleDateString('en-CA'); }

// ── Workouts ──────────────────────────────────────────────
app.post('/api/workouts', (req, res) => {
  const { text, date } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'text required' });
  const db = readDB();
  const parsed = parseWorkoutText(text);
  const workoutDate = date || localToday();
  const entry = { id: nextId(db.workouts), raw_text: text.trim(), ...parsed, date: workoutDate, created_at: new Date().toISOString() };
  db.workouts.push(entry);

  // Auto-complete matching training plan day (skip rest days)
  const dateObj = new Date(workoutDate + 'T12:00:00');
  const weekStart = getWeekStart(dateObj);
  const dow = dateObj.getDay() === 0 ? 7 : dateObj.getDay();
  const planDay = db.trainingPlan.find(p =>
    p.week_start === weekStart &&
    p.day_of_week === dow &&
    !p.completed &&
    !p.activity.toLowerCase().startsWith('rest')
  );
  if (planDay) planDay.completed = true;

  writeDB(db);
  res.json(entry);
});

app.get('/api/workouts', (req, res) => {
  const { limit=30, date } = req.query;
  const db = readDB();
  res.json(date
    ? db.workouts.filter(w => w.date === date).reverse()
    : db.workouts.slice().reverse().slice(0, +limit));
});

app.delete('/api/workouts/:id', (req, res) => {
  const db = readDB();
  db.workouts = db.workouts.filter(w => w.id !== +req.params.id);
  writeDB(db);
  res.json({ ok:true });
});

// ── Exercise Sets ─────────────────────────────────────────
app.post('/api/exercises', (req, res) => {
  const { workout_id, name, sets, unit='lbs' } = req.body;
  if (!name?.trim() || !Array.isArray(sets)) return res.status(400).json({ error: 'name and sets required' });
  const db = readDB();
  const workout = db.workouts.find(w => w.id === +workout_id);
  const entry = {
    id: nextId(db.exercises),
    workout_id: +workout_id || null,
    name: name.trim(),
    sets: sets.filter(s => s.reps > 0),
    unit,
    date: workout?.date || localToday(),
    created_at: new Date().toISOString(),
  };
  db.exercises.push(entry);
  writeDB(db);
  res.json(entry);
});

app.get('/api/exercises', (req, res) => {
  const { workout_id, name } = req.query;
  const db = readDB();
  if (workout_id) return res.json(db.exercises.filter(e => e.workout_id === +workout_id));
  if (name) {
    const n = name.toLowerCase();
    return res.json(db.exercises.filter(e => e.name.toLowerCase().includes(n)).sort((a,b) => a.date.localeCompare(b.date)));
  }
  res.json(db.exercises.slice().reverse().slice(0, 50));
});

app.delete('/api/exercises/:id', (req, res) => {
  const db = readDB();
  db.exercises = db.exercises.filter(e => e.id !== +req.params.id);
  writeDB(db);
  res.json({ ok:true });
});

// Most recent entry per unique exercise name (for pre-filling weights)
app.get('/api/exercises/recent-weights', (_req, res) => {
  const db = readDB();
  const seen = new Set();
  const result = [];
  for (const e of db.exercises.slice().sort((a,b) => b.date.localeCompare(a.date))) {
    const key = e.name.toLowerCase().trim();
    if (!seen.has(key)) { seen.add(key); result.push(e); }
  }
  res.json(result);
});

// All exercises with full history per exercise name
app.get('/api/exercise-history', (_req, res) => {
  const db = readDB();
  const history = {};
  // Collect all unique exercise names from programs
  PROGRAMS.forEach(p => p.exercises.forEach(e => {
    if (!history[e.name]) history[e.name] = { plan: p.id, meta: e, logs: [] };
  }));
  // Attach logged entries
  db.exercises.forEach(entry => {
    const key = Object.keys(history).find(k => k.toLowerCase() === entry.name.toLowerCase());
    if (key) history[key].logs.push(entry);
  });
  // Sort logs newest first
  Object.values(history).forEach(h => h.logs.sort((a,b) => b.date.localeCompare(a.date)));
  res.json(history);
});

// Log weight for a specific exercise (simplified — just weight per set)
app.post('/api/exercise-log', (req, res) => {
  const { name, weight, reps, sets, unit='kg', date } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  const db = readDB();
  const entry = {
    id: nextId(db.exercises),
    name: name.trim(),
    sets: Array.isArray(sets) ? sets : [{ reps: reps||0, weight: +weight||0 }],
    unit,
    date: date || localToday(),
    created_at: new Date().toISOString(),
  };
  db.exercises.push(entry);
  writeDB(db);
  res.json(entry);
});

// Programs from Google Sheets
app.get('/api/programs', (_req, res) => res.json(PROGRAMS));

// ── Weight ────────────────────────────────────────────────
app.post('/api/weight', (req, res) => {
  const { weight, unit='lbs', note, date } = req.body;
  if (!weight) return res.status(400).json({ error: 'weight required' });
  const db = readDB();
  const entry = { id: nextId(db.weights), weight: +weight, unit, note: note||null, date: date||localToday(), created_at: new Date().toISOString() };
  db.weights.push(entry);
  writeDB(db);
  res.json(entry);
});

app.get('/api/weight', (_req, res) => {
  res.json(readDB().weights.sort((a,b) => a.date.localeCompare(b.date)));
});

app.delete('/api/weight/:id', (req, res) => {
  const db = readDB();
  db.weights = db.weights.filter(w => w.id !== +req.params.id);
  writeDB(db);
  res.json({ ok:true });
});

// ── Nutrition ─────────────────────────────────────────────
app.post('/api/nutrition', (req, res) => {
  const { meal_name, calories=0, protein=0, carbs=0, fat=0, date } = req.body;
  if (!meal_name?.trim()) return res.status(400).json({ error: 'meal_name required' });
  const db = readDB();
  const entry = { id: nextId(db.nutrition), meal_name: meal_name.trim(), calories:+calories, protein:+protein, carbs:+carbs, fat:+fat, date: date||localToday(), created_at: new Date().toISOString() };
  db.nutrition.push(entry);
  writeDB(db);
  res.json(entry);
});

app.get('/api/nutrition', (req, res) => {
  const { date } = req.query;
  const db = readDB();
  res.json(date
    ? db.nutrition.filter(n => n.date === date).reverse()
    : db.nutrition.slice().reverse().slice(0,50));
});

app.delete('/api/nutrition/:id', (req, res) => {
  const db = readDB();
  db.nutrition = db.nutrition.filter(n => n.id !== +req.params.id);
  writeDB(db);
  res.json({ ok:true });
});

app.patch('/api/nutrition/daily', (req, res) => {
  const { calories=0, protein=0, carbs=0, fat=0, date } = req.body;
  const db = readDB();
  const day = date || localToday();
  db.nutrition = db.nutrition.filter(n => n.date !== day);
  const entry = { id: nextId(db.nutrition), meal_name: 'Daily total', calories:+calories, protein:+protein, carbs:+carbs, fat:+fat, date: day, created_at: new Date().toISOString() };
  db.nutrition.push(entry);
  writeDB(db);
  res.json(entry);
});

// ── Training Plan ─────────────────────────────────────────
app.get('/api/plan', (_req, res) => {
  const db = readDB();
  const weekStart = getWeekStart(new Date());
  let plan = db.trainingPlan.filter(p => p.week_start === weekStart).sort((a,b) => a.day_of_week - b.day_of_week);
  if (!plan.length) plan = generateAdaptivePlan(weekStart, db);
  res.json(plan);
});

app.patch('/api/plan/:id', (req, res) => {
  const db = readDB();
  const item = db.trainingPlan.find(p => p.id === +req.params.id);
  if (item) {
    if (req.body.completed !== undefined) item.completed = !!req.body.completed;
    if (req.body.program_id !== undefined) item.program_id = req.body.program_id;
    if (req.body.activity   !== undefined) item.activity   = req.body.activity;
  }
  writeDB(db);
  res.json({ ok:true });
});

app.post('/api/plan/:id/start', (req, res) => {
  const db = readDB();
  const planDay = db.trainingPlan.find(p => p.id === +req.params.id);
  if (!planDay) return res.status(404).json({ error: 'not found' });
  const workoutDate = req.body.date || localToday();
  const workout = {
    id: nextId(db.workouts),
    raw_text: planDay.activity,
    activity: planDay.activity,
    duration_mins: planDay.duration_mins || null,
    intensity: planDay.intensity || 'medium',
    category: getCategoryFromActivity(planDay.activity),
    date: workoutDate,
    created_at: new Date().toISOString(),
  };
  db.workouts.push(workout);
  if (!planDay.completed) planDay.completed = true;
  writeDB(db);
  res.json({ workout, planDay });
});

app.post('/api/plan/regenerate', (req, res) => {
  const db = readDB();
  const weekStart = getWeekStart(new Date());
  db.trainingPlan = db.trainingPlan.filter(p => p.week_start !== weekStart);
  writeDB(db);
  const plan = generateAdaptivePlan(weekStart, readDB());
  res.json(plan);
});

// ── Meal Plan ─────────────────────────────────────────────
app.get('/api/meal-plan', (req, res) => {
  const db = readDB();
  const weekStart = getWeekStart(new Date());
  let plan = db.mealPlan.filter(m => m.week_start === weekStart).sort((a,b) => a.day_of_week - b.day_of_week || a.meal_type.localeCompare(b.meal_type));
  if (!plan.length) plan = generateMealPlan(weekStart, req.query.calorieGoal || 2000, db);
  res.json(plan);
});

app.post('/api/meal-plan/regenerate', (req, res) => {
  const db = readDB();
  const weekStart = getWeekStart(new Date());
  db.mealPlan = db.mealPlan.filter(m => m.week_start !== weekStart);
  writeDB(db);
  const plan = generateMealPlan(weekStart, req.body.calorieGoal || 2000, readDB());
  res.json(plan);
});

// ── Streak calendar ───────────────────────────────────────
app.get('/api/streak-calendar', (_req, res) => {
  const db = readDB();
  const doneDates = new Set(db.workouts.map(w => w.date));
  // Return last 84 days (12 weeks)
  const days = [];
  const d = new Date();
  for (let i = 0; i < 84; i++) {
    const ds = d.toLocaleDateString('en-CA');
    days.push({ date: ds, done: doneDates.has(ds) });
    d.setDate(d.getDate() - 1);
  }
  // streak count
  let streak = 0;
  const s = new Date();
  while (doneDates.has(s.toLocaleDateString('en-CA'))) {
    streak++; s.setDate(s.getDate() - 1);
  }
  res.json({ days, streak });
});

app.post('/api/streak-calendar/toggle', (req, res) => {
  const { date } = req.body;
  if (!date) return res.status(400).json({ error: 'date required' });
  const db = readDB();
  const existing = db.workouts.findIndex(w => w.date === date && w.raw_text === '✓');
  if (existing >= 0) {
    // Only remove the marker entry, not real logged workouts
    const real = db.workouts.filter(w => w.date === date && w.raw_text !== '✓');
    if (real.length === 0) db.workouts.splice(existing, 1);
  } else {
    // Only add a marker if no workout already logged for this date
    if (!db.workouts.some(w => w.date === date)) {
      db.workouts.push({ id: nextId(db.workouts), date, raw_text: '✓', activity: 'Exercise', duration_mins: 0, created_at: new Date().toISOString() });
    }
  }
  writeDB(db);
  res.json({ ok: true });
});

// ── Stats ─────────────────────────────────────────────────
app.get('/api/stats', (_req, res) => {
  const db = readDB();
  const today = localToday();
  const weekStart = getWeekStart(new Date());
  const sortedW = db.weights.slice().sort((a,b) => a.date.localeCompare(b.date));
  const todayNutrition = db.nutrition.filter(n => n.date === today);
  const weekWorkouts   = db.workouts.filter(w => w.date >= weekStart);

  let streak = 0;
  const d = new Date();
  while (true) {
    const ds = d.toLocaleDateString('en-CA');
    if (!db.workouts.some(w => w.date === ds)) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }

  // MET-based calorie burn for today's workouts
  const latestWeight = sortedW[sortedW.length-1];
  const weightKg = latestWeight
    ? (latestWeight.unit === 'kg' ? latestWeight.weight : latestWeight.weight / 2.20462)
    : 80; // default 80kg
  const todayWorkouts = db.workouts.filter(w => w.date === today);
  const caloriesBurned = Math.round(
    todayWorkouts.reduce((sum, w) => sum + getMET(w.activity) * weightKg * ((w.duration_mins || 0) / 60), 0)
  );
  const caloriesIn = todayNutrition.reduce((s,e)=>s+(+e.calories||0),0);

  res.json({
    today: {
      workouts: todayWorkouts,
      calories: caloriesIn,
      protein:  todayNutrition.reduce((s,e)=>s+(+e.protein||0),0),
      calories_burned: caloriesBurned,
      net: caloriesIn - caloriesBurned,
    },
    week: {
      workoutCount: weekWorkouts.length,
      totalDuration: weekWorkouts.reduce((s,w)=>s+(+w.duration_mins||0),0),
    },
    weight: {
      current: sortedW[sortedW.length-1]?.weight ?? null,
      unit: sortedW[sortedW.length-1]?.unit ?? 'lbs',
      change: (sortedW.length > 1) ? +(sortedW[sortedW.length-1].weight - sortedW[0].weight).toFixed(1) : null,
    },
    streak,
  });
});

// ── VAPID / Push ──────────────────────────────────────────
function initVapid() {
  const db = readDB();
  if (!db.vapid) {
    db.vapid = webpush.generateVAPIDKeys();
    writeDB(db);
  }
  webpush.setVapidDetails(
    'mailto:connormoore130@gmail.com',
    db.vapid.publicKey,
    db.vapid.privateKey
  );
  return db.vapid;
}
const vapidKeys = initVapid();

async function sendPushToAll(payload) {
  const db = readDB();
  const dead = [];
  for (const sub of db.pushSubscriptions) {
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload));
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) dead.push(sub.endpoint);
    }
  }
  if (dead.length) {
    db.pushSubscriptions = db.pushSubscriptions.filter(s => !dead.includes(s.endpoint));
    writeDB(db);
  }
}

app.get('/api/push/vapid-public-key', (_req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

app.post('/api/push/subscribe', (req, res) => {
  const sub = req.body;
  if (!sub?.endpoint) return res.status(400).json({ error: 'invalid subscription' });
  const db = readDB();
  const exists = db.pushSubscriptions.some(s => s.endpoint === sub.endpoint);
  if (!exists) { db.pushSubscriptions.push(sub); writeDB(db); }
  res.json({ ok: true });
});

app.delete('/api/push/subscribe', (req, res) => {
  const { endpoint } = req.body;
  const db = readDB();
  db.pushSubscriptions = db.pushSubscriptions.filter(s => s.endpoint !== endpoint);
  writeDB(db);
  res.json({ ok: true });
});

app.post('/api/push/test', async (_req, res) => {
  await sendPushToAll({ title: 'Connor Tracker', body: 'Push notifications are working! 💪' });
  res.json({ ok: true });
});

// ── Cron: 8am daily morning reminder ─────────────────────
cron.schedule('0 8 * * *', async () => {
  const db = readDB();
  if (!db.pushSubscriptions.length) return;
  const weekStart = getWeekStart(new Date());
  const todayDow = new Date().getDay() === 0 ? 7 : new Date().getDay();
  const plan = db.trainingPlan.filter(p => p.week_start === weekStart);
  const todayPlan = plan.find(p => p.day_of_week === todayDow);

  let streak = 0;
  const d = new Date(); d.setDate(d.getDate() - 1); // yesterday (today not logged yet)
  while (db.workouts.some(w => w.date === d.toLocaleDateString('en-CA'))) {
    streak++; d.setDate(d.getDate() - 1);
  }

  const streakMsg = streak > 0 ? ` You're on a ${streak}-day streak 🔥` : '';
  const body = todayPlan && todayPlan.activity !== 'Rest' && todayPlan.activity !== 'Rest & Recovery'
    ? `Today: ${todayPlan.activity}${todayPlan.duration_mins > 0 ? ` · ${todayPlan.duration_mins} min` : ''}.${streakMsg}`
    : `Rest day today — recover well.${streakMsg}`;

  await sendPushToAll({ title: "Morning, Connor 💪", body, url: '/' });
});

// ── Cron: 9pm evening nudge if no workout logged ──────────
cron.schedule('0 21 * * *', async () => {
  const db = readDB();
  if (!db.pushSubscriptions.length) return;
  const today = localToday();
  const loggedToday = db.workouts.some(w => w.date === today);
  if (loggedToday) return;

  // Count streak to motivate
  let streak = 0;
  const d = new Date(); d.setDate(d.getDate() - 1);
  while (db.workouts.some(w => w.date === d.toLocaleDateString('en-CA'))) {
    streak++; d.setDate(d.getDate() - 1);
  }

  const body = streak > 0
    ? `You haven't logged today — don't break your ${streak}-day streak! 🔥`
    : "You haven't logged a workout today. Even a short session counts!";

  await sendPushToAll({ title: "Don't forget to log 📋", body, url: '/' });
});

const os = require('os');
function getLocalIP() {
  for (const nets of Object.values(os.networkInterfaces())) {
    for (const net of nets) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  const ip = getLocalIP();
  console.log(`\n  Connor Workout Tracker`);
  console.log(`  ─────────────────────────────────`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${ip}:${PORT}  ← use this on your phone\n`);
});
