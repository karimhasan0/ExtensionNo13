

function formatPrice(n) {
  if (n == null || n === "") return "";
  const num = Number(n);
  if (isNaN(num)) return "";
  return num.toFixed(2);
}

function getPriceFromAliExpressState() {
  try {
    const state =
      window.__AER_DATA__ ||
      window.runParams ||
      window.__runParams__ ||
      window.runData ||
      window.run_model;

    if (!state) return null;

    const candidates = [];

    if (state.skuModule?.skuPriceList) {
      state.skuModule.skuPriceList.forEach((s) => {
        const p = s?.skuVal?.skuPrice || s?.skuPrice || s?.price;
        const n = Number(String(p).replace(/[^0-9.]/g, ""));
        if (!isNaN(n) && n >= 0.5) candidates.push(n);
      });
    }

    if (state.priceModule) {
      const pm = state.priceModule;
      const tryVals = [
        pm.activityPrice?.value,
        pm.discountPrice?.value,
        pm.minPrice,
        pm.maxPrice,
        pm.price,
      ];
      tryVals.forEach((v) => {
        if (v == null) return;
        const n = Number(String(v).replace(/[^0-9.]/g, ""));
        if (!isNaN(n) && n >= 0.5) candidates.push(n);
      });
    }

    if (Array.isArray(state.skuPriceList)) {
      state.skuPriceList.forEach((p) => {
        const n = Number(String(p).replace(/[^0-9.]/g, ""));
        if (!isNaN(n) && n >= 0.5) candidates.push(n);
      });
    }

    if (candidates.length) {
      return Math.min(...candidates).toFixed(2);
    }
  } catch (e) {
  }
  return null;
}

function getPriceFromDOM() {
  try {
    let priceText =
      document.querySelector('[data-pl="product-price"]')?.innerText ||
      document.querySelector('[class*="price"]')?.innerText ||
      "";

    priceText = priceText.replace(/,/g, "");

    const decimalMatches = priceText.match(/\d+\.\d{2}/g) || [];
    const decimals = decimalMatches.map(Number).filter(n => n >= 0.5 && n < 100000);

    if (decimals.length) {
      return Math.min(...decimals).toFixed(2);
    }

    const numbers =
      priceText
        .match(/\d+(\.\d+)?/g)
        ?.map(Number)
        .filter((n) => !isNaN(n) && n >= 0.5 && n < 100000) || [];

    if (numbers.length) {
      return Math.min(...numbers).toFixed(2);
    }
  } catch (e) {
  }
  return null;
}

function parseAliExpressOnce() {
  const title =
    document.querySelector('[data-pl="product-title"]')?.innerText?.trim() ||
    document.querySelector('h1[class*="title"]')?.innerText?.trim() ||
    document.querySelector('h1')?.innerText?.trim() ||
    "";

  const description =
    document.querySelector('[data-pl="product-description"]')?.innerText ||
    document.querySelector('meta[name="description"]')?.content ||
    "";

  const price = getPriceFromAliExpressState() || getPriceFromDOM() || "";

  return { title, price: formatPrice(price), description };
}


function debounce(fn, wait = 200) {
  let t = null;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

const current = {
  title: "",
  price: "",
  description: "",
};

let actionButton = null;
let priceBadge = null;

function updateCurrentAndUI(parsed) {
  const prevPrice = current.price;
  current.title = parsed.title || current.title;
  current.description = parsed.description || current.description;
  current.price = parsed.price || current.price;

  if (actionButton) {
    const badgeText = current.price ? ` ($${formatPrice(current.price)})` : "";
    actionButton.innerText = `Send product for review in Shopify`;
  }

  if (priceBadge && prevPrice !== current.price) {
    priceBadge.innerText = current.price ? `$${formatPrice(current.price)}` : "";
    priceBadge.style.opacity = "1";
    setTimeout(() => {
      priceBadge.style.opacity = "0.6";
    }, 600);
  }
}

const reparseAndUpdate = debounce(() => {
  const parsed = parseAliExpressOnce();
  updateCurrentAndUI(parsed);
}, 200);

let lastStatePrice = null;
const pollAliExpressState = () => {
  try {
    const sPrice = getPriceFromAliExpressState();
    if (sPrice && sPrice !== lastStatePrice) {
      lastStatePrice = sPrice;
      reparseAndUpdate();
    }
  } catch (e) {
  }
};

function attachSkuInteractionListeners() {
  const skuSelectors = [
    "[data-sku-id]",
    ".sku-property",
    ".sku-property__value",
    ".sku-attr",
    ".sku-values",
    ".sku-property-box",
    ".sku-variant",
    ".sku-item",
    "[data-property]",
    "select"
  ];

  document.addEventListener("click", (ev) => {
    const el = ev.target;
    for (const sel of skuSelectors) {
      if (el.closest(sel)) {
        setTimeout(reparseAndUpdate, 80);
        return;
      }
    }
  }, true);

  document.addEventListener("change", (ev) => {
    const el = ev.target;
    if (el && (el.tagName === "SELECT" || el.matches && el.matches("select"))) {
      setTimeout(reparseAndUpdate, 80);
    }
  }, true);
}

function attachMutationObservers() {
  const observer = new MutationObserver(debounce((mutations) => {
    reparseAndUpdate();
  }, 150));

  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  const priceNode =
    document.querySelector('[data-pl="product-price"]') ||
    document.querySelector('[class*="price"]');

  if (priceNode) {
    const priceObs = new MutationObserver(debounce(() => {
      reparseAndUpdate();
    }, 80));
    priceObs.observe(priceNode, { childList: true, subtree: true, characterData: true });
  }
}


function injectUI() {
  if (window.__dropshipImporterInjected) return;
  window.__dropshipImporterInjected = true;

  actionButton = document.createElement("button");
  actionButton.type = "button";
  actionButton.setAttribute("aria-label", "Send product for review in Shopify");

  Object.assign(actionButton.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    zIndex: "999999",
    padding: "12px 16px",
    background: "#008060",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  });

  priceBadge = document.createElement("div");
  Object.assign(priceBadge.style, {
    background: "rgba(0,0,0,0.08)",
    color: "#fff",
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "13px",
    fontWeight: "700",
    opacity: "0.6",
    transition: "opacity 260ms",
    backgroundColor: "rgba(0,0,0,0.2)"
  });

  actionButton.appendChild(priceBadge);

  actionButton.innerText = "Send product for review in Shopify";
  actionButton.prepend(priceBadge);

  document.body.appendChild(actionButton);

  actionButton.addEventListener("click", () => {
    reparseAndUpdate();

    const payload = {
      supplier: "aliexpress",
      title: current.title || parseAliExpressOnce().title,
      price: current.price || parseAliExpressOnce().price,
      description: current.description || parseAliExpressOnce().description,
    };

    if (!payload.title || !payload.price) {
      alert("❌ Failed to extract product data. Make sure a product is selected.");
      return;
    }

    chrome.runtime.sendMessage(
      {
        type: "IMPORT_PRODUCT",
        payload,
      },
      (response) => {
        if (response?.success) {
          alert("✅ Product sent! Open your Shopify app.");
        } else {
          alert("❌ Failed to send product");
        }
      }
    );
  });
}


function startLiveTracking() {
  const parsed = parseAliExpressOnce();
  current.title = parsed.title;
  current.price = parsed.price;
  current.description = parsed.description;

  injectUI();
  updateCurrentAndUI(parsed);

  attachSkuInteractionListeners();
  attachMutationObservers();

  setInterval(pollAliExpressState, 700);

  setInterval(reparseAndUpdate, 3000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startLiveTracking);
} else {
  startLiveTracking();
}
