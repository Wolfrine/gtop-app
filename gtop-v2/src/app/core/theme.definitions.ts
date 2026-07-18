import { ThemeDefinition } from './models';

export const GTOP_THEME_DEFINITIONS: ThemeDefinition[] = [
  {
    id: 'academic-editorial',
    name: 'Academic Editorial',
    description: 'Ivory, deep navy and teal with a refined academic voice.',
    swatches: ['#f7f2e8', '#14213d', '#157a78', '#d9a441'],
    dark: false,
  },
  {
    id: 'learning-os',
    name: 'Learning OS',
    description: 'A crisp indigo and cyan workspace built for dense learning data.',
    swatches: ['#f5f7ff', '#20285c', '#5965e8', '#20b9ce'],
    dark: false,
  },
  {
    id: 'aurora-glass',
    name: 'Aurora Glass',
    description: 'Midnight surfaces with restrained violet and teal light.',
    swatches: ['#0e1324', '#171d33', '#8b7cff', '#3dd6c4'],
    dark: true,
  },
  {
    id: 'warm-studio',
    name: 'Warm Studio',
    description: 'Sand, terracotta and sage for a calm coaching atmosphere.',
    swatches: ['#fbf5eb', '#3d302a', '#c7674f', '#6e8b74'],
    dark: false,
  },
  {
    id: 'quiz-pulse',
    name: 'Quiz Pulse',
    description: 'Graphite, electric blue and coral for energetic practice.',
    swatches: ['#f5f8fa', '#18202a', '#1479ff', '#ff5d67'],
    dark: false,
  },
];
