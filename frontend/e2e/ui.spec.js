import { test, expect } from "@playwright/test";

test("homepage shows send and receive actions", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /FileShare/i }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Send Files/i }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Receive Files/i }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /Send Files Securely/i })).toBeVisible();
});

test("upload page empty state", async ({ page }) => {
  await page.goto("/upload");
  await expect(page.getByRole("heading", { name: /Send Files/i })).toBeVisible();
  await expect(page.getByText(/Tap to select or drop files here/i)).toBeVisible();
  await expect(page.getByText(/Up to 2 GB total/i).first()).toBeVisible();
});

test("download page rejects an invalid code", async ({ page }) => {
  await page.goto("/download");
  await expect(page.getByRole("heading", { name: /Receive Files/i })).toBeVisible();
  await expect(page.getByText(/No active transfer yet/i)).toBeVisible();
  await page.getByLabel("Transfer Code").fill("not-a-valid-hex!");
  await page.getByRole("button", { name: /Connect & Receive/i }).click();
  await expect(page.getByRole("alert")).toContainText(/Invalid transfer code/i);
});
