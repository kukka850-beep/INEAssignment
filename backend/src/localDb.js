const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getInitialData() {
  const p1Id = 'e1a12001-92be-4971-923f-e14b01d81001';
  const p2Id = 'e1a12002-92be-4971-923f-e14b01d81002';
  const p3Id = 'e1a12003-92be-4971-923f-e14b01d81003';

  const now = Date.now();
  const h = 3600 * 1000;

  return {
    tracked_products: [
      {
        id: p1Id,
        store_product_id: '2527',
        product_name: 'Halvard Bookshelf Ultra',
        product_url: 'https://demo.inelabteamdev.com/item/2527',
        option_label: 'Oak',
        option_key: 'o1',
        is_active: true,
        scrape_interval_minutes: 120,
        last_known_selector_hash: 'd3b07384d113edec49eaa6238ad5ff00',
        created_at: new Date(now - 48 * h).toISOString(),
      },
      {
        id: p2Id,
        store_product_id: '2872',
        product_name: 'Brightwell Synthesizer Zen',
        product_url: 'https://demo.inelabteamdev.com/item/2872',
        option_label: 'Instrument only',
        option_key: 'o1',
        is_active: true,
        scrape_interval_minutes: 120,
        last_known_selector_hash: 'a1b02384d113edec49eaa6238ad5ff99',
        created_at: new Date(now - 36 * h).toISOString(),
      },
      {
        id: p3Id,
        store_product_id: '2811',
        product_name: 'Lumeno Drawing Tablet Zen',
        product_url: 'https://demo.inelabteamdev.com/item/2811',
        option_label: '256 GB',
        option_key: 'o3',
        is_active: true,
        scrape_interval_minutes: 120,
        last_known_selector_hash: 'f8c02384d113edec49eaa6238ad5aa77',
        created_at: new Date(now - 24 * h).toISOString(),
      },
    ],
    scrape_history: [
      // Product 1 history (Halvard Bookshelf Ultra)
      {
        id: crypto.randomUUID(),
        tracked_product_id: p1Id,
        attempted_at: new Date(now - 24 * h).toISOString(),
        outcome: 'success',
        price: 14999,
        stock: 'in_stock',
        attempt_number: 1,
        http_status: 200,
        error_message: null,
        duration_ms: 1840,
        page_structure_ok: true,
        price_drop: false,
        back_in_stock: false,
      },
      {
        id: crypto.randomUUID(),
        tracked_product_id: p1Id,
        attempted_at: new Date(now - 18 * h).toISOString(),
        outcome: 'retried',
        price: null,
        stock: null,
        attempt_number: 1,
        http_status: 504,
        error_message: 'Gateway Timeout from mock store (retry scheduled)',
        duration_ms: 5020,
        page_structure_ok: true,
        price_drop: false,
        back_in_stock: false,
      },
      {
        id: crypto.randomUUID(),
        tracked_product_id: p1Id,
        attempted_at: new Date(now - 17.9 * h).toISOString(),
        outcome: 'success',
        price: 14999,
        stock: 'in_stock',
        attempt_number: 2,
        http_status: 200,
        error_message: null,
        duration_ms: 2100,
        page_structure_ok: true,
        price_drop: false,
        back_in_stock: false,
      },
      {
        id: crypto.randomUUID(),
        tracked_product_id: p1Id,
        attempted_at: new Date(now - 12 * h).toISOString(),
        outcome: 'success',
        price: 13499,
        stock: 'in_stock',
        attempt_number: 1,
        http_status: 200,
        error_message: null,
        duration_ms: 1910,
        page_structure_ok: true,
        price_drop: true, // PRICE DROP ALERT
        back_in_stock: false,
      },
      {
        id: crypto.randomUUID(),
        tracked_product_id: p1Id,
        attempted_at: new Date(now - 6 * h).toISOString(),
        outcome: 'success',
        price: 13499,
        stock: 'in_stock',
        attempt_number: 1,
        http_status: 200,
        error_message: null,
        duration_ms: 1750,
        page_structure_ok: true,
        price_drop: false,
        back_in_stock: false,
      },
      {
        id: crypto.randomUUID(),
        tracked_product_id: p1Id,
        attempted_at: new Date(now - 1 * h).toISOString(),
        outcome: 'success',
        price: 13499,
        stock: 'in_stock',
        attempt_number: 1,
        http_status: 200,
        error_message: null,
        duration_ms: 1820,
        page_structure_ok: true,
        price_drop: false,
        back_in_stock: false,
      },

      
      {
        id: crypto.randomUUID(),
        tracked_product_id: p2Id,
        attempted_at: new Date(now - 20 * h).toISOString(),
        outcome: 'success',
        price: 42500,
        stock: 'in_stock',
        attempt_number: 1,
        http_status: 200,
        error_message: null,
        duration_ms: 1920,
        page_structure_ok: true,
        price_drop: false,
        back_in_stock: false,
      },
      {
        id: crypto.randomUUID(),
        tracked_product_id: p2Id,
        attempted_at: new Date(now - 14 * h).toISOString(),
        outcome: 'success',
        price: 42500,
        stock: 'in_stock',
        attempt_number: 1,
        http_status: 200,
        error_message: null,
        duration_ms: 2200,
        page_structure_ok: true,
        price_drop: false,
        back_in_stock: false,
      },
      {
        id: crypto.randomUUID(),
        tracked_product_id: p2Id,
        attempted_at: new Date(now - 8 * h).toISOString(),
        outcome: 'success',
        price: 41999,
        stock: 'in_stock',
        attempt_number: 1,
        http_status: 200,
        error_message: null,
        duration_ms: 1650,
        page_structure_ok: true,
        price_drop: true,
        back_in_stock: false,
      },
      {
        id: crypto.randomUUID(),
        tracked_product_id: p2Id,
        attempted_at: new Date(now - 2 * h).toISOString(),
        outcome: 'success',
        price: 41999,
        stock: 'in_stock',
        attempt_number: 1,
        http_status: 200,
        error_message: null,
        duration_ms: 1780,
        page_structure_ok: true,
        price_drop: false,
        back_in_stock: false,
      },

      // Product 3 history (Lumeno Drawing Tablet Zen)
      {
        id: crypto.randomUUID(),
        tracked_product_id: p3Id,
        attempted_at: new Date(now - 16 * h).toISOString(),
        outcome: 'success',
        price: 24999,
        stock: 'out_of_stock',
        attempt_number: 1,
        http_status: 200,
        error_message: null,
        duration_ms: 1810,
        page_structure_ok: true,
        price_drop: false,
        back_in_stock: false,
      },
      {
        id: crypto.randomUUID(),
        tracked_product_id: p3Id,
        attempted_at: new Date(now - 10 * h).toISOString(),
        outcome: 'success',
        price: 24999,
        stock: 'out_of_stock',
        attempt_number: 1,
        http_status: 200,
        error_message: null,
        duration_ms: 1940,
        page_structure_ok: true,
        price_drop: false,
        back_in_stock: false,
      },
      {
        id: crypto.randomUUID(),
        tracked_product_id: p3Id,
        attempted_at: new Date(now - 4 * h).toISOString(),
        outcome: 'success',
        price: 23499,
        stock: 'in_stock',
        attempt_number: 1,
        http_status: 200,
        error_message: null,
        duration_ms: 1760,
        page_structure_ok: true,
        price_drop: true,
        back_in_stock: true, // BACK IN STOCK ALERT!
      },
      {
        id: crypto.randomUUID(),
        tracked_product_id: p3Id,
        attempted_at: new Date(now - 0.5 * h).toISOString(),
        outcome: 'success',
        price: 23499,
        stock: 'in_stock',
        attempt_number: 1,
        http_status: 200,
        error_message: null,
        duration_ms: 1710,
        page_structure_ok: true,
        price_drop: false,
        back_in_stock: false,
      },
    ],
  };
}

