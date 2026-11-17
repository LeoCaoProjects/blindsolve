import { NavLink } from "react-router-dom";
export function AdminTabs() {
  return (
    <header className="shrink-0 border-b border-line px-5 md:px-10">
      <div className="mx-auto flex min-h-[60px] w-full max-w-[880px] items-center gap-7">
        <h1 className="text-[14px] font-bold text-ink">Admin</h1>
        <nav aria-label="Admin sections" className="flex items-center gap-5">
          {[
            ["/admin", "Overview"],
            ["/admin/feedback", "Feedback"],
          ].map(([to, title]) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `relative inline-flex h-9 items-center text-[13px] transition-colors ${isActive ? "text-ink after:absolute after:inset-x-0 after:bottom-[3px] after:h-px after:bg-ink" : "text-ink-2 hover:text-ink"}`
              }
            >
              {title}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
