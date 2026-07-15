/* TallyHo - clean single-runtime build. Keeps all existing local budget data. */
const BASE_APP_KEY='tallyho-budget-v3';
const AUTH_KEY='tallyho-auth-users-v1';
const SESSION_KEY='tallyho-session-v1';
const DEVICE_AUTH_KEY='tallyho-device-auth-v1';
let APP_KEY=BASE_APP_KEY;
const LEGACY_APP_KEY='sprig-budget-v1';
const DEFAULTS={settings:{cadence:'monthly',purchaseGuardPercent:15,categories:['Housing','Bills','Debt','Groceries','Gas','Food & Takeout','Entertainment','Health','Pets','Personal','Other'],savingsFunds:['Emergency fund'],startingBalance:0,theme:'classic'},entries:[],debts:[],buyHistory:[]};
const PALETTE=['#5f806b','#c98368','#d0aa69','#7fa4a7','#9c83a9','#bd8b7c','#88996c','#8490af'];
const THEMES={classic:'Classic',blush:'Blush',heritage:'Heritage',rainbow:'Rainbow'};
const DEMO_EMAIL='demo@tallyho.app';
const DEMO_PASSWORD='FronzAndLillian!';
let state=loadState();
let selectedPurchasePlan='yearly';
let viewDate=startOfDay(new Date());
let calDate=new Date(viewDate.getFullYear(),viewDate.getMonth(),1,12);
let selectedDate=null;
let onboardingDraft=null;
const ui={coachView:'both',planView:'both',min:'',max:''};

