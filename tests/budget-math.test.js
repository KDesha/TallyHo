const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function appContext() {
  const storage = new Map();
  const context = vm.createContext({
    Blob,
    Date,
    Intl,
    Math,
    Number,
    Object,
    String,
    TextDecoder,
    TextEncoder,
    URL,
    clearTimeout,
    confirm: () => false,
    console,
    crypto: globalThis.crypto,
    devicePixelRatio: 1,
    document: { addEventListener() {}, readyState: 'loading' },
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      removeItem(key) { storage.delete(key); },
      setItem(key, value) { storage.set(key, String(value)); }
    },
    navigator: { language: 'en-US', languages: ['en-US'] },
    setTimeout,
    structuredClone,
    window: { addEventListener() {} }
  });
  const source = fs.readFileSync(path.join(__dirname, '..', 'www', 'app.js'), 'utf8');
  vm.runInContext(source, context, { filename: 'www/app.js' });
  return expression => vm.runInContext(expression, context);
}

test('monthly split shares use exact four-week and two-paycheck math', () => {
  const evaluate = appContext();
  assert.equal(evaluate(`splitReserveAmount({amount:800,repeat:{every:1,unit:'months'}},'weekly',new Date(2026,7,1,12))`), 200);
  assert.equal(evaluate(`splitReserveAmount({amount:800,repeat:{every:1,unit:'months'}},'biweekly',new Date(2026,7,1,12))`), 400);
});

test('split distributions preserve every cent of the bill', () => {
  const evaluate = appContext();
  const result = JSON.parse(evaluate(`JSON.stringify(splitMonthRows({
    id:'bill',type:'payment',name:'Bill',amount:800,date:'2026-08-10',
    repeat:{every:1,unit:'months'},splitPlan:{enabled:true,cadence:'biweekly'}
  },new Date(2026,7,1,12)).map(row=>({amount:row.amount,date:row.occurrenceDate})))`));
  assert.deepEqual(result, [
    { amount: 400, date: '2026-08-01' },
    { amount: 400, date: '2026-08-15' }
  ]);
  assert.equal(result.reduce((sum, row) => sum + row.amount, 0), 800);
});

test('August 2026 calendar map clips the first and last weeks to the month', () => {
  const evaluate = appContext();
  const ranges = JSON.parse(evaluate(`JSON.stringify(moneyMapWeekRanges(new Date(2026,7,1,12)).map(range=>({
    start:dateISO(range.start),end:dateISO(range.end),tag:range.tag
  })))`));
  assert.equal(ranges.length, 6);
  assert.deepEqual(ranges[0], { start: '2026-08-01', end: '2026-08-02', tag: 'last week' });
  assert.deepEqual(ranges[5], { start: '2026-08-30', end: '2026-09-01', tag: 'next week' });
});

test('biweekly calendar map always starts on the first', () => {
  const evaluate = appContext();
  const ranges = JSON.parse(evaluate(`JSON.stringify(moneyMapBiweekRanges(new Date(2026,7,1,12)).map(range=>({
    start:dateISO(range.start),end:dateISO(range.end),tag:range.tag
  })))`));
  assert.deepEqual(ranges, [
    { start: '2026-08-01', end: '2026-08-15', tag: '' },
    { start: '2026-08-15', end: '2026-08-29', tag: '' },
    { start: '2026-08-29', end: '2026-09-01', tag: 'next week' }
  ]);
});

test('weekend income moves backward and weekend payments move forward', () => {
  const evaluate = appContext();
  const saturday = JSON.parse(evaluate(`JSON.stringify({
    income:dateISO(effectiveBusinessDate({type:'income'},new Date(2026,7,1,12))),
    payment:dateISO(effectiveBusinessDate({type:'payment'},new Date(2026,7,1,12)))
  })`));
  assert.deepEqual(saturday, { income: '2026-07-31', payment: '2026-08-03' });

  const sunday = JSON.parse(evaluate(`JSON.stringify({
    income:dateISO(effectiveBusinessDate({type:'income'},new Date(2026,7,2,12))),
    payment:dateISO(effectiveBusinessDate({type:'payment'},new Date(2026,7,2,12)))
  })`));
  assert.deepEqual(sunday, { income: '2026-07-31', payment: '2026-08-03' });

  const monday = JSON.parse(evaluate(`JSON.stringify({
    income:dateISO(effectiveBusinessDate({type:'income'},new Date(2026,7,3,12))),
    payment:dateISO(effectiveBusinessDate({type:'payment'},new Date(2026,7,3,12)))
  })`));
  assert.deepEqual(monday, { income: '2026-08-03', payment: '2026-08-03' });
});

