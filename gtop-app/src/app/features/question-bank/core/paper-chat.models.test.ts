import {describe,it,expect} from 'vitest';
import {nextPaperRun} from './paper-chat.models';
describe('paper worker schedule in IST',()=>{
  it.each([
    ['2026-10-04T02:29:59Z','2026-10-04T02:30:00Z'],
    ['2026-10-04T02:30:00Z','2026-10-04T04:30:00Z'],
    ['2026-10-04T14:29:59Z','2026-10-04T14:30:00Z'],
    ['2026-10-04T14:30:00Z','2026-10-05T02:30:00Z'],
    ['2026-12-31T23:00:00Z','2027-01-01T02:30:00Z'],
  ])('next run from %s is %s',(now,next)=>expect(nextPaperRun(new Date(now)).toISOString()).toBe(new Date(next).toISOString()));
});
