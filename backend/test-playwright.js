const { chromium } = require('playwright');

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  let quoteData = null;
  page.on('response', async res => {
    if (res.url().includes('/quote')) {
      try {
        const text = await res.text();
        console.log('QUOTE RESPONSE BODY:', text);
      } catch (e) {}
    }
  });

  await page.goto('https://demo.inelabteamdev.com/item/2007', { waitUntil: 'networkidle' });

  const panel = page.locator('.offer-panel');
  const box = await panel.boundingBox();
  if (box) {
    for (let i = 0; i < 40; i++) {
      await page.mouse.move(box.x + 20 + i * 5, box.y + 15 + (i % 7) * 4);
      await page.waitForTimeout(30);
    }
  }

  const btn = page.locator('.offer-panel button:not([disabled])');
  if (await btn.count() > 0) {
    await btn.click();
  }

  await page.waitForTimeout(4000);
  
  // Inspect the output element
  const output = page.locator('.offer-panel output');
  if (await output.count() > 0) {
    console.log('OUTPUT innerText:', await output.innerText());
    console.log('OUTPUT textContent:', await output.textContent());
  }

  // Inspect avail pill
  const avail = page.locator('.avail-pill');
  if (await avail.count() > 0) {
    console.log('AVAIL text:', await avail.innerText());
  }

  // Inspect all visible text in offer-row
  const row = page.locator('.offer-row');
  console.log('ROW innerText:', await row.innerText());

  await browser.close();
}
test().catch(console.error);
