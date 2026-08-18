import asyncio, os
from playwright.async_api import async_playwright

BASE = "https://social-media-hub-77.preview.emergentagent.com"
OUT = "/app/frontend/public/pitch-shots"
os.makedirs(OUT, exist_ok=True)


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(
            viewport={"width": 1680, "height": 1050},
            device_scale_factor=2,
        )
        page = await ctx.new_page()

        async def safe_goto(url):
            for _ in range(3):
                try:
                    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    await page.wait_for_timeout(1200)
                    return
                except Exception as e:
                    print("goto retry", url, str(e)[:80])
                    await page.wait_for_timeout(1500)

        # LOGIN
        await safe_goto(f"{BASE}/login")
        await page.fill('[data-testid="email-input"]', 'superadmin@quickwing.com')
        await page.fill('[data-testid="password-input"]', 'Super123')
        await page.click('[data-testid="login-button"]')
        await page.wait_for_timeout(4000)

        # Warm tenant context
        await safe_goto(f"{BASE}/test-fleet/bookings")
        await page.wait_for_timeout(3500)

        async def reload_until(url, ok_selector, tries=4, settle=3500):
            for i in range(tries):
                await safe_goto(url)
                try:
                    await page.wait_for_selector(ok_selector, timeout=6000)
                    await page.wait_for_timeout(settle)
                    return True
                except Exception:
                    await page.wait_for_timeout(1500)
            await page.wait_for_timeout(settle)
            return False

        # 1. OVERVIEW
        await safe_goto(f"{BASE}/test-fleet?tab=overview")
        await page.wait_for_timeout(3000)
        # dismiss error by clicking Refresh if present
        try:
            btn = page.get_by_role("button", name="Refresh")
            if await btn.count() > 0:
                await btn.first.click()
                await page.wait_for_timeout(4000)
        except Exception as e:
            print("refresh", e)
        await page.wait_for_timeout(1500)
        await page.screenshot(path=f"{OUT}/01-overview.png", full_page=False)
        print("saved 01")

        # 2. CAR BOOKINGS (fleet board)
        await reload_until(f"{BASE}/test-fleet/bookings",
                           '[data-testid^="fleet-card-"]', settle=4500)
        await page.screenshot(path=f"{OUT}/02-car-bookings.png", full_page=False)
        print("saved 02")

        # 5/6 BOOKING INTELLIGENCE (same page, already loaded)
        await page.wait_for_timeout(1000)
        await page.screenshot(path=f"{OUT}/05-booking-intelligence-board.png", full_page=False)
        el = page.locator('[data-testid="booking-intelligence"]')
        try:
            await el.scroll_into_view_if_needed()
            await page.wait_for_timeout(800)
            box = await el.bounding_box()
            pad = 16
            clip = {
                "x": max(0, box["x"] - pad), "y": max(0, box["y"] - pad),
                "width": min(1680 - max(0, box["x"] - pad), box["width"] + pad * 2),
                "height": box["height"] + pad * 2,
            }
            await page.screenshot(path=f"{OUT}/06-booking-intelligence.png", clip=clip)
            print("saved 05/06", clip)
        except Exception as e:
            print("BI crop err", e)

        # 3. MANAGE VEHICLES
        await safe_goto(f"{BASE}/test-fleet/admin?tab=cars")
        await page.wait_for_timeout(3000)
        try:
            close_btn = page.locator('[data-testid="close-training"]')
            if await close_btn.count() > 0:
                await close_btn.first.click()
                await page.wait_for_timeout(1500)
        except Exception as e:
            print("close modal", e)
        # ensure cars loaded
        try:
            await page.wait_for_selector('text=Fleet Vehicles', timeout=6000)
        except Exception:
            await page.reload(wait_until="domcontentloaded")
            await page.wait_for_timeout(3000)
        await page.wait_for_timeout(1500)
        await page.screenshot(path=f"{OUT}/03-manage-vehicles.png", full_page=False)
        print("saved 03")

        # 4. REPORTS
        await reload_until(f"{BASE}/test-fleet?tab=reports&sub=fleet-reports",
                           'text=All Bookings List', settle=4000)
        await page.screenshot(path=f"{OUT}/04-reports.png", full_page=False)
        print("saved 04")

        await browser.close()


asyncio.run(main())
