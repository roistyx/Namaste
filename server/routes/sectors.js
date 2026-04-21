import { Router } from 'express';
import { getDB } from '../db.js';

const router = Router();
const CACHE_DAYS = 7;
const FINNHUB_KEY = process.env.FINNHUB_API_KEY || '';
console.log('[sectors] Finnhub key configured:', !!FINNHUB_KEY);

// Static fallback — covers most common US equities without an API call
const STATIC_SECTORS = {
  // Technology
  AAPL:'Technology', MSFT:'Technology', NVDA:'Technology', AMD:'Technology',
  INTC:'Technology', QCOM:'Technology', AVGO:'Technology', TXN:'Technology',
  AMAT:'Technology', KLAC:'Technology', LRCX:'Technology', MRVL:'Technology',
  ASML:'Technology', TSM:'Technology',  SNPS:'Technology', CDNS:'Technology',
  ORCL:'Technology', CRM:'Technology',  NOW:'Technology',  SAP:'Technology',
  ADBE:'Technology', INTU:'Technology', ANSS:'Technology', FTNT:'Technology',
  PANW:'Technology', CRWD:'Technology', ZS:'Technology',   SNDK:'Technology',
  WDC:'Technology',  STX:'Technology',  MU:'Technology',   HPQ:'Technology',
  DELL:'Technology', CSCO:'Technology', ANET:'Technology', JNPR:'Technology',
  IBM:'Technology',  PLTR:'Technology', SNOW:'Technology', DDOG:'Technology',
  // Communication Services
  GOOGL:'Communication Services', GOOG:'Communication Services',
  META:'Communication Services',  NFLX:'Communication Services',
  DIS:'Communication Services',   CMCSA:'Communication Services',
  T:'Communication Services',     VZ:'Communication Services',
  TMUS:'Communication Services',  TTWO:'Communication Services',
  EA:'Communication Services',    ATVI:'Communication Services',
  RBLX:'Communication Services',  SNAP:'Communication Services',
  PINS:'Communication Services',  MTCH:'Communication Services',
  // Consumer Discretionary
  AMZN:'Consumer Discretionary', TSLA:'Consumer Discretionary',
  HD:'Consumer Discretionary',   LOW:'Consumer Discretionary',
  MCD:'Consumer Discretionary',  SBUX:'Consumer Discretionary',
  NKE:'Consumer Discretionary',  TJX:'Consumer Discretionary',
  BKNG:'Consumer Discretionary', ABNB:'Consumer Discretionary',
  UBER:'Consumer Discretionary', LYFT:'Consumer Discretionary',
  MELI:'Consumer Discretionary', ETSY:'Consumer Discretionary',
  RH:'Consumer Discretionary',   PTON:'Consumer Discretionary',
  GM:'Consumer Discretionary',   F:'Consumer Discretionary',
  // Consumer Staples
  WMT:'Consumer Staples', COST:'Consumer Staples', PG:'Consumer Staples',
  KO:'Consumer Staples',  PEP:'Consumer Staples',  PM:'Consumer Staples',
  MO:'Consumer Staples',  MDLZ:'Consumer Staples', CL:'Consumer Staples',
  KMB:'Consumer Staples', GIS:'Consumer Staples',  HSY:'Consumer Staples',
  // Energy
  XOM:'Energy', CVX:'Energy', COP:'Energy', SLB:'Energy',
  EOG:'Energy', PXD:'Energy', MPC:'Energy', VLO:'Energy',
  PSX:'Energy', OXY:'Energy', HAL:'Energy', BKR:'Energy',
  ET:'Energy',  KMI:'Energy', WMB:'Energy', LNG:'Energy',
  // Financials
  JPM:'Financials', BAC:'Financials', WFC:'Financials', GS:'Financials',
  MS:'Financials',  C:'Financials',   AXP:'Financials', V:'Financials',
  MA:'Financials',  PYPL:'Financials', COF:'Financials', DFS:'Financials',
  BLK:'Financials', SCHW:'Financials', ICE:'Financials', CME:'Financials',
  SPGI:'Financials', MCO:'Financials', BRK:'Financials', BRKB:'Financials',
  BRKA:'Financials', AFL:'Financials', MET:'Financials', PRU:'Financials',
  // Healthcare
  JNJ:'Healthcare', UNH:'Healthcare', PFE:'Healthcare', ABBV:'Healthcare',
  LLY:'Healthcare', MRK:'Healthcare', TMO:'Healthcare', ABT:'Healthcare',
  DHR:'Healthcare', MDT:'Healthcare', BMY:'Healthcare', AMGN:'Healthcare',
  GILD:'Healthcare', CVS:'Healthcare', HUM:'Healthcare', CI:'Healthcare',
  ISRG:'Healthcare', SYK:'Healthcare', BSX:'Healthcare', EW:'Healthcare',
  REGN:'Healthcare', VRTX:'Healthcare', BIIB:'Healthcare', MRNA:'Healthcare',
  // Industrials
  CAT:'Industrials', DE:'Industrials',  HON:'Industrials', GE:'Industrials',
  LMT:'Industrials', RTX:'Industrials', NOC:'Industrials', BA:'Industrials',
  GD:'Industrials',  HII:'Industrials', L3H:'Industrials', TDG:'Industrials',
  HWM:'Industrials', TXT:'Industrials', LHX:'Industrials', LDOS:'Industrials',
  UPS:'Industrials', FDX:'Industrials', DAL:'Industrials', UAL:'Industrials',
  AAL:'Industrials', NSC:'Industrials', UNP:'Industrials', CSX:'Industrials',
  MMM:'Industrials', EMR:'Industrials', ETN:'Industrials', ROK:'Industrials',
  AME:'Industrials', PH:'Industrials',  CARR:'Industrials', OTIS:'Industrials',
  OSK:'Industrials', PCAR:'Industrials', CMI:'Industrials', IR:'Industrials',
  SAFRY:'Industrials', SAABY:'Industrials', EADSY:'Industrials',
  // Materials
  LIN:'Materials', APD:'Materials', SHW:'Materials', FCX:'Materials',
  NEM:'Materials', NUE:'Materials', VMC:'Materials', MLM:'Materials',
  // Real Estate
  AMT:'Real Estate', PLD:'Real Estate', CCI:'Real Estate', EQIX:'Real Estate',
  SPG:'Real Estate', O:'Real Estate',   PSA:'Real Estate', WELL:'Real Estate',
  // Utilities
  NEE:'Utilities', DUK:'Utilities', SO:'Utilities',  D:'Utilities',
  AEP:'Utilities', EXC:'Utilities', PCG:'Utilities', ED:'Utilities',
};

