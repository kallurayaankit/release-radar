"""Cross-project compatibility check using pinned real reports and controlled JUnit omissions."""
import argparse
import base64
import hashlib
import io
import json
from pathlib import Path
import re
import subprocess
from urllib.request import urlopen
import zipfile

SAMPLES = {
    'merge.html':'mishiwata1015/playwright-report-to-gh-pages/c79f4d7db741eb733c54b7754b413d03114d46d9/reports/2/merge/4073224816/1/index.html',
    'chromium.html':'ifeelBALANCED/cron-playwright/e9a87bf7e53fb67182d3aee5f2dd90249ca3e533/reports/pr/10/21627676040/chromium/index.html',
}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('cache',type=Path)
    args=parser.parse_args()
    args.cache.mkdir(parents=True,exist_ok=True)
    jobs=[]
    for filename,source in SAMPLES.items():
        path=args.cache/filename
        ref='https://raw.githubusercontent.com/'+source
        if not path.exists():
            with urlopen(ref,timeout=20) as response:
                path.write_bytes(response.read())
        data=path.read_bytes()
        payload=re.search(rb'data:application/zip;base64,([A-Za-z0-9+/=]+)',data)[1]
        groups={}
        with zipfile.ZipFile(io.BytesIO(base64.b64decode(payload))) as archive:
            for f in json.loads(archive.read('report.json'))['files']:
                for test in json.loads(archive.read(f['fileId']+'.json'))['tests']:
                    loc=test['location']
                    title=test['title']
                    key=(loc['file'],test['projectName'],loc['line'],loc['column'],tuple(test['path']))
                    for attempt in test['results']:
                        hits=groups.setdefault(title,{}).setdefault(key,{})
                        status=attempt['status']
                        hits[status]=hits.get(status,0)+1
        cases=[]
        for title,locations in groups.items():
            cases.append(dict(title=title,locations=[
                dict(name=title,file=file,project=project,line=line,column=col,suitePath=suite,outcomes=counts)
                for (file,project,line,col,suite),counts in locations.items()]))
        cases.append(dict(title='ReleaseRadar absent negative control',locations=[]))
        jobs.append(dict(path=str(path.resolve()),ref=ref,sha256=hashlib.sha256(data).hexdigest(),cases=cases))
    subprocess.run(['node',str(Path(__file__).with_suffix('.mjs'))],input=json.dumps(jobs).encode(),check=True)


if __name__=='__main__':
    main()
