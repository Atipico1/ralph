import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';
const ASSETS = 'decks/ralph-mid/assets';

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  // 1. Landing page
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${ASSETS}/01-landing.png` });
  console.log('✓ 01-landing.png');

  // 2. Create a project to get into collect phase
  const textarea = page.locator('textarea');
  if (await textarea.isVisible()) {
    await textarea.fill('취업 면접 자기소개서를 써주세요');
    // Find and click submit button
    const submitBtn = page.locator('button[type="submit"], button:has-text("시작")').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      // Wait for navigation to project page
      await page.waitForURL(/\/project\//, { timeout: 30000 });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${ASSETS}/02-collect.png` });
      console.log('✓ 02-collect.png');

      // 3. Answer a question to see progress
      const textInput = page.locator('textarea').first();
      if (await textInput.isVisible()) {
        await textInput.fill('백엔드 개발자로 3년 경력이 있고, 스타트업에서 일했습니다.');
        const sendBtn = page.locator('button[type="submit"], button:has-text("보내기"), button:has-text("다음")').first();
        if (await sendBtn.isVisible()) {
          await sendBtn.click();
          await page.waitForTimeout(5000);
          await page.screenshot({ path: `${ASSETS}/03-collect-progress.png` });
          console.log('✓ 03-collect-progress.png');
        }
      }
    }
  }

  // 4. Check if we have any existing projects in simulate/deliver phase
  const res = await page.goto(`${BASE}/api/projects`);
  const projects = await res.json();

  // Look for a project in simulate or deliver phase
  const simProject = projects.find(p => p.phase === 'simulate');
  const delProject = projects.find(p => p.phase === 'deliver');

  if (simProject) {
    await page.goto(`${BASE}/project/${simProject.id}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${ASSETS}/04-simulate.png` });
    console.log('✓ 04-simulate.png');
  }

  if (delProject) {
    await page.goto(`${BASE}/project/${delProject.id}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${ASSETS}/05-deliver.png` });
    console.log('✓ 05-deliver.png');
  }

  await browser.close();
  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
