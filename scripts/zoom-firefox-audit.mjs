// Test-only native zoom extension; nothing here is loaded by the application.
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  levels,
  modes,
  routes,
  sizes,
  base,
  output,
  pause,
  measure,
  prototype,
} from "./zoom-audit.mjs";

await mkdir(output, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), "blindsolve-firefox-"));
await writeFile(
  join(profile, "user.js"),
  'user_pref("browser.shell.checkDefaultBrowser", false);\nuser_pref("browser.startup.homepage_override.mstone", "ignore");',
);
const port = 9300 + Math.floor(Math.random() * 500);
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
  { windowsHide: true },
);
proc.stderr.on("data", (b) => {
  if (String(b).includes("WebDriver BiDi")) process.stderr.write(b);
});
let ws;
for (let attempt = 0; attempt < 30; attempt++) {
  const candidate = new WebSocket(`ws://127.0.0.1:${port}/session`);
  if (
    await new Promise((resolve) => {
      candidate.onopen = () => resolve(true);
      candidate.onerror = () => resolve(false);
    })
  ) {
    ws = candidate;
    break;
  }
  await pause(500);
}
if (!ws) {
  proc.kill();
  throw Error("Firefox BiDi did not start");
}
let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (pending.has(msg.id)) {
    const { resolve, reject, timer } = pending.get(msg.id);
    clearTimeout(timer);
    pending.delete(msg.id);
    msg.type === "error"
      ? reject(new Error(JSON.stringify(msg)))
      : resolve(msg.result);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const key = ++id;
    const timer = setTimeout(() => reject(Error(`Timeout: ${method}`)), 45000);
    pending.set(key, { resolve, reject, timer });
    ws.send(JSON.stringify({ id: key, method, params }));
  });
