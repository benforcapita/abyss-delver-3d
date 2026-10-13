import {memo, useEffect, useRef, type MutableRefObject} from 'react';
import {
  MINIMAP_REDRAW_MS,
  createVisitedMask,
  isVisited,
  revealVisited,
  visibleMarkers,
  worldToTile,
  worldToTileFloat,
  type MinimapBridge,
} from '../minimap';

interface MinimapProps {
  bridge: MutableRefObject<MinimapBridge>;
  active: boolean;
}

const CSS_SIZE = 152;

function paint(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  bridge: MinimapBridge,
  mask: Uint8Array,
): void {
  const floorTiles = bridge.tiles;
  const gridSize = bridge.gridSize;
  if (!floorTiles || gridSize <= 0) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pixels = Math.floor(CSS_SIZE * dpr);
  if (canvas.width !== pixels) {
    canvas.width = pixels;
    canvas.height = pixels;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, CSS_SIZE, CSS_SIZE);
  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, CSS_SIZE, CSS_SIZE);

  const cell = CSS_SIZE / gridSize;
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      if (!isVisited(mask, gridSize, x, y)) continue;
      const kind = floorTiles[x][y];
      ctx.fillStyle = kind === 1 ? '#52525b' : kind === 3 ? '#a16207' : '#27272a';
      ctx.fillRect(x * cell, y * cell, cell + 0.6, cell + 0.6);
    }
  }

  const markers = visibleMarkers(mask, gridSize, bridge.chests, bridge.enemies, bridge.stairs);
  for (const marker of markers) {
    const cx = marker.x * cell;
    const cy = marker.y * cell;
    if (marker.kind === 'chest') {
      const size = Math.max(3, cell * 0.62);
      ctx.fillStyle = marker.opened ? '#78716c' : '#fbbf24';
      ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
      continue;
    }
    if (marker.kind === 'stairs') {
      const size = Math.max(2.5, cell * 0.42);
      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.moveTo(cx, cy - size);
      ctx.lineTo(cx + size, cy);
      ctx.lineTo(cx, cy + size);
      ctx.lineTo(cx - size, cy);
      ctx.closePath();
      ctx.fill();
      continue;
    }
    ctx.fillStyle = marker.kind === 'boss' ? '#fb7185' : '#ef4444';
    ctx.beginPath();
    ctx.arc(cx, cy, marker.kind === 'boss' ? cell * 0.48 : cell * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  const player = worldToTileFloat(bridge.playerX, bridge.playerZ, gridSize);
  const px = player.x * cell;
  const py = player.y * cell;
  const fx = Math.sin(bridge.playerYaw);
  const fy = -Math.cos(bridge.playerYaw);
  ctx.strokeStyle = '#fffbeb';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + fx * cell * 1.35, py + fy * cell * 1.35);
  ctx.stroke();
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(px, py, Math.max(2.5, cell * 0.42), 0, Math.PI * 2);
  ctx.fill();
}

function MinimapCanvas({bridge}: {bridge: MutableRefObject<MinimapBridge>}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let mask = createVisitedMask(0);
    let serial = -1;

    const tick = () => {
      const sample = bridge.current;
      const tiles = sample.tiles;
      if (!tiles || sample.gridSize <= 0) return;
      if (serial !== sample.floorSerial || mask.length !== sample.gridSize * sample.gridSize) {
        mask = createVisitedMask(sample.gridSize);
        serial = sample.floorSerial;
      }
      const tile = worldToTile(sample.playerX, sample.playerZ, sample.gridSize);
      revealVisited(mask, tiles, sample.rooms, tile.x, tile.y);
      paint(canvas, ctx, sample, mask);
    };

    tick();
    const id = window.setInterval(tick, MINIMAP_REDRAW_MS);
    return () => window.clearInterval(id);
  }, [bridge]);

  return (
    <div
      data-testid="minimap"
      role="img"
      aria-label="Dungeon minimap"
      className="pointer-events-none w-[9.25rem] shrink-0 rounded-md border border-amber-500/70 bg-black/80 p-1.5 shadow-xl [@media(max-height:420px)]:w-[6.75rem]">
      <div className="mb-0.5 text-[10px] font-bold tracking-[0.18em] text-amber-400">
        MINIMAP
      </div>
      <canvas
        ref={canvasRef}
        width={CSS_SIZE}
        height={CSS_SIZE}
        className="block aspect-square h-auto w-full rounded-sm"
      />
      <div className="mt-0.5 flex flex-wrap justify-between gap-x-1 text-[9px] text-zinc-400">
        <span className="text-amber-400">you</span>
        <span className="text-amber-300">chest</span>
        <span className="text-red-400">foe</span>
        <span className="text-emerald-400">stairs</span>
      </div>
    </div>
  );
}

/**
 * Canvas overlay. The parent re-renders with the game loop; this stays memoized
 * and repaints the canvas from the bridge on a timer instead of via setState.
 */
export const Minimap = memo(function Minimap({bridge, active}: MinimapProps) {
  if (!active) return null;
  return <MinimapCanvas bridge={bridge} />;
});
