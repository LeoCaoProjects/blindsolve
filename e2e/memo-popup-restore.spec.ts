import { test, expect, type Page } from "@playwright/test";
import { createSpeffzScheme } from "../src/domain/bld/speffz";

async function completedMemo(page: Page, savedWord = false) {
  const scheme = createSpeffzScheme();
  const first = Object.values(scheme.stickers).find(
    (s) => s.pieceType === "corner" && s.label === "P",
  )!;
  const second = Object.values(scheme.stickers).find(
    (s) => s.pieceType === "corner" && s.label === "F",
  )!;
  const pairs = savedWord
    ? {
        [JSON.stringify([first.id, second.id])]: {
          id: "e8a502fb-b967-4c98-bc5d-b108ae767283",
          firstStickerId: first.id,
          secondStickerId: second.id,
          firstToken: "P",
          secondToken: "F",
          primaryMnemonic: "puff",
          alternates: [],
          encounters: 0,
          forgotten: 0,
          updatedAt: new Date().toISOString(),
        },
      }
    : {};
  await page.addInitScript(
    ({ scheme, pairs }) =>
      localStorage.setItem(
        "cubeiq-bld-v2:guest",
        JSON.stringify({
          data: {
            scheme,
            onboarded: true,
            pairs,
            attempts: [],
            solves: [],
          },
          revision: 0,
          dirty: false,
        }),
      ),
    { scheme, pairs },
  );
  await page.addInitScript(() => {
    const original = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = ((array: any) => {
      if (array instanceof Uint32Array && array.length === 1) {
        array[0] = 41337;
        return array;
      }
      return original(array);
    }) as typeof crypto.getRandomValues;
  });
  await page.goto("/training");
  await page.getByRole("radio", { name: "Memo Recall", exact: true }).click();
  await expect(
    page.locator("[data-training-region][data-transitioning=true]"),
  ).toHaveCount(0);
  await page.keyboard.down("Space");
  await page.waitForTimeout(320);
  await page.keyboard.up("Space");
  await expect(page.getByRole("timer", { name: "Memorisation" })).toBeVisible();
  const sequences = await page
    .locator("[data-training-targets] ol[aria-label]")
    .evaluateAll((elements) =>
      elements.map((el) => el.getAttribute("aria-label")!.split(" ")),
    );
  await page.keyboard.press("Space");
  const inputs = page.getByRole("textbox", { name: /Recall (corners|edges)/ });
  for (let i = 0; i < sequences.length; i++) {
    const answer = [...sequences[i]];
    if (i === 0) answer[0] = answer[0] === "A" ? "B" : "A";
    await inputs.nth(i).fill(answer.join(""));
    await inputs.nth(i).press("Enter");
  }
  const popup = page.getByRole("dialog", {
    name: "Memo Recall review",
    exact: true,
  });
  await expect(popup).toBeVisible();
  await expect(popup).toHaveCSS("transform", "none");
  return popup;
}

async function stored(page: Page) {
  return page.evaluate(
    () => JSON.parse(localStorage.getItem("cubeiq-bld-v2:guest")!).data,
  );
}

test("Memo mnemonic input and footer stay stable; explicit Save persists and closes", async ({
  page,
}) => {
  const popup = await completedMemo(page);
  const field = popup.getByRole("textbox", { name: /^Word for/ }).first();
  const suggest = popup
    .getByRole("button", { name: /^Suggest word for/ })
    .first();
  const save = popup.getByRole("button", { name: /^Save/ });
  const remove = popup.getByRole("button", {
    name: "Delete attempt",
    exact: true,
  });
  await expect(field).toHaveAttribute("placeholder", "Enter word");
  await expect(suggest).toHaveText("");
  await expect(suggest.locator("svg")).toBeVisible();
  await expect(popup.getByText("Suggest", { exact: true })).toHaveCount(0);
  const geometry = () =>
    popup.evaluate((el) => {
      const box = (node: Element) => {
        const r = node.getBoundingClientRect();
        return [r.x, r.y, r.width, r.height];
      };
      const input = el.querySelector('input[aria-label^="Word for"]')!;
      const style = getComputedStyle(input);
      return {
        popup: box(el),
        footer: box(el.querySelector("footer")!),
        pairs: [...el.querySelectorAll("ol > li")].map(box),
        rows: [...el.querySelectorAll("section ul > li")].map(box),
        field: box(input),
        icon: box(el.querySelector('button[aria-label^="Suggest word for"]')!),
        inputStyle: [
          style.height,
          style.width,
          style.borderRadius,
          style.backgroundColor,
          style.fontSize,
          style.padding,
          style.textAlign,
        ],
      };
    });
  const before = await geometry();
  await field.click();
  expect(await geometry()).toEqual(before);
  await field.fill("test mnemonic");
  await field.press("Space");
  await expect(field).toHaveValue("test mnemonic ");
  await expect(save).toBeVisible();
  await expect(remove).toBeVisible();
  expect(await geometry()).toEqual(before);
  await field.fill("");
  expect(await geometry()).toEqual(before);
  await popup
    .getByRole("textbox", { name: /^Word for/ })
    .nth(1)
    .focus();
  expect(await geometry()).toEqual(before);
  await expect(popup.getByText(/unsaved|changes not saved/i)).toHaveCount(0);
  const original = await stored(page);
  expect(original.pairs).toEqual({});
  await suggest.click();
  const menu = page.getByRole("dialog", { name: /Suggestions for/ });
  const choice = menu.locator("ul button").first();
  const word = (await choice.textContent())!.trim();
  await choice.click();
  await expect(field).toHaveValue(word);
  expect(await geometry()).toEqual(before);
  expect((await stored(page)).pairs).toEqual({});
  await page.screenshot({ path: "test-results/memo-mnemonic-edit.png" });
  await save.click();
  await expect(popup).toHaveCount(0);
  const after = await stored(page);
  expect(JSON.stringify(after.pairs)).toContain(word);
  expect(after.attempts).toEqual(original.attempts);
});

