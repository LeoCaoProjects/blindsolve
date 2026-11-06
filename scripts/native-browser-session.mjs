// Isolated test-only native page zoom. Never imported by the application.
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
export const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function nativeBrowser(engine) {
  const profile = await mkdtemp(join(tmpdir(), `blindsolve-live-${engine}-`));
  const extension = join(profile, "zoom-control");
  await mkdir(extension);
  const firefox = engine === "firefox";
  await writeFile(
    join(extension, "manifest.json"),
    JSON.stringify({
      manifest_version: firefox ? 2 : 3,
      name: "BlindSolve local zoom audit",
      version: "1.0",
      permissions: ["tabs"],
      ...(firefox
        ? { permissions: ["tabs", "http://127.0.0.1/*"] }
        : { host_permissions: ["http://127.0.0.1/*"] }),
      background: firefox
        ? { scripts: ["background.js"] }
        : { service_worker: "background.js" },
      content_scripts: [
        { matches: ["http://127.0.0.1/*"], js: ["content.js"] },
      ],
    }),
  );
  await writeFile(
    join(extension, "background.js"),
    firefox
      ? "browser.runtime.onMessage.addListener((m,s)=>browser.tabs.setZoom(s.tab.id,m.zoom).then(()=>browser.tabs.getZoom(s.tab.id)));"
      : "chrome.runtime.onMessage.addListener((m,s,reply)=>{chrome.tabs.setZoom(s.tab.id,m.zoom).then(()=>chrome.tabs.getZoom(s.tab.id)).then(reply);return true;});",
  );
  await writeFile(
    join(extension, "content.js"),
    'new MutationObserver(()=>{const z=document.documentElement.getAttribute("data-test-zoom");if(z)' +
      (firefox ? "browser" : "chrome") +
      '.runtime.sendMessage({zoom:Number(z)}).then(v=>{document.documentElement.removeAttribute("data-test-zoom");document.documentElement.setAttribute("data-zoom-ack",String(v));});}).observe(document.documentElement,{attributes:true,attributeFilter:["data-test-zoom"]});document.documentElement.setAttribute("data-zoom-ready","true");',
  );
  let evaluate,
    navigate,
    resize,
    resizeWindow,
    screenshot,
    close,
    version,
    page,
    key,
    click;
  if (!firefox) {
    const context = await chromium.launchPersistentContext(profile, {
      channel: "chrome",
      headless: true,
      viewport: null,
      ignoreDefaultArgs: ["--disable-extensions"],
      args: ["--window-size=1458,996", "--enable-unsafe-extension-debugging"],
    });
    page = context.pages()[0];
    const cdp = await context.newCDPSession(page);
    const browserCdp = await context.browser().newBrowserCDPSession();
    await browserCdp.send("Extensions.loadUnpacked", { path: extension });
    const { windowId } = await cdp.send("Browser.getWindowForTarget");
    evaluate = (fn, arg) => page.evaluate(fn, arg);
    navigate = (url) => page.goto(url);
    // Native window resizing, not a layout-viewport override.
    const trim = await page.evaluate(() => ({
      width: outerWidth - innerWidth,
      height: outerHeight - innerHeight,
    }));
    resize = (width, height) =>
      cdp.send("Browser.setWindowBounds", {
        windowId,
        bounds: {
          width: Math.round(width + trim.width),
          height: Math.round(height + trim.height),
        },
      });
    resizeWindow = resize;
    screenshot = async (path) => {
      const capture = await cdp.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
      });
      await writeFile(path, Buffer.from(capture.data, "base64"));
    };
    close = () => context.close();
    version = context.browser().version();
    key = async (value, hold = 0) => {
      await page.keyboard.down(value);
      if (hold) await pause(hold);
      await page.keyboard.up(value);
    };
    click = (selector) => page.locator(selector).click();
  } else {
    await writeFile(
      join(profile, "user.js"),
      'user_pref("browser.shell.checkDefaultBrowser",false);\nuser_pref("browser.startup.homepage_override.mstone","ignore");',
    );
    const port = 9400 + Math.floor(Math.random() * 1000);
    const proc = spawn(
      "C:/Program Files/Mozilla Firefox/firefox.exe",
      [
        "--headless",
        "--no-remote",
        "--profile",
        profile,
        `--remote-debugging-port=${port}`,
        "about:blank",
      ],
      { windowsHide: true, stdio: "ignore" },
    );
    let socket;
    for (let attempt = 0; attempt < 40; attempt++) {
      const candidate = new WebSocket(`ws://127.0.0.1:${port}/session`);
      if (
        await new Promise((resolve) => {
          candidate.onopen = () => resolve(true);
          candidate.onerror = () => resolve(false);
        })
      ) {
        socket = candidate;
        break;
      }
      await pause(300);
    }
    if (!socket) {
      proc.kill();
      throw Error("Firefox did not start");
    }
    let id = 0;
    const pending = new Map();
    socket.onmessage = (event) => {
      const result = JSON.parse(event.data),
        entry = pending.get(result.id);
      if (entry) {
        clearTimeout(entry.timer);
        pending.delete(result.id);
        result.type === "error"
          ? entry.reject(Error(JSON.stringify(result)))
          : entry.resolve(result.result);
      }
    };
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const key = ++id,
          timer = setTimeout(() => {
            pending.delete(key);
            reject(Error(`Timeout ${method}`));
          }, 45000);
        pending.set(key, { resolve, reject, timer });
        socket.send(JSON.stringify({ id: key, method, params }));
      });
    const session = await send("session.new", {
      capabilities: { alwaysMatch: {} },
    });
    version = session.capabilities.browserVersion;
    const { contexts } = await send("browsingContext.getTree");
    const context = contexts[0].context;
    evaluate = async (fn, arg) => {
      const result = await send("script.evaluate", {
        expression: `(async()=>JSON.stringify(await (${fn.toString()})(${JSON.stringify(arg) ?? "undefined"})))()`,
        target: { context },
        awaitPromise: true,
      });
      if (result.type !== "success") throw Error(JSON.stringify(result));
      return result.result.value === undefined
        ? undefined
        : JSON.parse(result.result.value);
    };
    navigate = (url) =>
      send("browsingContext.navigate", { context, url, wait: "complete" });
    resize = (width, height) =>
      send("browsingContext.setViewport", {
        context,
        viewport: { width, height },
      });
    const windowTrim = await evaluate(() => ({
      width: outerWidth - innerWidth,
      height: outerHeight - innerHeight,
    }));
    resizeWindow = async (width, height) => {
      await send("browsingContext.setViewport", { context, viewport: null });
      const { clientWindows } = await send("browser.getClientWindows");
      let targetWidth = width + windowTrim.width,
        targetHeight = height + windowTrim.height,
        last = "";
      for (let attempt = 0; attempt < 3; attempt++) {
        await send("browser.setClientWindowState", {
          clientWindow: clientWindows[0].clientWindow,
          state: "normal",
          width: Math.max(1, Math.round(targetWidth)),
          height: Math.max(1, Math.round(targetHeight)),
        });
        const actual = await evaluate(() => [innerWidth, innerHeight]);
        if (
          (Math.abs(actual[0] - width) < 1 &&
            Math.abs(actual[1] - height) < 1) ||
          actual.join(",") === last
        )
          return;
        last = actual.join(",");
        targetWidth += width - actual[0];
        targetHeight += height - actual[1];
      }
    };
    screenshot = async (path) => {
      const capture = await send("browsingContext.captureScreenshot", {
        context,
        origin: "viewport",
      });
      await writeFile(path, Buffer.from(capture.data, "base64"));
    };
    key = async (value, hold = 0) => {
      const code =
        { Space: " ", Escape: "\uE00C", Enter: "\uE007", ArrowRight: "\uE014" }[
          value
        ] ?? value;
      await send("input.performActions", {
        context,
        actions: [
          {
            type: "key",
            id: "state-keys",
            actions: [{ type: "keyDown", value: code }],
          },
        ],
      });
      if (hold) await pause(hold);
      await send("input.performActions", {
        context,
        actions: [
          {
            type: "key",
            id: "state-keys",
            actions: [{ type: "keyUp", value: code }],
          },
        ],
      });
    };
    click = async (selector) => {
      const point = await evaluate((value) => {
        const el = document.querySelector(value);
        if (!el) throw Error(`Missing ${value}`);
        const r = el.getBoundingClientRect();
        return {
          x: Math.round(r.x + r.width / 2),
          y: Math.round(r.y + r.height / 2),
        };
      }, selector);
      await send("input.performActions", {
        context,
        actions: [
          {
            type: "pointer",
            id: "state-mouse",
            parameters: { pointerType: "mouse" },
            actions: [
              { type: "pointerMove", ...point, origin: "viewport" },
              { type: "pointerDown", button: 0 },
              { type: "pointerUp", button: 0 },
            ],
          },
        ],
      });
    };
    close = async () => {
      await send("browser.close").catch(() => {});
      socket.close();
      proc.kill();
    };
    await send("webExtension.install", {
      extensionData: { type: "path", path: extension },
    });
  }
  const zoom = async (factor) => {
    for (let i = 0; i < 100; i++) {
      if (
        await evaluate(
          () =>
            document.documentElement.getAttribute("data-zoom-ready") === "true",
        )
      )
        break;
      if (i === 99) throw Error("Native zoom extension not ready");
      await pause(100);
    }
    await evaluate((value) => {
      document.documentElement.removeAttribute("data-zoom-ack");
      document.documentElement.setAttribute("data-test-zoom", String(value));
    }, factor);
    for (let i = 0; i < 100; i++) {
      const ack = await evaluate(() =>
        document.documentElement.getAttribute("data-zoom-ack"),
      );
      if (ack && Math.abs(Number(ack) - factor) < 0.001) return;
      if (i === 99) throw Error(`Native zoom ${factor} not acknowledged`);
      await pause(50);
    }
  };
  return {
    engine,
    version,
    evaluate,
    navigate,
    resize,
    resizeWindow,
    screenshot,
    close,
    zoom,
    page,
    key,
    click,
  };
}
