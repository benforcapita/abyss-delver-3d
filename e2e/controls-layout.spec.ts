import {expect, test} from '@playwright/test';
import type {Page} from '@playwright/test';

const PR_ASSETS = process.env.PR_ASSETS === '1';

const TARGET_IDS = [
  'mobile-joystick',
  'btn-attack',
  'btn-dash',
  'btn-spell',
  'btn-potion',
];

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function gap(a: Box, b: Box): number {
  const gapX = Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width));
  const gapY = Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height));
  if (gapX > 0 && gapY > 0) return Math.hypot(gapX, gapY);
  if (gapX > 0) return gapX;
  if (gapY > 0) return gapY;
  return Math.max(gapX, gapY);
}

function trackConsoleErrors(page: Page): string[] {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
  });
  return consoleErrors;
}

async function boxOf(page: Page, testId: string): Promise<Box> {
  const box = await page.getByTestId(testId).boundingBox();
  expect(box, `${testId} has a bounding box`).not.toBeNull();
  return box!;
}

test.describe('664x390 controls', () => {
  test.use({
    viewport: {width: 664, height: 390},
    hasTouch: true,
    isMobile: true,
  });

  test('touch targets are at least 56px and do not overlap HUD', async ({page}) => {
    const consoleErrors = trackConsoleErrors(page);
    await page.goto('/');
    await page.getByTestId('start-button').tap();
    await expect(page.getByText('FLOOR 1 / 5')).toBeVisible();

    const targetIds = [...TARGET_IDS];
    if (await page.getByTestId('btn-interact').isVisible()) targetIds.push('btn-interact');

    const targets = [];
    for (const id of targetIds) {
      const box = await boxOf(page, id);
      expect(box.width, `${id} width`).toBeGreaterThanOrEqual(56);
      expect(box.height, `${id} height`).toBeGreaterThanOrEqual(56);
      targets.push({id, box});
    }

    const attack = targets.find((target) => target.id === 'btn-attack')!;
    const dash = targets.find((target) => target.id === 'btn-dash')!;
    expect(attack.box.width).toBeGreaterThanOrEqual(80);
    expect(attack.box.height).toBeGreaterThanOrEqual(80);
    expect(dash.box.width).toBeGreaterThanOrEqual(60);
    expect(dash.box.height).toBeGreaterThanOrEqual(60);
    expect((await boxOf(page, 'mobile-joystick')).width).toBeGreaterThanOrEqual(120);

    for (let i = 0; i < targets.length; i++) {
      for (let j = i + 1; j < targets.length; j++) {
        expect(
          gap(targets[i].box, targets[j].box),
          `${targets[i].id} overlaps ${targets[j].id}`,
        ).toBeGreaterThanOrEqual(12);
      }
    }

    const obstacleCount = await page.locator('[data-layout-obstacle]').count();
    expect(obstacleCount).toBeGreaterThan(0);
    for (let i = 0; i < obstacleCount; i++) {
      const obstacle = page.locator('[data-layout-obstacle]').nth(i);
      if (!(await obstacle.isVisible())) continue;
      // Action buttons are obstacles so the stick can avoid them; they are
      // already checked against each other above.
      if ((await obstacle.getAttribute('data-touch-control')) === 'true') continue;
      const name = (await obstacle.getAttribute('data-testid')) ?? `obstacle-${i}`;
      const box = await obstacle.boundingBox();
      if (!box || box.width === 0 || box.height === 0) continue;
      for (const target of targets) {
        expect(gap(target.box, box), `${target.id} overlaps ${name}`).toBeGreaterThanOrEqual(0);
      }
    }

    if (PR_ASSETS) {
      await page.screenshot({path: 'docs/pr-assets/ad-24-5-landscape-664x390.png'});
    }

    const pointer = {pointerId: 4, pointerType: 'touch' as const, isPrimary: true, buttons: 1};

    // A touch in the left zone spawns the stick under the thumb.
    const zone = await boxOf(page, 'mobile-move-zone');
    const touch = {x: zone.x + 96, y: zone.y + zone.height * 0.42};
    const zoneTop = await page.evaluate(
      ({x, y}) => document.elementFromPoint(x, y)?.getAttribute('data-testid'),
      touch,
    );
    expect(zoneTop).toBe('mobile-move-zone');
    await page.getByTestId('mobile-move-zone').dispatchEvent('pointerdown', {
      ...pointer,
      clientX: touch.x,
      clientY: touch.y,
    });
    const joy = page.getByTestId('mobile-joystick');
    await expect(joy).toHaveAttribute('data-active', 'true');
    const spawned = await joy.boundingBox();
    expect(spawned).not.toBeNull();
    expect(Math.abs(spawned!.x + spawned!.width / 2 - touch.x)).toBeLessThan(2);
    expect(Math.abs(spawned!.y + spawned!.height / 2 - touch.y)).toBeLessThan(2);
    await page.getByTestId('mobile-move-zone').dispatchEvent('pointerup', {
      ...pointer,
      clientX: touch.x,
      clientY: touch.y,
    });
    await expect(joy).toHaveAttribute('data-active', 'false');

    // Touching SLASH hits the button, not the look pad.
    const slash = await boxOf(page, 'btn-attack');
    const slashTouch = {x: slash.x + slash.width / 2, y: slash.y + slash.height / 2};
    const slashTop = await page.evaluate(
      ({x, y}) => document.elementFromPoint(x, y)?.closest('[data-testid]')?.getAttribute('data-testid'),
      slashTouch,
    );
    expect(slashTop).toBe('btn-attack');
    await page.getByTestId('btn-attack').dispatchEvent('pointerdown', {
      ...pointer,
      pointerId: 5,
      clientX: slashTouch.x,
      clientY: slashTouch.y,
    });
    await expect(page.getByTestId('touch-look')).toHaveAttribute('data-looking', 'false');

    // A drag on open ground in the right half does look.
    const lookAt = {x: 430, y: 140};
    const lookTop = await page.evaluate(
      ({x, y}) => document.elementFromPoint(x, y)?.getAttribute('data-testid'),
      lookAt,
    );
    expect(lookTop).toBe('touch-look');
    await page.getByTestId('touch-look').dispatchEvent('pointerdown', {
      ...pointer,
      pointerId: 6,
      clientX: lookAt.x,
      clientY: lookAt.y,
    });
    await expect(page.getByTestId('touch-look')).toHaveAttribute('data-looking', 'true');

    expect(consoleErrors).toEqual([]);
  });
});

