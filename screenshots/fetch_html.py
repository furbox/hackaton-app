from playwright.sync_api import sync_playwright

URL = "https://urloft.site/"
base = "/g/nyx-workspace/dev/hackaton/bun-svelte-v2/screenshots"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.goto(URL, wait_until="networkidle", timeout=30000)
    html = page.content()
    with open(f"{base}/urloft_page.html", "w", encoding="utf-8") as f:
        f.write(html)
    print(f"HTML length: {len(html)} chars")
    browser.close()
