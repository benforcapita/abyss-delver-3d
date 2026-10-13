import {expect, test} from '@playwright/test';
import type {Page} from '@playwright/test';

const PR_ASSETS = process.env.PR_ASSETS === '1';
const pointer = {pointerId: 11, pointerType: 'touch', isPrimary: true};

const CONTROL_IDS = [
  'btn-attack',
  'btn-spell',
  'btn-dash',
  'btn-potion',
  'mobile-joystick',
];

function trackConsoleErrors(page: Page): string[] {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
  });
  return consoleErrors;
}

async function startRun(page: Page) {
  await page.goto('/');
  await page.getByTestId('start-button').tap();
  await expect(page.getByText('FLOOR 1 / 5')).toBeVisible();
}

// Every touch control's bounding box must stay clear of the HP/Mana panel.
async function expectControlsClearOfVitals(page: Page) {
  const vitals = page.getByTestId('hud-vitals');
  await expect(vitals).toBeVisible();
  const v = await vitals.boundingBox();
  expect(v).not.toBeNull();
  for (const id of CONTROL_IDS) {
    const el = page.getByTestId(id);
    await expect(el).toBeVisible();
    const b = await el.boundingBox();
    expect(b).not.toBeNull();
    const intersects =
      b!.x < v!.x + v!.width &&
      v!.x < b!.x + b!.width &&
      b!.y < v!.y + v!.height &&
      v!.y < b!.y + b!.height;
    expect(
      intersects,
      `${id} bounding box must not intersect the HP/Mana panel`,
    ).toBe(false);
  }
}

test.describe('664x390 viewport', () => {
  test.use({
    viewport: {width: 664, height: 390},
    hasTouch: true,
    isMobile: true,
  });

  test('touch controls do not overlap the HP/Mana panel', async ({page}) => {
    const consoleErrors = trackConsoleErrors(page);

    await startRun(page);
    await expectControlsClearOfVitals(page);

    if (PR_ASSETS) {
      await page.screenshot({
        path: 'docs/pr-assets/ad-13-mobile-664x390.png',
      });
    }

    expect(consoleErrors).toEqual([]);
  });
});

test.describe('844x390 viewport', () => {
  test.use({
    viewport: {width: 844, height: 390},
    hasTouch: true,
    isMobile: true,
  });

  test('mobile joystick and action buttons render and the stick resets safely', async ({
    page,
  }) => {
    const consoleErrors = trackConsoleErrors(page);

    await startRun(page);

    // Touch controls are visible and clear of the HP/Mana panel.
    const joystick = page.getByTestId('mobile-joystick');
    await expectControlsClearOfVitals(page);
    await expect(joystick).toHaveAttribute('data-active', 'false');
    await expect(joystick).toHaveAttribute('data-vector', '0,0');

    if (PR_ASSETS) {
      await page.screenshot({path: 'docs/pr-assets/ad-13-mobile-controls.png'});
    }

    const box = await joystick.boundingBox();
    expect(box).not.toBeNull();
    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;

    // Drag the stick upward -> normalized forward vector.
    await joystick.dispatchEvent('pointerdown', {
      ...pointer,
      clientX: cx,
      clientY: cy,
      buttons: 1,
    });
    await joystick.dispatchEvent('pointermove', {
      ...pointer,
      clientX: cx,
      clientY: cy - 40,
      buttons: 1,
    });
    await expect(joystick).toHaveAttribute('data-active', 'true');

    const dragged = (await joystick.getAttribute('data-vector'))!
      .split(',')
      .map(Number);
    expect(dragged[0]).toBeCloseTo(0, 1);
    expect(dragged[1]).toBeGreaterThan(0.5);

    if (PR_ASSETS) {
      await page.screenshot({
        path: 'docs/pr-assets/ad-13-mobile-joystick-active.png',
      });
    }

    // pointercancel (dropped touch) must reset movement to zero.
    await joystick.dispatchEvent('pointercancel', {
      ...pointer,
      clientX: cx,
      clientY: cy - 40,
    });
    await expect(joystick).toHaveAttribute('data-active', 'false');
    await expect(joystick).toHaveAttribute('data-vector', '0,0');

    // A normal drag + pointerup also resets cleanly.
    await joystick.dispatchEvent('pointerdown', {
      ...pointer,
      clientX: cx,
      clientY: cy,
      buttons: 1,
    });
    await joystick.dispatchEvent('pointermove', {
      ...pointer,
      clientX: cx + 40,
      clientY: cy,
      buttons: 1,
    });
    await expect(joystick).toHaveAttribute('data-active', 'true');
    await joystick.dispatchEvent('pointerup', {
      ...pointer,
      clientX: cx + 40,
      clientY: cy,
    });
    await expect(joystick).toHaveAttribute('data-active', 'false');
    await expect(joystick).toHaveAttribute('data-vector', '0,0');

    if (PR_ASSETS) {
      await page.screenshot({
        path: 'docs/pr-assets/ad-13-mobile-joystick-released.png',
      });
    }

    expect(consoleErrors).toEqual([]);
  });
});
