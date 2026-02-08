

function formatPrice(v) {
  const n = Number(v);
  return !isNaN(n) ? n.toFixed(2) : "";
}

function getPriceFromJSONLD() {
  try {
    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    for (const s of scripts) {
      let json;
      try {
        json = JSON.parse(s.textContent || '');
      } catch {
        continue;
      }
      const items = Array.isArray(json) ? json : [json];
      for (const item of items) {
        const offers = item.offers || (item.hasOwnProperty('offers') ? item.offers : null);
        if (!offers) continue;
        const offerArr = Array.isArray(offers) ? offers : [offers];
        for (const offer of offerArr) {
          if (offer.price) {
            const n = Number(String(offer.price).replace(/[^0-9.]/g, ''));
            if (!isNaN(n) && n >= 0.5) return n.toFixed(2);
          }
          if (offer.priceSpecification && offer.priceSpecification.price) {
            const n = Number(String(offer.priceSpecification.price).replace(/[^0-9.]/g, ''));
            if (!isNaN(n) && n >= 0.5) return n.toFixed(2);
          }
        }
      }
    }
  } catch (e) {}
  return null;
}

function getPriceFromMeta() {
  try {
    const selectors = [
      'meta[itemprop="price"]',
      'meta[property="product:price:amount"]',
      'meta[name="twitter:data1"]',
      'meta[name="price"]',
      'meta[name="sauce:price"]'
    ];
    for (const sel of selectors) {
      const meta = document.querySelector(sel);
      if (meta) {
        const content = meta.getAttribute('content') || meta.getAttribute('value') || meta.getAttribute('data') || '';
        const n = Number(String(content).replace(/[^0-9.]/g, ''));
        if (!isNaN(n) && n >= 0.5) return n.toFixed(2);
      }
    }
  } catch {}
  return null;
}

function isElementVisible(el) {
  if (!el) return false;
  try {
    const cs = window.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity || '1') < 0.03) return false;
    if (el.closest && el.closest('[aria-hidden="true"]')) return false;
    const rects = el.getClientRects();
    if (!rects || rects.length === 0) return false;
    for (const r of rects) {
      if (r.width > 0 && r.height > 0) return true;
    }
    return false;
  } catch { return false; }
}

function isCrossedOut(el) {
  if (!el) return false;
  if (el.closest && el.closest('del, s')) return true;
  try {
    const cs = window.getComputedStyle(el);
    if ((cs.textDecorationLine || '').includes('line-through')) return true;
  } catch {}
  const parent = el.closest && el.closest('[class], [id]');
  if (parent) {
    const combined = ((parent.className || '') + ' ' + (parent.id || '')).toLowerCase();
    const bad = ['preheat','upcoming','countdown','old','strike','original','del','cross'];
    for (const k of bad) if (combined.includes(k)) return true;
  }
  return false;
}

function getPriceFromDOMVisual() {
  try {
    const containerSelectors = [
      '[data-pl="product-price"]',
      '[class*="product-price"]',
      '[class*="price"]',
      '[class*="productPrice"]',
      '[id*="price"]'
    ];
    const nodes = [];
    for (const sel of containerSelectors) {
      const containers = Array.from(document.querySelectorAll(sel));
      for (const c of containers) {
        const leafCandidates = Array.from(c.querySelectorAll('span, strong, b, i, em, div, p, small'));
        leafCandidates.unshift(c);
        for (const leaf of leafCandidates) {
          const txt = (leaf.innerText || '').replace(/,/g, '');
          if (!txt) continue;
          const matches = txt.match(/\d+\.\d{2}/g) || [];
          for (const m of matches) {
            const value = Number(m);
            if (isNaN(value) || value < 0.5 || value > 100000) continue;
            nodes.push({ el: leaf, value });
          }
        }
      }
    }

    if (!nodes.length) {
      const all = Array.from(document.body.querySelectorAll('*')).slice(0, 600);
      for (const el of all) {
        const t = (el.innerText || '').replace(/,/g, '');
        const matches = t.match(/\d+\.\d{2}/g) || [];
        for (const m of matches) {
          const v = Number(m);
          if (!isNaN(v) && v >= 0.5 && v < 100000) nodes.push({ el, value: v });
        }
      }
    }

    if (!nodes.length) return null;

    const scored = nodes.map(({el, value}) => {
      const visible = isElementVisible(el);
      const crossed = isCrossedOut(el);
      const cs = window.getComputedStyle(el);
      const fontSize = parseFloat(cs.fontSize || '0') || 0;
      const rawW = cs.fontWeight || '400';
      const fontWeight = isNaN(Number(rawW)) ? (rawW === 'bold' ? 700 : 400) : Number(rawW);
      let area = 0;
      try { for (const r of el.getClientRects()) area += r.width * r.height; } catch {}
      return { el, value, visible, crossed, fontSize, fontWeight, area };
    }).filter(s => !s.crossed && s.value >= 0.5 && s.value < 100000);

    const visibleOnly = scored.filter(s => s.visible);
    const pool = visibleOnly.length ? visibleOnly : scored;
    if (!pool.length) return null;

    pool.sort((a,b) => {
      if (b.area !== a.area) return b.area - a.area;
      if (b.fontSize !== a.fontSize) return b.fontSize - a.fontSize;
      if (b.fontWeight !== a.fontWeight) return b.fontWeight - a.fontWeight;
      return a.value - b.value;
    });

    return pool[0].value.toFixed(2);
  } catch (e) {
    return null;
  }
}

