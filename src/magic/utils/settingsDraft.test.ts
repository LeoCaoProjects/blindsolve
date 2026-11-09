import { expect, it } from "vitest";
import { speffzScheme } from "./scheme";
import { readSettingsDraft } from "./settingsDraft";

it.each(["", "B"])(
  "restores an abandoned %j lettering edit on reload while keeping unrelated valid edits",
  (invalid) => {
    const baseSetup = {
      scheme: speffzScheme(),
      schemeName: "Speffz",
      edgeBuffer: "U1",
      cornerBuffer: "U0",
      edgeMethod: "op",
      cornerMethod: "op",
    };
    const setup = {
      ...baseSetup,
      scheme: { ...baseSetup.scheme, U0: invalid, U1: "SH" },
    };
    const view = { top: "white", front: "green" };
    const recovered = readSettingsDraft(
      JSON.stringify({
        version: 1,
        owner: "guest",
        setup,
        baseSetup,
        view,
        baseView: view,
      }),
      "guest",
    )!;
    expect(recovered.setup.scheme.U0).toBe("A");
    expect(recovered.setup.scheme.U1).toBe("SH");
  },
);

it("allows the same label in Edge and Corner scopes when recovering drafts", () => {
  const baseSetup = {
    scheme: speffzScheme(),
    schemeName: "Speffz",
    edgeBuffer: "U1",
    cornerBuffer: "U0",
    edgeMethod: "op",
    cornerMethod: "op",
  };
  const setup = {
    ...baseSetup,
    scheme: { ...baseSetup.scheme, U0: "SH", U1: "SH" },
  };
  const view = { top: "white", front: "green" };
  expect(
    readSettingsDraft(
      JSON.stringify({
        version: 1,
        owner: "guest",
        setup,
        baseSetup,
        view,
        baseView: view,
      }),
      "guest",
    )!.setup,
  ).toEqual(setup);
});
