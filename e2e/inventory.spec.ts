import {expect, test} from '@playwright/test';

test('inventory opens from the I key and the BAG button, shows equipment, and closes', async ({page}) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => msg.type() === 'error' && consoleErrors.push(msg.text()));
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  await page.goto('/');
  await page.getByTestId('start-button').click();
  await expect(page.getByText('FLOOR 1 / 5')).toBeVisible();

  const panel = page.getByTestId('inventory-panel');
  await page.keyboard.press('KeyI');
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId('equipped-weapon')).toContainText('Novice Steel Sword');
  await expect(panel.getByTestId('equipped-armor')).toContainText('Leather Vest');
  await expect(panel.getByTestId('equipped-ring')).toContainText('Delver Signet Ring');
  // The pointer-lock hint is hidden while the (pausing) bag is open.
  await expect(page.getByTestId('pointer-lock-hint')).not.toBeVisible();

  await page.keyboard.press('Escape');
  await expect(panel).not.toBeVisible();
  // Esc closed the bag only; it did not also open the game menu.
  await expect(page.getByRole('button', {name: 'RESUME GAME'})).not.toBeVisible();

  await page.getByTestId('hud-inventory').click();
  await expect(panel).toBeVisible();
  await page.keyboard.press('KeyI');
  await expect(panel).not.toBeVisible();

  expect(consoleErrors).toEqual([]);
});
