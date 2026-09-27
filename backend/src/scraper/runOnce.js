
require('dotenv').config();
process.env.SCRAPER_MODE = 'browser';

const { scrapeProduct } = require('./scraper');

async function main() {
  const [, , productUrlArg, optionLabelArg] = process.argv;
  const productUrl = productUrlArg || `${process.env.STORE_BASE_URL || 'https://demo.inelabteamdev.com'}/item/1`;
  const optionLabel = optionLabelArg || null;

  console.log(`\n[runOnce] Target: ${productUrl}`);
  console.log(`[runOnce] Option: ${optionLabel || '(default/first option)'}\n`);

  const result = await scrapeProduct(
    { productUrl, optionLabel },
    {
      headed: true,
      onAttempt: async (info) => {
        console.log(
          `  attempt #${info.attemptNumber} -> ${info.outcome}` +
            (info.error ? ` (${info.error})` : '') +
            ` [${info.durationMs}ms]`
        );
      },
    }
  );

  console.log('\n[runOnce] Final result:', result, '\n');
  process.exit(result.outcome === 'failed' ? 1 : 0);
}

main().catch((err) => {
  console.error('[runOnce] Unexpected crash:', err);
  process.exit(1);
});
