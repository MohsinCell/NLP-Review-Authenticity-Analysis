const PRODUCT_PATTERNS = [
  { pattern: /amazon\.(com|in|co\.uk|ca|de|fr|it|es|com\.au|co\.jp)\/.*\/(dp|gp\/product)\//, name: 'Amazon' },
  { pattern: /flipkart\.com\/.*\/p\//, name: 'Flipkart' },
  { pattern: /myntra\.com\/.*\/buy/, name: 'Myntra' },
  { pattern: /ajio\.com\/.*\/p\//, name: 'Ajio' },
  { pattern: /nykaa\.com\/.*\/p\/|nykaafashion\.com\/.*\/p\//, name: 'Nykaa' },
];

function detectProductPage() {
  const url = window.location.href;
  for (const p of PRODUCT_PATTERNS) {
    if (p.pattern.test(url)) {
      return { detected: true, site: p.name, url };
    }
  }
  return { detected: false, site: null, url };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'DETECT_PAGE') {
    sendResponse(detectProductPage());
  }
  return true;
});

const result = detectProductPage();
if (result.detected) {
  chrome.runtime.sendMessage({
    type: 'PRODUCT_PAGE_DETECTED',
    site: result.site,
    url: result.url,
  });
}
