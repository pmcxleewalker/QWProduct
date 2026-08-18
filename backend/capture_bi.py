import asyncio, os
from playwright.async_api import async_playwright
BASE = "https://social-media-hub-77.preview.emergentagent.com"
OUT = "/app/frontend/public/pitch-shots"


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1680, "height": 1050}, device_scale_factor=2)
        page = await ctx.new_page()

        async def safe_goto(url):
            for _ in range(3):
                try:
                    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    await page.wait_for_timeout(1200)
                    return
                except Exception as e:
                    print("retry", str(e)[:60]); await page.wait_for_timeout(1500)

        await safe_goto(f"{BASE}/login")
        await page.fill('[data-testid="email-input"]', 'superadmin@quickwing.com')
        await page.fill('[data-testid="password-input"]', 'Super123')
        await page.click('[data-testid="login-button"]')
        await page.wait_for_timeout(4000)
        # warm
        await safe_goto(f"{BASE}/test-fleet/bookings")
        await page.wait_for_timeout(3500)
        # reload to load data under tenant token
        await safe_goto(f"{BASE}/test-fleet/bookings")
        await page.wait_for_selector('[data-testid="fleet-card"], [data-testid^="fleet-card-"]', timeout=12000)
        await page.wait_for_timeout(5000)  # BI analysis + cards
        el = page.locator('[data-testid="booking-intelligence"]')
        box = await el.bounding_box()
        print("box", box)
        pad = 16
        clip = {"x": max(0, box["x"] - pad), "y": max(0, box["y"] - pad),
                "width": min(1680 - max(0, box["x"] - pad), box["width"] + pad * 2),
                "height": box["height"] + pad * 2}
        await page.screenshot(path=f"{OUT}/06-booking-intelligence.png", clip=clip)
        print("saved 06", clip)
        await browser.close()

asyncio.run(main())
