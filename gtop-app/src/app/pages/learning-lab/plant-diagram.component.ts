import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-plant-diagram', standalone: true, imports: [CommonModule],
  template: `<svg viewBox="0 0 600 440" role="img" [attr.aria-label]="description">
    <defs>
      <linearGradient id="petal-colour" x2="1" y2="1"><stop stop-color="#ffbbd5"/><stop offset="1" stop-color="#d73583"/></linearGradient>
      <linearGradient id="ovary-colour" x2="1" y2="1"><stop stop-color="#d6ed96"/><stop offset="1" stop-color="#55a46c"/></linearGradient>
      <linearGradient id="fruit-colour" x2="1" y2="1"><stop stop-color="#ffe19a"/><stop offset="1" stop-color="#e89435"/></linearGradient>
    </defs>
    <path d="M300 365 V435" stroke="#89b87c" stroke-width="14" fill="none"/>
    <path d="M300 405 Q242 351 203 383 Q252 423 300 415 M303 416 Q358 361 394 390 Q350 429 303 425" fill="#5c9967"/>
    <g [attr.opacity]="fruit ? 1 - time / 110 : 1">
      <g [attr.opacity]="opened || journeyMode ? 0.12 : 0.95" class="petal-layer">
        <path d="M287 331 C190 320 80 217 137 106 C202 69 290 190 297 288Z" fill="url(#petal-colour)"/>
        <path d="M310 332 C412 323 521 209 464 104 C397 66 310 192 302 288Z" fill="url(#petal-colour)"/>
        <path d="M292 329 C223 268 216 147 288 123 C354 145 359 259 308 329Z" fill="#ef8fbd"/>
      </g>
      <g stroke="#dfe9a6" stroke-width="5" fill="none"><path d="M251 319 Q211 245 185 181"/><path d="M350 319 Q391 243 415 181"/><path d="M266 312 L227 219"/><path d="M334 312 L374 219"/></g>
      <g fill="#f8d45f" [attr.stroke]="part === 'anther' ? '#fff' : 'none'" stroke-width="4"><ellipse cx="183" cy="174" rx="13" ry="24" transform="rotate(-24 183 174)"/><ellipse cx="417" cy="174" rx="13" ry="24" transform="rotate(24 417 174)"/><ellipse cx="225" cy="210" rx="11" ry="20" transform="rotate(-24 225 210)"/><ellipse cx="375" cy="210" rx="11" ry="20" transform="rotate(24 375 210)"/></g>
      <path d="M286 289 L291 109 Q300 102 309 109 L314 289" fill="#afce8f" [attr.stroke]="part === 'style' ? '#fff' : '#dbe9b4'" stroke-width="3"/>
      <path d="M279 109 Q268 84 286 83 Q296 76 300 90 Q307 76 319 85 Q333 87 320 111Z" fill="#f4acc0" [attr.stroke]="part === 'stigma' ? '#fff' : '#fbd1dd'" stroke-width="3"/>
      <ellipse cx="300" cy="326" rx="64" ry="50" fill="url(#ovary-colour)" [attr.stroke]="part === 'ovary' ? '#fff' : '#d9ebaa'" stroke-width="4"/>
      <g *ngIf="opened || journeyMode" class="ovary-cutaway">
        <ellipse cx="300" cy="326" rx="49" ry="38" fill="#194d3c" stroke="#d1e5a0" stroke-width="2"/>
        <path d="M298 290 V359 M299 316 L270 314 M300 323 L330 321 M299 343 L273 344" stroke="#b3d387" stroke-width="2"/>
        <g fill="#d9eac0" stroke="#92b78b" stroke-width="2"><ellipse cx="271" cy="314" rx="13" ry="9"/><ellipse cx="329" cy="322" rx="14" ry="10"/><ellipse cx="275" cy="345" rx="13" ry="9"/></g>
        <circle cx="329" cy="322" r="4" [attr.fill]="journeyMode && time === 100 ? '#ffcd58' : '#d85f98'"/>
      </g>
      <circle *ngIf="pollenLanding" [attr.cx]="pollenLanding === 'stigma' ? 300 : 151" [attr.cy]="pollenLanding === 'stigma' ? 83 : 237" r="8" fill="#ffdd65" stroke="#fff2bf" stroke-width="2"/>
      <g *ngIf="journeyMode">
        <g fill="#fbd15c"><circle cx="295" cy="86" r="7"/><circle cx="308" cy="81" r="5"/></g>
        <path d="M295 88 Q299 145 301 208 L300 274 Q299 299 324 312 L329 322" fill="none" stroke="#ffdc70" stroke-width="5" pathLength="100" stroke-dasharray="100" [attr.stroke-dashoffset]="100-tubeGrowth"/>
        <circle *ngIf="time >= 65 && time < 100" cx="326" cy="316" r="4" fill="#ffed9e"/>
        <circle *ngIf="time === 100" cx="329" cy="322" r="14" fill="none" stroke="#ffdb65" stroke-width="2" class="fusion-ring"/>
      </g>
    </g>
    <g *ngIf="fruit" [attr.opacity]="time / 100">
      <path d="M300 255 C217 223 207 302 239 350 C265 389 341 389 366 350 C400 303 384 223 300 255Z" fill="url(#fruit-colour)" stroke="#ffda8d" stroke-width="3"/>
      <path d="M300 253 L286 229 L303 237 L326 224 L320 251" fill="#78a366"/>
      <path d="M303 266 V362" stroke="#ffd47a" stroke-width="3"/>
      <g fill="#75533a"><ellipse cx="276" cy="303" rx="9" ry="14" transform="rotate(-30 276 303)"/><ellipse cx="332" cy="310" rx="9" ry="14" transform="rotate(30 332 310)"/><ellipse cx="279" cy="342" rx="9" ry="14" transform="rotate(-30 279 342)"/></g>
    </g>
    <g class="diagram-labels" fill="#f2f9ec" font-size="17" font-family="inherit">
      <g *ngIf="!fruit"><path d="M331 97 H413 L435 77" stroke="#afc7b7" fill="none"/><text x="440" y="80">Stigma</text>
        <path d="M310 234 H449" stroke="#afc7b7"/><text x="457" y="240">Style</text>
        <path d="M168 170 H84" stroke="#afc7b7"/><text x="19" y="176">Anther</text>
        <path d="M236 338 H122" stroke="#afc7b7"/><text x="50" y="344">Ovary</text>
        <g *ngIf="opened || journeyMode"><path d="M344 322 H446" stroke="#afc7b7"/><text x="452" y="328">Ovule</text></g>
      </g>
      <g *ngIf="fruit"><text x="86" y="97">{{time < 50 ? 'After fertilisation' : 'Fruit develops'}}</text><path d="M242 301 H122" stroke="#afc7b7"/><text x="49" y="306">{{time < 50 ? 'Ovary' : 'Fruit'}}</text><path d="M337 314 H448" stroke="#afc7b7"/><text x="457" y="320">{{time < 50 ? 'Ovules' : 'Seeds'}}</text></g>
    </g>
  </svg>`,
})
export class PlantDiagramComponent {
  @Input() opened = false; @Input() part = ''; @Input() journeyMode = false;
  @Input() time = 0; @Input() fruit = false;
  @Input() pollenLanding = '';
  get tubeGrowth() { return Math.min(100, this.time / 65 * 100); }
  get description() { return this.fruit ? 'Schematic cutaway: ovary developing into a fruit, with seeds inside.' : 'Schematic flower cutaway: anthers alongside the central stigma and style; ovules inside the ovary. The filament supports each anther.'; }
}
