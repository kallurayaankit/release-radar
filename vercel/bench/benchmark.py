"""Replay frozen public reports against Git, difflib, and ReleaseRadar. Stdlib only."""
import argparse
import base64
from collections import Counter
import difflib
import io
import json
from pathlib import Path
import re
import subprocess
import tempfile
import xml.etree.ElementTree as ET
import zipfile

HERE = Path(__file__).resolve().parent
REPO = 'https://github.com/ella79/agentic-playwright-suite'
WINDOWS = [('279ee2ab4044eb08a4b6d2895736e7c7815b30e7',186,247),
           ('cfd20eb1addf3a4f5456fd111d32b1339fc51dd6',470,556)]


def leaves(tree, parents=()):
    if 'children' in tree:
        for child in tree['children']:
            yield from leaves(child, parents + (tree['name'],))
    else:
        yield (parents[1:], tree['name']), tree['status']


def junit(rows):
    root = ET.Element('testsuites')
    for (suites, title), status in rows.items():
        parent = root
        for suite in suites:
            parent = ET.SubElement(parent,'testsuite',name=suite)
        case = ET.SubElement(parent,'testcase',name=title)
        if status != 'passed':
            ET.SubElement(case,{'skipped':'skipped','failed':'failure','broken':'error'}[status])
    return ET.tostring(root,encoding='unicode')


def runner_rows(path):
    payload = re.findall(r'data:application/zip;base64,([A-Za-z0-9+/=]+)',path.read_text('utf8'))[-1]
    with zipfile.ZipFile(io.BytesIO(base64.b64decode(payload))) as archive:
        rows = []
        for file in json.loads(archive.read('report.json'))['files']:
            for case in json.loads(archive.read(file['fileId']+'.json'))['tests']:
                for attempt in case['results']:
                    rows.append(dict(file=file['fileName'],name=case['title'],project=case['projectName'],outcome=attempt['status']))
        return rows


def text_key(key):
    return json.dumps(key,ensure_ascii=False)


def matrix_missing(before,after,tmp):
    from junit2htmlreport.matrix import ReportMatrix
    matrix = ReportMatrix()
    for name,rows in [('before.xml',before),('after.xml',after)]:
        # The matrix uses classname + title; preserve the full original suite path in classname.
        root = ET.Element('testsuite',name='Allure')
        for (suites,title),status in rows.items():
            case = ET.SubElement(root,'testcase',classname=json.dumps(suites),name=title)
            if status!='passed':
                ET.SubElement(case,{'skipped':'skipped','failed':'failure','broken':'error'}[status])
        path = tmp/name
        ET.ElementTree(root).write(path,encoding='utf-8')
        matrix.add_report(str(path))
    return {(tuple(json.loads(group)),title) for group,col in matrix.cases.items()
            for title,seen in col.items() if 'before.xml' in seen and 'after.xml' not in seen}


def git_missing(before, after, tmp):
    for rows, name in [(before,'before'),(after,'after')]:
        (tmp/name).write_text(''.join(k+'\n' for k in sorted(map(text_key,rows))),encoding='utf8')
    run = subprocess.run(['git','-c','core.autocrlf=false','diff','--no-index','--no-ext-diff',
                          '--no-color','-U0','before','after'],cwd=tmp,capture_output=True)
    if run.returncode not in (0,1):
        raise RuntimeError(run.stderr.decode())
    return {line[1:] for line in run.stdout.decode().splitlines() if line.startswith('-[')}


def oracle(pair, key, after, observations):
    # Independently use the upstream TC/VR plan identifiers and browser, not title similarity.
    if pair in ('189-191','197-202'):
        suites,name = key
        case_id = re.match(r'^(TC|VR)-\d+:',name)[0]
        project = suites[0].split(' · ')[-1]
        matches = [k for k in after if k[1].startswith(case_id) and k[0][0].endswith(' · '+project)]
        assert len(matches) == 1
        return 'possible report relabel', text_key(matches[0])
    if pair in ('245-247','529-541'):
        assert key[1]=='authenticate'
        assert {(r['file'],r['project'],r['outcome']) for r in observations if r['name']=='authenticate'} == {
            ('utils/setup/login.setup.ts','setup','passed')}
        return 'matching runner result',None
    return None,None


