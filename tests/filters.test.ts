// CamIA Filters: the registry, and every filter run through the app's own shader on real photos (`npm test`).
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { camFilters, filterCategories, filterById } from '../src/filters/registry';
import { applyFilter, canvasKit, difference, labPhotos, loadPhoto, pixels } from './filterLab';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Img = any;

describe('filter registry', () => {
  it('has 60 filters with unique ids and names', () => {
    assert.equal(camFilters.length, 60);
    assert.equal(new Set(camFilters.map((f) => f.id)).size, camFilters.length);
    assert.equal(new Set(camFilters.map((f) => f.name)).size, camFilters.length);
  });

  it('fills every category with at least five filters, at a sensible default intensity', () => {
    for (const c of filterCategories) assert.ok(camFilters.filter((f) => f.category === c).length >= 5, `category ${c}`);
    for (const f of camFilters) assert.ok(f.intensity > 0 && f.intensity <= 100, f.id);
  });
});

describe('filters on photos', () => {
  let photos: Img[] = [];
  before(async () => {
    photos = await Promise.all(Object.values(labPhotos).map((p) => loadPhoto(p, 120)));
  });

  const mean = async (fn: (photo: Img) => Promise<number>) => {
    let sum = 0;
    for (const p of photos) sum += await fn(p);
    return sum / photos.length;
  };

  it('leaves the photo untouched at 0% intensity', async () => {
    for (const f of camFilters) {
      const d = await mean(async (p) => difference(p, await applyFilter(p, f, 0)));
      assert.ok(d < 0.6, `${f.id} at 0% moved the pixels by ${d.toFixed(2)}`);
    }
  });

  it('mixes halfway at 50%', async () => {
    for (const id of ['goldenhour', 'noir', 'coldblue']) {
      const f = filterById(id)!;
      const fullMove = await mean(async (p) => difference(p, await applyFilter(p, f, 100)));
      const halfMove = await mean(async (p) => difference(p, await applyFilter(p, f, 50)));
      const ratio = halfMove / fullMove;
      assert.ok(ratio > 0.45 && ratio < 0.55, `${id}: 50% gave ${ratio.toFixed(2)} of the full change`);
    }
  });

  it('really changes the colors, and no two filters look alike', async () => {
    const results = await Promise.all(camFilters.map((f) => Promise.all(photos.map((p) => applyFilter(p, f)))));
    for (let i = 0; i < camFilters.length; i++) {
      let d = 0;
      for (let k = 0; k < photos.length; k++) d += await difference(photos[k], results[i][k]);
      d /= photos.length;
      assert.ok(d > 6, `${camFilters[i].id} barely changes the photo (${d.toFixed(1)})`);
    }
    for (let i = 0; i < camFilters.length; i++) {
      for (let j = i + 1; j < camFilters.length; j++) {
        let d = 0;
        for (let k = 0; k < photos.length; k++) d += await difference(results[i][k], results[j][k]);
        d /= photos.length;
        assert.ok(d > 5, `${camFilters[i].id} and ${camFilters[j].id} look almost the same (${d.toFixed(1)})`);
      }
    }
  });

  it('keeps transparency (PNG)', async () => {
    const CK = await canvasKit();
    // A colored disc on a transparent background.
    const surface = CK.MakeSurface(80, 80);
    const canvas = surface.getCanvas();
    canvas.clear(CK.TRANSPARENT);
    const paint = new CK.Paint();
    paint.setColor(CK.Color(200, 120, 90, 1));
    canvas.drawCircle(40, 40, 25, paint);
    const img = surface.makeImageSnapshot();
    const alphaBefore = (await pixels(img)).filter((_: number, i: number) => i % 4 === 3);
    for (const f of camFilters) {
      const alphaAfter = (await pixels(await applyFilter(img, f))).filter((_: number, i: number) => i % 4 === 3);
      let worst = 0;
      for (let i = 0; i < alphaBefore.length; i++) worst = Math.max(worst, Math.abs(alphaBefore[i] - alphaAfter[i]));
      assert.ok(worst <= 1, `${f.id} changed the transparency by ${worst}`);
    }
  });

  it('gives the same colors on the small preview and on the full-size export', async () => {
    const CK = await canvasKit();
    const big = await loadPhoto(labPhotos.portrait, 400);
    const small = await loadPhoto(labPhotos.portrait, 120);
    const shrink = (img: Img) => {
      const s = CK.MakeSurface(small.width(), small.height());
      s.getCanvas().drawImageRect(img, CK.LTRBRect(0, 0, img.width(), img.height()), CK.LTRBRect(0, 0, small.width(), small.height()), new CK.Paint());
      return s.makeImageSnapshot();
    };
    for (const f of camFilters) {
      const preview = await applyFilter(small, f);
      const exported = shrink(await applyFilter(big, f));
      const d = await difference(preview, exported);
      // Grain and fine detail differ with the resolution; the colors must not.
      assert.ok(d < 6, `${f.id}: preview and export differ by ${d.toFixed(1)}`);
    }
  });
});
