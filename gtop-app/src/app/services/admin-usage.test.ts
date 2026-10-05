import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { activeInterval, usageArea } from './admin-usage.service';

describe('private active-time measurement',()=>{
  it('excludes idle, hidden and unfocused pages',()=>{
    expect(activeInterval(120000,105000,10000,true,true)).toBe(0);
    expect(activeInterval(15000,0,14000,false,true)).toBe(0);
    expect(activeInterval(15000,0,14000,true,false)).toBe(0);
  });
  it('caps a timer jump after suspension and never records negative time',()=>{
    expect(activeInterval(3600000,0,3600000,true,true)).toBe(15000);
    expect(activeInterval(100,200,100,true,true)).toBe(0);
    expect(activeInterval(15000,1000,9000,true,true)).toBe(14000);
  });
  it('records only coarse admin areas, excluding queries and learner routes',()=>{
    expect(usageArea('/admin/question-review?requestId=private-id')).toBe('review');
    expect(usageArea('/quiz?student=private')).toBe('');
    expect(usageArea('/admin/question-paper-generator')).toBe('paper-builder');
    for(const route of ['/admin/question-papers','/admin/question-papers/new','/admin/question-papers/chat/private-id','/admin/question-papers/view/private-id?answers=1','/admin/question-papers/all'])expect(usageArea(route)).toBe('papers');
  });
});
