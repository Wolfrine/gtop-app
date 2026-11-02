import {applicationDefault} from 'firebase-admin/app';

// Read-only, aggregate metrics. Uses the existing authenticated runtime identity;
// never grants monitoring permissions, reads conversation content or prints tokens.
const project='gtop-app',end=new Date(),start=new Date(end.getTime()-86400000);
const report={project,start:start.toISOString(),end:end.toISOString(),source:'Cloud Monitoring API',metrics:[]};
try{
  const credential=applicationDefault();
  for(const name of ['document/read_ops_count','document/write_ops_count']){
    const params=new URLSearchParams({filter:`metric.type="firestore.googleapis.com/${name}"`,'interval.startTime':start.toISOString(),'interval.endTime':end.toISOString(),'aggregation.alignmentPeriod':'3600s','aggregation.perSeriesAligner':'ALIGN_SUM',pageSize:'1000'});
    const {access_token}=await credential.getAccessToken();
    const r=await fetch(`https://monitoring.googleapis.com/v3/projects/${project}/timeSeries?${params}`,{headers:{Authorization:'Bearer '+access_token},signal:AbortSignal.timeout(30000)});
    if(!r.ok){report.metrics.push({name,available:false,status:r.status});continue;}
    const data=await r.json();report.metrics.push({name,available:true,truncated:!!data.nextPageToken,series:(data.timeSeries||[]).map(s=>({labels:s.metric.labels,resource:s.resource,points:s.points}))});
  }
}catch(error){report.available=false;report.errorCode=error.code||error.name;}
console.log(JSON.stringify(report));
