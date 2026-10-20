import {test,expect} from '@playwright/test';
test('live AI generates cases that prove the regression and verify the fix',async({page})=>{
  test.skip(process.env.RUN_LIVE_AI!=='1','Explicit opt-in required: makes one paid API request.');
  test.setTimeout(90000);
  await page.goto('/');
  await expect(page.locator('#ai-connection')).toContainText('AI key configured');
  await page.getByRole('button',{name:'Run existing tests'}).click();
  await page.getByLabel('Test source').selectOption('live');
  await page.getByRole('button',{name:'Prepare missing tests'}).click();
  await expect(page.locator('#ai-connection')).toHaveText('Live AI verified',{timeout:65000});
  await page.getByRole('button',{name:'Run new tests on both builds'}).click();
  await expect(page.getByText('Regression reproduced. The test distinguishes the builds.')).toBeVisible();
  await expect(page.locator('#proof-card')).toBeVisible();
  await page.getByRole('button',{name:'Apply fix & rerun unchanged tests'}).click();
  await expect(page.getByText('Fix verified against the unchanged tests.')).toBeVisible();
  await expect(page.locator('.proof-fixed')).toBeVisible();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Test cases',exact:false}).click();
  expect((await download).suggestedFilename()).toBe('releaseradar-test-cases.json');
});
