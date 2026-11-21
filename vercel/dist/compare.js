const byId = id => document.getElementById(id);
const reports = {baseline: null, candidate: null};
const revisions = {baseline: 0, candidate: 0};
const pageSize = 50;
let sourceVersion = 0;
let findings = [];
let page = 0;

function parseReport(xml) {
  if (/<!DOCTYPE/i.test(xml)) throw Error('Please export XML without a document type declaration.');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror') || !['testsuite', 'testsuites'].includes(doc.documentElement.localName)) {
    throw Error('Expected a JUnit testsuite or testsuites XML document.');
  }
  const cases = doc.getElementsByTagNameNS('*', 'testcase');
  if (cases.length > 10000) throw Error('The report exceeds 10,000 cases.');
  const result = new Map();
  for (const test of cases) {
    const name = test.getAttribute('name');
    if (!name?.trim()) throw Error('Every test case needs a name.');
    const suites = [];
    for (let parent = test.parentElement; parent; parent = parent.parentElement) {
      if (parent.localName === 'testsuite') suites.unshift(parent.getAttribute('name') || '');
    }
    const className = test.getAttribute('classname') || '';
    const key = JSON.stringify([suites, className, name]);
    if (result.has(key)) throw Error('Duplicate test identity: ' + name + '. Export distinct case names to compare these results.');
    const markers = Array.from(test.children, child => child.localName);
    const outcome = ['error','failure','skipped'].find(marker => markers.includes(marker)) || 'passed';
    result.set(key, {name, suites, className, outcome});
  }
  return result;
}

const isFailure = outcome => outcome === 'failure' || outcome === 'error';
function classify(before, after) {
  if (!after) return 'Missing in candidate';
  if (!before) return isFailure(after) ? 'Added with failure' : 'Added test';
  if (after === 'skipped' && before !== after) return 'Now skipped';
  if (isFailure(after)) return isFailure(before) ? 'Still failing' : 'New failure';
  if (isFailure(before) && after === 'passed') return 'Recovered';
  return before === after ? 'Unchanged' : 'Now passing';
}

function compare() {
  const {baseline, candidate} = reports;
  page = 0;
  findings = [];
  byId('changes').hidden = !(baseline && candidate);
  if (!baseline || !candidate) return;
  const keys = new Set([...baseline.cases.keys(), ...candidate.cases.keys()]);
  for (const key of keys) {
    const first = baseline.cases.get(key);
    const second = candidate.cases.get(key);
    const {name, suites, className} = first || second;
    findings.push({name, suites, className, baseline: first?.outcome || null,
      candidate: second?.outcome || null, finding: classify(first?.outcome, second?.outcome)});
  }
  const counts = new Map();
  for (const row of findings) counts.set(row.finding, (counts.get(row.finding) || 0) + 1);
  byId('totals').textContent = Array.from(counts, ([label, count]) => label + ' (' + count + ')').join(' · ') || 'Both reports contain zero test cases.';
  byId('message').textContent = baseline.label + ' → ' + candidate.label;
  render();
}

function render() {
  const visible = byId('filter').value === 'all' ? findings : findings.filter(row => row.finding !== 'Unchanged');
  const start = page * pageSize;
  const body = byId('rows');
  body.replaceChildren();
  for (const item of visible.slice(start, start + pageSize)) {
    const row = body.insertRow();
    const title = row.insertCell();
    title.textContent = item.name;
    const detail = document.createElement('small');
    detail.textContent = [...item.suites, item.className].filter(Boolean).join(' / ');
    title.append(detail);
    for (const text of [item.baseline, item.candidate, item.finding]) row.insertCell().textContent = text || 'Absent';
  }
  byId('range').textContent = visible.length ? (start + 1) + '–' + Math.min(start + pageSize, visible.length) + ' of ' + visible.length : 'No tests in this view.';
  byId('previous').disabled = page === 0;
  byId('next').disabled = start + pageSize >= visible.length;
}

