import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const ASSETS = 'decks/ralph-mid/assets';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  // 1. Landing page
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${ASSETS}/01-landing.png` });
  console.log('✓ 01-landing.png');

  // 2. Create project via API for fresh collect phase
  const res = await page.evaluate(async (base) => {
    const r = await fetch(`${base}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: '자기소개서를 써주세요' }),
    });
    return r.json();
  }, BASE);
  console.log('Created project:', res.projectId);

  // Navigate to the collect phase
  await page.goto(`${BASE}/project/${res.projectId}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${ASSETS}/02-collect.png` });
  console.log('✓ 02-collect.png');

  // 3. Find a working deliver project
  const projects = await page.evaluate(async (base) => {
    const r = await fetch(`${base}/api/projects`);
    return r.json();
  }, BASE);

  const deliverProject = projects.find(p => p.phase === 'deliver');
  if (deliverProject) {
    await page.goto(`${BASE}/project/${deliverProject.id}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${ASSETS}/05-deliver.png` });
    console.log(`✓ 05-deliver.png (${deliverProject.id})`);
  }

  await browser.close();
  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