test("Memo Save with no edits closes without mnemonic writes", async ({
  page,
}) => {
  const popup = await completedMemo(page);
  const before = await stored(page);
  await popup.getByRole("button", { name: /^Save/ }).click();
  await expect(popup).toHaveCount(0);
  const after = await stored(page);
  expect(after.pairs).toEqual(before.pairs);
  expect(after.attempts).toEqual(before.attempts);
});

test("Memo Delete stays visible while editing and discards draft", async ({
  page,
}) => {
  const popup = await completedMemo(page);
  await popup
    .getByRole("textbox", { name: /^Word for/ })
    .first()
    .fill("discard this");
  await popup
    .getByRole("button", { name: "Delete attempt", exact: true })
    .click();
  await expect(popup).toHaveCount(0);
  const after = await stored(page);
  expect(after.attempts).toHaveLength(0);
  expect(after.pairs).toEqual({});
});

test("Saved words keep the suggestion icon and matching field width", async ({
  page,
}) => {
  const popup = await completedMemo(page, true);
  const saved = popup.getByRole("textbox", {
    name: "Word for PF",
    exact: true,
  });
  await expect(saved).toHaveValue("puff");
  const empty = popup.getByRole("textbox", {
    name: "Word for WB",
    exact: true,
  });
  const row = saved.locator("..");
  const icon = row.getByRole("button", {
    name: "Suggest word for PF",
    exact: true,
  });
  await expect(icon).toBeVisible();
  await expect(icon).toHaveText("");
  expect((await saved.boundingBox())!.width).toBeCloseTo(
    (await empty.boundingBox())!.width,
    0,
  );
  await icon.click();
  const menu = page.getByRole("dialog", {
    name: "Suggestions for PF",
    exact: true,
  });
  await expect(menu).toBeVisible();
  await menu.locator("ul button").first().click();
  await expect(saved).not.toHaveValue("");
  await page.screenshot({ path: "test-results/memo-saved-word.png" });
  await popup.getByRole("button", { name: /^Save/ }).click();
  await expect(popup).toHaveCount(0);
});

for (const existing of [false, true]) {
  test(`Close discards ${existing ? "updated" : "new"} word and preserves the completed attempt`, async ({
    page,
  }) => {
    const popup = await completedMemo(page, existing);
    const field = popup.getByRole("textbox", {
      name: "Word for PF",
      exact: true,
    });
    const close = popup.getByRole("button", { name: /^Close/ });
    const original = await stored(page);
    await expect(close).toHaveCount(0);
    await field.fill("new word");
    await expect(close).toBeVisible();
    await expect(popup.getByRole("button", { name: /^Save/ })).toBeVisible();
    await expect(
      popup.getByRole("button", { name: "Delete attempt", exact: true }),
    ).toBeVisible();
    await field.fill(existing ? "puff" : "");
    await expect(close).toHaveCount(0);
    await field.fill("new word");
    await close.click();
    await expect(popup).toHaveCount(0);
    const after = await stored(page);
    expect(after.pairs).toEqual(original.pairs);
    expect(after.attempts).toEqual(original.attempts);
    await expect(page.locator("[data-attempt-row]")).toHaveCount(1);
  });
}

test("Memo Save width and styling stay consistent when Close appears", async ({page}) => {
  const popup=await completedMemo(page);
  const save=popup.getByRole('button',{name:'Save',exact:true});
  await expect(save).toHaveText('Save');
  const before=await save.boundingBox();
  expect(before!.width).toBeGreaterThanOrEqual(84);
  await popup.getByRole('textbox',{name:'Word for PF',exact:true}).fill('new word');
  const close=popup.getByRole('button',{name:/^Close/});await expect(close).toContainText('Esc');
  await expect(save).toHaveText('Save');expect(await save.boundingBox()).toEqual(before);
  const appearance=(button: import('@playwright/test').Locator)=>button.evaluate(el=>{const s=getComputedStyle(el);return [s.height,s.minWidth,s.borderWidth,s.borderColor,s.borderRadius,s.backgroundColor,s.color,s.fontSize];});
  expect(await appearance(close)).toEqual(await appearance(save));
  await page.screenshot({path:'test-results/memo-footer-consistent.png'});
});
