export type CircuitMode = 'single' | 'series' | 'parallel';
export function circuit(
  voltage: number,
  r1: number,
  r2: number,
  mode: CircuitMode,
  closed = true,
) {
  if (
    ![voltage, r1, r2].every(Number.isFinite) ||
    voltage < 0 ||
    r1 <= 0 ||
    r2 <= 0
  )
    throw new Error('Invalid circuit values');
  const resistance =
    mode === 'single'
      ? r1
      : mode === 'series'
        ? r1 + r2
        : 1 / (1 / r1 + 1 / r2);
  const current = closed ? voltage / resistance : 0;
  const i1 = mode === 'parallel' && closed ? voltage / r1 : current;
  const i2 =
    mode === 'single'
      ? 0
      : mode === 'parallel' && closed
        ? voltage / r2
        : current;
  return {
    resistance,
    current,
    i1,
    i2,
    v1: i1 * r1,
    v2: i2 * r2,
    power: voltage * current,
  };
}
export type Question = {
  id: string;
  topic: string;
  prompt: string;
  choices: string[];
  answer: number;
  explanation: string;
};
export const baseline: Question[] = [
  {
    id: 'pre-voltage',
    topic: 'Ohm’s law',
    prompt:
      'A fixed resistor carries 1 A at 6 V. What current would it carry at 12 V, at the same temperature?',
    choices: ['0.5 A', '1 A', '2 A', 'I’m not sure yet'],
    answer: 2,
    explanation:
      'At fixed resistance, doubling the voltage doubles the current.',
  },
  {
    id: 'pre-parallel',
    topic: 'Parallel paths',
    prompt:
      'You add an identical resistor in parallel across an ideal battery. What happens to the total current from the battery?',
    choices: [
      'It decreases',
      'It stays the same',
      'It increases',
      'I’m not sure yet',
    ],
    answer: 2,
    explanation:
      'Another parallel path reduces equivalent resistance, increasing total current at the same battery voltage.',
  },
];
export const questions: Question[] = [
  {
    id: 'q-voltage',
    topic: 'Ohm’s law',
    prompt:
      'A 4 Ω resistor is connected across 8 V. The voltage rises to 12 V. What is the new current?',
    choices: ['2 A', '3 A', '4 A', '6 A'],
    answer: 1,
    explanation:
      'I = V ÷ R = 12 ÷ 4 = 3 A. With resistance fixed, current rises in proportion to voltage.',
  },
  {
    id: 'q-resistance',
    topic: 'Resistance',
    prompt:
      'At a constant 6 V, resistance changes from 3 Ω to 6 Ω. What happens to current?',
    choices: [
      'It doubles',
      'It stays the same',
      'It halves',
      'It becomes zero',
    ],
    answer: 2,
    explanation:
      'The current changes from 6 ÷ 3 = 2 A to 6 ÷ 6 = 1 A. Twice the resistance gives half the current at fixed voltage.',
  },
  {
    id: 'q-series',
    topic: 'Series circuits',
    prompt:
      'Two 3 Ω resistors are in series across 12 V. What current passes through the SECOND resistor?',
    choices: ['1 A', '2 A', '4 A', '0 A: the first resistor uses it up'],
    answer: 1,
    explanation:
      'Total resistance is 3 + 3 = 6 Ω, so I = 12 ÷ 6 = 2 A everywhere in this single path. Resistors transfer electrical energy; they do not use up current.',
  },
  {
    id: 'q-parallel',
    topic: 'Parallel paths',
    prompt:
      'Two 6 Ω resistors are connected in parallel across 6 V. What is the total battery current?',
    choices: ['0.5 A', '1 A', '2 A', '6 A'],
    answer: 2,
    explanation:
      'Each branch gets 6 V, so each carries 6 ÷ 6 = 1 A. The battery supplies 1 + 1 = 2 A.',
  },
  {
    id: 'q-power',
    topic: 'Electrical power',
    prompt:
      'A resistor has 6 V across it and carries 0.5 A. How quickly does it transfer electrical energy?',
    choices: ['0.083 W', '3 W', '6.5 W', '12 W'],
    answer: 1,
    explanation:
      'P = VI = 6 × 0.5 = 3 W. This is 3 joules of electrical energy transferred each second.',
  },
];
export const missions = [
  {
    id: 'voltage',
    title: 'Turn up the push',
    concept: 'Voltage & current',
    setup: 'One 6 Ω resistor, starting at 6 V.',
    prompt:
      'Keep resistance fixed. If you double the voltage to 12 V, what happens to current?',
    choices: ['It halves', 'It stays the same', 'It doubles'],
    answer: 2,
    explanation:
      'You changed voltage while keeping resistance fixed. The current doubled from 1 A to 2 A: I = V ÷ R.',
    target: 'Set voltage to 12 V, leaving R₁ at 6 Ω.',
  },
  {
    id: 'resistance',
    title: 'Make the path harder',
    concept: 'Resistance & current',
    setup: 'One 6 Ω resistor, with the battery fixed at 6 V.',
    prompt: 'If you double resistance to 12 Ω, what happens to current?',
    choices: ['It halves', 'It stays the same', 'It doubles'],
    answer: 0,
    explanation:
      'At the same 6 V, current fell from 1 A to 0.5 A. A greater resistance allows less current at the same voltage.',
    target: 'Set R₁ to 12 Ω, leaving voltage at 6 V.',
  },
  {
    id: 'paths',
    title: 'Give current another path',
    concept: 'Series vs parallel',
    setup: 'Two 6 Ω resistors in series across 6 V.',
    prompt:
      'Reconnect both resistors in parallel at the same voltage. What happens to total current?',
    choices: [
      'It becomes one quarter',
      'It doubles',
      'It becomes four times as large',
    ],
    answer: 2,
    explanation:
      'Series: R = 12 Ω, so I = 0.5 A. Parallel: R = 3 Ω, so total I = 2 A. Each parallel branch carries 1 A; the battery supplies their sum.',
    target: 'Choose Parallel, keeping 6 V and both resistors at 6 Ω.',
  },
] as const;
export function score(answers: Record<string, number>, items = questions) {
  return items.reduce((n, q) => n + (answers[q.id] === q.answer ? 1 : 0), 0);
}
export const LESSON_VERSION = 'electricity-1.0';
