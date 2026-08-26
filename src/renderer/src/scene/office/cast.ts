// Studio Floor starter roster metadata + sprite frames.
//
// Both the static portraits (cards / picker) and the in-scene walking sprites are
// now fully custom-drawn from the same per-character recipes in portraitArt.ts:
// the scene sprite reuses the portrait's exact head/face/clothing and adds legs,
// so an agent on the office floor looks identical to its card. The LimeZu base
// sheets are no longer used for the cast. See assets/ATTRIBUTION.md.

import { Texture } from 'pixi.js';
import { paintPortrait, sceneFrameBufs, SCENE_W, SCENE_H } from './portraitArt';
import carlaWalkSheetUrl from '@/assets/custom-avatars/sprites/carla-walk.png?url';
import nickWalkSheetUrl from '@/assets/custom-avatars/sprites/nick-walk.png?url';
import engineerWalkSheetUrl from '@/assets/custom-avatars/sprites/engineer-walk.png?url';

export type OfficeCharacterName =
  | 'carla' | 'nick' | 'engineer'
  | 'studio01' | 'studio02' | 'studio03' | 'studio04' | 'studio05'
  | 'studio06' | 'studio07' | 'studio08' | 'studio09' | 'studio10'
  | 'studio11' | 'studio12' | 'studio13' | 'studio14' | 'studio15';

export interface CastMember {
  name: OfficeCharacterName;
  displayName: string;
  /** Signature accent color (hex) — used for the in-scene selection glow. */
  shirt: string;
  /** Blurb shown when this character is picked / has no description yet. */
  blurb: string;
}

/** Selectable roster, in display order. */
export const OFFICE_CAST: CastMember[] = [
  { name: 'carla', displayName: 'Carla', shirt: '#3f9d9a', blurb: 'Designer' },
  { name: 'nick', displayName: 'Nick', shirt: '#c7903e', blurb: 'CEO' },
  { name: 'engineer', displayName: 'You', shirt: '#4d79c7', blurb: 'Engineer' },
];

export const CAST_BY_NAME: Record<OfficeCharacterName, CastMember> =
  Object.fromEntries(OFFICE_CAST.map((c) => [c.name, c])) as Record<OfficeCharacterName, CastMember>;

export const DEFAULT_CHARACTER: OfficeCharacterName = 'engineer';

