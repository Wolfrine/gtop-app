export interface PaperExample {
  id: string;
  family: string;
  description: string;
  questionType: string;
  curriculum: string;
  marks: number;
  question: string;
  options?: string[];
  answer: string;
}

export const PAPER_EXAMPLES: Record<string, PaperExample> = {
  auto: {
    id: 'auto', family: 'Objective', description: 'A quick, single-section MCQ paper you can size yourself.',
    questionType: 'Single-correct MCQ', curriculum: 'CBSE · Class 10 · Science', marks: 1,
    question: 'Which lens is used to correct myopia?',
    options: ['Concave lens', 'Convex lens', 'Cylindrical lens', 'Plane glass'],
    answer: 'A. Concave lens. It diverges incoming rays so the image forms on the retina.',
  },
  board_40_mark_chapter_test: {
    id: 'board_40_mark_chapter_test', family: 'Board paper', description: '40 marks across objective, very short, short and longer answers.',
    questionType: 'Short answer', curriculum: 'CBSE · Class 11 · Biology', marks: 3,
    question: 'An onion peel shrinks when placed in concentrated salt solution. Name the process, explain why water moves out of the cells, and state what happens when the peel is returned to fresh water.',
    answer: 'Plasmolysis occurs. Water leaves the cells by osmosis because the surrounding solution has lower water potential. In fresh water, water enters and the cells become turgid again.',
  },
  competency_based_paper: {
    id: 'competency_based_paper', family: 'Competency', description: 'Interpret evidence, apply ideas and explain a conclusion.',
    questionType: 'Experiment inference', curriculum: 'CBSE · Class 10 · Science', marks: 3,
    question: 'A student connects wires of the same material and thickness to the same battery. A 1 m wire carries more current than a 2 m wire. What does this suggest about resistance? Identify two variables kept constant.',
    answer: 'Resistance increases with length, so the longer wire carries less current at the same voltage. Material and cross-sectional area (thickness) are held constant.',
  },
  icse_structured_paper: {
    id: 'icse_structured_paper', family: 'Board paper', description: 'Compulsory short items followed by structured working.',
    questionType: 'Numerical', curriculum: 'ICSE · Class 9 · Physics', marks: 2,
    question: 'A stone starts from rest and falls freely for 2 s. Calculate the distance travelled. Take g = 10 m/s² and show the formula used.',
    answer: 's = ut + ½gt² = 0 + ½ × 10 × 2² = 20 m.',
  },
  integrated_multi_subject_paper: {
    id: 'integrated_multi_subject_paper', family: 'Integrated', description: 'A tuition practice paper combining Physics, Chemistry and Biology questions.',
    questionType: 'Integrated short answer', curriculum: 'Class 12 · Physics, Chemistry & Biology', marks: 3,
    question: 'A pond sample has pH 5 and contains fish. A 12 V pump draws 0.5 A to aerate it. (a) Calculate the pump power. (b) Classify the water by pH. (c) Why do the fish need dissolved oxygen?',
    answer: '(a) P = VI = 12 × 0.5 = 6 W. (b) It is acidic. (c) Fish use dissolved oxygen for aerobic respiration.',
  },
  mixed_mcq_mock: {
    id: 'mixed_mcq_mock', family: 'Objective', description: 'Objective mock mixing single-correct, assertion–reason and statement items.',
    questionType: 'Assertion–reason', curriculum: 'NEET · Biology', marks: 4,
    question: 'Assertion: Crossing over occurs during prophase I of meiosis. Reason: Homologous chromosomes pair and exchange segments between non-sister chromatids.',
    options: ['Both are true; the reason explains the assertion', 'Both are true; the reason does not explain it', 'Assertion true; reason false', 'Assertion false; reason true'],
    answer: 'A. Both are true and the reason explains the assertion. Exchange occurs at pachytene of prophase I.',
  },
  neet_objective_mock: {
    id: 'neet_objective_mock', family: 'Objective', description: 'NEET-style subject slices or a full 180-question mock with negative marking.',
    questionType: 'Single-correct MCQ', curriculum: 'NEET · Biology', marks: 4,
    question: 'At which stage of meiosis do homologous chromosomes move to opposite poles?',
    options: ['Anaphase I', 'Anaphase II', 'Metaphase I', 'Telophase II'],
    answer: 'A. Anaphase I. Sister chromatids remain joined while homologous chromosomes separate.',
  },
  numerical_graph_instrument_paper: {
    id: 'numerical_graph_instrument_paper', family: 'Skills', description: 'Worked calculations, graph interpretation and instrument reading.',
    questionType: 'Numerical with working', curriculum: 'ICSE · Class 9 · Physics', marks: 4,
    question: 'A car increases its speed uniformly from 4 m/s to 16 m/s in 6 s. Calculate its acceleration and the distance travelled in that time.',
    answer: 'a = (v − u)/t = (16 − 4)/6 = 2 m/s². Distance = (u + v)t/2 = (4 + 16) × 6/2 = 60 m.',
  },
  one_two_mark_qa_sheet: {
    id: 'one_two_mark_qa_sheet', family: 'Revision', description: 'One and two-mark questions with compact model answers.',
    questionType: 'Two-mark answer', curriculum: 'CBSE · Class 9 · History', marks: 2,
    question: 'Give two ways the spread of print helped circulate new ideas in society.',
    answer: 'It made books and pamphlets available to more readers. It also let people share and debate ideas across places more quickly.',
  },
};
