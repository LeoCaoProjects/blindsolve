import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import {
  WorkspaceLink,
  useWorkspaceLocation,
  workspacePath,
} from "./workspaces";

describe("workspace history", () => {
  it.each(["/", "/training", "/pairs", "/flashcards"])(
    "restores the public workspace %s at the root URL",
    (workspace) => expect(workspacePath("/", { workspace })).toBe(workspace),
  );

  it.each([
    null,
    {},
    { workspace: "/admin/feedback" },
    { workspace: "/settings" },
    { workspace: "https://example.com" },
    { workspace: ["/pairs"] },
  ])("rejects invalid or privileged workspace state %j", (state) =>
    expect(workspacePath("/", state)).toBe("/"),
  );

  it.each(["/settings", "/signin", "/admin/feedback", "/missing"])(
    "never overrides the explicit route %s with workspace state",
    (path) => expect(workspacePath(path, { workspace: "/pairs" })).toBe(path),
  );

  function Probe() {
    const location = useLocation();
    const workspace = useWorkspaceLocation();
    return (
      <output>
        {location.pathname}|{workspace.pathname}
      </output>
    );
  }

  it("navigates at root while retaining a working legacy href", () => {
    render(
      <MemoryRouter>
        <WorkspaceLink to="/pairs">Pairs</WorkspaceLink>
        <Probe />
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: "Pairs" });
    expect(link.getAttribute("href")).toBe("/pairs");
    fireEvent.click(link);
    expect(screen.getByRole("status").textContent).toBe("/|/pairs");
  });

  it("honours a prevented navigation without changing history", () => {
    render(
      <MemoryRouter>
        <WorkspaceLink
          to="/training"
          onClick={(event) => event.preventDefault()}
        >
          Training
        </WorkspaceLink>
        <Probe />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("link", { name: "Training" }));
    expect(screen.getByRole("status").textContent).toBe("/|/");
  });
});