function $(q,r=document){return r.querySelector(q)}
function $$(q,r=document){return [...r.querySelectorAll(q)]}
function startOfDay(d){const x=new Date(d);x.setHours(12,0,0,0);return x}
function addDays(d,n){const x=startOfDay(d);x.setDate(x.getDate()+n);return x}
function addMonths(d,n){const x=startOfDay(d),day=x.getDate();x.setDate(1);x.setMonth(x.getMonth()+n);x.setDate(Math.min(day,new Date(x.getFullYear(),x.getMonth()+1,0).getDate()));return x}
function addYears(d,n){const x=startOfDay(d);x.setFullYear(x.getFullYear()+n);return x}
function dateISO(d){const x=startOfDay(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`}
function parseDate(v){if(!v)return null;if(v instanceof Date)return Number.isNaN(v)?null:startOfDay(v);const s=String(v).trim();let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);if(m)return new Date(+m[1],+m[2]-1,+m[3],12);m=s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);if(m){const y=+m[3]<100?2000+(+m[3]):+m[3];return new Date(y,+m[1]-1,+m[2],12)}const d=new Date(s);return Number.isNaN(d)?null:startOfDay(d)}
function diffDays(a,b){return Math.round((startOfDay(b)-startOfDay(a))/86400000)}
function money(v){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v)||0)}
function shortMoney(v){const n=Number(v)||0;return Math.abs(n)>=1000?`$${(n/1000).toFixed(Math.abs(n)%1000?1:0)}k`:money(n)}
function dateLabel(d){return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(d)}
function monthLabel(d){return new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric'}).format(d)}
function calendarItemLabel(item){const raw=String(item?.name||item?.category||item?.type||'Item').trim(),word=(raw.split(/\s+/)[0]||'Item');return word.length>6?`${word.slice(0,5)}.`:word}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function cents(v){return Math.round((Number(v)||0)*100)/100}
function uid(p='entry'){return `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`}
function normalizedType(v){v=String(v||'payment').toLowerCase().trim();if(['income','paycheck','deposit','earnings','inflow'].includes(v))return'income';if(['savings','save','transfer to savings'].includes(v))return'savings';return'payment'}
function safe(fn){try{return fn()}catch(err){console.error('TallyHo:',err);return undefined}}

function loadState(){try{const raw=localStorage.getItem(APP_KEY)||(APP_KEY===BASE_APP_KEY?localStorage.getItem('tallyho-budget-v2')||localStorage.getItem(LEGACY_APP_KEY):null);const saved=raw?JSON.parse(raw):{};const data={...DEFAULTS,...saved,settings:{...DEFAULTS.settings,...(saved.settings||{})},entries:Array.isArray(saved.entries)?saved.entries:[],debts:Array.isArray(saved.debts)?saved.debts:[]};normalizeState(data);return data}catch{return structuredClone(DEFAULTS)}}
function normalizeState(target=state){if(!target.settings)target.settings={...DEFAULTS.settings};target.settings={...DEFAULTS.settings,...target.settings};if(!Array.isArray(target.entries))target.entries=[];if(!Array.isArray(target.buyHistory))target.buyHistory=[];target.entries=target.entries.filter(Boolean).map(raw=>{const e={...raw};e.id=e.id||uid();e.name=String(e.name||e.title||e.label||'Unnamed item').trim();e.type=normalizedType(e.type||e.kind||e.entryType||e.transactionType);e.amount=cents(e.amount??e.value??e.price??e.total??0);const rawDate=e.date||e.dueDate||e.startDate||e.nextDate||e.paymentDate||null;e.date=parseDate(rawDate)?dateISO(parseDate(rawDate)):null;let r=e.repeat;if(!r&&(e.frequency||e.interval||e.repeatEvery))r={every:e.repeatEvery||e.interval||1,unit:e.frequency||e.repeatUnit||'months'};if(r===true)r={every:1,unit:'months'};if(!r||typeof r!=='object')e.repeat=null;else{let every=Math.max(1,Number(r.every||r.interval||1)||1);let unit=String(r.unit||r.frequency||'months').toLowerCase();if(['week','weekly'].includes(unit))unit='weeks';if(['biweekly','bi-weekly','fortnightly'].includes(unit)){unit='weeks';every*=2}if(['month','monthly'].includes(unit))unit='months';if(['year','yearly','annual','annually'].includes(unit))unit='years';e.repeat=['weeks','months','years'].includes(unit)?{every,unit}:null}return e})}
function save(){normalizeState();localStorage.setItem(APP_KEY,JSON.stringify(state))}
function totals(items){return(items||[]).reduce((a,x)=>{const amt=cents(x.amount);if(x.type==='income')a.income=cents(a.income+amt);else if(x.type==='savings')a.savings=cents(a.savings+amt);else a.payments=cents(a.payments+amt);return a},{income:0,payments:0,savings:0})}
function step(d,r){return r.unit==='weeks'?addDays(d,r.every*7):r.unit==='years'?addYears(d,r.every):addMonths(d,r.every)}
function occurrences(entry,start,end){if(!entry.date)return[];const first=parseDate(entry.date);if(!first||first>=end)return[];if(!entry.repeat)return first>=start&&first<end?[{...entry,occurrence:first,occurrenceDate:dateISO(first)}]:[];let cur=first,guard=0,out=[];while(cur<start&&guard++<5000)cur=step(cur,entry.repeat);while(cur<end&&guard++<5000){out.push({...entry,occurrence:cur,occurrenceDate:dateISO(cur)});cur=step(cur,entry.repeat)}return out}
function planned(start,end,{undated=false}={}){const dated=state.entries.flatMap(e=>occurrences(e,start,end));const extra=undated?state.entries.filter(e=>!e.date).map(e=>({...e,occurrence:start,occurrenceDate:dateISO(start),unscheduled:true})):[];return [...dated,...extra].sort((a,b)=>a.occurrence-b.occurrence||a.name.localeCompare(b.name))}
function summary(start,end,opts){const items=planned(start,end,opts),t=totals(items);return{items,...t,outflow:cents(t.payments+t.savings),net:cents(t.income-t.payments-t.savings)}}
function monthEnd(d){return new Date(d.getFullYear(),d.getMonth()+1,1,12)}
function monthShort(d){return new Intl.DateTimeFormat('en-US',{month:'short'}).format(d)}
function sumBy(items,keyFn,valueFn=x=>Number(x.amount)||0){return items.reduce((out,item)=>{const key=keyFn(item)||'Other';out[key]=cents((out[key]||0)+valueFn(item));return out},{})}
function activeTheme(){const key=state.settings?.theme||'classic';return isPremium()&&THEMES[key]?key:'classic'}
function applyTheme(){document.body.dataset.theme=activeTheme()}
function cssVar(name,fallback=''){return getComputedStyle(document.body).getPropertyValue(name).trim()||fallback}
function chartColor(name,fallback){return cssVar(name,fallback)}
function themePalette(){return ['--chart-a','--chart-b','--chart-c','--chart-d','--chart-e','--chart-f','--chart-g','--chart-h'].map((name,i)=>chartColor(name,PALETTE[i%PALETTE.length]))}
function getPeriod(){const d=startOfDay(viewDate);if(state.settings.cadence==='weekly'){const start=addDays(d,-d.getDay());return{start,end:addDays(start,7),label:`${dateLabel(start)} - ${dateLabel(addDays(start,6))}`}}if(state.settings.cadence==='biweekly'){const anchor=new Date(d.getFullYear(),0,1,12),block=Math.floor((d-anchor)/86400000/14),start=addDays(anchor,block*14);return{start,end:addDays(start,14),label:`${dateLabel(start)} - ${dateLabel(addDays(start,13))}`}}return{start:new Date(d.getFullYear(),d.getMonth(),1,12),end:new Date(d.getFullYear(),d.getMonth()+1,1,12),label:monthLabel(d)}}
function sunday(d){return addDays(d,-startOfDay(d).getDay())}
function planStart(){const base=sunday(viewDate),end=addDays(base,28);const current=state.entries.some(e=>occurrences(e,base,end).length);if(current)return base;const next=state.entries.map(e=>{if(!e.date)return null;let c=parseDate(e.date),g=0;while(e.repeat&&c<base&&g++<5000)c=step(c,e.repeat);return c>=base?c:null}).filter(Boolean).sort((a,b)=>a-b)[0];return next?sunday(next):base}
function weeklyReserve(e){const amount=Math.max(0,Number(e.amount)||0);if(!e.repeat){const due=parseDate(e.date);if(due&&due>=viewDate)return cents(amount/Math.max(1,Math.ceil((diffDays(viewDate,due)+1)/7)));return cents(amount*12/52)}const n=Math.max(1,e.repeat.every||1);const yearly=e.repeat.unit==='weeks'?52/n:e.repeat.unit==='years'?1/n:12/n;return cents(amount*yearly/52)}

function renderTop(){const p=getPeriod();$('#periodLabel').textContent=p.label;$('#periodNarrative').textContent=state.settings.cadence==='monthly'?`Here is your plan for ${p.label}. Let every dollar clock in before it wanders off.`:`This ${state.settings.cadence} view organizes every scheduled date into one clear plan.`}
function renderHome(){
  const p=getPeriod(),s=summary(p.start,p.end),balance=s.net;
  $('#kpiIncome').textContent=money(s.income);
  $('#kpiOutflow').textContent=money(s.outflow);
  $('#kpiBalance').textContent=money(balance);
  $('#kpiSavings').textContent=money(s.savings);
  $('#incomeSub').textContent=s.income?`${s.items.filter(i=>i.type==='income').length} scheduled item(s)`:'add income to begin';
  $('#outflowSub').textContent=s.payments?`${s.items.filter(i=>i.type==='payment').length} payment(s) + savings`:'nothing scheduled yet';
  $('#balanceSub').textContent=balance>=0?'money not already spoken for':'more planned than income';
  $('#savingsSub').textContent=s.savings?`${state.settings.savingsFunds.length} fund(s) available`:'create a fund in settings';
  const cats={};
  s.items.filter(i=>i.type==='payment').forEach(i=>cats[i.category||'Other']=(cats[i.category||'Other']||0)+i.amount);
  const pairs=Object.entries(cats).sort((a,b)=>b[1]-a[1]),max=Math.max(1,...pairs.map(x=>x[1]));
  $('#cashFlowList').innerHTML=pairs.length?pairs.map(([n,v])=>`<div class="flow-row"><span class="flow-label">${esc(n)}</span><div class="flow-bar"><i style="width:${Math.max(4,v/max*100)}%"></i></div><span class="flow-value">${money(v)}</span></div>`).join(''):'<div class="empty-state">Add a payment to see where your money is planned to go.</div>';
  const upcoming=planned(startOfDay(new Date()),addDays(new Date(),90)).filter(i=>i.type!=='income').slice(0,6);
  $('#upcomingList').innerHTML=upcoming.length?upcoming.map(i=>`<div class="upcoming-item"><div class="date-badge"><b>${i.occurrence.getDate()}</b><small>${new Intl.DateTimeFormat('en-US',{month:'short'}).format(i.occurrence)}</small></div><div class="upcoming-details"><strong>${esc(i.name)}</strong><span>${esc(i.category||i.savingsFund||i.account||'Scheduled item')}</span></div><span class="upcoming-amount">${money(i.amount)}</span></div>`).join(''):'<div class="empty-state">Your next scheduled payments will appear here.</div>';
  const allocationColors=[chartColor('--chart-outflow','#c8755f'),chartColor('--chart-savings','#8ebbc2'),chartColor('--chart-income','#4f8374')];
  drawDonut('allocationChart',[s.payments,s.savings,Math.max(0,balance)],allocationColors);
  $('#allocationLegend').innerHTML=[['Payments',s.payments,allocationColors[0]],['Savings',s.savings,allocationColors[1]],['Breathing room',Math.max(0,balance),allocationColors[2]]].map(x=>`<div class="legend-item"><span><i class="dot" style="background:${x[2]}"></i>${x[0]}</span><strong>${money(x[1])}</strong></div>`).join('');
}
function renderCalendar(){const y=calDate.getFullYear(),m=calDate.getMonth(),first=new Date(y,m,1,12),grid=sunday(first),end=addDays(grid,42),items=planned(grid,end),by={};items.forEach(i=>(by[i.occurrenceDate]??=[]).push(i));$('#calMonthLabel').textContent=monthLabel(calDate);$('#calendarGrid').innerHTML=Array.from({length:42},(_,n)=>{const d=addDays(grid,n),arr=by[dateISO(d)]||[];return `<button class="cal-cell ${d.getMonth()!==m?'muted':''}" data-date="${dateISO(d)}"><span class="cal-daynum">${d.getDate()}</span><div class="cal-items">${arr.slice(0,1).map(i=>`<div class="cal-pill ${i.type}" title="${esc(i.name)}">${esc(calendarItemLabel(i))}</div>`).join('')}${arr.length>1?`<span class="cal-more">+${arr.length-1} more</span>`:''}</div></button>`}).join('');$$('.cal-cell').forEach(b=>b.onclick=()=>{selectedDate=b.dataset.date;renderSelectedDay()});renderSelectedDay();const yr=planned(new Date(y,0,1,12),new Date(y+1,0,1,12)).filter(i=>i.type!=='income');const months=Array.from({length:12},(_,i)=>yr.filter(x=>x.occurrence.getMonth()===i).reduce((a,x)=>a+x.amount,0)),max=Math.max(1,...months);$('#monthlyRhythm').innerHTML=months.map((v,i)=>`<div class="rhythm-row"><strong>${new Intl.DateTimeFormat('en-US',{month:'short'}).format(new Date(y,i,1))}</strong><div class="rhythm-bar"><i style="width:${v/max*100}%"></i></div><strong>${shortMoney(v)}</strong></div>`).join('');renderCalendarLedger(new Date(y,m,1,12),new Date(y,m+1,1,12))}
function renderCalendarLedger(start,end){const items=planned(start,end).sort((a,b)=>a.occurrence-b.occurrence||a.name.localeCompare(b.name)),t=totals(items),net=cents(t.income-t.payments-t.savings);const summary=$('#calendarLedgerSummary'),list=$('#calendarLedgerList');if(summary)summary.textContent=`${money(net)} net`;if(!list)return;list.innerHTML=items.length?items.map(i=>{const sign=i.type==='income'?'+':'-',meta=i.type==='income'?'Income':i.type==='savings'?'Savings':'Payment';return `<div class="ledger-row ${i.type}"><span class="ledger-date">${dateLabel(i.occurrence)}</span><div><strong>${esc(i.name)}</strong><small>${meta} · ${esc(i.category||i.savingsFund||i.account||'Scheduled')}</small></div><b>${sign}${money(i.amount)}</b></div>`}).join(''):'<div class="empty-state">Nothing is scheduled for this month yet.</div>'}
function renderSelectedDay(){const box=$('#selectedDayItems'),title=$('#selectedDayTitle');if(!selectedDate){title.textContent='Choose a day';box.className='day-items empty-state';box.textContent='Tap a payment date to see its details.';return}const d=parseDate(selectedDate),items=planned(d,addDays(d,1));title.textContent=new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric'}).format(d);box.className='day-items';box.innerHTML=items.length?items.map(i=>`<div class="day-item"><div class="date-badge"><b>${i.type==='income'?'↑':'↓'}</b></div><div class="upcoming-details"><strong>${esc(i.name)}</strong><span>${esc(i.category||i.savingsFund||i.account||'Planned')}</span></div><span class="upcoming-amount">${i.type==='income'?'+':'-'}${money(i.amount)}</span></div>`).join(''):'<div class="empty-state">Nothing scheduled for this day.</div>'}
function renderWeekly(){const start=planStart();const weeks=Array.from({length:4},(_,i)=>{const s=addDays(start,i*7),e=addDays(s,7);return{index:i+1,start:s,end:e,...summary(s,e,{undated:i===0})}});let running=Number(state.settings.startingBalance)||0;weeks.forEach(w=>{running=cents(running+w.net);w.after=running});$('#weeklyRangeLabel').textContent=`${dateLabel(start)} - ${dateLabel(addDays(start,27))} · four-week runway`;$('#weeklyStartingBalance').textContent=money(state.settings.startingBalance);$('#weeklyIncomeTotal').textContent=money(weeks.reduce((a,w)=>a+w.income,0));$('#weeklyOutflowTotal').textContent=money(weeks.reduce((a,w)=>a+w.outflow,0));$('#weeklyAfterTotal').textContent=money(weeks[3].after);const card=w=>`<article class="weekly-card"><div class="weekly-card-head"><div><p class="eyebrow">WEEK ${w.index}</p><h2>${dateLabel(w.start)} - ${dateLabel(addDays(w.end,-1))}</h2></div><span class="weekly-net ${w.net<0?'negative':''}">${w.net>=0?'+':''}${money(w.net)}</span></div><div class="weekly-items">${w.items.length?w.items.map(i=>`<div class="weekly-item ${i.type}"><span class="weekly-date">${i.unscheduled?'No date':dateLabel(i.occurrence)}</span><strong>${esc(i.name)}</strong><span class="weekly-purpose">${esc(i.category||i.savingsFund||i.account||i.type)}</span><b>${i.type==='income'?'+':'-'}${money(i.amount)}</b></div>`).join(''):'<div class="weekly-empty">No scheduled money moves this week. Suspiciously peaceful.</div>'}</div><div class="weekly-totals"><div><span>Income</span><strong>${money(w.income)}</strong></div><div><span>Payments + saving</span><strong>${money(w.outflow)}</strong></div><div class="weekly-after ${w.after<0?'negative':''}"><span>Left after this week</span><strong>${money(w.after)}</strong></div></div></article>`;$('#weeklyOverview').innerHTML=weeks.map(card).join('');const bis=[[weeks[0],weeks[1]],[weeks[2],weeks[3]]];$('#biweeklyOverview').innerHTML=bis.map((pair,i)=>{const income=cents(pair[0].income+pair[1].income),out=cents(pair[0].outflow+pair[1].outflow),after=pair[1].after;return `<article class="biweekly-card"><div><p class="eyebrow">BIWEEK ${i+1}</p><h2>${dateLabel(pair[0].start)} - ${dateLabel(addDays(pair[1].end,-1))}</h2></div><div class="biweekly-metrics"><div><span>Income</span><strong>${money(income)}</strong></div><div><span>Payments + saving</span><strong>${money(out)}</strong></div><div class="weekly-after ${after<0?'negative':''}"><span>Left after biweekly</span><strong>${money(after)}</strong></div></div></article>`}).join('');const note=weeks.filter(w=>w.after<0);$('#weeklyPlanNote').innerHTML=note.length?`<strong>Heads up:</strong> this plan drops below zero after ${note.map(w=>`week ${w.index}`).join(' and ')}. The math is honest, even when it is a little rude.`:`<strong>Looking good:</strong> the running total includes every dated item, plus undated items once in week 1 so nothing quietly disappears.`;$('#weeklyOverview').hidden=ui.planView==='biweekly';$('.biweekly-section').hidden=ui.planView==='weekly';$$('[data-plan-view]').forEach(b=>b.classList.toggle('active',b.dataset.planView===ui.planView))}
function renderCoach(){const all=state.entries.filter(e=>e.type==='payment'&&e.amount>0);const min=ui.min===''?0:Math.max(0,Number(ui.min)||0),max=ui.max===''?Infinity:Math.max(min,Number(ui.max)||0),picked=all.filter(e=>e.amount>=min&&e.amount<=max),rows=picked.map(e=>({entry:e,weekly:weeklyReserve(e)})).sort((a,b)=>b.weekly-a.weekly),weekly=cents(rows.reduce((a,r)=>a+r.weekly,0)),biweekly=cents(weekly*2),start=planStart(),weeks=Array.from({length:4},(_,i)=>summary(addDays(start,i*7),addDays(start,(i+1)*7),{undated:i===0})),heavy=weeks.reduce((a,w)=>w.outflow>a.outflow?w:a,weeks[0]),avg=cents(weeks.reduce((a,w)=>a+w.outflow,0)/4),filtered=ui.min!==''||ui.max!=='';$('#coachHeadline').textContent=all.length?'Make the weeks behave.':'Add payments to get the useful stuff.';$('#coachSummary').textContent=all.length?'This screen reads the same saved bills as the weekly map. Filtering only changes what you are testing, not your budget data.':'Add payments with amounts to build weekly and biweekly pull-out amounts.';$('#coachWeekLabel').textContent=filtered?'Filtered weekly pull-out':'Weekly pull-out budget';$('#coachBiweekLabel').textContent=filtered?'Filtered biweekly pull-out':'Biweekly pull-out budget';$('#coachWeekTarget').textContent=money(weekly);$('#coachBiweekTarget').textContent=money(biweekly);$('#coachSpike').textContent=heavy.outflow?`${dateLabel(heavy.start)} - ${dateLabel(addDays(heavy.end,-1))}: ${money(heavy.outflow)}`:'No dated bills yet';$('#coachWithdrawalNote').innerHTML=rows.length?`<strong>Set-aside plan:</strong> move <strong>${money(weekly)}</strong> every week or <strong>${money(biweekly)}</strong> every two weeks for the selected bills. This does not change your stored payments.`:`<strong>No matches:</strong> widen the price filter or add a payment amount.`;$('#coachSpikeNote').innerHTML=heavy.outflow>avg*1.2?`<strong>Heavy-week alert:</strong> ${money(heavy.outflow)} is scheduled in the heaviest upcoming week, ${money(heavy.outflow-avg)} above average.`:`<strong>Schedule note:</strong> the reserve smooths bills across paychecks; the weekly map still shows actual due dates.`;const mode=ui.coachView;$('#splitSuggestions').innerHTML=rows.length?`<p class="filter-count">Showing ${rows.length} of ${all.length} payment(s).</p>`+rows.map(({entry,weekly:w})=>`<article class="split-card" data-mode="${mode}"><div class="split-card-title"><div><p class="eyebrow">${esc(entry.category||'PAYMENT')} · ${esc(entry.repeat?`EVERY ${entry.repeat.every} ${entry.repeat.unit}`:entry.date?`DUE ${dateLabel(parseDate(entry.date))}`:'NO DUE DATE')}</p><h3>${esc(entry.name)}</h3><p>Bill amount: <strong>${money(entry.amount)}</strong></p></div><span class="split-bill">${money(entry.amount)}</span></div><div class="split-options"><div class="weekly-option"><span>Pull out weekly</span><strong>${money(w)}</strong></div><div class="biweekly-option"><span>Pull out biweekly</span><strong>${money(cents(w*2))}</strong></div></div><p class="split-tip">${entry.repeat?'Converted from its actual recurrence into an even reserve.':entry.date?'Split evenly across the calendar weeks remaining until it is due.':'No date is attached, so this uses a monthly-equivalent reserve.'}</p></article>`).join(''):'<div class="empty-state">No payments match this price range.</div>';const weeklyCards=Array.from({length:4},(_,i)=>`<article class="pullout-card"><p class="eyebrow">WEEK ${i+1}</p><h3>${dateLabel(addDays(start,i*7))} - ${dateLabel(addDays(start,i*7+6))}</h3><strong>${money(weekly)}</strong><span>pull aside this week</span></article>`).join(''),biCards=Array.from({length:2},(_,i)=>`<article class="pullout-card"><p class="eyebrow">PAYDAY ${i+1}</p><h3>${dateLabel(addDays(start,i*14))} - ${dateLabel(addDays(start,i*14+13))}</h3><strong>${money(biweekly)}</strong><span>pull aside this payday</span></article>`).join('');$('#pulloutSchedule').innerHTML=`<div class="cash-plan-title"><p class="eyebrow">WHAT TO MOVE, WHEN</p><h2>${mode==='weekly'?'Weekly pull-out calendar':mode==='biweekly'?'Biweekly pull-out calendar':'Weekly and biweekly pull-out calendars'}</h2></div><div class="pullout-grid">${mode!=='biweekly'?`<div class="pullout-group"><h3>Weekly</h3><div class="pullout-cards">${weeklyCards}</div></div>`:''}${mode!=='weekly'?`<div class="pullout-group"><h3>Biweekly</h3><div class="pullout-cards">${biCards}</div></div>`:''}</div>`;$$('[data-coach-view]').forEach(b=>b.classList.toggle('active',b.dataset.coachView===mode))}
function renderInsights(){
  const now=startOfDay(new Date()),yearStart=new Date(now.getFullYear(),0,1,12),ytdEnd=monthEnd(now),s=summary(yearStart,ytdEnd);
  $('#ytdIncome').textContent=money(s.income);
  $('#ytdOutflow').textContent=money(s.payments);
  $('#ytdSaved').textContent=money(s.savings);
  $('#ytdNet').textContent=money(s.net);
  const palette=themePalette();
  const cats=sumBy(s.items.filter(i=>i.type==='payment'),i=>i.category||'Other'),pairs=Object.entries(cats).sort((a,b)=>b[1]-a[1]);
  drawDonut('categoryChart',pairs.map(x=>x[1]),palette);
  $('#categoryLegend').innerHTML=pairs.length?pairs.slice(0,7).map(([n,v],i)=>`<div class="legend-item"><span><i class="dot" style="background:${palette[i%palette.length]}"></i>${esc(n)}</span><strong>${money(v)}</strong></div>`).join(''):'<div class="empty-state">Add payments to see category insights.</div>';
  const months=Array.from({length:now.getMonth()+1},(_,i)=>new Date(now.getFullYear(),i,1,12));
  drawLine('cumulativeChart',months.map(monthShort),[
    {label:'Income',color:chartColor('--chart-income','#4f8374'),values:months.map(d=>summary(yearStart,monthEnd(d)).income)},
    {label:'Outflow',color:chartColor('--chart-outflow','#c8755f'),values:months.map(d=>summary(yearStart,monthEnd(d)).outflow)}
  ]);
  const monthStart=new Date(now.getFullYear(),now.getMonth(),1,12),thisMonth=planned(monthStart,monthEnd(monthStart)),lastDay=addDays(monthEnd(monthStart),-1).getDate();
  const daily=Array.from({length:lastDay},()=>0);
  thisMonth.filter(i=>i.type!=='income').forEach(i=>{const day=i.occurrence.getDate()-1;daily[day]=cents(daily[day]+i.amount)});
  drawBars('dailyChart',Array.from({length:lastDay},(_,i)=>String(i+1)),daily,chartColor('--chart-outflow','#c8755f'));
  const funds=Object.entries(sumBy(s.items.filter(i=>i.type==='savings'),i=>i.savingsFund||'Savings')).sort((a,b)=>b[1]-a[1]);
  drawBars('savingsChart',funds.map(([name])=>name),funds.map(([,value])=>value),chartColor('--chart-savings','#8ebbc2'));
}
function renderDebts(){const box=$('#debtCards');if(!state.debts.length){box.innerHTML='<article class="panel debt-card"><p class="eyebrow">START HERE</p><h2>Track your first payoff goal</h2><p class="setting-help">Add a balance, APR, and regular payment to see an estimate.</p></article>';$('#debtEstimate').textContent='Add a debt to begin';return}box.innerHTML=state.debts.map(d=>`<article class="panel debt-card"><p class="eyebrow">${esc(d.name)}</p><div class="debt-bal">${money(d.balance)}</div><div class="debt-meta"><span>APR <strong>${Number(d.apr||0).toFixed(2)}%</strong></span><span>Monthly <strong>${money((+d.minimum||0)+(+d.extra||0))}</strong></span></div></article>`).join('');$('#debtEstimate').textContent=`${state.debts.length} debt account(s)`}
function renderSettings(){
  state.settings.categories=Array.isArray(state.settings.categories)&&state.settings.categories.length?state.settings.categories:[...DEFAULTS.settings.categories];
  state.settings.savingsFunds=Array.isArray(state.settings.savingsFunds)&&state.settings.savingsFunds.length?state.settings.savingsFunds:[...DEFAULTS.settings.savingsFunds];
  $$('[data-cadence]',$('#cadenceOptions')).forEach(b=>b.classList.toggle('active',b.dataset.cadence===state.settings.cadence));
  $('#categorySettings').innerHTML=state.settings.categories.map(c=>`<span class="chip">${esc(c)}<button data-cat="${esc(c)}" type="button">×</button></span>`).join('');
  $('#savingsSettings').innerHTML=state.settings.savingsFunds.map(c=>`<span class="chip">${esc(c)}<button data-save="${esc(c)}" type="button">×</button></span>`).join('');
  $('#cushionInput').value=Number(state.settings.startingBalance)||0;
  $$('[data-cat]').forEach(b=>b.onclick=()=>{state.settings.categories=state.settings.categories.filter(x=>x!==b.dataset.cat);save();renderSettings()});
  $$('[data-save]').forEach(b=>b.onclick=()=>{state.settings.savingsFunds=state.settings.savingsFunds.filter(x=>x!==b.dataset.save);save();renderSettings()});
  renderThemeSettings();
}
function renderThemeSettings(){
  const premium=isPremium(),current=activeTheme(),help=$('#themeHelp');
  $$('#themeOptions button').forEach(button=>{
    const active=button.dataset.theme===current;
    button.classList.toggle('active',active);
    button.disabled=false;
    button.setAttribute('aria-pressed',String(active));
  });
  if(help)help.textContent=premium?'Premium members can switch the full app palette any time.':'Themes are a premium perk. Your budget can have outfits after it pays rent.';
}
function renderAll(){normalizeState();applyTheme();[renderTop,renderHome,renderCalendar,renderInsights,renderDebts,renderSettings,renderWeekly,renderCoach,renderCanBuy,renderPremiumState,renderAccount].forEach(fn=>safe(fn))}

function fillSelects(){ $('#entryCategory').innerHTML=state.settings.categories.map(x=>`<option>${esc(x)}</option>`).join('');$('#entrySavings').innerHTML=state.settings.savingsFunds.map(x=>`<option>${esc(x)}</option>`).join('')}
function syncEntry(){const type=$('input[name="entryType"]:checked').value;$$('.payment-only').forEach(x=>x.hidden=type!=='payment');$$('.savings-only').forEach(x=>x.hidden=type!=='savings');$('#repeatFields').hidden=!$('#repeatEnabled').checked}
function openEntry(type='payment'){const f=$('#entryForm');f.reset();$('#entryId').value='';$(`input[name="entryType"][value="${type}"]`).checked=true;fillSelects();syncEntry();$('#modalOverlay').hidden=false}
function saveEntry(ev){ev.preventDefault();if(!isPremium()&&state.entries.length>=25){openPremium('Unlimited budget items');return;}const type=$('input[name="entryType"]:checked').value;const row={id:$('#entryId').value||uid(),type,name:$('#entryName').value.trim(),amount:cents($('#entryAmount').value),date:$('#entryDate').value||null,category:type==='payment'?$('#entryCategory').value:null,savingsFund:type==='savings'?$('#entrySavings').value:null,account:$('#entryAccount').value.trim(),notes:'',repeat:$('#repeatEnabled').checked?{every:Math.max(1,Number($('#repeatEvery').value)||1),unit:$('#repeatUnit').value}:null};if(!row.name||row.amount<0)return toast('Please add a name and valid amount.');state.entries.push(row);save();$('#modalOverlay').hidden=true;renderAll();toast('Saved to your plan.')}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove('show'),2600)}
function go(page){if(['coach','insights','debts'].includes(page)&&!isPremium()){openPremium(page==='coach'?'Split Coach':page==='insights'?'Spending insights':'Debt planning');return;}document.body.dataset.activePage=page;$$('.page').forEach(p=>p.classList.toggle('active',p.id===page));$$('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));const renderers={home:renderHome,calendar:renderCalendar,weekly:renderWeekly,coach:renderCoach,insights:renderInsights,debts:renderDebts,canbuy:renderCanBuy,settings:renderSettings,premium:renderPremiumState};safe(renderers[page]||renderTop);window.scrollTo({top:0,behavior:'smooth'})}
function bind(){if(window.__tallyBound)return;window.__tallyBound=true;$$('[data-page]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.page)));$$('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));$('#openAdd').onclick=()=>openEntry();$('#mobileAdd').onclick=()=>openEntry();$('#quickAddIncome').onclick=()=>openEntry('income');$('#quickAddPayment').onclick=()=>openEntry('payment');$('#closeModal').onclick=$('#cancelModal').onclick=()=>$('#modalOverlay').hidden=true;$('#modalOverlay').addEventListener('click',e=>{if(e.target===$('#modalOverlay'))$('#modalOverlay').hidden=true});$('#entryForm').addEventListener('submit',saveEntry);$$('input[name="entryType"]').forEach(x=>x.addEventListener('change',syncEntry));$('#repeatEnabled').addEventListener('change',syncEntry);$('#prevPeriod').onclick=()=>{viewDate=state.settings.cadence==='monthly'?addMonths(viewDate,-1):addDays(viewDate,state.settings.cadence==='weekly'?-7:-14);renderAll()};$('#nextPeriod').onclick=()=>{viewDate=state.settings.cadence==='monthly'?addMonths(viewDate,1):addDays(viewDate,state.settings.cadence==='weekly'?7:14);renderAll()};$('#jumpToday').onclick=()=>{viewDate=startOfDay(new Date());calDate=new Date(viewDate.getFullYear(),viewDate.getMonth(),1,12);renderAll()};$('#calPrev').onclick=()=>{calDate=addMonths(calDate,-1);renderCalendar()};$('#calNext').onclick=()=>{calDate=addMonths(calDate,1);renderCalendar()};$$('#cadenceOptions button').forEach(b=>b.addEventListener('click',()=>{state.settings.cadence=b.dataset.cadence;save();renderAll()}));$('#categoryForm').addEventListener('submit',e=>{e.preventDefault();const v=$('#newCategory').value.trim();if(v&&!state.settings.categories.includes(v)){state.settings.categories.push(v);$('#newCategory').value='';save();renderSettings()}});$('#savingsForm').addEventListener('submit',e=>{e.preventDefault();const v=$('#newSavings').value.trim();if(v&&!state.settings.savingsFunds.includes(v)){state.settings.savingsFunds.push(v);$('#newSavings').value='';save();renderSettings()}});$('#cushionForm').addEventListener('submit',e=>{e.preventDefault();state.settings.startingBalance=cents($('#cushionInput').value);save();renderAll()});$('#coachMinPrice').addEventListener('input',e=>{ui.min=e.target.value;renderCoach()});$('#coachMaxPrice').addEventListener('input',e=>{ui.max=e.target.value;renderCoach()});$('#coachClearFilters').onclick=()=>{ui.min=ui.max='';$('#coachMinPrice').value='';$('#coachMaxPrice').value='';renderCoach()};$$('[data-coach-view]').forEach(b=>b.addEventListener('click',()=>{ui.coachView=b.dataset.coachView;renderCoach()}));$$('[data-plan-view]').forEach(b=>b.addEventListener('click',()=>{ui.planView=b.dataset.planView;renderWeekly()}));$('#exportData').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.download=`tallyho-backup-${dateISO(new Date())}.json`;a.click();URL.revokeObjectURL(a.href)};$('#importData').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{state=JSON.parse(r.result);normalizeState();save();renderAll();toast('Backup imported.')}catch{toast('That backup could not be read.')}};r.readAsText(f)});$('#resetData').onclick=()=>{if(confirm('Reset all budget data?')){state=structuredClone(DEFAULTS);save();renderAll()}};window.addEventListener('resize',()=>{clearTimeout(window.__resize);window.__resize=setTimeout(renderAll,150)});bindAppStoreFeatures()}
function canvas(id){const c=$('#'+id);if(!c)return null;const ctx=c.getContext('2d'),r=c.getBoundingClientRect(),d=devicePixelRatio||1,w=Math.max(1,r.width),h=Math.max(1,r.height);c.width=Math.round(w*d);c.height=Math.round(h*d);ctx.setTransform(d,0,0,d,0,0);return{ctx,w,h}}
function drawEmptyChart(ctx,w,h,msg='Add a few items and this will fill in.'){
  ctx.fillStyle=chartColor('--chart-empty-bg','#eef1e8');
  ctx.fillRect(34,18,Math.max(1,w-52),Math.max(1,h-50));
  ctx.fillStyle=chartColor('--chart-empty-text','#5f6f64');
  ctx.font='600 12px DM Sans, sans-serif';
  ctx.textAlign='center';
  ctx.fillText(msg,w/2,h/2);
}
function drawDonut(id,values,colors=themePalette()){
  const x=canvas(id);if(!x)return;
  const {ctx,w,h}=x,total=values.reduce((a,b)=>a+b,0),r=Math.min(w,h)*.32,palette=colors.length?colors:themePalette();
  ctx.clearRect(0,0,w,h);
  ctx.lineWidth=Math.max(12,Math.min(w,h)*.14);
  ctx.lineCap='butt';
  if(w<=1||h<=1)return;
  if(!total){
    ctx.strokeStyle=chartColor('--chart-grid','#d9ddd2');
    ctx.beginPath();
    ctx.arc(w/2,h/2,r,0,Math.PI*2);
    ctx.stroke();
    return;
  }
  let a=-Math.PI/2;
  values.forEach((v,i)=>{
    const ang=v/total*Math.PI*2;
    ctx.strokeStyle=palette[i]||palette[i%palette.length];
    ctx.beginPath();
    ctx.arc(w/2,h/2,r,a+.025,a+Math.max(a+.025,a+ang-.025));
    ctx.stroke();
    a+=ang;
  });
}
function drawBars(id,labels=[],values=[],color=chartColor('--chart-income','#4f8374')){
  const x=canvas(id);if(!x)return;
  const {ctx,w,h}=x;
  ctx.clearRect(0,0,w,h);
  if(w<=1||h<=1)return;
  const nums=values.map(v=>Math.max(0,Number(v)||0)),max=Math.max(0,...nums),pad={l:40,r:16,t:20,b:34};
  ctx.strokeStyle=chartColor('--chart-grid','#d7dacf');
  ctx.lineWidth=1;
  ctx.beginPath();
  ctx.moveTo(pad.l,pad.t);
  ctx.lineTo(pad.l,h-pad.b);
  ctx.lineTo(w-pad.r,h-pad.b);
  ctx.stroke();
  if(!nums.length||!max){drawEmptyChart(ctx,w,h);return}
  const areaW=Math.max(1,w-pad.l-pad.r),areaH=Math.max(1,h-pad.t-pad.b),gap=nums.length>18?2:8,rawBarW=(areaW-gap*(nums.length-1))/nums.length,barW=Math.max(3,Math.min(nums.length<=8?46:999,rawBarW)),totalW=barW*nums.length+gap*(nums.length-1),startX=pad.l+Math.max(0,(areaW-totalW)/2);
  ctx.fillStyle=color;
  nums.forEach((v,i)=>{const bh=v/max*areaH,x0=startX+i*(barW+gap),y0=h-pad.b-bh;ctx.fillRect(x0,y0,barW,bh)});
  ctx.fillStyle=chartColor('--chart-label','#51665a');
  ctx.font='500 10px DM Mono, monospace';
  ctx.textAlign='center';
  const every=Math.max(1,Math.ceil(labels.length/6));
  labels.forEach((label,i)=>{if(i%every===0||i===labels.length-1)ctx.fillText(String(label).slice(0,14),startX+i*(barW+gap)+barW/2,h-13)});
  ctx.textAlign='left';
  ctx.fillText(shortMoney(max),6,pad.t+4);
}
function drawLine(id,labels=[],series=[]){
  const x=canvas(id);if(!x)return;
  const {ctx,w,h}=x,palette=themePalette();
  ctx.clearRect(0,0,w,h);
  if(w<=1||h<=1)return;
  const sets=(series||[]).map((s,i)=>Array.isArray(s)?{label:i?'Outflow':'Income',values:s,color:palette[i%palette.length]}:{label:s.label||`Line ${i+1}`,values:s.values||[],color:s.color||palette[i%palette.length]});
  const all=sets.flatMap(s=>s.values).map(v=>Math.max(0,Number(v)||0)),max=Math.max(0,...all),pad={l:44,r:18,t:24,b:38};
  ctx.strokeStyle=chartColor('--chart-grid','#d7dacf');
  ctx.lineWidth=1;
  ctx.beginPath();
  ctx.moveTo(pad.l,pad.t);
  ctx.lineTo(pad.l,h-pad.b);
  ctx.lineTo(w-pad.r,h-pad.b);
  ctx.stroke();
  if(!sets.length||!max){drawEmptyChart(ctx,w,h);return}
  const areaW=Math.max(1,w-pad.l-pad.r),areaH=Math.max(1,h-pad.t-pad.b),count=Math.max(1,labels.length-1);
  sets.forEach(set=>{
    ctx.strokeStyle=set.color;
    ctx.lineWidth=3;
    ctx.lineJoin='round';
    ctx.lineCap='round';
    ctx.beginPath();
    set.values.forEach((v,i)=>{const px=pad.l+(i/count)*areaW,py=h-pad.b-(Math.max(0,Number(v)||0)/max)*areaH;if(i)ctx.lineTo(px,py);else ctx.moveTo(px,py)});
    ctx.stroke();
    ctx.fillStyle=set.color;
    set.values.forEach((v,i)=>{const px=pad.l+(i/count)*areaW,py=h-pad.b-(Math.max(0,Number(v)||0)/max)*areaH;ctx.beginPath();ctx.arc(px,py,3,0,Math.PI*2);ctx.fill()});
  });
  ctx.fillStyle=chartColor('--chart-label','#51665a');
  ctx.font='500 10px DM Mono, monospace';
  ctx.textAlign='center';
  const every=Math.max(1,Math.ceil(labels.length/6));
  labels.forEach((label,i)=>{if(i%every===0||i===labels.length-1)ctx.fillText(String(label),pad.l+(i/count)*areaW,h-13)});
  ctx.textAlign='left';
  ctx.fillText(shortMoney(max),6,pad.t+4);
  sets.forEach((set,i)=>{const x0=pad.l+i*92;ctx.fillStyle=set.color;ctx.fillRect(x0,pad.t-16,9,9);ctx.fillStyle=chartColor('--chart-label','#51665a');ctx.fillText(set.label,x0+13,pad.t-8)});
}
function bindThemeControls(){if(window.__themeBound)return;window.__themeBound=true;const box=$('#themeOptions');if(!box)return;box.addEventListener('click',e=>{const button=e.target.closest('[data-theme]');if(!button)return;if(!isPremium()){openPremium('Premium themes');return}state.settings.theme=button.dataset.theme;save();applyTheme();renderAll();toast(`${THEMES[state.settings.theme]} theme applied.`)})}
function init(){bind();bindOnboarding();bindThemeControls();initAuth();renderAll();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();

/* TallyHo v8 - simple large-bill split coach. */
function splitIsActive(entry){
  return !!(entry && entry.type==='payment' && Number(entry.amount)>500 && entry.splitPlan && entry.splitPlan.enabled && ['weekly','biweekly'].includes(entry.splitPlan.cadence));
}
function splitWeeklyReserve(entry, referenceDate){
  const amount=Math.max(0,Number(entry.amount)||0);
  const reference=startOfDay(referenceDate||viewDate);
  if(!entry.repeat){
    const due=parseDate(entry.date);
    if(!due || due<reference) return 0;
    return cents(amount / Math.max(1,Math.ceil((diffDays(reference,due)+1)/7)));
  }
  const n=Math.max(1,Number(entry.repeat.every)||1);
  const yearly=entry.repeat.unit==='weeks'?52/n:entry.repeat.unit==='years'?1/n:12/n;
  return cents(amount*yearly/52);
}
function splitReserveRows(start,end){
  const rows=[];
  const anchor=new Date(2020,0,5,12); // fixed Sunday: biweekly pulls stay on the same alternating weeks
  state.entries.filter(splitIsActive).forEach(entry=>{
    if(!entry.repeat){ const due=parseDate(entry.date); if(!due || due<start) return; }
    const cadence=entry.splitPlan.cadence;
    const stepDays=cadence==='biweekly'?14:7;
    const amount=cadence==='biweekly'?cents(splitWeeklyReserve(entry,start)*2):splitWeeklyReserve(entry,start);
    if(amount<=0) return;
    let cursor=anchor,guard=0;
    while(cursor<start && guard++<5000) cursor=addDays(cursor,stepDays);
    while(cursor<end && guard++<5000){
      rows.push({
        id:`split_${entry.id}_${dateISO(cursor)}`,
        type:'payment', amount, name:`Set aside: ${entry.name}`,
        category:'Split reserve', occurrence:cursor, occurrenceDate:dateISO(cursor),
        isReserve:true, sourceEntryId:entry.id
      });
      cursor=addDays(cursor,stepDays);
    }
  });
  return rows;
}
function splitCashSummary(start,end,opts={}){
  const actual=planned(start,end,opts).filter(item=>!(item.type==='payment' && splitIsActive(item)));
  const items=[...actual,...splitReserveRows(start,end)].sort((a,b)=>a.occurrence-b.occurrence||String(a.name).localeCompare(String(b.name)));
  const t=totals(items);
  return {items,...t,outflow:cents(t.payments+t.savings),net:cents(t.income-t.payments-t.savings)};
}
function applyLargeBillSplit(id,cadence){
  const entry=state.entries.find(item=>item.id===id);
  if(!entry) return;
  if(cadence==='remove') delete entry.splitPlan;
  else entry.splitPlan={enabled:true,cadence};
  save();
  renderWeekly();
  renderCoach();
  toast(cadence==='remove' ? `Removed ${entry.name} from the cash plan.` : `${entry.name} is now split ${cadence}.`);
}
function renderWeekly(){
  const start=planStart();
  const weeks=Array.from({length:4},(_,i)=>{
    const s=addDays(start,i*7),e=addDays(s,7);
    return {index:i+1,start:s,end:e,...splitCashSummary(s,e,{undated:i===0})};
  });
  let running=Number(state.settings.startingBalance)||0;
  weeks.forEach(w=>{running=cents(running+w.net);w.after=running});
  $('#weeklyRangeLabel').textContent=`${dateLabel(start)} - ${dateLabel(addDays(start,27))} · four-week cash plan`;
  $('#weeklyStartingBalance').textContent=money(state.settings.startingBalance);
  $('#weeklyIncomeTotal').textContent=money(weeks.reduce((sum,w)=>sum+w.income,0));
  $('#weeklyOutflowTotal').textContent=money(weeks.reduce((sum,w)=>sum+w.outflow,0));
  $('#weeklyAfterTotal').textContent=money(weeks[3].after);
  const card=w=>`<article class="weekly-card"><div class="weekly-card-head"><div><p class="eyebrow">WEEK ${w.index}</p><h2>${dateLabel(w.start)} - ${dateLabel(addDays(w.end,-1))}</h2></div><span class="weekly-net ${w.net<0?'negative':''}">${w.net>=0?'+':''}${money(w.net)}</span></div><div class="weekly-items">${w.items.length?w.items.map(i=>`<div class="weekly-item ${i.type}${i.isReserve?' reserve-item':''}"><span class="weekly-date">${i.unscheduled?'No date':dateLabel(i.occurrence)}</span><strong>${esc(i.name)}${i.isReserve?'<span class="reserve-badge">split</span>':''}</strong><span class="weekly-purpose">${esc(i.category||i.savingsFund||i.account||i.type)}</span><b>${i.type==='income'?'+':'-'}${money(i.amount)}</b></div>`).join(''):'<div class="weekly-empty">No scheduled money moves this week. Suspiciously peaceful.</div>'}</div><div class="weekly-totals"><div><span>Income</span><strong>${money(w.income)}</strong></div><div><span>Cash-plan outflow</span><strong>${money(w.outflow)}</strong></div><div class="weekly-after ${w.after<0?'negative':''}"><span>Left after this week</span><strong>${money(w.after)}</strong></div></div></article>`;
  $('#weeklyOverview').innerHTML=weeks.map(card).join('');
  const pairs=[[weeks[0],weeks[1]],[weeks[2],weeks[3]]];
  $('#biweeklyOverview').innerHTML=pairs.map((pair,i)=>{const income=cents(pair[0].income+pair[1].income),out=cents(pair[0].outflow+pair[1].outflow),after=pair[1].after;return `<article class="biweekly-card"><div><p class="eyebrow">BIWEEK ${i+1}</p><h2>${dateLabel(pair[0].start)} - ${dateLabel(addDays(pair[1].end,-1))}</h2></div><div class="biweekly-metrics"><div><span>Income</span><strong>${money(income)}</strong></div><div><span>Cash-plan outflow</span><strong>${money(out)}</strong></div><div class="weekly-after ${after<0?'negative':''}"><span>Left after biweekly</span><strong>${money(after)}</strong></div></div></article>`}).join('');
  const active=state.entries.filter(splitIsActive),negative=weeks.filter(w=>w.after<0);
  $('#weeklyPlanNote').innerHTML=negative.length?`<strong>Heads up:</strong> this cash plan drops below zero after ${negative.map(w=>`week ${w.index}`).join(' and ')}.`:active.length?`<strong>Cash-split plan active:</strong> ${active.map(e=>`${esc(e.name)} (${e.splitPlan.cadence})`).join(', ')} is shown as a reserve instead of one giant due-date hit. The calendar still shows the real due date.`:`<strong>Looking good:</strong> this map shows scheduled dates. Split Coach can smooth any payment over $500.`;
  $('#weeklyOverview').hidden=ui.planView==='biweekly';
  $('.biweekly-section').hidden=ui.planView==='weekly';
  $$('[data-plan-view]').forEach(b=>b.classList.toggle('active',b.dataset.planView===ui.planView));
}
function renderCoach(){
  const controls=$('.coach-controls');
  if(controls) controls.innerHTML=`<div class="coach-control-copy"><p class="eyebrow">KEEP IT SIMPLE</p><h2>Only payments over $500</h2><p>Pick weekly or biweekly for any big bill. When you apply it, TallyHo replaces that bill's large due-date hit in the weekly map with set-aside amounts. Your saved bill and calendar date do not change.</p></div><div class="simple-coach-status"><span id="coachLargeCount">Checking payments...</span><button class="outline-btn" type="button" data-go="weekly">View weekly plan ↗</button></div>`;
  const all=state.entries.filter(e=>e.type==='payment'&&Number(e.amount)>500).sort((a,b)=>Number(b.amount)-Number(a.amount));
  $('#coachHeadline').textContent=all.length?'Split the big stuff, keep your sanity.':'No payments over $500 yet.';
  $('#coachSummary').textContent=all.length?'Choose a rhythm for each large payment. This is the only thing Split Coach does now, on purpose.':'Add a payment above $500 and it will appear here.';
  $('#coachLargeCount').textContent=all.length?`${all.length} large payment${all.length===1?'':'s'} found`:'Nothing to split';
  const oldMetrics=$('.coach-metrics'), oldNotes=$('#coachWithdrawalNote'), oldSpike=$('#coachSpikeNote'), oldSchedule=$('#pulloutSchedule');
  if(oldMetrics) oldMetrics.hidden=true;
  if(oldNotes) oldNotes.hidden=true;
  if(oldSpike) oldSpike.hidden=true;
  if(oldSchedule) oldSchedule.hidden=true;
  $('#splitSuggestions').innerHTML=all.length?all.map(entry=>{
    const weekly=splitWeeklyReserve(entry,planStart()),biweekly=cents(weekly*2),active=splitIsActive(entry)?entry.splitPlan.cadence:null;
    const schedule=entry.repeat?`Repeats every ${entry.repeat.every} ${entry.repeat.unit}`:entry.date?`Due ${dateLabel(parseDate(entry.date))}`:'No due date';
    return `<article class="split-card ${active?'active-split':''}"><div class="split-card-title"><div><p class="eyebrow">${esc(entry.category||'PAYMENT')} · ${esc(schedule)}</p><h3>${esc(entry.name)}</h3><p>Full bill: <strong>${money(entry.amount)}</strong></p></div><span class="split-bill">${money(entry.amount)}</span></div><div class="split-options simple-split-options"><div><span>Weekly set-aside</span><strong>${money(weekly)}</strong><button class="split-apply ${active==='weekly'?'selected':''}" data-split-id="${esc(entry.id)}" data-split-cadence="weekly">${active==='weekly'?'Weekly plan active':'Use weekly plan'}</button></div><div><span>Biweekly set-aside</span><strong>${money(biweekly)}</strong><button class="split-apply ${active==='biweekly'?'selected':''}" data-split-id="${esc(entry.id)}" data-split-cadence="biweekly">${active==='biweekly'?'Biweekly plan active':'Use biweekly plan'}</button></div></div>${active?`<div class="split-active-row"><span>Currently smoothing this bill in your weekly map.</span><button class="split-remove" data-split-id="${esc(entry.id)}">Remove split</button></div>`:`<p class="split-tip">Choose one option to update the weekly cash plan.</p>`}</article>`;
  }).join(''):'<div class="empty-state">No payment over $500 exists yet. Add one when it is ready for its close-up.</div>';
  $$('.split-apply').forEach(button=>button.onclick=()=>applyLargeBillSplit(button.dataset.splitId,button.dataset.splitCadence));
  $$('.split-remove').forEach(button=>button.onclick=()=>applyLargeBillSplit(button.dataset.splitId,'remove'));
  $$('[data-go="weekly"]',controls||document).forEach(button=>button.onclick=()=>go('weekly'));
}

/* App Store foundation: local preview auth, premium gating, and Can I Buy It? */
function authUsers(){try{return JSON.parse(localStorage.getItem(AUTH_KEY)||'{}')}catch{return{}}}
function setAuthUsers(users){localStorage.setItem(AUTH_KEY,JSON.stringify(users))}
function sessionEmail(){return String(localStorage.getItem(SESSION_KEY)||'').toLowerCase()}
function userKey(email){return `${BASE_APP_KEY}:${String(email||'guest').toLowerCase().replace(/[^a-z0-9@._-]/g,'_')}`}
function currentUser(){return authUsers()[sessionEmail()]||null}
function isPremium(){return currentUser()?.plan==='premium'}
function deviceAuthPrefs(){try{return JSON.parse(localStorage.getItem(DEVICE_AUTH_KEY)||'{}')}catch{return{}}}
function setDeviceAuthPrefs(prefs){localStorage.setItem(DEVICE_AUTH_KEY,JSON.stringify(prefs||{}))}
function biometricPlugin(){return window.Capacitor?.Plugins?.TallyHoBiometric||window.TallyHoBiometric||null}
function deviceAuthLabel(kind='device unlock'){return kind==='faceID'?'Face ID':kind==='touchID'?'Touch ID':kind==='passcode'?'device passcode':kind==='device'?'device unlock':kind}
function deviceAuthAccount(email){const key=String(email||'').toLowerCase();return deviceAuthPrefs().accounts?.[key]||null}
function deviceAuthEnabledFor(email){return !!deviceAuthAccount(email)}
function deviceAuthLabelFor(email){const account=deviceAuthAccount(email);return deviceAuthLabel(typeof account==='object'?account.label:deviceAuthPrefs().label)}
function setDeviceAuthFor(email,enabled,label='device unlock'){
  const key=String(email||'').toLowerCase();
  if(!key)return;
  const prefs=deviceAuthPrefs();
  prefs.accounts={...(prefs.accounts||{})};
  if(enabled){
    const cleanLabel=deviceAuthLabel(label);
    prefs.accounts[key]={enabled:true,label:cleanLabel,updatedAt:new Date().toISOString()};
    prefs.lastEmail=key;
    prefs.label=cleanLabel;
  }else{
    delete prefs.accounts[key];
    if(prefs.lastEmail===key)prefs.lastEmail=Object.keys(prefs.accounts)[0]||'';
  }
  setDeviceAuthPrefs(prefs);
}
async function checkDeviceAuth(){
  const plugin=biometricPlugin();
  if(!plugin?.isAvailable)return{available:false,native:false,label:'device unlock',reason:'Device unlock is ready in the iOS app build. This browser preview cannot prompt Face ID or Touch ID.'};
  try{
    const result=await plugin.isAvailable();
    return{available:!!result.available,native:true,label:deviceAuthLabel(result.biometryType||result.label),reason:result.reason||''};
  }catch(err){
    return{available:false,native:true,label:'device unlock',reason:err?.message||'Device unlock is not available on this device.'};
  }
}
async function requestDeviceAuth(reason='Unlock TallyHo'){
  const plugin=biometricPlugin();
  if(!plugin?.authenticate)throw new Error('Device unlock is available in the iOS app build.');
  const result=await plugin.authenticate({reason});
  if(result?.success===false)throw new Error('Device unlock was canceled.');
  return result;
}
async function renderDeviceAuth(){
  const prefs=deviceAuthPrefs(),lastEmail=String(prefs.lastEmail||'').toLowerCase(),loginButton=$('#deviceAuthLogin');
  const loginReady=lastEmail&&deviceAuthEnabledFor(lastEmail)&&!!authUsers()[lastEmail];
  if(loginButton){
    loginButton.hidden=!loginReady;
    loginButton.textContent=loginReady?`Use ${deviceAuthLabelFor(lastEmail)||'device unlock'}`:'Use device unlock';
  }
  const status=$('#deviceAuthStatus'),enable=$('#enableDeviceAuth'),disable=$('#disableDeviceAuth');
  if(!status||!enable||!disable)return;
  const user=currentUser(),check=await checkDeviceAuth(),enabled=!!(user&&deviceAuthEnabledFor(user.email));
  enable.hidden=enabled;
  disable.hidden=!enabled;
  enable.disabled=!check.available;
  enable.textContent=`Enable ${check.label}`;
  if(enabled)status.innerHTML=`<strong>${deviceAuthLabelFor(user.email)||check.label}</strong> quick login is on for this account.`;
  else status.textContent=check.available?`${check.label} is available. Enable it after one normal login.`:(check.reason||'Device unlock is not available on this device.');
}
async function enableDeviceAuth(){
  const user=currentUser();
  if(!user)return;
  const check=await checkDeviceAuth();
  if(!check.available){toast(check.reason||'Device unlock is not available on this device.');return renderDeviceAuth()}
  try{
    await requestDeviceAuth(`Use ${check.label} to unlock TallyHo for ${user.email}.`);
    setDeviceAuthFor(user.email,true,check.label);
    renderDeviceAuth();
    toast(`${check.label} is on for this account.`);
  }catch(err){toast(err?.message||'Device unlock was not enabled.')}
}
function disableDeviceAuth(){
  const user=currentUser();
  if(!user)return;
  setDeviceAuthFor(user.email,false);
  renderDeviceAuth();
  toast('Device unlock is off for this account.');
}
async function loginWithDeviceAuth(){
  const prefs=deviceAuthPrefs(),email=String(prefs.lastEmail||'').toLowerCase(),users=authUsers();
  if(!email||!deviceAuthEnabledFor(email))return toast('Log in once with your password, then enable device unlock in Settings.');
  if(!users[email]){setDeviceAuthFor(email,false);renderDeviceAuth();return toast('That saved account is no longer on this device.')}
  const label=deviceAuthLabelFor(email)||'device unlock';
  try{
    await requestDeviceAuth(`Use ${label} to unlock TallyHo.`);
    activateSession(email);
  }catch(err){toast(err?.message||'Device unlock was canceled.')}
}
async function hashPassword(value){const data=new TextEncoder().encode(String(value));const digest=await crypto.subtle.digest('SHA-256',data);return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('')}
function buildDemoState(){const demo=structuredClone(DEFAULTS),today=startOfDay(new Date()),monthStart=new Date(today.getFullYear(),today.getMonth(),1,12);demo.settings={...demo.settings,cadence:'biweekly',theme:'classic'};demo.entries=[{id:uid(),type:'income',name:'Paycheck',amount:1450,date:dateISO(addDays(monthStart,4)),repeat:{every:2,unit:'weeks'},account:'Checking'},{id:uid(),type:'payment',name:'Rent',amount:1200,date:dateISO(addDays(monthStart,1)),repeat:{every:1,unit:'months'},category:'Housing'},{id:uid(),type:'payment',name:'Car payment',amount:540,date:dateISO(addDays(monthStart,12)),repeat:{every:1,unit:'months'},category:'Debt'},{id:uid(),type:'payment',name:'Groceries',amount:135,date:dateISO(addDays(today,2)),repeat:{every:1,unit:'weeks'},category:'Groceries'},{id:uid(),type:'payment',name:'Health insurance',amount:300,date:dateISO(addDays(monthStart,6)),repeat:{every:1,unit:'months'},category:'Health'},{id:uid(),type:'payment',name:'Pet supplies',amount:200,date:dateISO(addDays(monthStart,14)),repeat:{every:1,unit:'months'},category:'Pets'},{id:uid(),type:'savings',name:'Emergency fund',amount:100,date:dateISO(addDays(monthStart,6)),repeat:{every:2,unit:'weeks'},savingsFund:'Emergency fund'}];return demo}
async function ensureDemoAccount(){const users=authUsers(),passwordHash=await hashPassword(DEMO_PASSWORD);users[DEMO_EMAIL]={...(users[DEMO_EMAIL]||{}),name:'Demo Ranger',email:DEMO_EMAIL,passwordHash,plan:'premium',createdAt:users[DEMO_EMAIL]?.createdAt||new Date().toISOString(),onboardingComplete:true};setAuthUsers(users);const key=userKey(DEMO_EMAIL);if(!localStorage.getItem(key)){localStorage.setItem(key,JSON.stringify(buildDemoState()))}}
function activateSession(email){localStorage.setItem(SESSION_KEY,String(email).toLowerCase());APP_KEY=userKey(email);if(!localStorage.getItem(APP_KEY)&&!localStorage.getItem('tallyho-v3-migrated')){const old=localStorage.getItem('tallyho-budget-v2')||localStorage.getItem(LEGACY_APP_KEY);if(old){localStorage.setItem(APP_KEY,old);localStorage.setItem('tallyho-v3-migrated','1')}}state=loadState();normalizeState();save();showAuthenticated();renderAll();if(needsOnboarding())showOnboarding();else go('home')}
function showAuthenticated(){const logged=!!currentUser();const gate=$('#authGate'),shell=$('#appShell'),onboarding=$('#onboardingGate');if(gate)gate.hidden=logged;if(shell)shell.hidden=!logged;if(onboarding&&!logged)onboarding.hidden=true;document.body.classList.toggle('signed-in',logged);renderDeviceAuth()}
function renderAccount(){const user=currentUser();if(!user){renderDeviceAuth();return}const name=user.name||user.email.split('@')[0];$('#accountName').textContent=name;$('#accountInitial').textContent=name.slice(0,1).toUpperCase();$('#settingsUserName').textContent=name;$('#settingsUserEmail').textContent=`${user.email} · ${isPremium()?'Premium member':'Free plan'}`;$$('[data-premium-feature]').forEach(el=>el.classList.toggle('locked',!isPremium()));renderDeviceAuth()}
function needsOnboarding(){return currentUser()?.onboardingComplete===false}
function showOnboarding(){const gate=$('#onboardingGate');if(!gate)return;onboardingDraft={...DEFAULTS.settings,...state.settings,categories:[...(state.settings.categories||DEFAULTS.settings.categories)],savingsFunds:[...(state.settings.savingsFunds||DEFAULTS.settings.savingsFunds)]};renderOnboardingSettings();gate.hidden=false}
function renderOnboardingSettings(){if(!onboardingDraft)return;$$('[data-onboarding-cadence]').forEach(b=>b.classList.toggle('active',b.dataset.onboardingCadence===onboardingDraft.cadence));$('#onboardingCategorySettings').innerHTML=onboardingDraft.categories.map(c=>`<span class="chip">${esc(c)}<button data-onboarding-cat="${esc(c)}" type="button">×</button></span>`).join('');$('#onboardingSavingsSettings').innerHTML=onboardingDraft.savingsFunds.map(c=>`<span class="chip">${esc(c)}<button data-onboarding-save="${esc(c)}" type="button">×</button></span>`).join('');$('#onboardingCushion').value=Number(onboardingDraft.startingBalance)||''}
function addOnboardingChip(kind,value){if(!onboardingDraft)return;const key=kind==='cat'?'categories':'savingsFunds',clean=String(value||'').trim();if(clean&&!onboardingDraft[key].includes(clean))onboardingDraft[key].push(clean);renderOnboardingSettings()}
function finishOnboarding(useDefaults=false){const user=currentUser();if(!user)return;if(!useDefaults&&onboardingDraft){state.settings={...state.settings,...onboardingDraft,startingBalance:cents($('#onboardingCushion').value)}}save();const users=authUsers();users[user.email]={...users[user.email],onboardingComplete:true,updatedAt:new Date().toISOString()};setAuthUsers(users);$('#onboardingGate').hidden=true;onboardingDraft=null;renderAll();go('home');toast('Welcome in. Your setup is saved.')}
function bindOnboarding(){if(window.__onboardingBound)return;window.__onboardingBound=true;const form=$('#onboardingForm'),skip=$('#skipOnboarding');if(form)form.addEventListener('submit',e=>{e.preventDefault();finishOnboarding(false)});if(skip)skip.onclick=()=>finishOnboarding(true);$$('[data-onboarding-cadence]').forEach(b=>b.addEventListener('click',()=>{if(!onboardingDraft)return;onboardingDraft.cadence=b.dataset.onboardingCadence;renderOnboardingSettings()}));$('#onboardingAddCategory').onclick=()=>{addOnboardingChip('cat',$('#onboardingNewCategory').value);$('#onboardingNewCategory').value=''};$('#onboardingAddSavings').onclick=()=>{addOnboardingChip('save',$('#onboardingNewSavings').value);$('#onboardingNewSavings').value=''};$('#onboardingCategorySettings').addEventListener('click',e=>{const btn=e.target.closest('[data-onboarding-cat]');if(!btn||!onboardingDraft)return;onboardingDraft.categories=onboardingDraft.categories.filter(x=>x!==btn.dataset.onboardingCat);renderOnboardingSettings()});$('#onboardingSavingsSettings').addEventListener('click',e=>{const btn=e.target.closest('[data-onboarding-save]');if(!btn||!onboardingDraft)return;onboardingDraft.savingsFunds=onboardingDraft.savingsFunds.filter(x=>x!==btn.dataset.onboardingSave);renderOnboardingSettings()})}
function openResetPassword(){
  const modal=$('#resetPasswordModal');
  if(!modal)return;
  $('#resetEmail').value=$('#loginEmail')?.value.trim()||'';
  $('#resetPassword').value='';
  $('#resetConfirm').value='';
  modal.hidden=false;
  setTimeout(()=>$('#resetEmail')?.focus(),40);
}
function closeResetPassword(){const modal=$('#resetPasswordModal');if(modal)modal.hidden=true}
async function handleResetPassword(ev){
  ev.preventDefault();
  const email=$('#resetEmail').value.trim().toLowerCase(),password=$('#resetPassword').value,confirm=$('#resetConfirm').value;
  if(password.length<6)return toast('Use at least 6 characters.');
  if(password!==confirm)return toast('Those passwords do not match.');
  if(email===DEMO_EMAIL){
    await ensureDemoAccount();
    closeResetPassword();
    $('#loginEmail').value=DEMO_EMAIL;
    $('#loginPassword').value='';
    return toast('The demo password stays FronzAndLillian!.');
  }
  const users=authUsers(),user=users[email];
  if(!user)return toast('No local account was found for that email.');
  users[email]={...user,passwordHash:await hashPassword(password),updatedAt:new Date().toISOString()};
  setAuthUsers(users);
  closeResetPassword();
  $('#loginEmail').value=email;
  $('#loginPassword').value='';
  toast('Password reset. You can log in now.');
}
function initAuth(){
  showAuthenticated();
  ensureDemoAccount().catch(()=>{});
  $$('[data-auth-tab]').forEach(button=>button.onclick=()=>{$$('[data-auth-tab]').forEach(b=>b.classList.toggle('active',b===button));$('#loginForm').hidden=button.dataset.authTab!=='login';$('#signupForm').hidden=button.dataset.authTab!=='signup'});
  $('#forgotPassword').onclick=openResetPassword;
  $('#deviceAuthLogin').onclick=loginWithDeviceAuth;
  $('#closeResetPassword').onclick=closeResetPassword;
  $('#resetPasswordModal').onclick=e=>{if(e.target===$('#resetPasswordModal'))closeResetPassword()};
  $('#resetPasswordForm').addEventListener('submit',handleResetPassword);
  $('#loginForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const email=$('#loginEmail').value.trim().toLowerCase(),password=$('#loginPassword').value,typedHash=await hashPassword(password);
    if(email===DEMO_EMAIL)await ensureDemoAccount();
    const users=authUsers(),user=users[email];
    if(!user||user.passwordHash!==typedHash)return toast('That email or password does not match.');
    activateSession(email);
  });
  $('#signupForm').addEventListener('submit',async e=>{e.preventDefault();const email=$('#signupEmail').value.trim().toLowerCase(),users=authUsers();if(users[email])return toast('An account already exists for that email.');users[email]={name:$('#signupName').value.trim(),email,passwordHash:await hashPassword($('#signupPassword').value),plan:'free',createdAt:new Date().toISOString(),onboardingComplete:false};setAuthUsers(users);activateSession(email)});
  renderDeviceAuth();
  if(currentUser())activateSession(sessionEmail());
}
function logout(){save();localStorage.removeItem(SESSION_KEY);APP_KEY=BASE_APP_KEY;state=structuredClone(DEFAULTS);applyTheme();showAuthenticated();$('#loginPassword').value='';window.scrollTo(0,0)}
function deleteCurrentAccount(){const user=currentUser();if(!user)return;if(!confirm('Delete this TallyHo account and all budget data on this device? This cannot be undone.'))return;const users=authUsers();delete users[user.email];setAuthUsers(users);localStorage.removeItem(userKey(user.email));logout();toast('Account deleted.')}
function openPremium(feature='Premium tools'){$('#premiumModal').hidden=false;$('#premiumModal .modal-heading p').textContent=`UNLOCK ${String(feature).toUpperCase()}`}
function closePremium(){$('#premiumModal').hidden=true}
function renderPremiumState(){const premium=isPremium();const labels=[['#premiumUpgrade','Unlock premium'],['#heroUpgrade','Start premium']];labels.forEach(([sel,label])=>{const b=$(sel);if(b){b.textContent=premium?'Premium is active':label;b.disabled=premium}});const freeButton=$('.plan-card:not(.featured) .outline-btn');if(freeButton)freeButton.textContent=premium?'Free plan available':'Current free plan';$('#buyChecksBadge').textContent=premium?'Unlimited premium checks':`${Math.max(0,3-freeChecksUsed())} free checks left this week`}
async function completePremiumPurchase(){const user=currentUser();if(!user)return;try{if(window.TallyHoStore?.purchase){const result=await window.TallyHoStore.purchase(selectedPurchasePlan);if(!result?.active)throw new Error('Purchase was not completed.')}const users=authUsers();users[user.email]={...users[user.email],plan:'premium',subscription:selectedPurchasePlan,updatedAt:new Date().toISOString()};setAuthUsers(users);closePremium();renderAll();toast('Premium unlocked. Let us boss the budget around.')}catch(err){toast(err?.message||'Purchase could not be completed.') }}
function restorePremium(){if(window.TallyHoStore?.restore){Promise.resolve(window.TallyHoStore.restore()).then(result=>{if(result?.active)return completePremiumPurchase();toast('No active purchase was found.')}).catch(()=>toast('Restore could not be completed.'));return}toast(isPremium()?'Premium is already active.':'No App Store purchase is available in this web preview.')}
function weekKey(d=new Date()){const s=sunday(d);return dateISO(s)}
function freeChecksUsed(){return state.buyHistory.filter(x=>x.weekKey===weekKey()).length}
function purchasePeriod(cadence){const today=startOfDay(new Date()),week=sunday(today);if(cadence==='biweekly'){const anchor=new Date(2020,0,5,12),blocks=Math.floor(diffDays(anchor,week)/14),start=addDays(anchor,blocks*14);return{start,end:addDays(start,14),label:`${dateLabel(start)} - ${dateLabel(addDays(start,13))}`}}return{start:week,end:addDays(week,7),label:`${dateLabel(week)} - ${dateLabel(addDays(week,6))}`}}
function evaluatePurchase(name,amount,cadence,priority){const p=purchasePeriod(cadence),s=splitCashSummary(p.start,p.end),income=s.income,outflow=s.outflow,base=cents((Number(state.settings.startingBalance)||0)+income-outflow),guardRate=Math.max(0,Math.min(50,Number(state.settings.purchaseGuardPercent)||15))/100,guard=cents(Math.max(income,base,0)*guardRate),safe=cents(Math.max(0,base-guard)),after=cents(base-amount);let verdict=amount<=safe?'yes':amount<=base?'tight':'no';if(priority==='need'&&verdict==='tight')verdict='yes';const title=verdict==='yes'?'Yes, this fits the plan.':verdict==='tight'?'Technically yes. Future you is raising an eyebrow.':'Not this pay period.';const copy=verdict==='yes'?`You can cover ${money(amount)} and still keep ${money(Math.max(0,after))} after planned money moves.`:verdict==='tight'?`It fits before the safety buffer, but leaves only ${money(Math.max(0,after))}. Waiting would be the calmer choice.`:`You are short ${money(Math.abs(after))} after planned income, bills, savings, and reserves.`;return{id:uid('buy'),name,amount:cents(amount),cadence,priority,verdict,title,copy,available:base,safe,after,period:p.label,checkedAt:new Date().toISOString(),weekKey:weekKey()}}
function renderBuyVerdict(item){const box=$('#buyVerdict');if(!item){box.className='panel buy-verdict empty-verdict';box.innerHTML='<div class="verdict-icon">?</div><p class="eyebrow">TALLYHO VERDICT</p><h2>Give me a price. I’ll give you the truth.</h2><p>Your verdict includes the money already spoken for, your safety buffer, and what the purchase leaves behind.</p>';return}const icon=item.verdict==='yes'?'✓':item.verdict==='tight'?'!':'×';box.className=`panel buy-verdict ${item.verdict}`;box.innerHTML=`<div class="verdict-icon">${icon}</div><p class="eyebrow">${esc(item.name)} · ${esc(item.period)}</p><h2>${esc(item.title)}</h2><p>${esc(item.copy)}</p><div class="verdict-math"><div><span>Available before purchase</span><strong>${money(item.available)}</strong></div><div><span>Protected safety amount</span><strong>${money(Math.max(0,item.available-item.safe))}</strong></div><div><span>Left after purchase</span><strong>${money(item.after)}</strong></div></div>`}
function renderCanBuy(){const list=state.buyHistory.slice().sort((a,b)=>String(b.checkedAt).localeCompare(String(a.checkedAt))).slice(0,12);$('#buyHistory').innerHTML=list.length?list.map(x=>`<div class="buy-history-row"><div><strong>${esc(x.name)}</strong><small>${new Date(x.checkedAt).toLocaleDateString()} · ${esc(x.cadence)} check</small></div><b>${money(x.amount)}</b><span class="verdict-tag ${x.verdict}">${x.verdict==='yes'?'Buy it':x.verdict==='tight'?'Tight':'Wait'}</span></div>`).join(''):'<div class="empty-state">No purchase checks yet. Your cart is behaving, for now.</div>';renderPremiumState()}
function bindAppStoreFeatures(){
  if(window.__appStoreBound)return;
  window.__appStoreBound=true;
  $('#logoutButton').onclick=logout;
  $('#deleteAccount').onclick=deleteCurrentAccount;
  $('#managePlan').onclick=()=>go('premium');
  $('#enableDeviceAuth').onclick=enableDeviceAuth;
  $('#disableDeviceAuth').onclick=disableDeviceAuth;
  $('#heroUpgrade').onclick=$('#premiumUpgrade').onclick=()=>openPremium('TallyHo Premium');
  $('#restorePurchases').onclick=restorePremium;
  $('#closePremiumModal').onclick=closePremium;
  $('#premiumModal').onclick=e=>{if(e.target===$('#premiumModal'))closePremium()};
  $$('[data-purchase-plan]').forEach(b=>b.onclick=()=>{
    selectedPurchasePlan=b.dataset.purchasePlan;
    $$('[data-purchase-plan]').forEach(x=>x.classList.toggle('selected',x===b));
    $('#premiumContinue').textContent=`Continue with ${selectedPurchasePlan}`;
  });
  $('#premiumContinue').onclick=completePremiumPurchase;
  $('#buyCheckForm').addEventListener('submit',e=>{
    e.preventDefault();
    if(!isPremium()&&freeChecksUsed()>=3){openPremium('Unlimited purchase checks');return}
    const item=evaluatePurchase($('#buyName').value.trim(),Number($('#buyAmount').value),$('#buyCadence').value,$('#buyPriority').value);
    state.buyHistory.unshift(item);
    save();
    renderBuyVerdict(item);
    renderCanBuy();
    toast('Purchase checked. TallyHo has opinions.');
  });
  $('#clearBuyHistory').onclick=()=>{
    if(confirm('Clear purchase-check history?')){
      state.buyHistory=[];
      save();
      renderCanBuy();
      renderBuyVerdict(null);
    }
  };
}
