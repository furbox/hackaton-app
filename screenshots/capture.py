from playwright.sync_api import sync_playwright

URL = "https://urloft.site/"

viewports = [
    ("desktop", 1920, 1080),
    ("laptop", 1366, 768),
    ("tablet", 768, 1024),
    ("mobile", 375, 812),
]

base = "/g/nyx-workspace/dev/hackaton/bun-svelte-v2/screenshots"

with sync_playwright() as p:
    browser = p.chromium.launch()
    for name, w, h in viewports:
        page = browser.new_page(viewport={"width": w, "height": h})
        page.goto(URL, wait_until="networkidle", timeout=30000)
        path = f"{base}/urloft_{name}.png"
        page.screenshot(path=path, full_page=False)
        print(f"Saved {path}")
        page.close()
    browser.close()
print("Done.")
