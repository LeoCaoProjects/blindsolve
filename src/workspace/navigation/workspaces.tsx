import {
  Link,
  useLocation,
  useNavigate,
  type LinkProps,
} from "react-router-dom";

const workspacePaths = ["/", "/training", "/pairs", "/flashcards"] as const;
type WorkspacePath = (typeof workspacePaths)[number];

export function isWorkspacePath(path: unknown): path is WorkspacePath {
  return workspacePaths.some((candidate) => candidate === path);
}

/** History stores presentation only. It can never select a privileged route. */
export function workspacePath(pathname: string, state: unknown): string {
  if (pathname !== "/") return pathname === "/memo" ? "/training" : pathname;
  const selected =
    state && typeof state === "object" && "workspace" in state
      ? state.workspace
      : undefined;
  return isWorkspacePath(selected) ? selected : "/";
}

/** Logical page identity for layouts, keyboard activity and feedback context. */
export function useWorkspaceLocation() {
  const location = useLocation();
  return {
    ...location,
    pathname: workspacePath(location.pathname, location.state),
  };
}

/** Keep legacy hrefs usable for copied links and opening a new browser tab. */
export function WorkspaceLink({ to, onClick, ...props }: LinkProps) {
  const navigate = useNavigate();
  // Ordinary clicks use root + history state. Modified clicks follow the href.
  const workspace = typeof to === "string" && isWorkspacePath(to) ? to : null;
  return (
    <Link
      {...props}
      to={to}
      onClick={(event) => {
        onClick?.(event);
        if (
          workspace &&
          !event.defaultPrevented &&
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey &&
          (!props.target || props.target === "_self") &&
          !props.reloadDocument &&
          !props.download
        ) {
          event.preventDefault();
          void navigate("/", {
            state: { workspace },
            replace: props.replace,
            preventScrollReset: props.preventScrollReset,
          });
        }
      }}
    />
  );
}
