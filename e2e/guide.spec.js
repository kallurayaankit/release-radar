import {test,expect} from '@playwright/test';
test('built-in guide helps beginners without API, supports keyboard and navigation',async({page})=>{
  let calls=0;await page.route('**/api/chat',r=>{calls++;return r.abort();});await page.goto('/');
  await page.getByRole('button',{name:'Ask Radar'}).click();await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button',{name:'Help me choose an idea',exact:true}).click();await expect(page.locator('#radar-messages')).toContainText('one person, one problem');expect(calls).toBe(0);
  await page.getByLabel('What would you like help with?').fill('<img src=x onerror=alert(1)>');await page.getByLabel('What would you like help with?').press('Enter');await expect(page.locator('#radar-messages img')).toHaveCount(0);
  await page.getByRole('button',{name:'New chat',exact:true}).click();await expect(page.locator('.radar-message')).toHaveCount(1);
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toBeHidden();await expect(page.locator('#radar-launcher')).toBeFocused();
  await page.locator('#radar-launcher').click();await page.getByRole('button',{name:'Go to challenge'}).click();await expect(page.locator('#challenge-freeze')).toBeFocused();
});
test('live chat includes context, renders replies as text, and preserves failed question',async({page})=>{
  await page.route('**/api/config',r=>r.fulfill({json:{configured:true,model:'test-model'}}));const bodies=[];
  await page.route('**/api/chat',r=>{bodies.push(r.request().postDataJSON());return bodies.length===1?r.fulfill({json:{reply:'Choose one requirement. <b>Not HTML</b>',model:'test-model'}}):r.fulfill({status:502,json:{error:'Connection failed'}});});
  await page.goto('/');await page.locator('#radar-launcher').click();await page.getByLabel('Reply source').selectOption('live');await page.getByLabel('What would you like help with?').fill('Help me plan a booking app');await page.getByRole('button',{name:'Send',exact:false}).click();
  await expect(page.locator('#radar-messages')).toContainText('RADAR · LIVE AI');await expect(page.locator('#radar-messages b')).toHaveCount(0);expect(bodies[0].context.demoStep).toBeTruthy();
  await page.getByLabel('What would you like help with?').fill('What is my first test?');await page.getByRole('button',{name:'Send',exact:false}).click();await expect(page.locator('#radar-messages')).toContainText('Connection failed');await expect(page.locator('#radar-input')).toHaveValue('What is my first test?');expect(bodies[1].messages).toHaveLength(3);
});
test('guide fits a phone screen',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');await page.locator('#radar-launcher').click();await page.getByRole('button',{name:'Explain the challenge',exact:true}).click();const bounds=await page.locator('#radar-dialog').boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(390);expect(bounds.y+bounds.height).toBeLessThanOrEqual(844);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('live Radar answers a beginner question',async({page})=>{
  test.skip(process.env.RUN_LIVE_AI!=='1','Explicit live API check only');test.setTimeout(80000);
  await page.goto('/');await page.locator('#radar-launcher').click();await page.getByLabel('Reply source').selectOption('live');await page.getByLabel('What would you like help with?').fill('I have no idea what to build. Suggest one small project and its first acceptance test.');await page.getByRole('button',{name:'Send',exact:false}).click();await expect(page.locator('#radar-messages')).toContainText('RADAR · LIVE AI',{timeout:65000});await expect(page.locator('#radar-messages')).not.toContainText('REQUEST FAILED');
  await page.screenshot({path:'../releaseradar-radar-guide.png'});
});
