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

export function investigate(baseline,candidate,identity,diff='') {
  const key = JSON.stringify([identity.suites,identity.className,identity.name]);
  const before = baseline.get(key), after = candidate.get(key);
  if (!before || after) throw Error('Choose an exact identity present only in the baseline report.');
  const facts = {identity,baseline:before.outcome,candidate:'absent'};
  const unknown = {...facts,assessment:'unresolved',evidence:[],nextCheck:'Inspect the test selection, shard completion and reporting configuration for this run.'};
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