test('business-day shifts cross month boundaries exactly once', () => {
  const evaluate = appContext();
  const income = `{id:'income',type:'income',name:'Pay',amount:1000,date:'2026-08-01',repeat:null}`;
  assert.deepEqual(JSON.parse(evaluate(`JSON.stringify(occurrences(${income},new Date(2026,6,1,12),new Date(2026,7,1,12)).map(x=>x.occurrenceDate))`)), ['2026-07-31']);
  assert.deepEqual(JSON.parse(evaluate(`JSON.stringify(occurrences(${income},new Date(2026,7,1,12),new Date(2026,8,1,12)).map(x=>x.occurrenceDate))`)), []);

  const payment = `{id:'payment',type:'payment',name:'Bill',amount:100,date:'2026-05-31',repeat:null}`;
  assert.deepEqual(JSON.parse(evaluate(`JSON.stringify(occurrences(${payment},new Date(2026,4,1,12),new Date(2026,5,1,12)).map(x=>x.occurrenceDate))`)), []);
  assert.deepEqual(JSON.parse(evaluate(`JSON.stringify(occurrences(${payment},new Date(2026,5,1,12),new Date(2026,6,1,12)).map(x=>x.occurrenceDate))`)), ['2026-06-01']);
});

test('monthly recurrence remains anchored to its original calendar day', () => {
  const evaluate = appContext();
  const rows = JSON.parse(evaluate(`JSON.stringify(occurrences({
    id:'bill',type:'payment',name:'Month end',amount:100,date:'2026-01-31',repeat:{every:1,unit:'months'}
  },new Date(2026,0,1,12),new Date(2026,3,1,12)).map(x=>({scheduled:x.scheduledOccurrenceDate,effective:x.occurrenceDate})))`));
  assert.deepEqual(rows, [
    { scheduled: '2026-01-31', effective: '2026-02-02' },
    { scheduled: '2026-02-28', effective: '2026-03-02' },
    { scheduled: '2026-03-31', effective: '2026-03-31' }
  ]);
});

test('weekly and yearly recurrence calculate each weekend shift from the nominal date', () => {
  const evaluate = appContext();
  const weekly = JSON.parse(evaluate(`JSON.stringify(occurrences({
    id:'pay',type:'income',name:'Weekly pay',amount:100,date:'2026-08-01',repeat:{every:1,unit:'weeks'}
  },new Date(2026,6,1,12),new Date(2026,7,16,12)).map(x=>({scheduled:x.scheduledOccurrenceDate,effective:x.occurrenceDate})))`));
  assert.deepEqual(weekly.slice(0, 3), [
    { scheduled: '2026-08-01', effective: '2026-07-31' },
    { scheduled: '2026-08-08', effective: '2026-08-07' },
    { scheduled: '2026-08-15', effective: '2026-08-14' }
  ]);

  const yearly = JSON.parse(evaluate(`JSON.stringify(occurrences({
    id:'annual',type:'income',name:'Annual income',amount:100,date:'2026-08-01',repeat:{every:1,unit:'years'}
  },new Date(2026,6,1,12),new Date(2027,7,2,12)).map(x=>({scheduled:x.scheduledOccurrenceDate,effective:x.occurrenceDate})))`));
  assert.deepEqual(yearly, [
    { scheduled: '2026-08-01', effective: '2026-07-31' },
    { scheduled: '2027-08-01', effective: '2027-07-30' }
  ]);
});

test('Home period follows weekly, biweekly, and monthly settings', () => {
  const evaluate = appContext();
  const periods = JSON.parse(evaluate(`JSON.stringify(['weekly','biweekly','monthly'].map(cadence=>{
    const period=homePeriodFor(new Date(2026,7,3,12),cadence);
    return{cadence,start:dateISO(period.start),end:dateISO(period.end),kind:period.kind};
  }))`));
  assert.deepEqual(periods, [
    { cadence: 'weekly', start: '2026-08-02', end: '2026-08-09', kind: 'Current week' },
    { cadence: 'biweekly', start: '2026-08-02', end: '2026-08-16', kind: 'Current 2 weeks' },
    { cadence: 'monthly', start: '2026-08-01', end: '2026-09-01', kind: 'Current month' }
  ]);
});
