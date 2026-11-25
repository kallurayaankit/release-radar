"""Blind evidence review and summarize completed, counterbalanced tester sessions."""
import argparse
import csv
import hashlib
import json
from collections import defaultdict
from pathlib import Path
from statistics import median

KEY = {'197-202':'Report grouping or title changed',
       '529-541':'Runner recorded the test under this title and file'}
ASSIGNMENTS = {'A':[(0,False),(1,True)],'B':[(0,True),(1,False)],
               'C':[(1,False),(0,True)],'D':[(1,True),(0,False)]}


def main():
    flags = argparse.ArgumentParser(description=__doc__)
    flags.add_argument('sessions',type=Path)
    action = flags.add_mutually_exclusive_group(required=True)
    action.add_argument('--blind-sheet',type=Path)
    action.add_argument('--ratings',type=Path)
    args = flags.parse_args()
    participants, rows = set(), {}
    for path in sorted(args.sessions.glob('session-*.json')):
        s = json.loads(path.read_text('utf8'))
        person = s['participant']
        if person in participants or len(s['responses'])!=2:
            raise ValueError('Duplicate or incomplete session: '+path.name)
        participants.add(person)
        for r,(case,arm) in zip(s['responses'],ASSIGNMENTS[s['group']],strict=True):
            if (r['pair'],r['assisted'])!=(list(KEY)[case],arm) or not 0 < r['seconds'] < float('inf'):
                raise ValueError('Invalid assignment or duration: '+path.name)
            code = hashlib.sha256((person+'|'+r['pair']).encode()).hexdigest()[:16]
            rows[code] = r
    if not participants:
        flags.error('No completed session-*.json files found')
    if args.blind_sheet:
        with args.blind_sheet.open('x',newline='',encoding='utf8') as f:
            writer = csv.writer(f)
            writer.writerow(['id','pair','answer','citation','supported_0_or_1'])
            for code,r in sorted(rows.items()):
                writer.writerow([code,r['pair'],r['answer'],r['citation'],''])
        return
    with args.ratings.open(encoding='utf-8-sig',newline='') as f:
        ratings = {r['id']:r['supported_0_or_1'] for r in csv.DictReader(f)}
    if ratings.keys()!=rows.keys() or not set(ratings.values())<={'0','1'}:
        flags.error('Every response requires one completed evidence rating')
    cells = defaultdict(list)
    for code,r in rows.items():
        correct = r['answer']==KEY[r['pair']] and ratings[code]=='1'
        cells[(r['pair'],r['assisted'])].append((r['seconds'],correct))
    deltas = []
    for pair in KEY:
        medians = []
        for arm in (False,True):
            cell = cells[pair,arm]
            solved = [s for s,c in cell if c]
            typical = median(solved) if solved else None
            print(pair,'assisted' if arm else 'manual','correct',len(solved),'/',len(cell),
                  'median seconds (all)',median(s for s,_ in cell) if cell else None,
                  'median seconds (correct)',typical)
            medians.append(typical)
        if None not in medians:
            deltas.append(medians[0]-medians[1])
    if len(deltas)==len(KEY):
        print('Equal-case average of manual minus assisted median seconds, correct answers only:',round(sum(deltas)/len(deltas),2))


if __name__ == '__main__':
    main()
