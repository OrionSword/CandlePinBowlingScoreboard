/*
 * Candlepin bowling scoring engine.
 *
 * Rules implemented:
 *  - 10 frames, up to 3 balls per frame, 10 pins per rack.
 *  - Strike: all 10 pins on the first ball. Scores 10 + the next two balls.
 *  - Spare: all 10 pins with the first two balls. Scores 10 + the next ball.
 *  - Ten-box: all 10 pins using all three balls. Scores 10, no bonus.
 *  - Open frame: pins left standing after three balls. Scores pins knocked down.
 *  - Fallen pins (deadwood) stay on the lane between balls of a frame, so each
 *    ball can only knock down the pins still standing in the current rack.
 *  - 10th frame: three balls are always thrown. After a strike or spare the
 *    pins are reset, so a strike earns two bonus balls and a spare earns one.
 *  - Foul: the ball counts as thrown but scores 0 pins.
 *  - Perfect game is 300.
 *
 * A player's game is stored as a flat list of balls: { pins: Number, foul?: true }.
 */
(function (root) {
  'use strict';

  var PINS = 10;
  var FRAMES = 10;
  var BALLS_PER_FRAME = 3;

  function pinsOf(ball) {
    return ball.foul ? 0 : ball.pins;
  }

  function sum(balls) {
    var total = 0;
    for (var i = 0; i < balls.length; i++) total += pinsOf(balls[i]);
    return total;
  }

  /* Splits a flat ball list into 10 frames and scores them. */
  function buildFrames(balls) {
    var frames = [];
    var i = 0;

    for (var f = 0; f < FRAMES; f++) {
      var frame = {
        index: f,
        start: i,
        balls: [],
        marks: [],
        type: null, // 'strike' | 'spare' | 'tenbox' | 'open'
        complete: false,
        score: null, // this frame's points once known
        total: null // running total once known
      };
      var tenth = f === FRAMES - 1;
      var rack = PINS;
      var rackBall = 0;

      while (frame.balls.length < BALLS_PER_FRAME && i < balls.length) {
        var ball = balls[i++];
        var pins = pinsOf(ball);
        frame.balls.push(ball);
        rack -= pins;
        rackBall++;

        if (ball.foul) frame.marks.push('F');
        else if (rack === 0 && rackBall === 1) frame.marks.push('X');
        else if (rack === 0 && rackBall === 2) frame.marks.push('/');
        else frame.marks.push(pins === 0 ? '–' : String(pins));

        if (rack === 0) {
          if (!tenth) break;
          rack = PINS; // 10th frame: reset the pins after a strike or spare
          rackBall = 0;
        }
      }

      var n = frame.balls.length;
      var first = n > 0 ? pinsOf(frame.balls[0]) : 0;
      var firstTwo = n > 1 ? first + pinsOf(frame.balls[1]) : first;

      if (tenth) {
        frame.complete = n === BALLS_PER_FRAME;
      } else {
        frame.complete = n > 0 && (sum(frame.balls) === PINS || n === BALLS_PER_FRAME);
      }

      if (n > 0) {
        if (first === PINS) frame.type = 'strike';
        else if (n > 1 && firstTwo === PINS) frame.type = 'spare';
        else if (n === 3 && sum(frame.balls.slice(0, 3)) === PINS) frame.type = 'tenbox';
        else if (frame.complete) frame.type = 'open';
      }

      frames.push(frame);
    }

    // Score frames now that the balls are split up.
    var running = 0;
    var known = true;
    for (var k = 0; k < FRAMES; k++) {
      var fr = frames[k];
      if (!fr.complete) {
        known = false;
        continue;
      }
      var score;
      if (k === FRAMES - 1) {
        score = sum(fr.balls);
      } else {
        var bonusCount = fr.type === 'strike' ? 2 : fr.type === 'spare' ? 1 : 0;
        var after = fr.start + fr.balls.length;
        var bonus = balls.slice(after, after + bonusCount);
        score = bonus.length === bonusCount ? sum(fr.balls) + sum(bonus) : null;
      }
      fr.score = score;
      if (score === null) known = false;
      if (known) {
        running += score;
        fr.total = running;
      }
    }

    return frames;
  }

  /* Information about the next ball for a player, or null if their game is over. */
  function nextBall(balls) {
    var frames = buildFrames(balls);
    for (var f = 0; f < FRAMES; f++) {
      var frame = frames[f];
      if (frame.complete) continue;
      var rack = PINS;
      for (var b = 0; b < frame.balls.length; b++) {
        rack -= pinsOf(frame.balls[b]);
        if (rack === 0) rack = PINS;
      }
      return { frame: f, ball: frame.balls.length, standing: rack };
    }
    return null;
  }

  function completedFrames(balls) {
    var frames = buildFrames(balls);
    var count = 0;
    while (count < FRAMES && frames[count].complete) count++;
    return count;
  }

  /* Highest total still reachable, assuming every remaining ball is a strike. */
  function maxPossible(balls) {
    var copy = balls.slice();
    var next;
    var guard = 0;
    while ((next = nextBall(copy)) && guard++ < 40) copy.push({ pins: next.standing });
    return totalScore(copy);
  }

  function totalScore(balls) {
    var frames = buildFrames(balls);
    var total = 0;
    for (var f = 0; f < FRAMES; f++) {
      var fr = frames[f];
      if (fr.total !== null) total = fr.total;
      else break;
    }
    return total;
  }

  /* Score that is currently on the board, counting incomplete frames at face value. */
  function currentScore(balls) {
    var frames = buildFrames(balls);
    var total = 0;
    for (var f = 0; f < FRAMES; f++) {
      var fr = frames[f];
      if (fr.score !== null) total += fr.score;
      else {
        total += sum(fr.balls);
        // Pending strike/spare bonuses: count the bonus balls already thrown.
        if (fr.complete && f < FRAMES - 1) {
          var bonusCount = fr.type === 'strike' ? 2 : 1;
          var after = fr.start + fr.balls.length;
          total += sum(balls.slice(after, after + bonusCount));
        }
      }
    }
    return total;
  }

  function stats(balls) {
    var frames = buildFrames(balls);
    var s = {
      throws: balls.length,
      strikes: 0,
      spares: 0,
      tenBoxes: 0,
      opens: 0,
      fouls: 0,
      firstBallPins: 0,
      firstBalls: 0,
      score: currentScore(balls),
      complete: nextBall(balls) === null
    };
    for (var f = 0; f < FRAMES; f++) {
      var fr = frames[f];
      for (var m = 0; m < fr.marks.length; m++) {
        if (fr.marks[m] === 'X') s.strikes++;
        else if (fr.marks[m] === '/') s.spares++;
        else if (fr.marks[m] === 'F') s.fouls++;
      }
      if (fr.type === 'tenbox') s.tenBoxes++;
      if (fr.type === 'open') s.opens++;
      if (fr.balls.length) {
        s.firstBalls++;
        s.firstBallPins += pinsOf(fr.balls[0]);
      }
    }
    s.firstBallAverage = s.firstBalls ? s.firstBallPins / s.firstBalls : 0;
    return s;
  }

  var api = {
    PINS: PINS,
    FRAMES: FRAMES,
    buildFrames: buildFrames,
    nextBall: nextBall,
    completedFrames: completedFrames,
    totalScore: totalScore,
    currentScore: currentScore,
    maxPossible: maxPossible,
    stats: stats
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Candlepin = api;
})(this);
