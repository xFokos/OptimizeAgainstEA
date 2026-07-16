import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 900 });

// Idle state
await page.goto('http://localhost:5173/ShooterGame');
await page.waitForTimeout(2000);
await page.screenshot({ path: 'shooter_idle.png' });
console.log('1) Idle screenshot saved');

// Starte Runde
await page.click('button:has-text("Runde starten")');
await page.waitForTimeout(1500);
await page.screenshot({ path: 'shooter_playing.png' });
console.log('2) Playing screenshot saved');

await browser.close();
