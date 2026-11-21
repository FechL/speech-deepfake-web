import test from 'node:test';
import assert from 'node:assert/strict';
import { batchMetrics } from '../frontend/src/metrics.js';

const row = (label, score, prediction) => ({ label, result: { predictions: [{ id: 'B4', score, prediction }] } });

test('batch metrics use labeled scores and expose confusion counts', () => {
  const result = batchMetrics([
    row(0, .1, 'REAL'), row(0, .8, 'FAKE'), row(1, .9, 'FAKE'), row(1, .2, 'REAL'), row(null, .95, 'FAKE'),
  ], 'B4');
  assert.equal(result.scored, 5);
  assert.equal(result.labeled, 4);
  assert.deepEqual([result.tp, result.fp, result.tn, result.fn], [1, 1, 1, 1]);
  assert.equal(result.accuracy, .5);
  assert.equal(result.balancedAccuracy, .5);
  assert.equal(result.auc, .75);
});

test('AUC and balanced accuracy need both reference classes', () => {
  const result = batchMetrics([row(0, .1, 'REAL'), row(0, .2, 'REAL')], 'B4');
  assert.equal(result.auc, null);
  assert.equal(result.eer, null);
  assert.equal(result.balancedAccuracy, null);
});
