import test from 'node:test';
import assert from 'node:assert/strict';
import { boardPoint, plannerArrow } from './planner.js';

test('board coordinates and arrow ends rotate together', () => {
  const white = plannerArrow({ from: 'b1', to: 'c3' });
  const black = plannerArrow({ from: 'b1', to: 'c3' }, 'black');
  assert.deepEqual(boardPoint('a8'), { x: .5, y: .5 });
  assert.deepEqual(boardPoint('a8', 'black'), { x: 7.5, y: 7.5 });
  for (const point of ['from', 'to', 'tip']) {
    assert.equal(white[point].x + black[point].x, 8);
    assert.equal(white[point].y + black[point].y, 8);
  }
});
test('arrow shafts stop outside the destination piece and numbered badges stay inside their square', () => {
  for (const [from, to] of [['e2', 'e4'], ['a1', 'h8'], ['g1', 'f3'], ['a7', 'a8'], ['h2', 'h1']]) {
    const { tip, to: target, badge } = plannerArrow({ from, to });
    assert.ok(Math.abs(Math.hypot(tip.x - target.x, tip.y - target.y) - .44) < 1e-10);
    assert.ok(badge.x - .155 > 0 && badge.x + .155 < 8);
    assert.ok(badge.y - .155 > 0 && badge.y + .155 < 8);
  }
});
test('knight arrows bend while bishop arrows stay diagonal, and malformed arrows do not render', () => {
  assert.equal(plannerArrow({ from: 'b1', to: 'c3' }).path.split('L').length, 3);
  assert.equal(plannerArrow({ from: 'c1', to: 'h6' }).path.split('L').length, 2);
  assert.equal(plannerArrow({ from: 'a1', to: 'a1' }), null);
  assert.equal(plannerArrow({ from: 'wrong', to: 'a8' }), null);
});
