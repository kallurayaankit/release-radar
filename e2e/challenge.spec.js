import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
test('challenge retains original assertions, proves gaps, and exports replayable evidence',async({page},testInfo)=>{
  await page.goto('/');
  await expect(page.getByText('Freeze the suite to reveal the three challenges.',{exact:false})).toBeVisible();
  await page.locator('#challenge-freeze').click();
  await page.getByRole('button',{name:/AUDIENCE PICK Currency rounding/}).click();
  await page.locator('#challenge-run').click();
  await expect(page.locator('#challenge-status')).toContainText('1 of 3 injected bugs detected');
  await expect(page.locator('.challenge-outcome.missed')).toHaveCount(2);
  await page.locator('#challenge-improve').click();
  await expect(page.locator('#challenge-review')).toContainText('Original assertions retained');
  await page.locator('#challenge-freeze').click();await page.locator('#challenge-run').click();
  await expect(page.locator('#challenge-status')).toContainText('3 of 3 injected bugs detected');
  await expect(page.locator('.challenge-round')).toHaveCount(2);
  const jsonEvent=page.waitForEvent('download');await page.locator('#challenge-data').click();const jsonFile=await jsonEvent;
  const data=JSON.parse(await readFile(await jsonFile.path(),'utf8'));
  expect(data.rounds[1].tests.slice(0,3)).toEqual(data.rounds[0].tests);
  expect(data.rounds[0].suiteHash).not.toBe(data.rounds[1].suiteHash);
  expect(data.rounds[1].fixedVerified).toBe(true);
  const replayEvent=page.waitForEvent('download');await page.locator('#challenge-replay').click();const replay=await replayEvent;
  const file=testInfo.outputPath('replay.mjs');await replay.saveAs(file);
  expect(execFileSync(process.execPath,[file],{encoding:'utf8',env:{...process.env,FORCE_COLOR:'0'}})).toContain('Replay mismatches: 0');
  const reportEvent=page.waitForEvent('download');await page.locator('#challenge-report').click();const report=await reportEvent;
  expect(await readFile(await report.path(),'utf8')).toContain('Round 2: 3 / 3 injected bugs detected');
  await page.setViewportSize({width:1440,height:1100});await page.locator('#challenge').screenshot({path:testInfo.outputPath('challenge-desktop.png')});
  await page.locator('#challenge-reset').click();await expect(page.locator('#challenge-run')).toBeDisabled();await expect(page.locator('.challenge-round')).toHaveCount(0);
});
test('contradictory imported expectations are shown and cannot freeze',async({page})=>{
  await page.goto('/');await page.getByLabel('Challenge case source').selectOption('import');
  await page.getByLabel('Challenge test JSON').fill(JSON.stringify({summary:'bad',tests:[{name:'Wrong',subtotal:9000,discount:0,expectedShipping:0,reason:'wrong'}]}));
  await page.locator('#challenge-freeze').click();await expect(page.locator('#challenge-status')).toContainText('contradicts');
  await expect(page.locator('#challenge-review')).toContainText('CONTRADICTS RULE');await expect(page.locator('#challenge-run')).toBeDisabled();
});
test('live generation initially withholds observations and does not substitute on errors',async({page})=>{
  await page.route('**/api/config',r=>r.fulfill({json:{configured:true,model:'test-model'}}));
  const requests=[];
  await page.route('**/api/challenge-generate',r=>{requests.push(r.request().postDataJSON());return r.fulfill({status:502,json:{error:'Test connection failure'}});});
  await page.goto('/');await page.getByLabel('Challenge case source').selectOption('live');await page.locator('#challenge-freeze').click();
  await expect(page.locator('#challenge-status')).toHaveText('Test connection failure');expect(requests[0].observations).toBeNull();expect(Object.keys(requests[0])).toEqual(['tests','observations']);await expect(page.locator('#challenge-run')).toBeDisabled();
});
test('expanded challenge fits a mobile viewport',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');await page.locator('#challenge-freeze').click();await page.locator('#challenge-run').click();await expect(page.locator('.challenge-round')).toHaveCount(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('live AI expands a frozen suite using completed challenge observations',async({page})=>{
  test.skip(process.env.RUN_LIVE_AI!=='1','Explicit live API check only');test.setTimeout(100000);
  await page.goto('/');await page.locator('#challenge-freeze').click();await page.locator('#challenge-run').click();
  await expect(page.locator('#challenge-status')).toContainText('1 of 3');
  await page.getByLabel('Challenge case source').selectOption('live');await page.locator('#challenge-improve').click();
  await expect(page.locator('#challenge-review')).toContainText('Review proposed additions',{timeout:70000});
  await page.locator('#challenge-freeze').click();await page.locator('#challenge-run').click();
  await expect(page.locator('.challenge-round')).toHaveCount(2);await expect(page.locator('#challenge-review')).toContainText('Live AI');
  await expect(page.locator('#challenge-status')).toContainText('3 of 3 injected bugs detected');
});
