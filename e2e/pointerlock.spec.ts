import {expect, test} from '@playwright/test';

test('shows pointer lock hint overlay during play on desktop while unlocked', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
  });

  await page.goto('/');
  await page.getByTestId('start-button').click();
  await expect(page.getByText('FLOOR 1 / 5')).toBeVisible();

  const hint = page.getByTestId('pointer-lock-hint');
  await expect(hint).toBeVisible();
  await expect(hint).toContainText('Click to look');
  await expect(hint).toContainText('Esc to release');

  // Hides when in-game menu is opened
  await page.getByRole('button', {name: 'MENU'}).click();
  await expect(hint).not.toBeVisible();

  // Reappears when resuming
  await page.getByRole('button', {name: 'RESUME GAME'}).click();
  await expect(hint).toBeVisible();

  // Simulating pointer lock change hides the hint without depending on real headless lock
  await page.evaluate(() => {
    Object.defineProperty(document, 'pointerLockElement', {
      configurable: true,
      get: () => document.body,
    });
    document.dispatchEvent(new Event('pointerlockchange'));
  });
  await expect(hint).not.toBeVisible();

  // Simulating pointer unlock restores the hint
  await page.evaluate(() => {
    Object.defineProperty(document, 'pointerLockElement', {
      configurable: true,
      get: () => null,
    });
    document.dispatchEvent(new Event('pointerlockchange'));
  });
  await expect(hint).toBeVisible();

  expect(consoleErrors).toEqual([]);
});
