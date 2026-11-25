import {SaxesParser} from 'saxes';
import {classify} from '../dist/run-classification.js';

// Project only test identities and JUnit outcomes. Discard logs and failure bodies.
export function readCases(xml) {
  const parser = new SaxesParser({xmlns:true});
  const suites = [], stack = [], result = new Map();
  const priority = ['passed','skipped','failure','error'];
  let current;
  parser.on('doctype', () => { throw Error('DTD declarations are unsupported.'); });
  parser.on('opentag', tag => {
    const type = tag.local, name = tag.attributes.name?.value || '';
    if (!stack.length && !['testsuite','testsuites'].includes(type)) throw Error('Expected a JUnit XML report.');
    if (stack.length > 64 || name.length > 500) throw Error('Report exceeds nesting or identity limits.');
    if (type === 'testsuite') suites.push(name);
    if (type === 'testcase') {
      if (current || !name.trim() || result.size >= 10000) throw Error('Invalid or oversized test collection.');
      const className = tag.attributes.classname?.value || '';
      const key = JSON.stringify([suites,className,name]);
      if (key.length > 1200 || result.has(key)) throw Error('Oversized or duplicate test identity.');
      current = {name,className,suites:[...suites],outcome:'passed'};
      if (tag.attributes.file?.value) current.file = tag.attributes.file.value.replaceAll('\\','/');
      result.set(key,current);
    } else if (current && stack.at(-1) === 'testcase' && priority.indexOf(type) > priority.indexOf(current.outcome)) {
      current.outcome = type;
    }
    stack.push(type);
  });
  parser.on('closetag', tag => {
    if (tag.local === 'testsuite') suites.pop();
    if (tag.local === 'testcase') current = null;
    stack.pop();
  });
  parser.on('error', () => { throw Error('Malformed XML.'); });
  parser.write(xml).close();
  return result;
}

export function compareReports(baseline, candidate, {offset=0,limit=25,changesOnly=true}={}) {
  const rows = [], counts = {};
  let matching = 0;
  for (const key of new Set([...baseline.keys(),...candidate.keys()])) {
    const before = baseline.get(key), after = candidate.get(key);
    const finding = classify(before?.outcome,after?.outcome);
    counts[finding] = (counts[finding] || 0) + 1;
    if (changesOnly && finding === 'Unchanged') continue;
    if (matching++ < offset || rows.length >= limit) continue;
    const {suites,className,name} = before || after;
    rows.push({suites,className,name,baseline:before?.outcome || null,candidate:after?.outcome || null,finding});
  }
  return {baselineCases:baseline.size,candidateCases:candidate.size,counts,matching,rows,
    nextOffset:offset+rows.length < matching ? offset+rows.length : null};
}

// Only compare literal declarations in the same unified-diff hunk. Fuzzy names,
// context lines, comments, and changes in unrelated hunks do not establish a rename.
function declarationHunks(diff) {
  const hunks = [];
  let file, hunk;
  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith('diff --git ') || line.startsWith('--- ')) { file = null; hunk = null; }
    if (line.startsWith('+++ ')) {file = line.slice(4,504); hunk = null;}
    if (file && /^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/.test(line)) {
      hunk = {file,location:line.split('@@')[1].trim(),removed:[],added:[]};
      hunks.push(hunk);
    }
    const match = /^([+-])\s*(?:test|it)\(\s*(["'])([^"'\\]{1,500})\2\s*,/.exec(line);
    if (hunk && match) hunk[match[1] === '-' ? 'removed' : 'added'].push(match[3]);
  }
  return hunks;
}

function sameReportSlot(a,b) {
  // Some reporters include both a project and a source file in their suite path.
  // Keep both anchors. Middle labels and title capitalization may change.
  const file = a.suites.at(-1);
  return a.suites.length >= 2 && a.suites.length === b.suites.length &&
    /\.[\w]+$/.test(file) && file === b.suites.at(-1) &&
    a.suites[0].toLowerCase() === b.suites[0].toLowerCase() &&
    a.className === b.className && a.name.toLowerCase() === b.name.toLowerCase();
}

export function investigate(baseline,candidate,identity,diff='',runnerReport) {
  const key = JSON.stringify([identity.suites,identity.className,identity.name]);
  const before = baseline.get(key), after = candidate.get(key);
  if (!before || after) throw Error('Choose an exact identity present only in the baseline report.');
  const facts = {identity,baseline:before.outcome,candidate:'absent'};
  const unknown = {...facts,assessment:'unresolved',evidence:[],nextCheck:'Inspect the test selection, shard completion and reporting configuration for this run.'};
  const matches = [...candidate.entries()].filter(([,row])=>sameReportSlot(identity,row));
  if (matches.length === 1 && !baseline.has(matches[0][0]) &&
      [...baseline.values()].filter(row=>sameReportSlot(identity,row)).length === 1) {
    const {suites,className,name} = matches[0][1];
    return {...facts,assessment:'possible report relabel',candidateIdentity:{suites,className,name},evidence:[],
      nextCheck:'Compare suite labels and test declarations in both revisions to verify this correspondence.'};
  }
  if (runnerReport) {
    const fileOf = row => row.file || (/\.(?:[cm]?[jt]sx?|py|java|cs|rb|go)$/.test(row.className) ? row.className.replaceAll('\\','/') : row.suites.at(-1));
    const file = fileOf(before);
    const sameFile = path => path === file || (!file?.includes('/') && path.split('/').at(-1) === file);
    const rows = runnerReport.rows.filter(row=>row.name===identity.name && sameFile(row.file));
    const sources = new Set(rows.map(row=>JSON.stringify([row.file,row.project,row.line,row.column,row.suitePath])));
    const possible = [...baseline.values()].filter(row=>row.name===identity.name && fileOf(row)===file);
    if (rows.length && sources.size === 1 && possible.length === 1 &&
        ![...candidate.values()].some(row=>row.name===identity.name && fileOf(row)===file)) {
      return {...facts,assessment:'matching runner result',evidence:[],runnerMatch:{ref:runnerReport.ref,
        file:rows[0].file,project:rows[0].project,observations:rows.length,outcomes:[...new Set(rows.map(row=>row.outcome))]},
        nextCheck:'Verify the supplied runner report belongs to the candidate run and inspect reporter filters for this file and title.'};
    }
  }
  if ([...baseline.values()].filter(row=>row.name===identity.name).length !== 1) return unknown;
  const hits = declarationHunks(diff).filter(h=>h.removed.includes(identity.name));
  if (hits.length !== 1) return unknown;
  const [hit] = hits;
  const evidence = [{file:hit.file,hunk:hit.location,removedDeclaration:identity.name}];
  if (hit.removed.length === 1 && hit.added.length === 1) {
    const newName = hit.added[0];
    const newKey = JSON.stringify([identity.suites,identity.className,newName]);
    if (!baseline.has(newKey) && candidate.has(newKey)) {
      return {...facts,assessment:'possible rename',candidateName:newName,evidence,
        nextCheck:'Review the two test bodies in this hunk to confirm they exercise the same behavior.'};
    }
  }
  return {...facts,assessment:'declaration removal observed',evidence,
    nextCheck:'Check for moved or replacement coverage before concluding the behavior lost coverage.'};
}
