// Run with: node --test tests/scoring.test.js
const test = require('node:test');
const assert = require('node:assert');
const C = require('../scoring.js');

const b = (...pins) => pins.map((p) => (p === 'F' ? { pins: 0, foul: true } : { pins: p }));

test('perfect game is 300 in 12 throws', () => {
  const balls = b(...Array(12).fill(10));
  assert.strictEqual(C.totalScore(balls), 300);
  assert.strictEqual(C.nextBall(balls), null);
  assert.strictEqual(C.stats(balls).throws, 12);
  assert.strictEqual(C.stats(balls).strikes, 12);
});

test('all open frames sum pins and take 30 throws', () => {
  const balls = b(...Array(30).fill(2));
  assert.strictEqual(C.totalScore(balls), 60);
  assert.strictEqual(C.nextBall(balls), null);
});

test('strike bonus uses next two balls', () => {
  const balls = b(10, 3, 4, 2);
  const frames = C.buildFrames(balls);
  assert.strictEqual(frames[0].score, 17);
  assert.strictEqual(frames[1].score, 9);
  assert.strictEqual(frames[1].total, 26);
});

test('spare bonus uses next ball', () => {
  const frames = C.buildFrames(b(6, 4, 5, 1, 1));
  assert.strictEqual(frames[0].type, 'spare');
  assert.strictEqual(frames[0].score, 15);
  assert.deepStrictEqual(frames[0].marks, ['6', '/']);
});

test('ten-box scores 10 with no bonus', () => {
  const frames = C.buildFrames(b(5, 3, 2, 9, 0, 0));
  assert.strictEqual(frames[0].type, 'tenbox');
  assert.strictEqual(frames[0].score, 10);
  assert.strictEqual(frames[1].total, 19);
});

test('pending bonus leaves total unknown', () => {
  const frames = C.buildFrames(b(10, 4));
  assert.strictEqual(frames[0].score, null);
  assert.strictEqual(C.currentScore(b(10, 4)), 18);
});

test('deadwood limits standing pins', () => {
  assert.deepStrictEqual(C.nextBall(b(7)), { frame: 0, ball: 1, standing: 3 });
  assert.deepStrictEqual(C.nextBall(b(7, 2)), { frame: 0, ball: 2, standing: 1 });
  assert.deepStrictEqual(C.nextBall(b(7, 2, 0)), { frame: 1, ball: 0, standing: 10 });
});

test('tenth frame resets pins after strike and spare', () => {
  const nine = Array(27).fill(0);
  assert.deepStrictEqual(C.nextBall(b(...nine, 10)), { frame: 9, ball: 1, standing: 10 });
  assert.deepStrictEqual(C.nextBall(b(...nine, 10, 6)), { frame: 9, ball: 2, standing: 4 });
  assert.deepStrictEqual(C.nextBall(b(...nine, 3, 7)), { frame: 9, ball: 2, standing: 10 });
  assert.deepStrictEqual(C.nextBall(b(...nine, 3, 2)), { frame: 9, ball: 2, standing: 5 });
  const done = b(...nine, 10, 6, 4);
  assert.strictEqual(C.nextBall(done), null);
  assert.strictEqual(C.totalScore(done), 20);
  assert.deepStrictEqual(C.buildFrames(done)[9].marks, ['X', '6', '/']);
});

test('ninth frame strike takes bonus from tenth', () => {
  const balls = b(...Array(24).fill(0), 10, 10, 10, 5);
  const frames = C.buildFrames(balls);
  assert.strictEqual(frames[8].score, 30);
  assert.strictEqual(frames[9].score, 25);
  assert.strictEqual(C.totalScore(balls), 55);
});

test('foul counts as a throw for zero pins', () => {
  const balls = b('F', 10);
  const frames = C.buildFrames(balls);
  assert.strictEqual(frames[0].type, 'spare');
  assert.deepStrictEqual(frames[0].marks, ['F', '/']);
  assert.strictEqual(C.stats(balls).fouls, 1);
});

test('max possible assumes strikes from here', () => {
  assert.strictEqual(C.maxPossible([]), 300);
  assert.strictEqual(C.maxPossible(b(9, 0, 0)), 279);
});