try {
  const session = await send("session.new", {
    capabilities: { alwaysMatch: { acceptInsecureCerts: true } },
  });
  const { contexts } = await send("browsingContext.getTree");
  const context = contexts[0].context;
  const evaluate = async (expression) => {
    const result = await send("script.evaluate", {
      expression: `JSON.stringify((${expression}))`,
      target: { context },
      awaitPromise: true,
    });
    if (result.type !== "success") throw Error(JSON.stringify(result));
    return result.result.value === undefined
      ? null
      : JSON.parse(result.result.value);
  };
  const addon = join(profile, "zoom-addon");
  await mkdir(addon);
  await writeFile(
    join(addon, "manifest.json"),
    JSON.stringify({
      manifest_version: 2,
      name: "Local zoom investigation",
      version: "1.0",
      permissions: ["tabs", "http://127.0.0.1/*"],
      background: { scripts: ["background.js"] },
      content_scripts: [
        { matches: ["http://127.0.0.1/*"], js: ["content.js"] },
      ],
    }),
  );
  await writeFile(
    join(addon, "background.js"),
    "browser.runtime.onMessage.addListener((m,s) => browser.tabs.setZoom(s.tab.id,m.zoom).then(()=>browser.tabs.getZoom(s.tab.id)));",
  );
  await writeFile(
    join(addon, "content.js"),
    'new MutationObserver(()=>{const z=document.documentElement.getAttribute("data-test-zoom");if(z)browser.runtime.sendMessage({zoom:Number(z)}).then(v=>{document.documentElement.removeAttribute("data-test-zoom");document.documentElement.setAttribute("data-zoom-ack",String(v));});}).observe(document.documentElement,{attributes:true,attributeFilter:["data-test-zoom"]});document.documentElement.setAttribute("data-zoom-ready","true");',
  );
  await send("webExtension.install", {
    extensionData: { type: "path", path: addon },
  });
  const navigate = async (route) => {
    await send("browsingContext.navigate", {
      context,
      url: base + route,
      wait: "complete",
    });
    await pause(700);
  };
  const setZoom = async (zoom) => {
    for (let i = 0; i < 100; i++) {
      if (
        await evaluate(
          `document.documentElement.getAttribute('data-zoom-ready')==='true'`,
        )
      )
        break;
      if (i === 99)
        throw Error(
          "Firefox test extension content script did not become ready",
        );
      await pause(100);
    }
    await evaluate(
      `(()=>{document.documentElement.removeAttribute('data-zoom-ack');document.documentElement.setAttribute('data-test-zoom','${zoom}');return true})()`,
    );
    for (let i = 0; i < 100; i++) {
      const ack = await evaluate(
        `document.documentElement.getAttribute('data-zoom-ack')`,
      );
      if (ack && Math.abs(Number(ack) - zoom) < 0.001) {
        await pause(300);
        return;
      }
      await pause(100);
    }
    throw Error(
      `Native Firefox zoom ${zoom} was not acknowledged: ${JSON.stringify(await evaluate("({...document.documentElement.dataset})"))}`,
    );
  };
  await navigate("/");
  await send("browsingContext.setViewport", {
    context,
    viewport: { width: 1440, height: 900 },
  });
  const rows = [],
    responsive = [];
  const collect = async (zoom, mode, extra = {}) => {
    const row = {
      browser: session.capabilities.browserVersion,
      zoom,
      mode,
      ...extra,
      ...(await evaluate(`(${measure.toString()})()`)),
    };
    rows.push(row);
    return row;
  };
  for (const zoom of levels) {
    await setZoom(zoom);
    for (const route of routes) {
      await navigate(route);
      if (
        (process.env.ZOOM_BASELINE_ONLY || process.env.ZOOM_VIEWPORT) &&
        ["/", "/training"].includes(route)
      ) {
        for (let i = 0; i < 90; i++) {
          if (
            await evaluate(
              `(()=>{const el=document.querySelector('button[aria-label="New scramble"]');return !!el&&!el.disabled;})()`,
            )
          )
            break;
          if (i === 89) throw Error("Scramble did not become ready");
          await pause(500);
        }
      }
      const actual = await evaluate("devicePixelRatio");
      if (Math.abs(actual - zoom) > 0.025)
        throw Error(`Firefox zoom mismatch ${zoom}: ${actual}`);
      for (const mode of modes) {
        if (mode === "viewport") await navigate(route + "?sizing=viewport");
        await evaluate(
          `(${prototype.toString()})(${JSON.stringify({ mode, zoom })})`,
        );
        await pause(250);
        await collect(zoom, mode);
        if (process.env.ZOOM_BASELINE_ONLY && mode === "baseline") {
          const capture = await send("browsingContext.captureScreenshot", {
            context,
            origin: "viewport",
          });
          await writeFile(
            join(output, `firefox-ready-${route.slice(1) || "timer"}.png`),
            Buffer.from(capture.data, "base64"),
          );
        }
        if (route === "/" && mode !== "transform") {
          const screenshot = await send("browsingContext.captureScreenshot", {
            context,
            origin: "viewport",
          });
          await writeFile(
            join(output, `firefox-${zoom}-${mode}.png`),
            Buffer.from(screenshot.data, "base64"),
          );
          for (const [selector, overlay] of [
            ['button[aria-label="Timer mode"]', "popover"],
            ['button[aria-label="Keyboard shortcuts  ?"]', "sheet"],
          ]) {
            let clicked;
            if (process.env.ZOOM_VIEWPORT) {
              const point = await evaluate(
                `(()=>{const el=document.querySelector(${JSON.stringify(selector)});const r=el?.getBoundingClientRect();return r?.width&&r?.height?{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}:null;})()`,
              );
              clicked = !!point;
              if (point)
                await send("input.performActions", {
                  context,
                  actions: [
                    {
                      type: "pointer",
                      id: "audit-mouse",
                      parameters: { pointerType: "mouse" },
                      actions: [
                        { type: "pointerMove", ...point, origin: "viewport" },
                        { type: "pointerDown", button: 0 },
                        { type: "pointerUp", button: 0 },
                      ],
                    },
                  ],
                });
            } else
              clicked = await evaluate(
                `(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el||!el.getBoundingClientRect().width)return false;el.click();return true;})()`,
              );
            if (clicked) {
              await pause(300);
              const row = await collect(zoom, mode, { overlay });
              if (mode === "viewport" && !row.elements.dialog)
                throw Error(
                  `Firefox native pointer missed ${overlay} at ${zoom}`,
                );
              if (process.env.ZOOM_VIEWPORT)
                await send("input.performActions", {
                  context,
                  actions: [
                    {
                      type: "key",
                      id: "audit-keyboard",
                      actions: [
                        { type: "keyDown", value: "\uE00C" },
                        { type: "keyUp", value: "\uE00C" },
                      ],
                    },
                  ],
                });
              else
                await evaluate(
                  `(()=>{window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return true})()`,
                );
              await pause(200);
            }
          }
        }
      }
      await evaluate(
        `(${prototype.toString()})(${JSON.stringify({ mode: "baseline", zoom })})`,
      );
    }
    console.log("Firefox measured", zoom);
    await writeFile(
      join(
        output,
        process.env.ZOOM_BASELINE_ONLY
          ? "firefox-baseline.json"
          : "firefox.json",
      ),
      JSON.stringify({ rows, responsive }, null, 2),
    );
  }
  await setZoom(1);
  for (const [width, height] of process.env.ZOOM_SKIP_RESIZE ? [] : sizes) {
    await send("browsingContext.setViewport", {
      context,
      viewport: { width, height },
    });
    for (const route of routes.slice(0, 5)) {
      await navigate(
        route + (process.env.ZOOM_VIEWPORT ? "?sizing=viewport" : ""),
      );
      responsive.push({
        width,
        height,
        ...(await evaluate(`(${measure.toString()})()`)),
      });
    }
  }
  await writeFile(
    join(
      output,
      process.env.ZOOM_BASELINE_ONLY ? "firefox-baseline.json" : "firefox.json",
    ),
    JSON.stringify({ rows, responsive }, null, 2),
  );
} finally {
  await send("browser.close").catch(() => {});
  ws.close();
  proc.kill();
}
