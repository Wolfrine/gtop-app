// Summed occupancy of locally contrasting strokes, including coloured and faint ink.
export function buildInkMap(pixels,width,height) {
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||
    width>1600||height>1600||pixels?.length!==width*height*4)return null;
  const occupied=new Uint32Array((width+1)*(height+1));
  for(let y=0;y<height;y++){
    let sum=0;
    for(let x=0;x<width;x++){
      const i=(y*width+x)*4;
      const right=(y*width+Math.min(width-1,x+3))*4;
      const down=(Math.min(height-1,y+3)*width+x)*4;
      let stroke=Math.max(pixels[i],pixels[i+1],pixels[i+2])<90;
      for(let channel=0;channel<3&&!stroke;channel++)
        stroke=Math.abs(pixels[i+channel]-pixels[right+channel])>=12||
          Math.abs(pixels[i+channel]-pixels[down+channel])>=12;
      if(stroke)sum++;
      const index=(y+1)*(width+1)+x+1;
      occupied[index]=occupied[index-width-1]+sum;
    }
  }
  return {width,height,occupied};
}

function scoreStatus(awarded,max){
  if(awarded===null)return 'uncertain';
  if(awarded===0)return 'wrong';
  return awarded===max?'correct':'partial';
}

export function pagePins(answers,page,score){
  const pins=[];
  for(const answer of answers){
    const steps=(answer.steps??[]).flatMap((step,i)=>step.anchor?.page===page?[{step,i}]:[]);
    if(steps.length){
      for(const {step,i} of steps)pins.push({id:`Q${answer.number}.${i+1}`,status:scoreStatus(step.awarded,step.max),
        score:score(step.awarded,step.max),comment:step.comment||step.criterion,anchor:step.anchor});
    }else{
      const anchor=answer.anchors.find(point=>point.page===page);
      if(anchor)pins.push({id:`Q${answer.number}`,status:answer.status,score:score(answer.awarded,answer.max),
        comment:answer.explanation,anchor});
    }
  }
  return pins;
}

export function marginGroups(marks,height,spacing){
  if(!marks.length)return [];
  const sorted=[...marks].sort((a,b)=>a.anchor.y-b.anchor.y);
  const capacity=Math.max(1,Math.floor(height/spacing));
  const groups=sorted.map(mark=>({marks:[mark],center:mark.anchor.y}));
  while(groups.length>capacity){
    let nearest=0;
    for(let i=1;i<groups.length-1;i++){
      if(groups[i+1].center-groups[i].center<groups[nearest+1].center-groups[nearest].center)nearest=i;
    }
    const group=groups[nearest];
    group.marks.push(...groups.splice(nearest+1,1)[0].marks);
    group.center=group.marks.reduce((sum,item)=>sum+item.anchor.y,0)/group.marks.length;
  }
  const step=spacing/Math.max(spacing,height);
  let previous=-step/2;
  for(const [i,group] of groups.entries()){
    group.center=Math.min(1-step*(groups.length-i-0.5),Math.max(previous+step,group.center));
    previous=group.center;
  }
  return groups;
}

export function gutterOrigin(ink,anchor,imageWidth,imageHeight){
  if(!ink)return imageWidth;
  const band=4/imageHeight;
  const top=Math.max(0,Math.floor((anchor.y-band)*ink.height));
  const bottom=Math.min(ink.height,Math.ceil((anchor.y+band)*ink.height));
  const stride=ink.width+1,sum=ink.occupied;
  const inkToRight=x=>sum[bottom*stride+ink.width]-sum[bottom*stride+x]-
    sum[top*stride+ink.width]+sum[top*stride+x];
  let start=0,end=ink.width;
  while(start<end){
    const mid=Math.floor((start+end)/2);
    if(inkToRight(mid)>0)start=mid+1;
    else end=mid;
  }
  return Math.min(imageWidth,Math.max(anchor.x*imageWidth+3,start/ink.width*imageWidth+2));
}

export function inkAwareMarks(marks,imageWidth,imageHeight,sizeFor,ink){
  const placed=[];
  function available(box){
    const pad=Math.max(1,box.height*0.13);
    if(box.x<pad||box.y<pad||box.x+box.width+pad>imageWidth||box.y+box.height+pad>imageHeight)return false;
    if(placed.some(other=>box.x<other.x+other.width+pad&&box.x+box.width+pad>other.x&&
      box.y<other.y+other.height+pad&&box.y+box.height+pad>other.y))return false;
    const left=Math.floor((box.x-pad)*ink.width/imageWidth);
    const top=Math.floor((box.y-pad)*ink.height/imageHeight);
    const right=Math.ceil((box.x+box.width+pad)*ink.width/imageWidth);
    const bottom=Math.ceil((box.y+box.height+pad)*ink.height/imageHeight);
    const stride=ink.width+1,area=ink.occupied;
    return area[bottom*stride+right]-area[bottom*stride+left]-area[top*stride+right]+area[top*stride+left]===0;
  }
  function findSpace(anchorX,anchorY,{width,height}){
    if(!ink||width<=0||height<=0)return;
    const gap=Math.max(1.5,height*0.22);
    const offsetsX=[gap,-width-gap,-width/2,-width*0.25,-width*0.75,gap+height*0.6,-width-gap-height*0.6];
    const offsetsY=[-height-gap,gap,-height*0.5,-height-gap-0.5*height,gap+0.5*height,
      -height-gap-height,gap+height,-height-gap-1.5*height,gap+1.5*height];
    let nearest,minimum=Infinity;
    for(const dy of offsetsY)for(const dx of offsetsX){
      // Keep the actual pen location visible, including very faint handwriting.
      if(dx<gap&&dx+width>-gap&&dy<gap&&dy+height>-gap)continue;
      const box={x:anchorX+dx,y:anchorY+dy,width,height};
      const distance=Math.hypot(dx+width/2,dy+height/2);
      const edge=Math.hypot(Math.max(dx,0,-dx-width),Math.max(dy,0,-dy-height));
      if(Math.abs(dy+height/2)<=12&&edge<=14&&distance<minimum&&available(box)){
        nearest=box;minimum=distance;
      }
    }
    return nearest;
  }
  return [...marks].sort((a,b)=>a.anchor.y-b.anchor.y).map(mark=>{
    const x=mark.anchor.x*imageWidth,y=mark.anchor.y*imageHeight;
    const box=findSpace(x,y,sizeFor(mark));
    if(!box)return {...mark,placement:'margin',left:100,top:mark.anchor.y*100};
    placed.push(box);
    return {...mark,placement:'label',left:box.x/imageWidth*100,top:box.y/imageHeight*100};
  });
}