def assess(result, expected, target):
    if result['assessment']=='unresolved':
        return 'abstained'
    if result['assessment']=='declaration removal observed' and expected=='possible report relabel':
        return 'partial (removed literal only)'
    if result['assessment'] != expected:
        return 'incorrect'
    if target:
        row = result['candidateIdentity']
        if text_key((row['suites'],row['name'])) != target:
            return 'incorrect'
    elif set(result['runnerMatch']['outcomes']) != {'passed'}:
        return 'incorrect'
    return 'correct'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('cache',type=Path)
    parser.add_argument('--exercise-data',type=Path)
    parser.add_argument('--junit2html',action='store_true',help='Also run the pinned junit2html matrix comparator')
    args = parser.parse_args()
    jobs, gold, tasks, pair_ids = [], [], [], []
    detected = Counter()
    scores = {name:Counter() for name in ('previous','current','difflib')}
    with tempfile.TemporaryDirectory() as directory:
        for rev,lo,hi in WINDOWS:
            history = json.loads((args.cache/('history-'+rev+'.json')).read_text('utf8'))
            runs = list({r['runUrl']:r for r in history if r['branch']=='main' and lo<=r['run']<=hi}.values())
            for a,b in zip(runs,runs[1:]):
                pair = f"{a['run']}-{b['run']}"
                pair_ids.append(pair)
                before,after = [dict(leaves(json.loads((args.cache/f"{r['run']}.json").read_text('utf8')))) for r in (a,b)]
                missing, added = sorted(before.keys()-after.keys()), sorted(after.keys()-before.keys())
                assert git_missing(before,after,Path(directory)) == set(map(text_key,missing))
                if args.junit2html:
                    assert matrix_missing(before,after,Path(directory)) == set(missing)
                queries, labels = [], []
                job = dict(before=junit(before),after=junit(after),queries=queries)
                assert max(len(job['before']),len(job['after']))<=80000
                jobs.append(job)
                gold.append(labels)
                detected[pair] = len(missing)
                if not missing:
                    continue
                patches = re.split(r'(?=^diff --git )',(args.cache/(pair+'.diff')).read_text('utf8'),flags=re.M)
                observations = runner_rows(args.cache/f"{b['run']}.html")
                ref = f"https://ella79.github.io/agentic-playwright-suite/runs/{b['run']}/playwright-report/"
                for key in missing:
                    suites,title = key
                    # Bound the patch submitted to MCP. Include the specific source file and label fixture first.
                    focused = [p for p in patches if p and any(x in p.splitlines()[0] for x in ('/'+suites[-1],'allureLabels.ts'))]
                    diff = ''.join(focused+[p for p in patches if p not in focused])[:50000]
                    runner = dict(ref=ref,rows=[r for r in observations if r['name']==title])
                    queries.append(dict(identity=dict(suites=suites,className='',name=title),diff=diff,runnerReport=runner))
                    expected,target = oracle(pair,key,after,observations)
                    labels.append((expected,target))
                    if expected:
                        closest = difflib.get_close_matches(text_key(key),list(map(text_key,added)),n=1,cutoff=0.6)
                        scores['difflib']['abstained' if not closest else 'correct' if closest[0]==target else 'incorrect'] += 1
                    if (pair=='197-202' and title.startswith('VR-14:')) or pair=='529-541':
                        base = 'https://raw.githubusercontent.com/ella79/agentic-playwright-suite/'+rev+'/runs/'
                        def title_rows(report):
                            return [dict(suites=k[0],title=k[1],outcome=v) for k,v in report.items() if k[1]==title]
                        tasks.append(dict(pair=pair,index=len(jobs)-1,row=len(queries)-1,title=title,suites=suites,
                                          records={'Earlier Allure':title_rows(before),'Later Allure':title_rows(after),
                                                   'Later Playwright attempts':runner['rows']},
                                          links={'Earlier Actions run':a['runUrl'],'Later Actions run':b['runUrl'],
                                          'Earlier Allure identities':base+str(a['run'])+'/data/suites.json',
                                          'Later Allure identities':base+str(b['run'])+'/data/suites.json',
                                          'Source comparison':REPO+f"/compare/{a['commit']}...{b['commit']}",
                                          'Archived Playwright HTML':REPO+f"/blob/{rev}/runs/{b['run']}/playwright-report/index.html"}))
    result = json.loads(subprocess.run(['node',str(HERE/'replay.mjs')],input=json.dumps(jobs).encode(),
                                       stdout=subprocess.PIPE,check=True).stdout)
    for version,data in result.items():
        for pair,output,labels in zip(pair_ids,data['pairs'],gold,strict=True):
            assert output['count']==detected[pair]
            for answer,(expected,target) in zip(output['missing'],labels,strict=True):
                if expected:
                    scores[version][assess(answer,expected,target)] += 1
                else:
                    scores[version]['unscored / '+answer['assessment']] += 1
    if args.exercise_data:
        for t in tasks:
            t['assistant'] = result['current']['pairs'][t.pop('index')]['missing'][t.pop('row')]
        assert len(tasks)==2
        args.exercise_data.write_text('const tasks = '+json.dumps(tasks,indent=2,ensure_ascii=False)+';\n',encoding='utf8')
    print(json.dumps(dict(pairs=len(jobs),missing=sum(detected.values()),junit2html_checked=args.junit2html,affected={k:v for k,v in detected.items() if v},
                         scores=scores,engine_ms={v:round(d['ms']) for v,d in result.items()}),indent=2))


if __name__ == '__main__':
    main()