function readDb() {
  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) {
    const init = getInitialData();
    fs.writeFileSync(DB_FILE, JSON.stringify(init, null, 2), 'utf-8');
    return init;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[localDb] Could not read db.json; preserving the existing file:', err);
    throw new Error(`Persistent local database is unreadable: ${err.message}`);
  }
}

function writeDb(data) {
  ensureDataDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Creates a query chain simulator matching Supabase JS client semantics.
 */
class LocalQueryBuilder {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.orderFields = [];
    this.limitCount = null;
    this.operation = 'select'; 
    this.payload = null;
    this.returnSingle = false;
    this.returnMaybeSingle = false;
  }

  select(fields = '*') {
    this.selectFields = fields;
    return this;
  }

  insert(values) {
    this.operation = 'insert';
    this.payload = Array.isArray(values) ? values : [values];
    return this;
  }

  update(values) {
    this.operation = 'update';
    this.payload = values;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(field, value) {
    this.filters.push((row) => row[field] === value);
    return this;
  }

  in(field, values) {
    this.filters.push((row) => values.includes(row[field]));
    return this;
  }

  not(field, operator, value) {
    if (operator !== 'is' || value !== null) {
      throw new Error(`Local database does not support .not(${operator}, ${value})`);
    }
    this.filters.push((row) => row[field] != null);
    return this;
  }

  order(field, { ascending = true } = {}) {
    this.orderFields.push({ field, ascending });
    return this;
  }

  limit(n) {
    this.limitCount = n;
    return this;
  }

  single() {
    this.returnSingle = true;
    return this.execute();
  }

  maybeSingle() {
    this.returnMaybeSingle = true;
    return this.execute();
  }

  
  then(onFulfilled, onRejected) {
    return this.execute().then(onFulfilled, onRejected);
  }

  async execute() {
    const db = readDb();

    
    if (this.table === 'latest_price' || this.table === 'latest_attempt') {
      const history = [...(db.scrape_history || [])];
      const latestReadingOnly = this.table === 'latest_price';
      const candidates = latestReadingOnly
        ? history.filter((row) => ['success', 'retried'].includes(row.outcome) && row.price != null)
        : history;
      candidates.sort((a, b) => new Date(b.attempted_at) - new Date(a.attempted_at));
      const seen = new Set();
      const latestRows = [];
      for (const h of candidates) {
        if (!seen.has(h.tracked_product_id)) {
          seen.add(h.tracked_product_id);
          latestRows.push({
            tracked_product_id: h.tracked_product_id,
            attempted_at: h.attempted_at,
            outcome: h.outcome,
            price: h.price,
            stock: h.stock,
            price_drop: h.price_drop || false,
            back_in_stock: h.back_in_stock || false,
            page_structure_ok: h.page_structure_ok !== false,
          });
        }
      }
      return { data: latestRows, error: null };
    }

    if (!db[this.table]) {
      db[this.table] = [];
    }

    let rows = db[this.table];

    if (this.operation === 'insert') {
      const inserted = [];
      for (const item of this.payload) {
        // Check unique constraint for tracked_products (store_product_id, option_label)
        if (this.table === 'tracked_products') {
          const duplicate = rows.find(
            (r) =>
              r.store_product_id === item.store_product_id &&
              r.option_label === item.option_label &&
              r.is_active !== false
          );
          if (duplicate) {
            return { data: null, error: { message: 'Unique violation', code: '23505' } };
          }
        }

        const newRow = {
          id: item.id || crypto.randomUUID(),
          created_at: item.created_at || new Date().toISOString(),
          attempted_at: item.attempted_at || new Date().toISOString(),
          is_active: item.is_active !== undefined ? item.is_active : true,
          ...item,
        };
        rows.push(newRow);
        inserted.push(newRow);
      }
      writeDb(db);
      if (this.returnSingle) {
        return { data: inserted[0] || null, error: null };
      }
      return { data: inserted, error: null };
    }

    if (this.operation === 'update') {
      let updatedCount = 0;
      for (const row of rows) {
        if (this.filters.every((f) => f(row))) {
          Object.assign(row, this.payload);
          updatedCount++;
        }
      }
      writeDb(db);
      return { data: null, error: null, count: updatedCount };
    }

    if (this.operation === 'delete') {
      db[this.table] = rows.filter((row) => !this.filters.every((f) => f(row)));
      writeDb(db);
      return { data: null, error: null };
    }

    
    let result = [...rows];
    for (const filter of this.filters) {
      result = result.filter(filter);
    }

    for (const { field, ascending } of this.orderFields) {
      result.sort((a, b) => {
        let va = a[field];
        let vb = b[field];
        if (va == null) return ascending ? -1 : 1;
        if (vb == null) return ascending ? 1 : -1;
        if (typeof va === 'string' && typeof vb === 'string') {
          return ascending ? va.localeCompare(vb) : vb.localeCompare(va);
        }
        return ascending ? (va > vb ? 1 : -1) : va < vb ? 1 : -1;
      });
    }

    if (this.limitCount !== null) {
      result = result.slice(0, this.limitCount);
    }

    if (this.returnSingle) {
      if (result.length === 0) {
        return { data: null, error: { message: 'Row not found' } };
      }
      return { data: result[0], error: null };
    }

    if (this.returnMaybeSingle) {
      return { data: result[0] || null, error: null };
    }

    return { data: result, error: null };
  }
}

const localClient = {
  from(tableName) {
    return new LocalQueryBuilder(tableName);
  },
};

module.exports = localClient;
