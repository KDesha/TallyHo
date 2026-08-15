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
const STORE_PRODUCT_IDS={monthly:'com.kayladeshasier.tallyho.premium.month',yearly:'com.kayladeshasier.tallyho.premium.annually',lifetime:'com.kayladeshasier.tallyho.premium.lifetime'};
const REVIEW_DEMO_EMAIL='demo@tallyho.app';
const REVIEW_DEMO_PASSWORD_HASH='ae3f827fb68b876cec2a35da9e275b8af205d9c8b813aac9da3f07c69e32db0d';
let state=loadState();
let selectedPurchasePlan='monthly';
let storeProducts={};
let storeProductsPromise=null;
let entitlementRefreshPromise=null;
let viewDate=startOfDay(new Date());
let calDate=new Date(viewDate.getFullYear(),viewDate.getMonth(),1,12);
let selectedDate=null;
let onboardingDraft=null;
const ui={coachView:'both',planView:state.settings.cadence==='monthly'?'both':state.settings.cadence,min:'',max:'',moneyMapDate:new Date(viewDate.getFullYear(),viewDate.getMonth(),1,12)};

function $(q,r=document){return r.querySelector(q)}
function $$(q,r=document){return [...r.querySelectorAll(q)]}
function startOfDay(d){const x=new Date(d);x.setHours(12,0,0,0);return x}
function addDays(d,n){const x=startOfDay(d);x.setDate(x.getDate()+n);return x}
function addMonths(d,n){const x=startOfDay(d),day=x.getDate();x.setDate(1);x.setMonth(x.getMonth()+n);x.setDate(Math.min(day,new Date(x.getFullYear(),x.getMonth()+1,0).getDate()));return x}
function addYears(d,n){const x=startOfDay(d),month=x.getMonth(),day=x.getDate();x.setDate(1);x.setFullYear(x.getFullYear()+n);x.setMonth(month);x.setDate(Math.min(day,new Date(x.getFullYear(),month+1,0).getDate()));return x}
function dateISO(d){const x=startOfDay(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`}
function parseDate(v){if(!v)return null;if(v instanceof Date)return Number.isNaN(v)?null:startOfDay(v);const s=String(v).trim();let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);if(m)return new Date(+m[1],+m[2]-1,+m[3],12);m=s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);if(m){const y=+m[3]<100?2000+(+m[3]):+m[3];return new Date(y,+m[1]-1,+m[2],12)}const d=new Date(s);return Number.isNaN(d)?null:startOfDay(d)}
function diffDays(a,b){return Math.round((startOfDay(b)-startOfDay(a))/86400000)}
function appLocales(){const raw=navigator.languages?.length?navigator.languages:[navigator.language||'en-US'];return raw.filter(Boolean)}
function primaryLocale(){return appLocales()[0]||'en-US'}
function formatDate(d,options){return new Intl.DateTimeFormat(appLocales(),options).format(d)}
function numberFormat(options){return new Intl.NumberFormat(appLocales(),options)}
function money(v){return numberFormat({style:'currency',currency:'USD'}).format(Number(v)||0)}
function shortMoney(v){const n=Number(v)||0;return Math.abs(n)>=1000?numberFormat({style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1}).format(n):money(n)}
function dateLabel(d){return formatDate(d,{month:'short',day:'numeric'})}
function monthLabel(d){return formatDate(d,{month:'long',year:'numeric'})}
function setDocumentLocale(){const locale=primaryLocale();document.documentElement.lang=locale;try{document.documentElement.dir=new Intl.Locale(locale).textInfo?.direction||'ltr'}catch{document.documentElement.dir='ltr'}}
function calendarItemLabel(item){const raw=String(item?.name||item?.category||item?.type||'Item').trim(),word=(raw.split(/\s+/)[0]||'Item');return word.length>6?`${word.slice(0,5)}.`:word}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function cents(v){return Math.round((Number(v)||0)*100)/100}
function uid(p='entry'){return `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`}
function normalizedType(v){v=String(v||'payment').toLowerCase().trim();if(['income','paycheck','deposit','earnings','inflow'].includes(v))return'income';if(['savings','save','transfer to savings'].includes(v))return'savings';return'payment'}
function sortByName(a,b){return String(a||'').localeCompare(String(b||''),appLocales(),{sensitivity:'base'})}
function safe(fn){try{return fn()}catch(err){console.error('TallyHo:',err);return undefined}}

function loadState(){try{const raw=localStorage.getItem(APP_KEY)||(APP_KEY===BASE_APP_KEY?localStorage.getItem('tallyho-budget-v2')||localStorage.getItem(LEGACY_APP_KEY):null);const saved=raw?JSON.parse(raw):{};const data={...DEFAULTS,...saved,settings:{...DEFAULTS.settings,...(saved.settings||{})},entries:Array.isArray(saved.entries)?saved.entries:[],debts:Array.isArray(saved.debts)?saved.debts:[]};normalizeState(data);return data}catch{return structuredClone(DEFAULTS)}}
function normalizeState(target=state){if(!target.settings)target.settings={...DEFAULTS.settings};target.settings={...DEFAULTS.settings,...target.settings};if(!Array.isArray(target.entries))target.entries=[];if(!Array.isArray(target.buyHistory))target.buyHistory=[];target.entries=target.entries.filter(Boolean).map(raw=>{const e={...raw};e.id=e.id||uid();e.name=String(e.name||e.title||e.label||'Unnamed item').trim();e.type=normalizedType(e.type||e.kind||e.entryType||e.transactionType);e.amount=cents(e.amount??e.value??e.price??e.total??0);const rawDate=e.date||e.dueDate||e.startDate||e.nextDate||e.paymentDate||null;e.date=parseDate(rawDate)?dateISO(parseDate(rawDate)):null;let r=e.repeat;if(!r&&(e.frequency||e.interval||e.repeatEvery))r={every:e.repeatEvery||e.interval||1,unit:e.frequency||e.repeatUnit||'months'};if(r===true)r={every:1,unit:'months'};if(!r||typeof r!=='object')e.repeat=null;else{let every=Math.max(1,Number(r.every||r.interval||1)||1);let unit=String(r.unit||r.frequency||'months').toLowerCase();if(['week','weekly'].includes(unit))unit='weeks';if(['biweekly','bi-weekly','fortnightly'].includes(unit)){unit='weeks';every*=2}if(['month','monthly'].includes(unit))unit='months';if(['year','yearly','annual','annually'].includes(unit))unit='years';e.repeat=['weeks','months','years'].includes(unit)?{every,unit}:null}return e})}
function save(){normalizeState();localStorage.setItem(APP_KEY,JSON.stringify(state))}
function totals(items){return(items||[]).reduce((a,x)=>{const amt=cents(x.amount);if(x.type==='income')a.income=cents(a.income+amt);else if(x.type==='savings')a.savings=cents(a.savings+amt);else a.payments=cents(a.payments+amt);return a},{income:0,payments:0,savings:0})}
function recurrenceDate(first,repeat,index){const distance=Math.max(1,Number(repeat.every)||1)*index;return repeat.unit==='weeks'?addDays(first,distance*7):repeat.unit==='years'?addYears(first,distance):addMonths(first,distance)}
function effectiveBusinessDate(entry,scheduledDate){
  const date=startOfDay(scheduledDate),day=date.getDay();
  if(entry.type==='income')return day===6?addDays(date,-1):day===0?addDays(date,-2):date;
  if(entry.type==='payment')return day===6?addDays(date,2):day===0?addDays(date,1):date;
  return date;
}
function occurrenceRow(entry,scheduledDate){
  const occurrence=effectiveBusinessDate(entry,scheduledDate),scheduledOccurrence=startOfDay(scheduledDate),scheduledOccurrenceDate=dateISO(scheduledOccurrence),occurrenceDate=dateISO(occurrence);
  return{...entry,occurrence,occurrenceDate,scheduledOccurrence,scheduledOccurrenceDate,businessDayShifted:occurrenceDate!==scheduledOccurrenceDate};
}
function occurrences(entry,start,end){
  if(!entry.date)return[];
  const rangeStart=startOfDay(start),rangeEnd=startOfDay(end),first=parseDate(entry.date);
  if(!first||rangeEnd<=rangeStart)return[];
  const include=row=>row.occurrence>=rangeStart&&row.occurrence<rangeEnd;
  if(!entry.repeat){const row=occurrenceRow(entry,first);return include(row)?[row]:[]}
  const scanStart=addDays(rangeStart,-2),scanEnd=addDays(rangeEnd,2),out=[];
  for(let index=0;index<10000;index++){
    const scheduled=recurrenceDate(first,entry.repeat,index);
    if(scheduled>=scanEnd)break;
    if(scheduled>=scanStart){const row=occurrenceRow(entry,scheduled);if(include(row))out.push(row)}
  }
  return out;
}
function planned(start,end,{undated=false}={}){const dated=state.entries.flatMap(e=>occurrences(e,start,end));const extra=undated?state.entries.filter(e=>!e.date).map(e=>({...e,occurrence:start,occurrenceDate:dateISO(start),unscheduled:true})):[];return [...dated,...extra].sort((a,b)=>a.occurrence-b.occurrence||sortByName(a.name,b.name))}
function summary(start,end,opts){const items=planned(start,end,opts),t=totals(items);return{items,...t,outflow:cents(t.payments+t.savings),net:cents(t.income-t.payments-t.savings)}}
function balanceAnchorBefore(reference){
  const end=startOfDay(reference),dates=state.entries.map(entry=>{const first=parseDate(entry.date);return first?effectiveBusinessDate(entry,first):null}).filter(date=>date&&date<end);
  return dates.length?new Date(Math.min(...dates.map(Number))):end;
}
function cashBalanceBefore(reference){
  const end=startOfDay(reference),anchor=balanceAnchorBefore(end),opening=Number(state.settings.startingBalance)||0;
  return cents(opening+(anchor<end?summary(anchor,end).net:0));
}
function monthEnd(d){return new Date(d.getFullYear(),d.getMonth()+1,1,12)}
function monthShort(d){return formatDate(d,{month:'short'})}
function sumBy(items,keyFn,valueFn=x=>Number(x.amount)||0){return items.reduce((out,item)=>{const key=keyFn(item)||'Other';out[key]=cents((out[key]||0)+valueFn(item));return out},{})}
function activeTheme(){const key=state.settings?.theme||'classic';return isPremium()&&THEMES[key]?key:'classic'}
function applyTheme(){document.body.dataset.theme=activeTheme()}
function cssVar(name,fallback=''){return getComputedStyle(document.body).getPropertyValue(name).trim()||fallback}
function chartColor(name,fallback){return cssVar(name,fallback)}
function themePalette(){return ['--chart-a','--chart-b','--chart-c','--chart-d','--chart-e','--chart-f','--chart-g','--chart-h'].map((name,i)=>chartColor(name,PALETTE[i%PALETTE.length]))}
function sunday(d){return addDays(d,-startOfDay(d).getDay())}

function homePeriodFor(reference,cadence='weekly'){
  const today=startOfDay(reference),mode=['weekly','biweekly','monthly'].includes(cadence)?cadence:'weekly';
  if(mode==='monthly'){
    const start=new Date(today.getFullYear(),today.getMonth(),1,12),end=monthEnd(start);
    return{cadence:mode,start,end,label:monthLabel(start),kind:'Current month',phrase:'this month',eyebrow:'THIS MONTH'};
  }
  const start=sunday(today),days=mode==='biweekly'?14:7,end=addDays(start,days);
  return{cadence:mode,start,end,label:`${dateLabel(start)} - ${dateLabel(addDays(end,-1))}`,kind:mode==='biweekly'?'Current 2 weeks':'Current week',phrase:mode==='biweekly'?'these 2 weeks':'this week',eyebrow:mode==='biweekly'?'THESE 2 WEEKS':'THIS WEEK'};
}
function currentHomePeriod(){return homePeriodFor(new Date(),state.settings.cadence)}
function currentWeekPeriod(){return homePeriodFor(new Date(),'weekly')}
function renderTop(){const p=currentHomePeriod();$('#periodKindLabel').textContent=p.kind;$('#periodLabel').textContent=p.label}
function renderHome(){
  const p=currentHomePeriod(),s=summary(p.start,p.end,{undated:true}),carried=cashBalanceBefore(p.start),balance=cents(carried+s.net);
  $('#kpiSavingsTitle').textContent=`Saved ${p.phrase}`;
  $('#cashFlowHeading').textContent=`Where ${p.phrase} is going`;
  $('#allocationEyebrow').textContent=p.eyebrow;
  $('#kpiIncome').textContent=money(s.income);
  $('#kpiOutflow').textContent=money(s.outflow);
  $('#kpiBalance').textContent=money(balance);
  $('#kpiSavings').textContent=money(s.savings);
  $('#incomeSub').textContent=s.income?`${s.items.filter(i=>i.type==='income').length} scheduled item(s)`:'add income to begin';
  $('#outflowSub').textContent=s.payments?`${s.items.filter(i=>i.type==='payment').length} payment(s) + savings`:'nothing scheduled yet';
  $('#balanceSub').textContent=carried?`${money(carried)} carried in from before ${p.phrase}`:balance>=0?'money not already spoken for':'more planned than income';
  $('#savingsSub').textContent=s.savings?`${state.settings.savingsFunds.length} fund(s) available`:'create a fund in settings';
  const cats={};
  s.items.filter(i=>i.type==='payment').forEach(i=>cats[i.category||'Other']=(cats[i.category||'Other']||0)+i.amount);
  const pairs=Object.entries(cats).sort((a,b)=>b[1]-a[1]),max=Math.max(1,...pairs.map(x=>x[1]));
  $('#cashFlowList').innerHTML=pairs.length?pairs.map(([n,v])=>`<div class="flow-row"><span class="flow-label">${esc(n)}</span><div class="flow-bar"><i style="width:${Math.max(4,v/max*100)}%"></i></div><span class="flow-value">${money(v)}</span></div>`).join(''):'<div class="empty-state">Add a payment to see where your money is planned to go.</div>';
  const upcoming=planned(startOfDay(new Date()),addDays(new Date(),90)).filter(i=>i.type!=='income').slice(0,6);
  $('#upcomingList').innerHTML=upcoming.length?upcoming.map(i=>`<div class="upcoming-item"><div class="date-badge"><b>${i.occurrence.getDate()}</b><small>${monthShort(i.occurrence)}</small></div><div class="upcoming-details"><strong>${esc(i.name)}</strong><span>${esc(i.category||i.savingsFund||i.account||'Scheduled item')}${i.businessDayShifted?` · moved from ${dateLabel(i.scheduledOccurrence)}`:''}</span></div><span class="upcoming-amount">${money(i.amount)}</span></div>`).join(''):'<div class="empty-state">Your next scheduled payments will appear here.</div>';
  const shortfall=Math.max(0,-balance),allocationColors=[chartColor('--chart-outflow','#c8755f'),chartColor('--chart-savings','#8ebbc2'),chartColor('--chart-income','#4f8374'),chartColor('--chart-alert','#a95747')];
  drawDonut('allocationChart',[s.payments,s.savings,Math.max(0,balance),shortfall],allocationColors);
  $('#allocationLegend').innerHTML=[['Payments',s.payments,allocationColors[0]],['Savings',s.savings,allocationColors[1]],['Breathing room',Math.max(0,balance),allocationColors[2]],...(shortfall?[['Shortfall',shortfall,allocationColors[3]]]:[])].map(x=>`<div class="legend-item"><span><i class="dot" style="background:${x[2]}"></i>${x[0]}</span><strong>${money(x[1])}</strong></div>`).join('');
}
function renderCalendar(){const y=calDate.getFullYear(),m=calDate.getMonth(),first=new Date(y,m,1,12),grid=sunday(first),end=addDays(grid,42),items=planned(grid,end),by={};items.forEach(i=>(by[i.occurrenceDate]??=[]).push(i));$('#calMonthLabel').textContent=monthLabel(calDate);$('#calendarGrid').innerHTML=Array.from({length:42},(_,n)=>{const d=addDays(grid,n),arr=by[dateISO(d)]||[];return `<button class="cal-cell ${d.getMonth()!==m?'muted':''}" data-date="${dateISO(d)}"><span class="cal-daynum">${d.getDate()}</span><div class="cal-items">${arr.slice(0,1).map(i=>`<div class="cal-pill ${i.type}" title="${esc(i.name)}">${esc(calendarItemLabel(i))}</div>`).join('')}${arr.length>1?`<span class="cal-more">+${arr.length-1} more</span>`:''}</div></button>`}).join('');$$('.cal-cell').forEach(b=>b.onclick=()=>{selectedDate=b.dataset.date;renderSelectedDay()});renderSelectedDay();const yr=planned(new Date(y,0,1,12),new Date(y+1,0,1,12)).filter(i=>i.type!=='income');const months=Array.from({length:12},(_,i)=>yr.filter(x=>x.occurrence.getMonth()===i).reduce((a,x)=>a+x.amount,0)),max=Math.max(1,...months);$('#monthlyRhythm').innerHTML=months.map((v,i)=>`<div class="rhythm-row"><strong>${monthShort(new Date(y,i,1))}</strong><div class="rhythm-bar"><i style="width:${v/max*100}%"></i></div><strong>${shortMoney(v)}</strong></div>`).join('');renderCalendarLedger(new Date(y,m,1,12),new Date(y,m+1,1,12))}
function renderCalendarLedger(start,end){
  const items=planned(start,end).sort((a,b)=>a.occurrence-b.occurrence||sortByName(a.name,b.name)),t=totals(items),net=cents(t.income-t.payments-t.savings),summaryBox=$('#calendarLedgerSummary'),list=$('#calendarLedgerList');
  if(summaryBox)summaryBox.textContent=`${money(net)} net`;if(!list)return;
  list.innerHTML=items.length?items.map(item=>{
    const sign=item.type==='income'?'+':'-',meta=item.type==='income'?'Income':item.type==='savings'?'Savings':'Payment';
    const content=`<div class="ledger-row ${item.type}"><span class="ledger-date">${dateLabel(item.occurrence)}</span><div><strong>${esc(item.name)}</strong><small>${meta} · ${esc(item.category||item.savingsFund||item.account||'Scheduled')}${item.businessDayShifted?` · moved from ${dateLabel(item.scheduledOccurrence)}`:''}</small></div><b>${sign}${money(item.amount)}</b></div>`;
    return ['payment','income'].includes(item.type)?swipeMoneyRow(item,content):content;
  }).join(''):'<div class="empty-state">Nothing is scheduled for this month yet.</div>';
}
function renderSelectedDay(){
  const box=$('#selectedDayItems'),title=$('#selectedDayTitle');
  if(!selectedDate){title.textContent='Choose a day';box.className='day-items empty-state';box.textContent='Tap a payment date to see its details.';return}
  const d=parseDate(selectedDate),items=planned(d,addDays(d,1));title.textContent=formatDate(d,{weekday:'long',month:'long',day:'numeric'});box.className='day-items';
  box.innerHTML=items.length?items.map(item=>{
    const content=`<div class="day-item"><div class="date-badge"><b>${item.type==='income'?'↑':'↓'}</b></div><div class="upcoming-details"><strong>${esc(item.name)}</strong><span>${esc(item.category||item.savingsFund||item.account||'Planned')}${item.businessDayShifted?` · moved from ${dateLabel(item.scheduledOccurrence)}`:''}</span></div><span class="upcoming-amount">${item.type==='income'?'+':'-'}${money(item.amount)}</span></div>`;
    return ['payment','income'].includes(item.type)?swipeMoneyRow(item,content):content;
  }).join(''):'<div class="empty-state">Nothing scheduled for this day.</div>';
}
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
  const user=currentUser();
  if(user){$('#profileName').value=user.name||'';$('#profileEmail').value=user.email||''}
  const moneyEntries=state.entries.filter(entry=>['payment','income'].includes(entry.type)).sort((a,b)=>a.type.localeCompare(b.type)||sortByName(a.name,b.name));
  $('#settingsMoneyCount').textContent=`${moneyEntries.length} ${moneyEntries.length===1?'item':'items'}`;
  $('#settingsMoneyList').innerHTML=moneyEntries.length?moneyEntries.map(entry=>{
    const type=entry.type==='income'?'Income':'Payment',schedule=entry.repeat?`Every ${entry.repeat.every} ${entry.repeat.unit}`:entry.date?`Scheduled ${dateLabel(parseDate(entry.date))}`:'No date',detail=entry.type==='income'?(entry.account||'Income'):(entry.category||'Other');
    return swipeMoneyRow(entry,`<div class="payment-row-main ${entry.type}"><div><span class="money-type-badge">${type}</span><strong>${esc(entry.name)}</strong><small>${esc(schedule)} · ${esc(detail)}</small></div><b>${entry.type==='income'?'+':'-'}${money(entry.amount)}</b></div>`);
  }).join(''):'<div class="empty-state">No payments or income have been added yet.</div>';
  $$('[data-cat]').forEach(b=>b.onclick=()=>{state.settings.categories=state.settings.categories.filter(x=>x!==b.dataset.cat);save();renderSettings()});
  $$('[data-save]').forEach(b=>b.onclick=()=>{state.settings.savingsFunds=state.settings.savingsFunds.filter(x=>x!==b.dataset.save);save();renderSettings()});
  renderThemeSettings();
}
function renderThemeSettings(){
  const current=activeTheme();
  $$('#themeOptions button').forEach(button=>{
    const active=button.dataset.theme===current;
    button.classList.toggle('active',active);
    button.disabled=false;
    button.setAttribute('aria-pressed',String(active));
  });
}
function renderAll(){normalizeState();applyTheme();[renderTop,renderHome,renderCalendar,renderInsights,renderDebts,renderSettings,renderWeekly,renderCoach,renderCanBuy,renderPremiumState,renderAccount].forEach(fn=>safe(fn))}

function fillSelects(){ $('#entryCategory').innerHTML=state.settings.categories.map(x=>`<option>${esc(x)}</option>`).join('');$('#entrySavings').innerHTML=state.settings.savingsFunds.map(x=>`<option>${esc(x)}</option>`).join('')}
function syncEntry(){const type=$('input[name="entryType"]:checked').value;$$('.payment-only').forEach(x=>x.hidden=type!=='payment');$$('.savings-only').forEach(x=>x.hidden=type!=='savings');$('#repeatFields').hidden=!$('#repeatEnabled').checked}
function openEntry(type='payment',entry=null){
  const f=$('#entryForm');f.reset();fillSelects();
  const source=entry&&state.entries.find(item=>item.id===entry.id)||entry;
  $('#entryId').value=source?.id||'';
  $(`input[name="entryType"][value="${source?.type||type}"]`).checked=true;
  if(source){
    $('#entryName').value=source.name||'';$('#entryAmount').value=Number(source.amount)||0;$('#entryDate').value=source.date||'';$('#entryAccount').value=source.account||'';
    if(source.category)$('#entryCategory').value=source.category;if(source.savingsFund)$('#entrySavings').value=source.savingsFund;
    $('#repeatEnabled').checked=!!source.repeat;if(source.repeat){$('#repeatEvery').value=source.repeat.every||1;$('#repeatUnit').value=source.repeat.unit||'months'}
  }
  $('#modalEyebrow').textContent=source?'EDIT YOUR PLAN':'ADD TO YOUR PLAN';$('#modalTitle').textContent=source?'Edit money item':'Add a money item';$('#saveEntry').textContent=source?'Save changes':'Save item';
  syncEntry();$('#modalOverlay').hidden=false;setTimeout(()=>$('#entryName')?.focus(),40);
}
function openEntryById(id){const entry=state.entries.find(item=>item.id===id);if(entry)openEntry(entry.type,entry)}
function saveEntry(ev){
  ev.preventDefault();
  const id=$('#entryId').value,existing=id?state.entries.find(item=>item.id===id):null;
  if(!existing&&!isPremium()&&state.entries.length>=25){openPremium('Unlimited budget items');return}
  const type=$('input[name="entryType"]:checked').value;
  const row={...(existing||{}),id:id||uid(),type,name:$('#entryName').value.trim(),amount:cents($('#entryAmount').value),date:$('#entryDate').value||null,category:type==='payment'?$('#entryCategory').value:null,savingsFund:type==='savings'?$('#entrySavings').value:null,account:$('#entryAccount').value.trim(),notes:existing?.notes||'',repeat:$('#repeatEnabled').checked?{every:Math.max(1,Number($('#repeatEvery').value)||1),unit:$('#repeatUnit').value}:null};
  if(type!=='payment')delete row.splitPlan;
  if(!row.name||row.amount<0)return toast('Please add a name and valid amount.');
  if(existing)state.entries[state.entries.findIndex(item=>item.id===id)]=row;else state.entries.push(row);
  save();$('#modalOverlay').hidden=true;renderAll();toast(existing?'Changes saved.':'Saved to your plan.');
}
function deleteEntryById(id){
  const entry=state.entries.find(item=>item.id===id);if(!entry)return;
  const series=entry.repeat?' and every repeating occurrence':'';
  if(!confirm(`Delete ${entry.name}${series}?`))return;
  state.entries=state.entries.filter(item=>item.id!==id);save();renderAll();toast(`${entry.name} deleted.`);
}
function swipeMoneyRow(entry,content){
  return `<div class="swipe-row" data-entry-id="${esc(entry.id)}"><div class="swipe-actions"><button class="swipe-edit" type="button" data-edit-entry="${esc(entry.id)}">Edit</button><button class="swipe-delete" type="button" data-delete-entry="${esc(entry.id)}">Delete</button></div><div class="swipe-foreground">${content}<button class="swipe-more" type="button" data-reveal-entry="${esc(entry.id)}" aria-label="Show actions for ${esc(entry.name)}">•••</button></div></div>`;
}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove('show'),2600)}
function go(page){if(['coach','insights','debts'].includes(page)&&!isPremium()){openPremium(page==='coach'?'Split Coach':page==='insights'?'Spending insights':'Debt planning');return;}document.body.dataset.activePage=page;$$('.page').forEach(p=>p.classList.toggle('active',p.id===page));$$('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));const renderers={home:renderHome,calendar:renderCalendar,weekly:renderWeekly,coach:renderCoach,insights:renderInsights,debts:renderDebts,canbuy:renderCanBuy,settings:renderSettings,premium:renderPremiumState};safe(renderers[page]||renderTop);window.scrollTo({top:0,behavior:'smooth'})}
function legacyBind(){}
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
    if(ang<=0)return;
    ctx.strokeStyle=palette[i]||palette[i%palette.length];
    ctx.beginPath();
    const gap=Math.min(.025,ang/4);
    ctx.arc(w/2,h/2,r,a+gap,a+ang-gap);
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
async function handleProfileUpdate(event){
  event.preventDefault();
  const user=currentUser();if(!user)return;
  const oldEmail=String(user.email||'').toLowerCase(),email=$('#profileEmail').value.trim().toLowerCase(),name=$('#profileName').value.trim(),currentPassword=$('#profileCurrentPassword').value,newPassword=$('#profileNewPassword').value,confirmPassword=$('#profileConfirmPassword').value;
  if(!name||!email)return toast('Add both a name and email.');
  const sensitiveChange=email!==oldEmail||!!newPassword;
  if(isReviewDemoUser(user)&&sensitiveChange)return toast('The App Review demo email and password are managed by the app publisher.');
  if(newPassword&&newPassword.length<6)return toast('Use at least 6 characters for the new password.');
  if(newPassword!==confirmPassword)return toast('The new passwords do not match.');
  if(sensitiveChange&&await hashPassword(currentPassword)!==user.passwordHash)return toast('Enter your current password to change email or password.');
  const users=authUsers();
  if(email!==oldEmail&&users[email])return toast('A profile with that email already exists on this device.');
  const updated={...user,name,email,passwordHash:newPassword?await hashPassword(newPassword):user.passwordHash,updatedAt:new Date().toISOString()};
  delete users[oldEmail];users[email]=updated;setAuthUsers(users);
  if(email!==oldEmail){
    const oldKey=userKey(oldEmail),newKey=userKey(email),prefs=deviceAuthPrefs();
    localStorage.setItem(newKey,JSON.stringify(state));localStorage.removeItem(oldKey);localStorage.setItem(SESSION_KEY,email);APP_KEY=newKey;
    if(prefs.accounts?.[oldEmail]){prefs.accounts[email]=prefs.accounts[oldEmail];delete prefs.accounts[oldEmail]}
    if(prefs.lastEmail===oldEmail)prefs.lastEmail=email;setDeviceAuthPrefs(prefs);
  }
  save();$('#profileCurrentPassword').value='';$('#profileNewPassword').value='';$('#profileConfirmPassword').value='';closeProfileEditor();renderAll();toast('Profile updated.');
}
function openProfileEditor(){
  const user=currentUser();if(!user)return;
  $('#profileName').value=user.name||'';$('#profileEmail').value=user.email||'';$('#profileCurrentPassword').value='';$('#profileNewPassword').value='';$('#profileConfirmPassword').value='';$('#profileModal').hidden=false;setTimeout(()=>$('#profileName')?.focus(),40);
}
function closeProfileEditor(){const modal=$('#profileModal');if(modal)modal.hidden=true}
function bindSwipeActions(){
  if(window.__swipeBound)return;window.__swipeBound=true;
  let gesture=null;
  document.addEventListener('click',event=>{
    const edit=event.target.closest('[data-edit-entry]'),remove=event.target.closest('[data-delete-entry]'),reveal=event.target.closest('[data-reveal-entry]');
    if(edit){openEntryById(edit.dataset.editEntry);return}
    if(remove){deleteEntryById(remove.dataset.deleteEntry);return}
    if(reveal){const row=reveal.closest('.swipe-row'),willOpen=!row.classList.contains('actions-open');$$('.swipe-row.actions-open').forEach(item=>item.classList.remove('actions-open'));row.classList.toggle('actions-open',willOpen)}
  });
  document.addEventListener('pointerdown',event=>{const row=event.target.closest('.swipe-row');if(!row||event.target.closest('.swipe-actions')||event.button>0)return;gesture={row,x:event.clientX,y:event.clientY,pointerId:event.pointerId}});
  document.addEventListener('pointerup',event=>{if(!gesture||event.pointerId!==gesture.pointerId)return;const dx=event.clientX-gesture.x,dy=Math.abs(event.clientY-gesture.y);if(dy<45&&Math.abs(dx)>35){$$('.swipe-row.actions-open').forEach(item=>{if(item!==gesture.row)item.classList.remove('actions-open')});gesture.row.classList.toggle('actions-open',dx<0)}gesture=null});
  document.addEventListener('pointercancel',()=>{gesture=null});
}
function bind(){
  if(window.__tallyBound)return;window.__tallyBound=true;
  $$('[data-page]').forEach(button=>button.addEventListener('click',()=>go(button.dataset.page)));
  $$('[data-go]').forEach(button=>button.addEventListener('click',()=>go(button.dataset.go)));
  $('#openAdd').onclick=()=>openEntry();$('#mobileAdd').onclick=()=>openEntry();$('#quickAddIncome').onclick=()=>openEntry('income');$('#quickAddPayment').onclick=()=>openEntry('payment');
  $('#closeModal').onclick=$('#cancelModal').onclick=()=>$('#modalOverlay').hidden=true;
  $('#modalOverlay').addEventListener('click',event=>{if(event.target===$('#modalOverlay'))$('#modalOverlay').hidden=true});
  $('#entryForm').addEventListener('submit',saveEntry);$$('input[name="entryType"]').forEach(input=>input.addEventListener('change',syncEntry));$('#repeatEnabled').addEventListener('change',syncEntry);
  $('#calPrev').onclick=()=>{calDate=addMonths(calDate,-1);selectedDate=null;renderCalendar()};$('#calNext').onclick=()=>{calDate=addMonths(calDate,1);selectedDate=null;renderCalendar()};
  $('#moneyMapPrev').onclick=()=>{ui.moneyMapDate=addMonths(ui.moneyMapDate,-1);renderWeekly()};$('#moneyMapNext').onclick=()=>{ui.moneyMapDate=addMonths(ui.moneyMapDate,1);renderWeekly()};
  $$('[data-plan-view]').forEach(button=>button.addEventListener('click',()=>{ui.planView=button.dataset.planView;renderWeekly()}));
  $$('[data-cadence]',$('#cadenceOptions')).forEach(button=>button.addEventListener('click',()=>{state.settings.cadence=button.dataset.cadence;ui.planView=button.dataset.cadence==='monthly'?'both':button.dataset.cadence;save();renderAll();toast(`Home is now showing the current ${button.dataset.cadence==='biweekly'?'two-week':button.dataset.cadence} period.`)}));
  $('#updateProfile').onclick=openProfileEditor;$('#closeProfileModal').onclick=$('#cancelProfileModal').onclick=closeProfileEditor;
  $('#profileModal').addEventListener('click',event=>{if(event.target===$('#profileModal'))closeProfileEditor()});
  $('#profileForm').addEventListener('submit',handleProfileUpdate);
  $('#categoryForm').addEventListener('submit',event=>{event.preventDefault();const value=$('#newCategory').value.trim();if(value&&!state.settings.categories.includes(value)){state.settings.categories.push(value);$('#newCategory').value='';save();renderSettings()}});
  $('#savingsForm').addEventListener('submit',event=>{event.preventDefault();const value=$('#newSavings').value.trim();if(value&&!state.settings.savingsFunds.includes(value)){state.settings.savingsFunds.push(value);$('#newSavings').value='';save();renderSettings()}});
  $('#cushionForm').addEventListener('submit',event=>{event.preventDefault();state.settings.startingBalance=cents($('#cushionInput').value);save();renderAll()});
  $('#exportData').onclick=()=>{const anchor=document.createElement('a');anchor.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));anchor.download=`tallyho-backup-${dateISO(new Date())}.json`;anchor.click();URL.revokeObjectURL(anchor.href)};
  $('#importData').addEventListener('change',event=>{const file=event.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{state=JSON.parse(reader.result);normalizeState();save();renderAll();toast('Backup imported.')}catch{toast('That backup could not be read.')}};reader.readAsText(file)});
  $('#resetData').onclick=()=>{if(confirm('Reset all budget data?')){state=structuredClone(DEFAULTS);save();renderAll()}};
  window.addEventListener('resize',()=>{clearTimeout(window.__resize);window.__resize=setTimeout(renderAll,150)});
  bindSwipeActions();bindAppStoreFeatures();
}
function bindThemeControls(){if(window.__themeBound)return;window.__themeBound=true;const box=$('#themeOptions');if(!box)return;box.addEventListener('click',e=>{const button=e.target.closest('[data-theme]');if(!button)return;if(!isPremium()){openPremium('Premium themes');return}state.settings.theme=button.dataset.theme;save();applyTheme();renderAll();toast(`${THEMES[state.settings.theme]} theme applied.`)})}
function init(){setDocumentLocale();bind();bindOnboarding();bindThemeControls();initAuth();renderAll();loadStoreProducts();refreshPremiumEntitlement();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{})}
window.addEventListener('languagechange',()=>{setDocumentLocale();renderAll()});
window.addEventListener('pageshow',()=>refreshPremiumEntitlement());
window.addEventListener('focus',()=>refreshPremiumEntitlement());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshPremiumEntitlement()});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();

/* TallyHo v8 - simple large-bill split coach. */
function splitIsActive(entry){
  return !!(entry && entry.type==='payment' && Number(entry.amount)>500 && entry.splitPlan && entry.splitPlan.enabled && ['weekly','biweekly'].includes(entry.splitPlan.cadence));
}
function splitReserveAmount(entry,cadence,referenceDate){
  const amount=Math.max(0,Number(entry.amount)||0),reference=startOfDay(referenceDate||new Date()),periodDays=cadence==='biweekly'?14:7;
  if(!entry.repeat){
    const due=parseDate(entry.date);if(!due)return cents(amount/(cadence==='biweekly'?2:4));if(due<reference)return 0;
    return cents(amount/Math.max(1,Math.ceil((diffDays(reference,due)+1)/periodDays)));
  }
  const every=Math.max(1,Number(entry.repeat.every)||1);
  if(entry.repeat.unit==='months')return cents((amount/every)/(cadence==='biweekly'?2:4));
  if(entry.repeat.unit==='weeks')return cents(amount*(cadence==='biweekly'?2:1)/every);
  return cents(amount/(every*(cadence==='biweekly'?26:52)));
}
function splitWeeklyReserve(entry,referenceDate){return splitReserveAmount(entry,'weekly',referenceDate)}
function exactShares(amount,count){
  const total=Math.round((Number(amount)||0)*100),base=Math.floor(total/count),remainder=total-base*count;
  return Array.from({length:count},(_,index)=>(base+(index<remainder?1:0))/100);
}
function splitPlanningWindows(monthStart,cadence){
  const end=monthEnd(monthStart),count=cadence==='biweekly'?2:4,step=cadence==='biweekly'?14:7;
  return Array.from({length:count},(_,index)=>({index,start:addDays(monthStart,index*step),end:index===count-1?end:addDays(monthStart,(index+1)*step)}));
}
function projectedCashScore(start,end,opening,items){
  const changes={};
  items.forEach(item=>{const key=dateISO(item.occurrence),amount=item.type==='income'?Number(item.amount)||0:-(Number(item.amount)||0);changes[key]=cents((changes[key]||0)+amount)});
  let running=cents(opening),minimum=running,negativeDays=0,deficit=0;
  for(let day=start;day<end;day=addDays(day,1)){
    running=cents(running+(changes[dateISO(day)]||0));minimum=Math.min(minimum,running);
    if(running<0){negativeDays++;deficit=cents(deficit-running)}
  }
  return{minimum:cents(minimum),negativeDays,deficit};
}
function recommendedReserveDate(window,amount,monthStart,monthFinish,opening,baseItems,scheduledRows){
  const target=addDays(window.start,Math.floor(Math.max(0,diffDays(window.start,window.end)-1)/2)),incomeDates=new Set(baseItems.filter(item=>item.type==='income').map(item=>item.occurrenceDate));
  const candidates=[];
  for(let date=window.start;date<window.end;date=addDays(date,1)){
    const occurrence=startOfDay(date),candidate={type:'payment',amount,occurrence,occurrenceDate:dateISO(occurrence)},score=projectedCashScore(monthStart,monthFinish,opening,[...baseItems,...scheduledRows,candidate]);
    const load=cents(scheduledRows.filter(row=>row.occurrenceDate===candidate.occurrenceDate).reduce((sum,row)=>sum+row.amount,0));
    candidates.push({occurrence,score,load,income:incomeDates.has(candidate.occurrenceDate),distance:Math.abs(diffDays(target,occurrence))});
  }
  candidates.sort((a,b)=>a.score.negativeDays-b.score.negativeDays||a.score.deficit-b.score.deficit||b.score.minimum-a.score.minimum||a.load-b.load||Number(b.income)-Number(a.income)||a.distance-b.distance||a.occurrence-b.occurrence);
  return candidates[0]?.occurrence||window.start;
}
function recommendedSplitMonthRows(monthStart,activeEntries){
  const monthFinish=monthEnd(monthStart),activeIds=new Set(activeEntries.map(entry=>entry.id)),baseItems=planned(monthStart,monthFinish).filter(item=>!activeIds.has(item.id)),opening=cashBalanceBefore(monthStart),specs=[];
  activeEntries.forEach(entry=>{
    const cadence=entry.splitPlan.cadence,windows=splitPlanningWindows(monthStart,cadence),sources=entry.date?occurrences(entry,monthStart,monthFinish):[{...entry,occurrence:monthStart,occurrenceDate:dateISO(monthStart),unscheduled:true}];
    sources.forEach((source,sourceIndex)=>exactShares(source.amount,windows.length).forEach((amount,index)=>specs.push({entry,source,sourceIndex,index,amount,window:windows[index]})));
  });
  specs.sort((a,b)=>a.window.start-b.window.start||b.amount-a.amount||sortByName(a.entry.name,b.entry.name));
  return specs.reduce((rows,spec)=>{
    const occurrence=recommendedReserveDate(spec.window,spec.amount,monthStart,monthFinish,opening,baseItems,rows),sourceDate=spec.source.scheduledOccurrenceDate||spec.source.occurrenceDate;
    rows.push({id:`split_${spec.entry.id}_${sourceDate}_${spec.index}`,type:'payment',amount:spec.amount,name:`Set aside: ${spec.entry.name}`,category:'Split reserve',occurrence,occurrenceDate:dateISO(occurrence),isReserve:true,isRecommended:true,sourceEntryId:spec.entry.id});
    return rows;
  },[]).sort((a,b)=>a.occurrence-b.occurrence||sortByName(a.name,b.name));
}
function splitMonthRows(entry,monthStart){return recommendedSplitMonthRows(monthStart,[entry]).filter(row=>row.sourceEntryId===entry.id)}
function splitReserveRows(start,end){
  const rows=[];let month=new Date(start.getFullYear(),start.getMonth(),1,12),guard=0;
  const active=state.entries.filter(splitIsActive);
  while(month<end&&guard++<120){rows.push(...recommendedSplitMonthRows(month,active));month=addMonths(month,1)}
  return rows.filter(row=>row.occurrence>=start&&row.occurrence<end);
}
function splitCashSummary(start,end,opts={}){
  const actual=planned(start,end,opts).filter(item=>!(item.type==='payment' && splitIsActive(item)));
  const items=[...actual,...splitReserveRows(start,end)].sort((a,b)=>a.occurrence-b.occurrence||sortByName(a.name,b.name));
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
function moneyMapWeekRanges(monthStart){
  const end=monthEnd(monthStart),ranges=[];let cursor=monthStart,index=1;
  while(cursor<end){const naturalEnd=addDays(cursor,index===1?7-cursor.getDay():7),rangeEnd=naturalEnd<end?naturalEnd:end;ranges.push({index,start:cursor,end:rangeEnd,tag:index===1&&monthStart.getDay()!==0?'last week':rangeEnd<naturalEnd?'next week':''});cursor=rangeEnd;index++}
  return ranges;
}
function moneyMapBiweekRanges(monthStart){
  const end=monthEnd(monthStart),ranges=[];let cursor=monthStart,index=1;
  while(cursor<end){const naturalEnd=addDays(cursor,14),rangeEnd=naturalEnd<end?naturalEnd:end;ranges.push({index,start:cursor,end:rangeEnd,tag:rangeEnd<naturalEnd?'next week':''});cursor=rangeEnd;index++}
  return ranges;
}
function moneyMapItems(items){
  return items.length?items.map(item=>`<div class="weekly-item ${item.type}${item.isReserve?' reserve-item':''}"><span class="weekly-date">${item.unscheduled?'No date':dateLabel(item.occurrence)}</span><strong>${esc(item.name)}${item.isReserve?'<span class="reserve-badge">split</span>':''}${item.businessDayShifted?'<span class="business-day-badge">business day</span>':''}</strong><span class="weekly-purpose">${esc(item.category||item.savingsFund||item.account||item.type)}${item.businessDayShifted?` · from ${dateLabel(item.scheduledOccurrence)}`:''}</span><b>${item.type==='income'?'+':'-'}${money(item.amount)}</b></div>`).join(''):'<div class="weekly-empty">No scheduled money moves in this window.</div>';
}
function transactionExpander(items,label='transactions'){
  return `<details class="money-map-transactions"><summary><span>View ${items.length} ${items.length===1?'transaction':label}</span><b>＋</b></summary><div class="weekly-items">${moneyMapItems(items)}</div></details>`;
}
function renderWeekly(){
  const monthStart=new Date(ui.moneyMapDate.getFullYear(),ui.moneyMapDate.getMonth(),1,12),monthFinish=monthEnd(monthStart),weeklyRanges=moneyMapWeekRanges(monthStart),biweeklyRanges=moneyMapBiweekRanges(monthStart);
  const carried=cashBalanceBefore(monthStart);
  let weeklyRunning=carried;
  const weeks=weeklyRanges.map((range,index)=>{const data=splitCashSummary(range.start,range.end,{undated:index===0});weeklyRunning=cents(weeklyRunning+data.net);return{...range,...data,after:weeklyRunning}});
  let biweeklyRunning=carried;
  const biweeks=biweeklyRanges.map((range,index)=>{const data=splitCashSummary(range.start,range.end,{undated:index===0});biweeklyRunning=cents(biweeklyRunning+data.net);return{...range,...data,after:biweeklyRunning}});
  const monthSummary=splitCashSummary(monthStart,monthFinish,{undated:true});
  $('#moneyMapMonthLabel').textContent=monthLabel(monthStart);$('#weeklyRangeLabel').textContent=`${dateLabel(monthStart)} - ${dateLabel(addDays(monthFinish,-1))}`;
  $('#weeklyStartingBalance').textContent=money(carried);$('#weeklyIncomeTotal').textContent=money(monthSummary.income);$('#weeklyOutflowTotal').textContent=money(monthSummary.outflow);$('#weeklyAfterTotal').textContent=money(cents(carried+monthSummary.net));
  $('#weeklyOverview').innerHTML=weeks.map(week=>`<article class="weekly-card"><div class="weekly-card-head"><div><p class="eyebrow">WEEK ${week.index}${week.tag?` · <span class="week-edge-tag">(${week.tag})</span>`:''}</p><h2>${dateLabel(week.start)} - ${dateLabel(addDays(week.end,-1))}</h2></div><span class="weekly-net ${week.after<0?'negative':''}" title="Left after this week">${money(week.after)}</span></div><div class="weekly-totals"><div><span>Income</span><strong>${money(week.income)}</strong></div><div><span>Cash-plan outflow</span><strong>${money(week.outflow)}</strong></div><div class="weekly-after ${week.after<0?'negative':''}"><span>Left after this week</span><strong>${money(week.after)}</strong></div></div>${transactionExpander(week.items)}</article>`).join('');
  $('#biweeklyOverview').innerHTML=biweeks.map(period=>`<article class="biweekly-card"><div class="biweekly-card-head"><div><p class="eyebrow">BIWEEK ${period.index}${period.tag?` · <span class="week-edge-tag">(${period.tag})</span>`:''}</p><h2>${dateLabel(period.start)} - ${dateLabel(addDays(period.end,-1))}</h2></div><span class="weekly-net ${period.after<0?'negative':''}" title="Left after this biweekly period">${money(period.after)}</span></div><div class="biweekly-metrics"><div><span>Income</span><strong>${money(period.income)}</strong></div><div><span>Cash-plan outflow</span><strong>${money(period.outflow)}</strong></div><div class="weekly-after ${period.after<0?'negative':''}"><span>Left after biweekly</span><strong>${money(period.after)}</strong></div></div>${transactionExpander(period.items)}</article>`).join('');
  const active=state.entries.filter(splitIsActive),negative=weeks.filter(week=>week.after<0);
  const planNote=negative.length?`<strong>Heads up:</strong> even after carrying money forward and placing splits around cash flow, the plan drops below zero in week ${negative[0].index}.`:active.length?`<strong>Cash-split plan active:</strong> recommended dates are spread across the month for ${active.map(entry=>`${esc(entry.name)} (${entry.splitPlan.cadence})`).join(', ')}.`:'';
  $('#weeklyPlanNote').innerHTML=planNote;$('#weeklyPlanNote').hidden=!planNote;
  $('#weeklyOverview').hidden=ui.planView==='biweekly';$('.biweekly-section').hidden=ui.planView==='weekly';$$('[data-plan-view]').forEach(button=>button.classList.toggle('active',button.dataset.planView===ui.planView));
}
function renderCoach(){
  const controls=$('.coach-controls');
  if(controls) controls.innerHTML=`<div class="coach-control-copy"><p class="eyebrow">SPLIT OPTIONS</p><h2>Payments over $500</h2><p>Monthly bills use four weekly shares or two biweekly shares, placed around your income and other outflow.</p></div><div class="simple-coach-status"><span id="coachLargeCount">Checking payments...</span><button class="outline-btn" type="button" data-go="weekly">View monthly cash plan ↗</button></div>`;
  const all=state.entries.filter(e=>e.type==='payment'&&Number(e.amount)>500).sort((a,b)=>Number(b.amount)-Number(a.amount));
  $('#coachHeadline').textContent=all.length?'Payment split coach':'No payments over $500';
  $('#coachLargeCount').textContent=all.length?`${all.length} large payment${all.length===1?'':'s'} found`:'Nothing to split';
  const oldMetrics=$('.coach-metrics'), oldNotes=$('#coachWithdrawalNote'), oldSpike=$('#coachSpikeNote'), oldSchedule=$('#pulloutSchedule');
  if(oldMetrics) oldMetrics.hidden=true;
  if(oldNotes) oldNotes.hidden=true;
  if(oldSpike) oldSpike.hidden=true;
  if(oldSchedule) oldSchedule.hidden=true;
  const reference=new Date(ui.moneyMapDate.getFullYear(),ui.moneyMapDate.getMonth(),1,12),recommendedRows=splitReserveRows(reference,monthEnd(reference));
  $('#splitSuggestions').innerHTML=all.length?all.map(entry=>{
    const weekly=splitReserveAmount(entry,'weekly',reference),biweekly=splitReserveAmount(entry,'biweekly',reference),active=splitIsActive(entry)?entry.splitPlan.cadence:null,dates=recommendedRows.filter(row=>row.sourceEntryId===entry.id).map(row=>dateLabel(row.occurrence));
    const schedule=entry.repeat?`Repeats every ${entry.repeat.every} ${entry.repeat.unit}`:entry.date?`Due ${dateLabel(parseDate(entry.date))}`:'No due date';
    return `<article class="split-card ${active?'active-split':''}"><div class="split-card-title"><div><p class="eyebrow">${esc(entry.category||'PAYMENT')} · ${esc(schedule)}</p><h3>${esc(entry.name)}</h3><p>Full bill: <strong>${money(entry.amount)}</strong></p></div><span class="split-bill">${money(entry.amount)}</span></div><div class="split-options simple-split-options"><div><span>Weekly set-aside</span><strong>${money(weekly)}</strong><button class="split-apply ${active==='weekly'?'selected':''}" data-split-id="${esc(entry.id)}" data-split-cadence="weekly">${active==='weekly'?'Weekly plan active':'Use weekly plan'}</button></div><div><span>Biweekly set-aside</span><strong>${money(biweekly)}</strong><button class="split-apply ${active==='biweekly'?'selected':''}" data-split-id="${esc(entry.id)}" data-split-cadence="biweekly">${active==='biweekly'?'Biweekly plan active':'Use biweekly plan'}</button></div></div>${active?`<div class="split-active-row"><span>${dates.length?`Recommended this month: ${dates.join(' · ')}`:'This bill has no occurrence in this month.'}</span><button class="split-remove" data-split-id="${esc(entry.id)}">Remove split</button></div>`:`<p class="split-tip">Choose one option and TallyHo will recommend separate dates that best fit the month.</p>`}</article>`;
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
function isReviewDemoUser(user=currentUser()){return user?.email===REVIEW_DEMO_EMAIL}
function reviewDemoState(){
  const today=startOfDay(new Date()),month=new Date(today.getFullYear(),today.getMonth(),1,12);
  return{
    settings:{...DEFAULTS.settings,cadence:'weekly',startingBalance:875,purchaseGuardPercent:15},
    entries:[
      {id:'demo-paycheck',name:'Paycheck',type:'income',amount:2400,date:dateISO(addDays(month,4)),repeat:{every:2,unit:'weeks'}},
      {id:'demo-rent',name:'Rent',type:'payment',amount:1350,date:dateISO(month),repeat:{every:1,unit:'months'},category:'Housing'},
      {id:'demo-electric',name:'Electric',type:'payment',amount:145,date:dateISO(addDays(month,9)),repeat:{every:1,unit:'months'},category:'Bills'},
      {id:'demo-groceries',name:'Groceries',type:'payment',amount:175,date:dateISO(addDays(month,6)),repeat:{every:1,unit:'weeks'},category:'Groceries'},
      {id:'demo-savings',name:'Emergency fund',type:'savings',amount:100,date:dateISO(addDays(month,5)),repeat:{every:2,unit:'weeks'},category:'Emergency fund'},
      {id:'demo-insurance',name:'Car insurance',type:'payment',amount:720,date:dateISO(addDays(month,24)),repeat:{every:6,unit:'months'},category:'Bills',splitPlan:{enabled:true,cadence:'weekly'}}
    ],
    debts:[{id:'demo-card',name:'Credit card',balance:2850,apr:19.99,minimum:95,extra:50}],
    buyHistory:[]
  };
}
function ensureReviewDemoProfile(){
  const users=authUsers(),existing=users[REVIEW_DEMO_EMAIL]||{},now=new Date().toISOString();
  const hadReviewBypass=existing.reviewAccess===true||existing.subscription==='review'||(existing.plan==='premium'&&existing.storeManaged!==true);
  users[REVIEW_DEMO_EMAIL]={...existing,name:existing.name||'TallyHo Demo',email:REVIEW_DEMO_EMAIL,passwordHash:REVIEW_DEMO_PASSWORD_HASH,plan:hadReviewBypass?'free':existing.plan==='premium'?'premium':'free',subscription:hadReviewBypass?null:(existing.subscription||null),storeProductIdentifier:hadReviewBypass?null:(existing.storeProductIdentifier||null),storeManaged:true,reviewAccess:false,onboardingComplete:true,createdAt:existing.createdAt||now,updatedAt:now};
  setAuthUsers(users);
  const demoKey=userKey(REVIEW_DEMO_EMAIL);
  if(!localStorage.getItem(demoKey))localStorage.setItem(demoKey,JSON.stringify(reviewDemoState()));
}
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
function activateSession(email){localStorage.setItem(SESSION_KEY,String(email).toLowerCase());APP_KEY=userKey(email);if(!localStorage.getItem(APP_KEY)&&!localStorage.getItem('tallyho-v3-migrated')){const old=localStorage.getItem('tallyho-budget-v2')||localStorage.getItem(LEGACY_APP_KEY);if(old){localStorage.setItem(APP_KEY,old);localStorage.setItem('tallyho-v3-migrated','1')}}state=loadState();normalizeState();ui.planView=state.settings.cadence==='monthly'?'both':state.settings.cadence;save();showAuthenticated();renderAll();refreshPremiumEntitlement();if(needsOnboarding())showOnboarding();else go('home')}
function showAuthenticated(){const logged=!!currentUser();const gate=$('#authGate'),shell=$('#appShell'),onboarding=$('#onboardingGate');if(gate)gate.hidden=logged;if(shell)shell.hidden=!logged;if(onboarding&&!logged)onboarding.hidden=true;document.body.classList.toggle('signed-in',logged);renderDeviceAuth()}
function renderAccount(){const user=currentUser();if(!user){renderDeviceAuth();return}const name=user.name||user.email.split('@')[0];$('#accountName').textContent=name;$('#accountInitial').textContent=name.slice(0,1).toUpperCase();$('#settingsUserName').textContent=name;$('#settingsUserEmail').textContent=`${user.email} · ${isPremium()?'Premium member':'Free plan'}`;$$('[data-premium-feature]').forEach(el=>el.classList.toggle('locked',!isPremium()));renderDeviceAuth()}
function needsOnboarding(){return currentUser()?.onboardingComplete===false}
function showOnboarding(){const gate=$('#onboardingGate');if(!gate)return;onboardingDraft={...DEFAULTS.settings,...state.settings,categories:[...(state.settings.categories||DEFAULTS.settings.categories)],savingsFunds:[...(state.settings.savingsFunds||DEFAULTS.settings.savingsFunds)]};renderOnboardingSettings();gate.hidden=false}
function renderOnboardingSettings(){if(!onboardingDraft)return;$$('[data-onboarding-cadence]').forEach(b=>b.classList.toggle('active',b.dataset.onboardingCadence===onboardingDraft.cadence));$('#onboardingCategorySettings').innerHTML=onboardingDraft.categories.map(c=>`<span class="chip">${esc(c)}<button data-onboarding-cat="${esc(c)}" type="button">×</button></span>`).join('');$('#onboardingSavingsSettings').innerHTML=onboardingDraft.savingsFunds.map(c=>`<span class="chip">${esc(c)}<button data-onboarding-save="${esc(c)}" type="button">×</button></span>`).join('');$('#onboardingCushion').value=Number(onboardingDraft.startingBalance)||''}
function addOnboardingChip(kind,value){if(!onboardingDraft)return;const key=kind==='cat'?'categories':'savingsFunds',clean=String(value||'').trim();if(clean&&!onboardingDraft[key].includes(clean))onboardingDraft[key].push(clean);renderOnboardingSettings()}
function finishOnboarding(useDefaults=false){const user=currentUser();if(!user)return;if(!useDefaults&&onboardingDraft){state.settings={...state.settings,...onboardingDraft,startingBalance:cents($('#onboardingCushion').value)}}ui.planView=state.settings.cadence==='monthly'?'both':state.settings.cadence;save();const users=authUsers();users[user.email]={...users[user.email],onboardingComplete:true,updatedAt:new Date().toISOString()};setAuthUsers(users);$('#onboardingGate').hidden=true;onboardingDraft=null;renderAll();go('home');toast('Welcome in. Your setup is saved.')}
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
  if(email===REVIEW_DEMO_EMAIL){
    ensureReviewDemoProfile();
    closeResetPassword();
    $('#loginEmail').value=REVIEW_DEMO_EMAIL;
    $('#loginPassword').value='';
    return toast('The App Review demo password is managed by the app publisher.');
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
  ensureReviewDemoProfile();
  showAuthenticated();
  $$('[data-auth-tab]').forEach(button=>button.onclick=()=>{$$('[data-auth-tab]').forEach(b=>b.classList.toggle('active',b===button));$('#loginForm').hidden=button.dataset.authTab!=='login';$('#signupForm').hidden=button.dataset.authTab!=='signup'});
  $('#forgotPassword').onclick=openResetPassword;
  $('#deviceAuthLogin').onclick=loginWithDeviceAuth;
  $('#closeResetPassword').onclick=closeResetPassword;
  $('#resetPasswordModal').onclick=e=>{if(e.target===$('#resetPasswordModal'))closeResetPassword()};
  $('#resetPasswordForm').addEventListener('submit',handleResetPassword);
  $('#loginForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const email=$('#loginEmail').value.trim().toLowerCase(),password=$('#loginPassword').value,typedHash=await hashPassword(password);
    const users=authUsers(),user=users[email];
    if(!user||user.passwordHash!==typedHash)return toast('That email or password does not match.');
    activateSession(email);
  });
  $('#signupForm').addEventListener('submit',async e=>{e.preventDefault();const email=$('#signupEmail').value.trim().toLowerCase(),users=authUsers();if(users[email])return toast('An account already exists for that email.');users[email]={name:$('#signupName').value.trim(),email,passwordHash:await hashPassword($('#signupPassword').value),plan:'free',createdAt:new Date().toISOString(),onboardingComplete:false};setAuthUsers(users);activateSession(email)});
  renderDeviceAuth();
  if(currentUser())activateSession(sessionEmail());
}
function logout(){save();localStorage.removeItem(SESSION_KEY);APP_KEY=BASE_APP_KEY;state=structuredClone(DEFAULTS);applyTheme();showAuthenticated();$('#loginPassword').value='';window.scrollTo(0,0)}
function deleteCurrentAccount(){const user=currentUser();if(!user)return;if(!confirm('Delete this TallyHo profile and all budget data on this device? This cannot be undone.'))return;const users=authUsers();delete users[user.email];setAuthUsers(users);localStorage.removeItem(userKey(user.email));logout();toast('Profile deleted.')}
function openPremium(feature='Premium tools'){$('#premiumModal').hidden=false;$('#premiumModal .modal-heading p').textContent=`UNLOCK ${String(feature).toUpperCase()}`;if(!storeProducts.monthly||!storeProducts.yearly)loadStoreProducts(true)}
function closePremium(){$('#premiumModal').hidden=true}
function storePlugin(){return window.Capacitor?.Plugins?.TallyHoStore||window.TallyHoStore||null}
function storePlanFromProduct(productIdentifier){return productIdentifier===STORE_PRODUCT_IDS.lifetime?'lifetime':productIdentifier===STORE_PRODUCT_IDS.yearly?'yearly':'monthly'}
function renderStoreProducts(){
  const native=!!storePlugin(),monthly=storeProducts.monthly,yearly=storeProducts.yearly;
  const monthlyText=monthly?.displayPrice?`${monthly.displayPrice}/month`:(native?'Loading price…':'Available in the iOS app');
  const yearlyText=yearly?.displayPrice?`${yearly.displayPrice}/year`:(native?'Loading price…':'Available in the iOS app');
  const pairs=[['#premiumHeroMonthlyPrice',monthlyText],['#premiumCardMonthlyPrice',monthlyText],['#premiumModalMonthlyPrice',monthlyText],['#premiumModalAnnualPrice',yearlyText]];
  pairs.forEach(([selector,value])=>{const element=$(selector);if(element)element.textContent=value});
  const annualSummary=$('#premiumHeroAnnualPrice');
  if(annualSummary)annualSummary.textContent=yearly?.displayPrice?`${yearly.displayPrice} per year`:'Annual plan available';
  const annualLabel=$('#premiumAnnualLabel');
  if(annualLabel){const savings=monthly?.price&&yearly?.price?Math.max(0,Math.round((1-yearly.price/(monthly.price*12))*100)):0;annualLabel.textContent=savings?`Yearly · save ${savings}%`:'Yearly · best value'}
}
async function loadStoreProducts(force=false){
  const plugin=storePlugin();
  if(!plugin?.getProducts){renderStoreProducts();return[]}
  if(storeProductsPromise&&!force)return storeProductsPromise;
  storeProductsPromise=(async()=>{try{const result=await plugin.getProducts();const products=Array.isArray(result?.products)?result.products:[];storeProducts=Object.fromEntries(products.map(product=>[product.plan||storePlanFromProduct(product.productIdentifier),product]));renderStoreProducts();return products}catch(err){const status=$('#storeStatus');if(status){status.hidden=false;status.textContent=err?.message||'Apple could not load subscription prices.'}renderStoreProducts();return[]}finally{storeProductsPromise=null}})();
  return storeProductsPromise;
}
function applyStoreEntitlement(result){
  const user=currentUser();
  if(!user)return !!result?.active;
  const users=authUsers();
  const active=!!result?.active,productIdentifier=result?.productIdentifier||'';
  users[user.email]={...users[user.email],plan:active?'premium':'free',subscription:active?(result?.plan||storePlanFromProduct(productIdentifier)):null,storeProductIdentifier:active?productIdentifier:null,storeManaged:true,updatedAt:new Date().toISOString()};
  setAuthUsers(users);
  renderAll();
  return active;
}
async function refreshPremiumEntitlement(){
  const plugin=storePlugin();
  const user=currentUser();
  if(!user)return null;
  if(!plugin?.getEntitlement)return null;
  if(entitlementRefreshPromise)return entitlementRefreshPromise;
  entitlementRefreshPromise=(async()=>{try{const result=await plugin.getEntitlement();applyStoreEntitlement(result);return result}catch(err){console.warn('TallyHo StoreKit entitlement refresh failed:',err);return null}finally{entitlementRefreshPromise=null}})();
  return entitlementRefreshPromise;
}
function setPurchaseBusy(busy,label='Contacting the App Store…'){
  const continueButton=$('#premiumContinue'),restoreButton=$('#restorePurchases'),status=$('#storeStatus');
  if(continueButton){continueButton.disabled=busy||isPremium();continueButton.textContent=busy?label:`Continue with ${selectedPurchasePlan}`}
  if(restoreButton)restoreButton.disabled=busy;
  if(status){status.hidden=!busy;if(busy)status.textContent=label}
}
function renderPremiumState(){const premium=isPremium();const labels=[['#premiumUpgrade','Unlock premium'],['#heroUpgrade','Start premium']];labels.forEach(([sel,label])=>{const b=$(sel);if(b){b.textContent=premium?'Premium is active':label;b.disabled=premium}});const freeButton=$('.plan-card:not(.featured) .outline-btn');if(freeButton)freeButton.textContent=premium?'Free plan available':'Current free plan';const badge=$('#buyChecksBadge');if(badge)badge.textContent=premium?'Unlimited premium checks':`${Math.max(0,3-freeChecksUsed())} free checks left this week`;const continueButton=$('#premiumContinue');if(continueButton)continueButton.disabled=premium;renderStoreProducts()}
async function completePremiumPurchase(){
  if(!currentUser())return;
  if(isPremium())return toast('Premium is already active.');
  const plugin=storePlugin();
  if(!plugin?.purchase)return toast('Premium purchases are available in the iOS app.');
  setPurchaseBusy(true,'Opening the App Store…');
  try{
    const result=await plugin.purchase({plan:selectedPurchasePlan});
    if(result?.status==='cancelled')return toast('Purchase canceled. Nothing was charged.');
    if(result?.status==='pending')return toast('Purchase pending approval. Premium will unlock after Apple approves it.');
    if(!result?.active)throw new Error('The App Store did not return an active subscription.');
    applyStoreEntitlement(result);
    closePremium();
    toast('Premium unlocked. Let us boss the budget around.');
  }catch(err){toast(err?.message||'Purchase could not be completed.')}finally{setPurchaseBusy(false)}
}
async function restorePremium(){
  const plugin=storePlugin();
  if(!plugin?.restore)return toast(isPremium()?'Premium is already active.':'Restore Purchases is available in the iOS app.');
  setPurchaseBusy(true,'Checking Apple purchases…');
  try{const result=await plugin.restore();if(applyStoreEntitlement(result)){closePremium();toast('Premium purchase restored.');return}toast('No active TallyHo Premium purchase was found for this Apple ID.')}catch(err){toast(err?.message||'Restore could not be completed.')}finally{setPurchaseBusy(false)}
}
function weekKey(d=new Date()){const s=sunday(d);return dateISO(s)}
function freeChecksUsed(){return state.buyHistory.filter(x=>x.weekKey===weekKey()).length}
function purchasePeriod(cadence){const today=startOfDay(new Date()),week=sunday(today);if(cadence==='biweekly'){const anchor=new Date(2020,0,5,12),blocks=Math.floor(diffDays(anchor,week)/14),start=addDays(anchor,blocks*14);return{start,end:addDays(start,14),label:`${dateLabel(start)} - ${dateLabel(addDays(start,13))}`}}return{start:week,end:addDays(week,7),label:`${dateLabel(week)} - ${dateLabel(addDays(week,6))}`}}
function evaluatePurchase(name,amount,cadence,priority){const p=purchasePeriod(cadence),s=splitCashSummary(p.start,p.end),income=s.income,outflow=s.outflow,carried=cashBalanceBefore(p.start),base=cents(carried+income-outflow),guardRate=Math.max(0,Math.min(50,Number(state.settings.purchaseGuardPercent)||15))/100,guard=cents(Math.max(income,base,0)*guardRate),safe=cents(Math.max(0,base-guard)),after=cents(base-amount);let verdict=amount<=safe?'yes':amount<=base?'tight':'no';if(priority==='need'&&verdict==='tight')verdict='yes';const title=verdict==='yes'?'Yes, this fits the plan.':verdict==='tight'?'Technically yes. Future you is raising an eyebrow.':'Not this pay period.';const copy=verdict==='yes'?`You can cover ${money(amount)} and still keep ${money(Math.max(0,after))} after planned money moves.`:verdict==='tight'?`It fits before the safety buffer, but leaves only ${money(Math.max(0,after))}. Waiting would be the calmer choice.`:`You are short ${money(Math.abs(after))} after planned income, bills, savings, and reserves.`;return{id:uid('buy'),name,amount:cents(amount),cadence,priority,verdict,title,copy,available:base,safe,after,period:p.label,checkedAt:new Date().toISOString(),weekKey:weekKey()}}
function renderBuyVerdict(item){const box=$('#buyVerdict');if(!item){box.className='panel buy-verdict empty-verdict';box.innerHTML='<div class="verdict-icon">?</div><p class="eyebrow">TALLYHO VERDICT</p><h2>Enter a price to check it.</h2>';return}const icon=item.verdict==='yes'?'✓':item.verdict==='tight'?'!':'×';box.className=`panel buy-verdict ${item.verdict}`;box.innerHTML=`<div class="verdict-icon">${icon}</div><p class="eyebrow">${esc(item.name)} · ${esc(item.period)}</p><h2>${esc(item.title)}</h2><p>${esc(item.copy)}</p><div class="verdict-math"><div><span>Available before purchase</span><strong>${money(item.available)}</strong></div><div><span>Protected safety amount</span><strong>${money(Math.max(0,item.available-item.safe))}</strong></div><div><span>Left after purchase</span><strong>${money(item.after)}</strong></div></div>`}
function renderCanBuy(){const list=state.buyHistory.slice().sort((a,b)=>String(b.checkedAt).localeCompare(String(a.checkedAt))).slice(0,12);$('#buyHistory').innerHTML=list.length?list.map(x=>`<div class="buy-history-row"><div><strong>${esc(x.name)}</strong><small>${formatDate(new Date(x.checkedAt),{dateStyle:'short'})} · ${esc(x.cadence)} check</small></div><b>${money(x.amount)}</b><span class="verdict-tag ${x.verdict}">${x.verdict==='yes'?'Buy it':x.verdict==='tight'?'Tight':'Wait'}</span></div>`).join(''):'<div class="empty-state">No purchase checks yet. Your cart is behaving, for now.</div>';renderPremiumState()}
function bindAppStoreFeatures(){
  if(window.__appStoreBound)return;
  window.__appStoreBound=true;
  console.info(`TallyHo StoreKit bridge: ${storePlugin()?'available':'unavailable'}`);
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
    $$('[data-purchase-plan]').forEach(x=>{const selected=x===b;x.classList.toggle('selected',selected);x.setAttribute('aria-pressed',String(selected))});
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
