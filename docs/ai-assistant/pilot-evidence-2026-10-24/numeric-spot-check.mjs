// Deterministic checks of selected actual paper answers, not an academic approval.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const paper=JSON.parse(fs.readFileSync(new URL('./06-codex-revision/paper.json',import.meta.url)));
const answer=n=>paper.sections.flatMap(s=>s.questions).find(q=>q.number===n).answer;
const checks=[];
function check(question,quantity,computed,pattern,scale=1){const match=answer(question).match(pattern);assert(match,`Missing reported value: Q${question} ${quantity}`);const reported=Number(match[1])*scale;const tolerance=Math.max(1e-9,Math.abs(computed)*0.0006);assert(Math.abs(computed-reported)<=tolerance,`Numeric mismatch: ${quantity}`);checks.push({question,quantity,computed,reported,passed:true});}
check(22,'conductivity_S_per_cm',1.20/600,/=(2\.00)\\times10\^\{-3\}/,0.001);
check(22,'molar_conductivity_S_cm2_per_mol',1000*(1.20/600)/0.0200,/=(100)\\,/);
check(36,'molality_mol_per_kg',0.248/1.86,/=(0\.1333)\\,/);
check(36,'molar_mass_g_per_mol',3.00/((0.248/1.86)*0.2500),/=(90\.0)\\,/);
check(36,'osmotic_pressure_atm',(0.900/90.0)/0.1000*0.0821*300,/=(2\.463)\\,/);
check(37,'cell_potential_V',1.10-(0.0592/2)*Math.log10(0.100/0.0100),/=(1\.0704)\\,/);
check(37,'copper_mass_g',1.93*1000*63.5/(2*96500),/=(0\.635)\\,/);
check(38,'rate_constant_per_min',1.386/40.0,/=(0\.03465)\\,/);
check(38,'half_life_min',0.693/(1.386/40.0),/=(20\.0)\\,/);
check(38,'initial_rate_mol_per_L_min',(1.386/40.0)*0.0800,/=(2\.772)\\times10\^\{-3\}/,0.001);
const result={method:'Manually transcribed givens and formulae from actual questions; numeric answer extraction; independent JavaScript arithmetic',checks,academicApproval:false,limitations:'Selected numerical values only; does not verify all chemistry, balance every reaction, assess difficulty or establish teacher acceptance.'};
fs.writeFileSync(new URL('./numeric-spot-check.json',import.meta.url),JSON.stringify(result,null,2));
console.log(`${checks.length} selected numerical values match independently recomputed results.`);
