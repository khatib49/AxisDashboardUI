/** Swap a list item with its neighbour (in place). */
export function moveItem<T>(arr: T[], index: number, dir: -1 | 1) {
  const j = index + dir;
  if (j < 0 || j >= arr.length) return;
  [arr[index], arr[j]] = [arr[j], arr[index]];
}
