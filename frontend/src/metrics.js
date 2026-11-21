export function batchMetrics(rows, modelId) {
  const scored = rows.flatMap(row => {
    const p = row.result?.predictions?.find(item => item.id === modelId);
    return p ? [{ ...p, label: row.label }] : [];
  });
  const labeled = scored.filter(p => p.label === 0 || p.label === 1);
  const tp = labeled.filter(p => p.label === 1 && p.prediction === 'FAKE').length;
  const tn = labeled.filter(p => p.label === 0 && p.prediction === 'REAL').length;
  const fp = labeled.filter(p => p.label === 0 && p.prediction === 'FAKE').length;
  const fn = labeled.filter(p => p.label === 1 && p.prediction === 'REAL').length;
  const ratio = (n, d) => d ? n / d : null;
  const precision = ratio(tp, tp + fp);
  const recall = ratio(tp, tp + fn);
  const specificity = ratio(tn, tn + fp);
  const f1 = precision !== null && recall !== null && precision + recall ? 2 * precision * recall / (precision + recall) : null;
  let auc = null;
  let eer = null;
  if (tp + fn && tn + fp) {
    const sorted = [...labeled].sort((a, b) => b.score - a.score);
    let positivesAbove = 0, concordant = 0, positivesSeen = 0, negativesSeen = 0, gap = Infinity;
    const consider = () => {
      const fpr = negativesSeen / (tn + fp), fnr = 1 - positivesSeen / (tp + fn);
      if (Math.abs(fpr - fnr) < gap) { gap = Math.abs(fpr - fnr); eer = (fpr + fnr) / 2; }
    };
    consider();
    for (let i = 0; i < sorted.length;) {
      let j = i, pos = 0, neg = 0;
      while (j < sorted.length && sorted[j].score === sorted[i].score) {
        if (sorted[j].label === 1) pos++; else neg++;
        j++;
      }
      concordant += neg * (positivesAbove + pos / 2);
      positivesAbove += pos; positivesSeen += pos; negativesSeen += neg;
      consider(); i = j;
    }
    auc = concordant / ((tp + fn) * (tn + fp));
  }
  return { attempted: rows.length, scored: scored.length, labeled: labeled.length, tp, tn, fp, fn,
    accuracy: ratio(tp + tn, labeled.length), precision, recall, specificity, f1,
    balancedAccuracy: recall !== null && specificity !== null ? (recall + specificity) / 2 : null, auc, eer };
}