async function fetchSectorFromFinnhub(symbol) {
  if (!FINNHUB_KEY) return null;
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_KEY}`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.finnhubIndustry || null;
  } catch {
    return null;
  }
}

// POST /api/sectors  — body: { symbols: string[] }
// Returns: { AAPL: 'Technology', MSFT: 'Technology', ... }
router.post('/', async (req, res) => {
  try {
    const { symbols } = req.body;
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({ error: 'symbols array required' });
    }

    const db  = getDB();
    const col = db.collection('symbol_sectors');
    const result = {};
    const toFetch = [];
    const sources = new Set();

    // Load cached entries
    const cutoff = new Date(Date.now() - CACHE_DAYS * 86_400_000);
    const cached = await col.find({
      _id:      { $in: symbols },
      cachedAt: { $gt: cutoff },
      sector:   { $ne: 'Unknown' },  // don't serve stale Unknown — retry via API
    }).toArray();

    for (const doc of cached) {
      result[doc._id] = doc.sector;
      const src = doc.source ?? (STATIC_SECTORS[doc._id] ? 'Static map' : 'Finnhub');
      sources.add(src);
    }

    for (const sym of symbols) {
      if (!(sym in result)) toFetch.push(sym);
    }

    // Check static map before hitting Finnhub
    const stillNeeded = [];
    const staticHits = [];
    for (const sym of toFetch) {
      if (STATIC_SECTORS[sym]) {
        result[sym] = STATIC_SECTORS[sym];
        staticHits.push(sym);
      } else {
        stillNeeded.push(sym);
      }
    }

    // Persist static hits to cache in one bulk write
    if (staticHits.length) {
      sources.add('Static map');
      const bulkOps = staticHits.map((sym) => ({
        updateOne: {
          filter: { _id: sym },
          update: { $set: { _id: sym, sector: result[sym], source: 'Static map', cachedAt: new Date() } },
          upsert: true,
        },
      }));
      await col.bulkWrite(bulkOps);
      console.log(`[sectors] static map resolved: ${staticHits.join(', ')}`);
    }

    // Fetch truly unknown symbols from Finnhub — one at a time, ~1 req/sec
    for (const sym of stillNeeded) {
      const sector = await fetchSectorFromFinnhub(sym);
      result[sym] = sector ?? 'Unknown';
      const src = sector ? 'Finnhub' : 'Unknown';
      if (sector) sources.add('Finnhub');
      console.log(`[sectors] finnhub ${sym} → ${result[sym]}`);
      await col.updateOne(
        { _id: sym },
        { $set: { _id: sym, sector: result[sym], source: src, cachedAt: new Date() } },
        { upsert: true },
      );
      if (stillNeeded.indexOf(sym) < stillNeeded.length - 1) {
        await new Promise((r) => setTimeout(r, 1100));
      }
    }

    res.json({ sectors: result, sources: [...sources] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
