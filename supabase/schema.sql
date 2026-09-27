-- INE Price Tracker — Supabase (PostgreSQL) schema
-- Run this in the Supabase SQL editor before starting the backend.

create extension if not exists "uuid-ossp";

-- One row per (store_product_id, option) pair the user chose to track.
create table if not exists tracked_products (
  id uuid primary key default uuid_generate_v4(),
  store_product_id text not null,        -- the ID as it appears in the store's product page URL
  product_name text not null,
  product_url text not null,             -- full URL of the product page on the mock store
  option_label text not null,            -- e.g. "128GB", "Pack of 3", "Kit A"
  option_key text,                       -- internal key/value the scraper uses to pick the right option in the DOM, if any
  is_active boolean not null default true,
  scrape_interval_minutes int not null default 120,  -- bonus: configurable frequency, defaults to the required 2h
  last_known_selector_hash text,         -- bonus: used for structure-change detection
  created_at timestamptz not null default now(),
  unique (store_product_id, option_label)
);

-- One row per scrape ATTEMPT (success, retried, or failed) — this is the honest log.
create table if not exists scrape_history (
  id uuid primary key default uuid_generate_v4(),
  tracked_product_id uuid not null references tracked_products(id) on delete cascade,
  attempted_at timestamptz not null default now(),  -- ISO 8601 UTC, timestamptz stores this natively
  outcome text not null check (outcome in ('success', 'retried', 'failed')),
  price numeric(12,2),                   -- null when outcome = 'failed'
  stock text,                            -- null when outcome = 'failed'; free text: "in_stock" / "out_of_stock" / numeric qty
  attempt_number int not null default 1, -- 1 = first try, 2 = first retry, etc.
  http_status int,
  error_message text,                    -- populated on failure/retry, for debugging
  duration_ms int,
  page_structure_ok boolean default true, -- bonus: flips false when expected selectors go missing
  price_drop boolean not null default false,   -- bonus: true if price fell vs. the previous successful scrape
  back_in_stock boolean not null default false -- bonus: true if stock flipped out_of_stock -> in_stock
);

create index if not exists idx_scrape_history_product on scrape_history(tracked_product_id, attempted_at desc);
create index if not exists idx_tracked_products_active on tracked_products(is_active);

-- Last valid price/stock stays available even when the latest attempt fails.
create or replace view latest_price as
select distinct on (tracked_product_id)
  tracked_product_id,
  attempted_at,
  outcome,
  price,
  stock,
  price_drop,
  back_in_stock,
  page_structure_ok
from scrape_history
where outcome in ('success', 'retried') and price is not null
order by tracked_product_id, attempted_at desc;

-- The most recent attempt is separate so failures remain visible and drive scheduling.
create or replace view latest_attempt as
select distinct on (tracked_product_id)
  tracked_product_id,
  attempted_at,
  outcome,
  price,
  stock,
  price_drop,
  back_in_stock,
  page_structure_ok
from scrape_history
order by tracked_product_id, attempted_at desc;
