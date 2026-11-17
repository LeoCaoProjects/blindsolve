import { expect, test } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`provider icons remain contained and transparent at ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/src/lib/supabase.ts*", async route => {
      const response = await route.fetch();
      const body = (await response.text())
        .replace(/const url = [^;]+;/, 'const url = "http://127.0.0.1:54321";')
        .replace(/const anonKey = [^;]+;/, 'const anonKey = "synthetic-public-key";');
      await route.fulfill({ response, body });
    });
    await page.route("http://127.0.0.1:54321/**", route => route.fulfill({ json: {} }));
    for (const [path, size, googleSize] of [["/signin", 20, 16], ["/settings", 16, 14]] as const) {
      await page.goto(path);
      const wca = page.getByRole("button", { name: "Continue with WCA", exact: true });
      const google = page.getByRole("button", { name: "Continue with Google", exact: true });
      await expect(wca).toBeVisible();
      await wca.scrollIntoViewIfNeeded();
      const logo = wca.locator("img");
      await expect(logo).toHaveAttribute("width", String(size));
      await expect(logo).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      expect(await logo.evaluate(async (img: HTMLImageElement) => {
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const context = canvas.getContext("2d")!;
        context.drawImage(img, 0, 0);
        return context.getImageData(0, 0, 1, 1).data[3];
      })).toBe(0);
      await expect(google.locator("svg")).toHaveAttribute("width", String(googleSize));
      const buttonBox = (await wca.boundingBox())!;
      const logoBox = (await logo.boundingBox())!;
      expect(logoBox.height).toBeLessThan(buttonBox.height / 2);
      expect(Math.abs(logoBox.y + logoBox.height / 2 - buttonBox.y - buttonBox.height / 2)).toBeLessThan(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: info.outputPath(`${path.slice(1)}-${width}.png`) });
    }
    expect(errors).toEqual([]);
  });
}