test.describe('portrait start button', () => {
  test.use({
    viewport: {width: 390, height: 844},
    hasTouch: true,
    isMobile: true,
  });

  test('start button is visible and tappable in portrait', async ({page}) => {
    const consoleErrors = trackConsoleErrors(page);
    await page.goto('/');
    const start = page.getByTestId('start-button');
    await expect(start).toBeVisible();
    const startBox = await start.boundingBox();
    expect(startBox).not.toBeNull();
    expect(startBox!.width).toBeGreaterThanOrEqual(56);
    expect(startBox!.height).toBeGreaterThanOrEqual(44);

    const prompt = page.getByTestId('rotate-prompt');
    if (await prompt.isVisible()) {
      const promptBox = await prompt.boundingBox();
      expect(promptBox).not.toBeNull();
      const covers =
        promptBox!.x <= startBox!.x &&
        promptBox!.y <= startBox!.y &&
        promptBox!.x + promptBox!.width >= startBox!.x + startBox!.width &&
        promptBox!.y + promptBox!.height >= startBox!.y + startBox!.height;
      expect(covers).toBe(false);
      await expect(prompt).toHaveCSS('pointer-events', 'none');
    }

    if (PR_ASSETS) {
      await page.screenshot({path: 'docs/pr-assets/ad-24-5-portrait-start.png'});
    }

    await start.tap();
    await expect(page.getByText('FLOOR 1 / 5')).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});
