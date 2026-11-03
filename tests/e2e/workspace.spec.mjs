import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
const qa = "output/qa";
mkdirSync(qa, { recursive: true });
async function signIn(page, founder = false) {
  await page.goto("/");
  if (founder)
    await page
      .getByRole("button", {
        name: "Co-founder Manage rates and review recoveries",
      })
      .click();
  await page
    .getByRole("button", { name: "Sign in to workspace", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Every rupee. Accounted for." }),
  ).toBeVisible();
}
async function nav(page, name) {
  const menu = page.getByRole("button", {
    name: "Open navigation",
    exact: true,
  });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name, exact: true }).click();
}
async function upload(page, type, name, csv) {
  await nav(page, "Imports");
  await page
    .getByRole("combobox", { name: "Report type", exact: true })
    .selectOption(type);
  await page
    .locator("#file-input")
    .setInputFiles({ name, mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByRole("dialog")).toBeVisible();
}
async function approve(page) {
  await page
    .getByRole("checkbox", { name: "I reviewed the mapping and preview rows." })
    .check();
  await page
    .getByRole("button", { name: "Approve & import", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
}

test("all workspace screens, self-hosted fonts and responsive layouts", async ({
  page,
}, info) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await signIn(page);
  for (const [name, title] of [
    ["Overview", "Every rupee. Accounted for."],
    ["Reconciliation", "One order. The whole picture."],
    ["Imports", "Bring your reports together."],
    ["Returns", "Bring every return home."],
    ["Rate cards", "The right amount starts here."],
    ["Mapping history", "Formats change. Your work stays."],
  ]) {
    await nav(page, name);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: `${qa}/${info.project.name}-${name.toLowerCase().replaceAll(" ", "-")}.png`,
      fullPage: true,
    });
  }
  await nav(page, "Overview");
  await expect(
    page.getByText("Settlements received", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(async () => {
      await document.fonts.ready;
      return (
        document.fonts.check('14px "DM Sans"') &&
        document.fonts.check('14px "Manrope"')
      );
    }),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});
test("upload approval, saved mapping, matching, evidence download and empty filters", async ({
  page,
}, info) => {
  const id = `E2E-${info.project.name}-ORDER`;
  await signIn(page);
  await upload(
    page,
    "Orders",
    `${id}.csv`,
    `Order ID,Channel,Value,Payment,Delivery Status,Date,Partner\n${id},Website,1499,COD,Delivered,2026-10-18,Courier Alpha`,
  );
  await expect(
    page.getByRole("button", { name: "Approve & import", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("heading", { name: "Preview · first 1 rows" }),
  ).toBeVisible();
  await approve(page);
  await upload(page, "COD", `${id}-paid.csv`, `Order ID,Received\n${id},1409`);
  await approve(page);
  await nav(page, "Reconciliation");
  await page.getByLabel("Search orders").fill(id);
  await expect(
    page.getByRole("cell", { name: "Settled", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: id, exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("₹1,409");
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export evidence", exact: true })
    .click();
  expect((await downloadPromise).suggestedFilename()).toContain(id);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByLabel("Search orders").fill("NONEXISTENT-XYZ");
  await expect(
    page.getByRole("heading", { name: "No orders found" }),
  ).toBeVisible();
  await nav(page, "Mapping history");
  await expect(page.getByText("COD", { exact: true }).first()).toBeVisible();
});
test("missing IDs stay in review until a confirmed human match", async ({
  page,
}, info) => {
  await signIn(page);
  await upload(
    page,
    "Settlement",
    `review-${info.project.name}.csv`,
    "Gross amount,Net payout\n1499,1409",
  );
  await approve(page);
  await nav(page, "Reconciliation");
  await page.getByRole("button", { name: "Needs review", exact: true }).click();
  await page
    .getByRole("button", { name: "Review match", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("button", { name: "Approve match", exact: true }),
  ).toBeDisabled();
  await page.locator("#review-order-id").fill("ORD-W-204118");
  await page
    .getByRole("checkbox", {
      name: "I checked the evidence and confirm this order match.",
    })
    .check();
  await page
    .getByRole("button", { name: "Approve match", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
test("role permissions and courier rate edits", async ({ page }, info) => {
  await signIn(page);
  await nav(page, "Rate cards");
  await expect(
    page.getByLabel("Courier Alpha Additional slab charge"),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Save rate cards", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Your account", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign in to workspace", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Co-founder Manage rates and review recoveries",
    })
    .click();
  await page
    .getByRole("button", { name: "Sign in to workspace", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Every rupee. Accounted for.",
      exact: true,
    }),
  ).toBeVisible();
  await nav(page, "Rate cards");
  const save = page.getByRole("button", {
    name: "Save rate cards",
    exact: true,
  });
  await expect(save).toBeDisabled();
  await page
    .getByLabel("Courier Alpha Additional slab charge")
    .fill(info.project.name === "desktop" ? "26" : "27");
  await expect(save).toBeEnabled();
  await save.click();
  await expect(save).toBeDisabled();
});
test("claim selections clear when filters change", async ({ page }) => {
  await signIn(page);
  const menu = page.getByRole("button", {
    name: "Open navigation",
    exact: true,
  });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name: /^Claims \d/ }).click();
  const apply = page.getByRole("button", {
    name: "Apply to selected",
    exact: true,
  });
  await expect(apply).toBeDisabled();
  await page
    .getByRole("checkbox", { name: "Select all visible claims" })
    .check();
  await expect(apply).toBeEnabled();
  await page
    .getByLabel("Filter by partner", { exact: true })
    .selectOption("Courier Alpha");
  await expect(page.locator(".bulk-bar>span")).toHaveText("0 selected");
  await expect(apply).toBeDisabled();
});