function getPriceFromState() {
  try {
    const state = window.__AER_DATA__ || window.runParams || window.__runParams__ || window.runData;
    if (!state) return null;
    const candidates = [];
    if (state.priceModule) {
      const pm = state.priceModule;
      const tryFields = [pm.discountPrice?.value, pm.activityPrice?.value, pm.minPrice, pm.maxPrice, pm.price];
      for (const f of tryFields) {
        if (!f && f !== 0) continue;
        const n = Number(String(f).replace(/[^0-9.]/g, ''));
        if (!isNaN(n) && n >= 0.5) candidates.push(n);
      }
    }
    if (state.skuModule?.skuPriceList) {
      state.skuModule.skuPriceList.forEach(s => {
        const raw = s?.skuVal?.skuPrice || s?.skuPrice || s?.price;
        const n = Number(String(raw).replace(/[^0-9.]/g, ''));
        if (!isNaN(n) && n >= 0.5) candidates.push(n);
      });
    }
    return candidates.length ? Math.min(...candidates).toFixed(2) : null;
  } catch { return null; }
}

function parseAliExpress() {
  const title =
    document.querySelector('[data-pl="product-title"]')?.innerText?.trim() ||
    document.querySelector('h1[class*="title"]')?.innerText?.trim() ||
    document.querySelector('h1')?.innerText?.trim() ||
    "";

  const description =
    document.querySelector('[data-pl="product-description"]')?.innerText ||
    document.querySelector('meta[name="description"]')?.content ||
    "";

  const jsonLdPrice = getPriceFromJSONLD();
  if (jsonLdPrice) return { title, description, price: formatPrice(jsonLdPrice) };

  const metaPrice = getPriceFromMeta();
  if (metaPrice) return { title, description, price: formatPrice(metaPrice) };

  const domPrice = getPriceFromDOMVisual();
  if (domPrice) return { title, description, price: formatPrice(domPrice) };

  const statePrice = getPriceFromState();
  if (statePrice) return { title, description, price: formatPrice(statePrice) };

  return { title, description, price: "" };
}

const current = { title: "", price: "", description: "" };

function debounce(fn, wait = 150) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

const refresh = debounce(() => {
  try {
    const p = parseAliExpress();
    if (p.title) current.title = p.title;
    if (p.description) current.description = p.description;
    if (p.price) current.price = p.price;
    updateButton();
  } catch {}
}, 140);

function attachLiveTracking() {
  document.addEventListener('click', e => {
    try {
      if (e.target.closest && e.target.closest('[data-sku], .sku, select, .sku-property, .sku-item')) {
        setTimeout(refresh, 100);
      }
    } catch {}
  }, true);

  const obs = new MutationObserver(refresh);
  obs.observe(document.body, { childList: true, subtree: true, characterData: true });

  setInterval(refresh, 2500);
}

let button;
function updateButton() {
  if (!button) return;
  button.innerText = current.price ? `Send product for review in Shopify ($${current.price})` : 'Send product for review in Shopify';
}

function injectButton() {
  if (window.__dropshipImporterInjected) return;
  window.__dropshipImporterInjected = true;

  button = document.createElement('button');
  Object.assign(button.style, {
    position: 'fixed', bottom: '20px', right: '20px', zIndex: '999999',
    padding: '12px 16px', background: '#008060', color: '#fff', border: 'none',
    borderRadius: '6px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
    boxShadow: '0 6px 18px rgba(0,0,0,0.2)'
  });

  document.body.appendChild(button);

  button.addEventListener('click', () => {
    refresh();

    button.disabled = true;
    const prevText = button.innerText;
    button.innerText = 'Loading latest product data...';

    setTimeout(() => {
      button.disabled = false;
      button.innerText = prevText;

      if (!current.title || !current.price) {
        alert('⏳ Product data still loading, please click again');
        return;
      }

      chrome.runtime.sendMessage({ type: 'IMPORT_PRODUCT', payload: { supplier: 'aliexpress', title: current.title, price: current.price, description: current.description } }, res => {
        alert(res?.success ? '✅ Product sent! Open your Shopify app.' : '❌ Failed to send product');
      });
    }, 250);
  });
}

function init() {
  refresh();
  injectButton();
  attachLiveTracking();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
