import { lazy, Suspense, useEffect, useState } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import {
  BookOpen,
  Brain,
  Clock3,
  Settings,
  Table2,
  Moon,
  Sun,
} from "lucide-react";
import { StoreProvider, useStore } from "./app/Store";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Dialog } from "./components/Dialog";
import { typingTarget } from "./lib/interaction";
import "@fontsource-variable/source-sans-3";
import "@fontsource/ibm-plex-sans/300.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/instrument-sans/400.css";
import "@fontsource/instrument-sans/500.css";
import "@fontsource/instrument-sans/600.css";
import "@fontsource/jetbrains-mono/200.css";
import "@fontsource/jetbrains-mono/300.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./styles.css";
const Timer = lazy(() => import("./pages/TimerPage")),
  Pairs = lazy(() => import("./pages/PairsPage")),
  Flashcards = lazy(() => import("./pages/FlashcardsPage")),
  Memo = lazy(() => import("./pages/MemoPage")),
  Preferences = lazy(() => import("./pages/SettingsPage"));
const navigation = [
  ["/", "Timer", Clock3],
  ["/pairs", "Letter pairs", Table2],
  ["/flashcards", "Flashcards", BookOpen],
  ["/memo", "Memo trainer", Brain],
  ["/settings", "Settings", Settings],
] as const;
function Shell() {
  const { data, user, ready, sync, message, notify, update, focus } =
      useStore(),
    location = useLocation(),
    timerRoute = location.pathname === "/";
  const [help, setHelp] = useState(false),
    [dark, setDark] = useState(() => {
      try {
        return localStorage.getItem("cubeiq-theme") !== "light";
      } catch {
        return true;
      }
    });
  useEffect(() => {
    const shortcut = (e: KeyboardEvent) => {
      if (
        e.key === "?" &&
        !e.repeat &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !typingTarget(e.target)
      ) {
        e.preventDefault();
        setHelp(true);
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try {
      localStorage.setItem("cubeiq-theme", dark ? "dark" : "light");
    } catch {
      /* Theme preference is optional. */
    }
  }, [dark]);
  useEffect(() => {
    document.title =
      navigation.find((n) => n[0] === location.pathname)?.[1] ??
      "Page not found";
  }, [location.pathname]);
  useEffect(() => {
    const main = document.getElementById("main");
    if (!main) return;
    const focusHeading = () => {
      const heading = main.querySelector<HTMLElement>("h1");
      if (!heading) return false;
      heading.tabIndex = -1;
      if(location.key!=="default")heading.focus({ preventScroll: true });
      const anchor = location.hash
        ? document.getElementById(location.hash.slice(1))
        : null;
      if (anchor) anchor.scrollIntoView();
      else window.scrollTo(0, 0);
      return true;
    };
    if (focusHeading()) return;
    const observer = new MutationObserver(() => {
      if (focusHeading()) observer.disconnect();
    });
    observer.observe(main, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [location.pathname, location.hash,location.key]);
  return (
    <div
      className={`app-shell ${timerRoute ? "timer-shell" : ""}`}
      data-focus={focus}
    >
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {!timerRoute && <header className="app-header no-brand">
        <nav className="app-nav" aria-label="Main navigation">
          {navigation.map(([path, label, Icon]) => (
            <NavLink end to={path} key={path}>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="header-actions">
          <Link
            to="/settings#account"
            className={`sync-status ${sync}`}
            aria-live="polite"
          >
            {
              {
                local: "On this device",
                loading: "Connecting…",
                saving: "Saving…",
                saved: "Synced",
                error: "Sync needs attention",
              }[sync]
            }
          </Link>
          <button
            className="icon-button"
            aria-label={dark ? "Use light theme" : "Use dark theme"}
            onClick={() => setDark(!dark)}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            className="icon-button shortcut-help"
            aria-label="Keyboard shortcuts"
            onClick={() => setHelp(true)}
          >
            ?
          </button>
        </div>
      </header>}
      <main id="main" tabIndex={-1}>
        {message && (
          <div className="status-message" role="status">
            <span>{message}</span>
            <button className="text-button" onClick={() => notify("")}>
              Dismiss
            </button>
          </div>
        )}
        {!ready ? (
          <p className="loading-state" role="status">
            Loading your workspace…
          </p>
        ) : (
          <>
            {!timerRoute && !data.onboarded && (
              <aside className="onboarding">
                <div>
                  <strong>Check your BLD setup</strong>
                  <p>
                    Speffz · DF edge buffer · UBL (L sticker) corner buffer ·
                    white up, green front.
                  </p>
                </div>
                <div className="actions">
                  <Link to="/settings" className="button">
                    Customise
                  </Link>
                  <button
                    className="primary"
                    onClick={() => update((d) => ({ ...d, onboarded: true }))}
                  >
                    Use these defaults
                  </button>
                </div>
              </aside>
            )}
            <ErrorBoundary key={`${user?.id ?? "guest"}:${location.pathname}`}>
              <Suspense
                fallback={
                  <p className="loading-state" role="status">
                    Loading…
                  </p>
                }
              >
                <Routes>
                  <Route path="/" element={<Timer />} />
                  <Route path="/pairs" element={<Pairs />} />
                  <Route path="/flashcards" element={<Flashcards />} />
                  <Route path="/memo" element={<Memo />} />
                  <Route path="/settings" element={<Preferences />} />
                  <Route
                    path="*"
                    element={
                      <section className="empty-state">
                        <h1>Page not found</h1>
                        <Link to="/">Return to timer</Link>
                      </section>
                    }
                  />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </>
        )}
      </main>
      {!timerRoute && help && (
        <Dialog title="Keyboard shortcuts" onClose={() => setHelp(false)}>
          <dl className="shortcut-list">
            <dt>Timer</dt>
            <dd>
              <kbd>Space</kbd> start / split / stop
            </dd>
            <dt>Letter pairs</dt>
            <dd>Arrow keys move · Enter edits · Escape closes</dd>
            <dt>Flashcards</dt>
            <dd>Space reveals · 1 forgot · 2 remembered</dd>
            <dt>Memo recall</dt>
            <dd>Enter checks your answer</dd>
          </dl>
          <p className="subtle">
            Shortcuts do not run while typing in an input.
          </p>
        </Dialog>
      )}
    </div>
  );
}
const router = createBrowserRouter([
  {
    path: "*",
    element: (
      <StoreProvider>
        <Shell />
      </StoreProvider>
    ),
  },
]);
export default function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}
