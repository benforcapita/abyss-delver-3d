import {expect, test} from '@playwright/test';
import type {Page} from '@playwright/test';

async function attachAttackCounter(page: Page) {
  await page.evaluate(() => {
    (window as any).__attackCount = 0;
    window.addEventListener('player-attack', () => {
      (window as any).__attackCount = ((window as any).__attackCount || 0) + 1;
    });
  });
}

async function getAttackCount(page: Page): Promise<number> {
  return page.evaluate(() => (window as any).__attackCount || 0);
}

async function startRun(page: Page, isMobile: boolean) {
  await page.goto('/');
  await attachAttackCounter(page);
  const startBtn = page.getByTestId('start-button');
  if (isMobile) {
    await startBtn.tap();
  } else {
    await startBtn.click();
  }
  await expect(page.getByText('FLOOR 1 / 5')).toBeVisible();
  // Reset any attack count triggered prior to gameplay
  await page.evaluate(() => {
    (window as any).__attackCount = 0;
  });
}

test.describe('mobile attacks (844x390 viewport)', () => {
  test.use({
    viewport: {width: 844, height: 390},
    hasTouch: true,
    isMobile: true,
  });

  test('(a) touch pointerdown held ~1s on look area / canvas causes 0 attacks', async ({
    page,
  }) => {
    await startRun(page, true);

    const canvas = page.locator('div.canvas-wrapper canvas');
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    const cx = box!.x + box!.width * 0.5;
    const cy = box!.y + box!.height * 0.3;

    await canvas.dispatchEvent('pointerdown', {
      pointerId: 10,
      pointerType: 'touch',
      clientX: cx,
      clientY: cy,
      isPrimary: true,
      buttons: 1,
    });

    await page.waitForTimeout(1000);

    await canvas.dispatchEvent('pointerup', {
      pointerId: 10,
      pointerType: 'touch',
      clientX: cx,
      clientY: cy,
      isPrimary: true,
      buttons: 0,
    });

    expect(await getAttackCount(page)).toBe(0);
  });

  test('(b) pressing and holding btn-attack for ~1s causes exactly 1 attack, and a second press causes 1 more', async ({
    page,
  }) => {
    await startRun(page, true);

    const btnAttack = page.getByTestId('btn-attack');
    await expect(btnAttack).toBeVisible();

    const box = await btnAttack.boundingBox();
    expect(box).not.toBeNull();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;

    // Press and hold for ~1s
    await btnAttack.dispatchEvent('pointerdown', {
      pointerId: 11,
      pointerType: 'touch',
      clientX: cx,
      clientY: cy,
      isPrimary: true,
      buttons: 1,
    });

    await page.waitForTimeout(1000);

    expect(await getAttackCount(page)).toBe(1);

    await btnAttack.dispatchEvent('pointerup', {
      pointerId: 11,
      pointerType: 'touch',
      clientX: cx,
      clientY: cy,
      isPrimary: true,
      buttons: 0,
    });

    expect(await getAttackCount(page)).toBe(1);

    // Wait well past the 0.35s attack cooldown (slow headless frames advance it slowly)
    await page.waitForTimeout(1500);

    // Second press
    await btnAttack.dispatchEvent('pointerdown', {
      pointerId: 11,
      pointerType: 'touch',
      clientX: cx,
      clientY: cy,
      isPrimary: true,
      buttons: 1,
    });

    await page.waitForTimeout(200);

    await btnAttack.dispatchEvent('pointerup', {
      pointerId: 11,
      pointerType: 'touch',
      clientX: cx,
      clientY: cy,
      isPrimary: true,
      buttons: 0,
    });

    expect(await getAttackCount(page)).toBe(2);
  });
});

test.describe('desktop attacks', () => {
  test('(c) mouse down held ~1s on canvas with pointer lock simulated causes exactly 1 attack', async ({
    page,
  }) => {
    await startRun(page, false);

    const canvas = page.locator('div.canvas-wrapper canvas');
    await expect(canvas).toBeVisible();

    // Simulate pointer lock
    await page.evaluate(() => {
      Object.defineProperty(document, 'pointerLockElement', {
        configurable: true,
        get: () => document.querySelector('canvas'),
      });
    });

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;

    // Mouse down held ~1s on canvas
    await canvas.dispatchEvent('pointerdown', {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: cx,
      clientY: cy,
      button: 0,
      buttons: 1,
      isPrimary: true,
    });

    await page.waitForTimeout(1000);

    expect(await getAttackCount(page)).toBe(1);

    await canvas.dispatchEvent('pointerup', {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: cx,
      clientY: cy,
      button: 0,
      buttons: 0,
      isPrimary: true,
    });

    expect(await getAttackCount(page)).toBe(1);
  });
});
