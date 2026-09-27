# Design Note — PriceWatch

The INE store loads current prices and stock asynchronously and requires a
browser interaction to reveal them. The scraper uses Playwright to select the
requested product option, request its quote, and read the visible price and
stock. It validates the option and page structure, and does not save a guessed
price when a scrape fails.

Each scrape retries up to three times with backoff. Attempts and errors are
recorded in Supabase. An external cron service calls the backend every two
hours; the backend only scrapes products whose individual interval has elapsed.
The local JSON database is for development, not production scheduling.

*AI disclosure:* I used an AI assistant to help review requirements, debug
scraper and deployment issues, and suggest and implement code/documentation
changes. I reviewed and tested the changes, and I am responsible for
understanding and explaining the submitted work.
