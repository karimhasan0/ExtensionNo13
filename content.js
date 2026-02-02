function parseAliExpress() {
  // ✅ TITLE (AliExpress-specific)
  const title =
    document.querySelector('[data-pl="product-title"]')?.innerText?.trim() ||
    document.querySelector('h1[class*="title"]')?.innerText?.trim() ||
    document.querySelector('h1')?.innerText?.trim() ||
    "";

  // ✅ PRICE (handles ranges & discounts)
  let priceText =
    document.querySelector('[data-pl="product-price"]')?.innerText ||
    document.querySelector('[class*="price"]')?.innerText ||
    "";

  priceText = priceText.replace(/,/g, "");
  const match = priceText.match(/(\d+(\.\d+)?)/);
  const price = match ? match[1] : "";

  // ✅ DESCRIPTION (best safe source)
  const description =
    document.querySelector('[data-pl="product-description"]')?.innerText ||
    document.querySelector('meta[name="description"]')?.content ||
    "";

  return { title, price, description };
}


if (!window.__dropshipImporterInjected) {
  window.__dropshipImporterInjected = true;

  const button = document.createElement("button");
  button.innerText = "Send product for review in Shopify";

  Object.assign(button.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    zIndex: "9999",
    padding: "12px 16px",
    background: "#008060",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  });

  document.body.appendChild(button);

  button.addEventListener("click", () => {
    const parsed = parseAliExpress();

    if (!parsed.title || !parsed.price) {
      alert("Failed to extract product data");
      return;
    }

    chrome.runtime.sendMessage(
      {
        type: "IMPORT_PRODUCT",
        payload: {
          supplier: "aliexpress",
          title: parsed.title,
          price: parsed.price,
          description: parsed.description,
        },
      },
      (response) => {
        if (response?.success) {
          alert("Product sent 🚀 Please check the app again in shopify");
        } else {
          alert("Failed to send product");
        }
      }
    );
  });
}