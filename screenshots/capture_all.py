from playwright.sync_api import sync_playwright
import json

URL = "https://urloft.site/"
OUTPUT_DIR = "/g/nyx-workspace/dev/hackaton/bun-svelte-v2/screenshots"

viewports = [
    {"name": "desktop", "width": 1920, "height": 1080},
    {"name": "laptop",  "width": 1366, "height": 768},
    {"name": "tablet",  "width": 768,  "height": 1024},
    {"name": "mobile",  "width": 375,  "height": 812},
]

metrics = {}

with sync_playwright() as p:
    browser = p.chromium.launch()

    for vp in viewports:
        page = browser.new_page(viewport={"width": vp["width"], "height": vp["height"]})
        page.goto(URL, wait_until="networkidle", timeout=30000)

        # Above-the-fold screenshot
        path = f"{OUTPUT_DIR}/{vp['name']}_atf.png"
        page.screenshot(path=path, full_page=False)

        # Full-page screenshot for desktop and mobile only
        if vp["name"] in ("desktop", "mobile"):
            full_path = f"{OUTPUT_DIR}/{vp['name']}_full.png"
            page.screenshot(path=full_path, full_page=True)

        # Collect DOM metrics
        data = page.evaluate("""() => {
            const h1 = document.querySelector('h1');
            const ctas = Array.from(document.querySelectorAll('a, button')).filter(el => {
                const text = el.innerText || '';
                return text.length > 0 && text.length < 60;
            });
            const viewport_meta = document.querySelector('meta[name="viewport"]');
            const images = Array.from(document.querySelectorAll('img'));
            const fonts = Array.from(document.querySelectorAll('*')).map(el => {
                const fs = window.getComputedStyle(el).fontSize;
                return parseFloat(fs);
            }).filter(Boolean);

            // Touch targets: find elements with small bounding boxes
            const smallTargets = Array.from(document.querySelectorAll('a, button')).map(el => {
                const r = el.getBoundingClientRect();
                return {tag: el.tagName, text: (el.innerText||'').slice(0,40), w: Math.round(r.width), h: Math.round(r.height)};
            }).filter(t => t.w > 0 && t.h > 0 && (t.w < 48 || t.h < 48));

            const bodyScrollWidth = document.body.scrollWidth;
            const windowWidth = window.innerWidth;

            // Check for images without explicit dimensions (CLS risk)
            const imgsNoDims = images.filter(img => !img.hasAttribute('width') || !img.hasAttribute('height'))
                                     .map(img => ({src: img.src.slice(0,60), alt: img.alt}));

            return {
                h1_text: h1 ? h1.innerText : null,
                h1_visible: h1 ? h1.getBoundingClientRect().top < window.innerHeight : false,
                viewport_meta: viewport_meta ? viewport_meta.getAttribute('content') : null,
                cta_count: ctas.length,
                first_cta_text: ctas.length ? (ctas[0].innerText||'').slice(0,50) : null,
                first_cta_visible: ctas.length ? ctas[0].getBoundingClientRect().top < window.innerHeight : false,
                small_touch_targets: smallTargets.slice(0, 20),
                horizontal_scroll: bodyScrollWidth > windowWidth,
                body_scroll_width: bodyScrollWidth,
                window_width: windowWidth,
                min_font: Math.min(...fonts),
                max_font: Math.max(...fonts),
                imgs_no_dims: imgsNoDims.slice(0, 10),
                total_imgs: images.length,
            };
        }""")
        metrics[vp["name"]] = data
        page.close()

    browser.close()

print(json.dumps(metrics, indent=2))
