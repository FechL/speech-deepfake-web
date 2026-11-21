import { useState } from 'react';

export function useTableSort() {
  const [sort, setSort] = useState({ key: null, direction: 'asc' });
  const selectSort = key => setSort(current => ({
    key,
    direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
  }));
  return [sort, selectSort];
}

export function sortRows(rows, sort, getValue) {
  if (!sort.key) return rows;
  const sign = sort.direction === 'asc' ? 1 : -1;
  return rows.map((row, index) => ({ row, index })).sort((a, b) => {
    const left = getValue(a.row, sort.key);
    const right = getValue(b.row, sort.key);
    const leftEmpty = left === null || left === undefined || (typeof left === 'number' && !Number.isFinite(left));
    const rightEmpty = right === null || right === undefined || (typeof right === 'number' && !Number.isFinite(right));
    if (leftEmpty || rightEmpty) return leftEmpty === rightEmpty ? a.index - b.index : leftEmpty ? 1 : -1;
    const compared = typeof left === 'number' && typeof right === 'number'
      ? left - right
      : String(left).localeCompare(String(right), 'en', { numeric: true, sensitivity: 'base' });
    return compared ? sign * compared : a.index - b.index;
  }).map(item => item.row);
}
