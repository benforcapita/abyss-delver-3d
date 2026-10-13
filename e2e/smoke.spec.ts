import {expect, test} from '@playwright/test';

test('starts a run and shows the HUD without console errors', async ({
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
  expect(consoleErrors).toEqual([]);
});
