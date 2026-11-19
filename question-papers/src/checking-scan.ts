export type MappingPoint = { page: number; x: number; y: number };
export type MarkStatus = 'correct' | 'partial' | 'wrong' | 'missing' | 'unreadable' | 'uncertain';
export type MethodStep = { criterion: string; max: number; awarded: number | null; comment: string; anchor: MappingPoint | null };
type MarkedAnswer = {
  number: number; max: number; awarded: number | null; status: MarkStatus;
  explanation: string; anchors: MappingPoint[]; steps?: MethodStep[];
};
export type ScanMark<T extends MarkedAnswer> = {
  answer: T; anchor: MappingPoint; key: string; stepIndex: number | null; title: string;
  awarded: number | null; max: number; status: MarkStatus; comment: string;
};

export function scoreStatus(awarded: number | null, max: number): MarkStatus {
  if (awarded === null) return 'uncertain';
  if (awarded === 0) return 'wrong';
  return awarded === max ? 'correct' : 'partial';
}

export function marksOnPage<T extends MarkedAnswer>(answers: T[], page: number): ScanMark<T>[] {
  const marks: ScanMark<T>[] = [];
  for (const answer of answers) {
    const onPage = (answer.steps ?? []).flatMap((step, stepIndex) =>
      step.anchor?.page === page ? [{ step, stepIndex, anchor: step.anchor }] : []);
    if (onPage.length) {
      for (const { step, stepIndex, anchor } of onPage) {
        marks.push({ answer, anchor, key: answer.number + '/' + stepIndex, stepIndex,
          title: step.criterion, awarded: step.awarded, max: step.max,
          status: scoreStatus(step.awarded, step.max), comment: step.comment });
      }
    } else {
      const anchor = answer.anchors.find(point => point.page === page);
      if (anchor) marks.push({ answer, anchor, key: String(answer.number), stepIndex: null, title: '',
        awarded: answer.awarded, max: answer.max, status: answer.status, comment: answer.explanation });
    }
  }
  return marks;
}

// Place references outside the scan. If the page is crowded, neighboring references
// share one button, with all of their individual results available in the inspector.
export function marginGroups<T extends { anchor: MappingPoint }>(marks: T[], height: number, spacing: number) {
  if (!marks.length) return [];
  const sorted = [...marks].sort((a, b) => a.anchor.y - b.anchor.y);
  const capacity = Math.max(1, Math.floor(height / spacing));
  const groups = sorted.map((mark) => ({ marks: [mark], center: mark.anchor.y }));
  while (groups.length > capacity) {
    let nearest = 0;
    for (let i = 1; i < groups.length - 1; i++) {
      if (groups[i + 1].center - groups[i].center < groups[nearest + 1].center - groups[nearest].center)
        nearest = i;
    }
    const group = groups[nearest];
    group.marks.push(...groups.splice(nearest + 1, 1)[0].marks);
    group.center = group.marks.reduce((sum, item) => sum + item.anchor.y, 0) / group.marks.length;
  }
  const step = spacing / Math.max(spacing, height);
  let previous = -step / 2;
  for (const [i, group] of groups.entries()) {
    group.center = Math.min(1 - step * (groups.length - i - 0.5), Math.max(previous + step, group.center));
    previous = group.center;
  }
  return groups;
}

// Keep scored marks on the actual scan while moving each small label away from
// its reference point. Prefer open space immediately above the written line.
export function positionedMarks<T extends { anchor: MappingPoint }>(
  marks: T[],
  width: number,
  height: number,
  labelWidth: number,
  labelHeight: number,
) {
  const placed: { x: number; y: number }[] = [];
  const limit = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(Math.max(min, max), value));
  return [...marks]
    .sort((a, b) => a.anchor.y - b.anchor.y)
    .map((mark) => {
      const x = mark.anchor.x * width,
        y = mark.anchor.y * height;
      const right = x + 8 + labelWidth <= width;
      const sides = right ? [x + 6, x - labelWidth - 6] : [x - labelWidth - 6, x + 6];
      const candidates = [-1.15, 0.15, -2.25, 1.3, -3.4, 2.5].flatMap((dy) =>
        sides.map((side) => ({
          x: limit(side, 1, width - labelWidth - 1),
          y: limit(y + dy * labelHeight, 1, height - labelHeight - 1),
        })),
      );
      const point =
        candidates.find((next) =>
          placed.every(
            (prev) =>
              Math.abs(next.x - prev.x) >= labelWidth + 1 || Math.abs(next.y - prev.y) >= labelHeight + 1,
          ),
        ) ?? candidates[0];
      placed.push(point);
      return { ...mark, left: (point.x / width) * 100, top: (point.y / height) * 100 };
    });
}