export function hexToNumber(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

// ─── scene frames ────────────────────────────────────────────────────────────
const frameCache = new Map<OfficeCharacterName, Texture[][]>();

type CustomWalkSheet = {
  url: string;
  /** Carla's source sheet arrived with a light checkerboard baked in. */
  removeLightCheckerboard?: boolean;
};

const CUSTOM_WALK_SHEETS: Partial<Record<OfficeCharacterName, CustomWalkSheet>> = {
  carla: { url: carlaWalkSheetUrl, removeLightCheckerboard: true },
  nick: { url: nickWalkSheetUrl },
  engineer: { url: engineerWalkSheetUrl },
};

function bufToTexture(buf: Uint8ClampedArray): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = SCENE_W; canvas.height = SCENE_H;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(SCENE_W, SCENE_H);
  img.data.set(buf);
  ctx.putImageData(img, 0, 0);
  const tex = Texture.from(canvas);
  tex.source.scaleMode = 'nearest';
  return tex;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load custom avatar sheet: ${url}`));
    image.src = url;
  });
}

/**
 * Converts one cell from a generated 3×3 sheet into the compact 18×32 frame
 * expected by the floor. The sheets deliberately contain a little breathing
 * room, so we find the visible silhouette first and anchor it at the feet.
 */
function sheetCellCanvas(
  image: HTMLImageElement,
  col: number,
  row: number,
  removeLightCheckerboard = false,
): HTMLCanvasElement {
  const cols = 3;
  const rows = 3;
  const sourceW = Math.floor(image.naturalWidth / cols);
  const sourceH = Math.floor(image.naturalHeight / rows);
  const sx = col * sourceW;
  const sy = row * sourceH;
  const source = document.createElement('canvas');
  source.width = sourceW;
  source.height = sourceH;
  const sourceCtx = source.getContext('2d', { willReadFrequently: true })!;
  sourceCtx.drawImage(image, sx, sy, sourceW, sourceH, 0, 0, sourceW, sourceH);
  const pixels = sourceCtx.getImageData(0, 0, sourceW, sourceH);

  // The Carla sheet has a neutral light checkerboard instead of alpha. Drop
  // only near-neutral white/gray cells; her warm sweater, hair, and skin stay.
  if (removeLightCheckerboard) {
    for (let i = 0; i < pixels.data.length; i += 4) {
      const r = pixels.data[i];
      const g = pixels.data[i + 1];
      const b = pixels.data[i + 2];
      if (r > 225 && g > 225 && b > 225 && Math.max(r, g, b) - Math.min(r, g, b) < 8) {
        pixels.data[i + 3] = 0;
      }
    }
    sourceCtx.putImageData(pixels, 0, 0);
  }

  let minX = sourceW;
  let minY = sourceH;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < sourceH; y += 1) {
    for (let x = 0; x < sourceW; x += 1) {
      if (pixels.data[(y * sourceW + x) * 4 + 3] < 24) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  const output = document.createElement('canvas');
  output.width = SCENE_W;
  output.height = SCENE_H;
  const outputCtx = output.getContext('2d')!;
  outputCtx.imageSmoothingEnabled = false;
  if (maxX >= minX && maxY >= minY) {
    const contentW = maxX - minX + 1;
    const contentH = maxY - minY + 1;
    const scale = Math.min(SCENE_W / contentW, SCENE_H / contentH);
    const drawW = Math.max(1, Math.round(contentW * scale));
    const drawH = Math.max(1, Math.round(contentH * scale));
    outputCtx.drawImage(source, minX, minY, contentW, contentH, Math.round((SCENE_W - drawW) / 2), SCENE_H - drawH, drawW, drawH);
  }
  return output;
}

function sheetCellTexture(
  image: HTMLImageElement,
  col: number,
  row: number,
  removeLightCheckerboard = false,
): Texture {
  const output = sheetCellCanvas(image, col, row, removeLightCheckerboard);
  const texture = Texture.from(output);
  texture.source.scaleMode = 'nearest';
  return texture;
}

async function customSheetFrames(sheet: CustomWalkSheet): Promise<Texture[][]> {
  const image = await loadImage(sheet.url);
  const row = (rowIndex: number): Texture[] => {
    const stand = sheetCellTexture(image, 0, rowIndex, sheet.removeLightCheckerboard);
    const stepL = sheetCellTexture(image, 1, rowIndex, sheet.removeLightCheckerboard);
    const stepR = sheetCellTexture(image, 2, rowIndex, sheet.removeLightCheckerboard);
    return [stand, stepL, stepR, stand, stand, stand, stand];
  };
  return [row(0), row(1), row(2)];
}

/**
 * Frame grid CharacterSprite expects: 3 rows (down, up, right) × 7 frames
 * [walk1, walk2, walk3, type1, type2, read1, read2]. We provide a front view
 * (down — and reused for the side row, so left/right walkers still show a face)
 * and a back view (up — agents seated facing their desk show their back). The
 * three walk frames are stand / step-left / step-right.
 */
export async function getCastFrames(name: OfficeCharacterName): Promise<Texture[][]> {
  const cached = frameCache.get(name);
  if (cached) return cached;
  const customSheet = CUSTOM_WALK_SHEETS[name];
  if (customSheet) {
    const frames = await customSheetFrames(customSheet);
    frameCache.set(name, frames);
    return frames;
  }
  const { front, back } = sceneFrameBufs(name);
  const toRow = (bufs: Uint8ClampedArray[]): Texture[] => {
    const [stand, stepL, stepR] = bufs.map(bufToTexture);
    return [stand, stepL, stepR, stand, stand, stand, stand];
  };
  const frontRow = toRow(front);
  const frames: Texture[][] = [frontRow, toRow(back), frontRow]; // down, up, right
  frameCache.set(name, frames);
  return frames;
}

/**
 * Paint a character's static portrait for cards / the picker (delegates to the
 * custom procedural composer in portraitArt.ts).
 */
export async function paintCastPortrait(
  ctx: CanvasRenderingContext2D,
  name: OfficeCharacterName,
  scale = 2,
): Promise<void> {
  const customSheet = CUSTOM_WALK_SHEETS[name];
  if (customSheet) {
    const image = await loadImage(customSheet.url);
    const frame = sheetCellCanvas(image, 0, 0, customSheet.removeLightCheckerboard);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, SCENE_W * scale, SCENE_H * scale);
    ctx.drawImage(frame, 0, 0, SCENE_W, SCENE_H, 0, 0, SCENE_W * scale, SCENE_H * scale);
    return;
  }
  paintPortrait(ctx, name, scale);
}