for (const side of Object.keys(reports)) {
  byId(side).onchange = async event => {
    sourceVersion++;
    byId('actions-status').replaceChildren();
    const revision = ++revisions[side];
    const file = event.target.files[0];
    reports[side] = null;
    compare();
    if (!file) { byId('message').textContent = 'Choose both reports.'; return; }
    try {
      if (file.size > 5 * 1024 * 1024) throw Error('The file exceeds 5 MiB.');
      const xml = await file.text();
      if (revisions[side] !== revision) return;
      reports[side] = {label: file.name, cases: parseReport(xml)};
      byId('message').textContent = file.name + ' loaded. Choose the other report.';
      compare();
    } catch (error) {
      if (revisions[side] === revision) byId('message').textContent = side + ' report: ' + error.message;
    }
  };
}
byId('example').onclick = () => {
  sourceVersion++;
  byId('actions-status').replaceChildren();
  const sample = {
    baseline: '<testcase name="Shipping threshold"/><testcase name="Coupon rounding"><failure/></testcase><testcase name="Guest cart"/>',
    candidate: '<testcase name="Shipping threshold"><failure/></testcase><testcase name="Coupon rounding"/><testcase name="Refund"><skipped/></testcase>'
  };
  for (const side of Object.keys(reports)) {
    revisions[side]++;
    byId(side).value = '';
    reports[side] = {label: 'Example ' + side, cases: parseReport('<testsuite name="Checkout">' + sample[side] + '</testsuite>')};
  }
  compare();
};
byId('filter').onchange = () => { page = 0; render(); };
let signedIn = false;
async function loadLogin() {
  const response = await fetch('/api/actions/session',{cache:'no-store'});
  if (!response.ok) return;
  const session = await response.json();
  signedIn = session.connected;
  byId('github-login').hidden = signedIn || !session.configured;
  byId('github-logout').hidden = !signedIn;
  byId('token-option').hidden = signedIn;
  if (!session.configured) {
    byId('token-option').open = true;
    byId('actions-status').textContent = 'GitHub sign-in is awaiting app configuration. Token access is available.';
  } else if (signedIn) {
    byId('actions-status').textContent = 'Signed in with GitHub.';
  } else if (new URLSearchParams(location.search).get('github') === 'retry') {
    byId('actions-status').textContent = 'GitHub sign-in did not finish. Please try again.';
  }
}
loadLogin().catch(() => {});
byId('actions-form').onsubmit = async event => {
  event.preventDefault();
  const version = ++sourceVersion;
  const status = byId('actions-status');
  const button = event.target.querySelector('button');
  const token = byId('actions-token').value.trim();
  if (!signedIn && !token) {
    if (!byId('github-login').hidden) location.assign('/api/actions/login');
    else byId('actions-token').focus();
    return;
  }
  byId('actions-token').value = '';
  button.disabled = true;
  for (const side of Object.keys(reports)) {
    revisions[side]++;
    reports[side] = null;
    byId(side).value = '';
  }
  compare();
  byId('message').textContent = '';
  status.textContent = 'Reading the two most recent completed runs…';
  try {
    const response = await fetch('/api/actions/compare', {
      method:'POST', headers:token ? {Authorization:'Bearer ' + token} : {}, cache:'no-store'
    });
    const pair = await response.json();
    if (version !== sourceVersion) return;
    if (!response.ok) {
      if (response.status === 401 && signedIn) await loadLogin();
      throw Error(pair.error || 'GitHub comparison is unavailable.');
    }
    const parsed = {};
    for (const side of Object.keys(reports)) {
      parsed[side] = {label:pair[side].label, cases:parseReport(pair[side].xml)};
    }
    Object.assign(reports, parsed);
    status.replaceChildren();
    for (const side of ['baseline','candidate']) {
      const link = document.createElement('a');
      link.href = 'https://github.com/kallurayaankit/release-radar/actions/runs/' + pair[side].id;
      link.textContent = side + ' · ' + pair[side].label;
      status.append(link, ' ');
    }
    compare();
    byId('changes').scrollIntoView({block:'start'});
  } catch (error) {
    if (version === sourceVersion) status.textContent = error.message;
  } finally { button.disabled = false; }
};
byId('previous').onclick = () => { page--; render(); };
byId('next').onclick = () => { page++; render(); };
byId('download').onclick = () => {
  const report = {baseline: reports.baseline.label, candidate: reports.candidate.label, tests: findings};
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], {type:'application/json'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'releaseradar-run-comparison.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
