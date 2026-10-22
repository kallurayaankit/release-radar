import {test,expect} from '@playwright/test';
import {qaExampleReport} from '../dist/copilot-core.js';
import {readFile} from 'node:fs/promises';
test('sample report matches selector safely, exports provenance and invalidates changed input',async({page})=>{
  await page.goto('/copilot.html');await page.getByRole('button',{name:'View sample report'}).click();
  await expect(page.locator('#report-meta')).toContainText('SAMPLE');await expect(page.locator('.decision')).toContainText('Hold release');
  await expect(page.locator('#report-content')).toContainText('1 match in supplied HTML');
  await page.locator('#project').fill('Changed brief');await expect(page.locator('#report-meta')).toContainText('BRIEF CHANGED');
  const pending=page.waitForEvent('download');await page.locator('#export-report').click();const file=await pending;
  const result=JSON.parse(await readFile(await file.path(),'utf8'));expect(result.source).toBe('sample');expect(result.input.project).toContain('Checkout');
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Clear',exact:true}).click();await expect(page.locator('#export-report')).toBeDisabled();
});
test('live response is safe text and failed retry preserves inputs without faking a result',async({page})=>{
  await page.route('**/api/config',r=>r.fulfill({json:{copilotConfigured:true,model:'test'}}));
  const report=structuredClone(qaExampleReport);report.summary='<img src=x onerror=alert(1)>';report.selectors[0].candidate='button';
  await page.route('**/api/copilot',r=>r.fulfill({json:{report,source:'live-ai',model:'test',generatedAt:new Date().toISOString()}}));
  await page.goto('/copilot.html');await page.locator('#example').click();await page.locator('summary').click();await page.locator('#html').fill('<button>Pay</button><button>Cancel</button><script>window.PWNED=1</script>');
  await page.locator('#analyze').click();await expect(page.locator('#report-meta')).toContainText('LIVE AI');
  await expect(page.locator('#report-content')).toContainText('2 matches');await expect(page.locator('#report-content img')).toHaveCount(0);
  expect(await page.evaluate(()=>window.PWNED)).toBeUndefined();
  await page.route('**/api/copilot',r=>r.fulfill({status:429,json:{error:'Allowance reached'}}));await page.locator('#analyze').click();
  await expect(page.locator('#qa-status')).toContainText('Allowance reached');await expect(page.locator('#project')).not.toHaveValue('');
  await expect(page.locator('#report-meta')).toContainText('LIVE AI');
});
