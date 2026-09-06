import { Component,Input,Output,EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlantFieldwork,freshFieldwork } from './plant-attempt';
@Component({selector:'app-plant-scene',standalone:true,imports:[CommonModule],templateUrl:'./plant-scene.component.html'})
export class PlantSceneComponent {
  @Input() mode='anatomy'; @Input() f:PlantFieldwork=freshFieldwork();
  @Input() selected=''; @Input() pulse=''; @Input() flight=0; @Input() pollenFlash=0;
  @Output() action=new EventEmitter<string>();
  readonly parts=[{id:'anther',name:'Anther',x:14,y:32},{id:'stigma',name:'Stigma',x:80,y:16},{id:'style',name:'Style',x:80,y:46},{id:'ovary',name:'Ovary',x:79,y:76}];
  get last(){return this.f.pollenTrials.at(-1);}
  get releasedWind(){return this.f.windTrials.at(-1)??0;}
}
