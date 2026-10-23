// Planning artifact validator. It does not execute or qualify product features.
import {readFile,writeFile,access,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
const here=dirname(fileURLToPath(import.meta.url));
const repo=resolve(here,'../../..');
const readJson=async p=>JSON.parse((await readFile(resolve(here,p),'utf8')).replace(/^\uFEFF/,''));
const errors=[],warnings=[],checks=[];
const reg=await readJson('TASK_REGISTRY.json');
const dag=await readJson('DEPENDENCY_GRAPH.json');
const allowedStates=new Set(['PLANNED','READY','IN_PROGRESS','TESTING','REVIEW','MERGED','VERIFIED','BLOCKED','DEFERRED','REJECTED']);
const approaches=new Set(['COPY','ADAPT','WRAP','COMBINE','BUILD','DEFER','REJECT']);
const exists=async p=>{try{await access(p);return true;}catch{return false;}};
const docs=await readdir(here);
for(let i=0;i<25;i++)if(!docs.some(p=>p.startsWith(String(i).padStart(2,'0')+'_')&&p.endsWith('.md')))errors.push('Missing numbered document '+i);
checks.push({name:'required numbered documents',count:docs.filter(p=>/^\d\d_.*\.md$/.test(p)).length});
const map=new Map();
const required=['objective','phase','priority','currentStatus','userValue','sourceRefs','targetFiles','interfaceChanges','dataModelChanges','dependencies','instructions','securityControls','performanceCriteria','tests','negativeTests','requiredEvidence','reviewGates','rollbackProcedure','mergeConditions','definitionOfDone','donor'];
for(const t of reg.tasks){
 if(map.has(t.id))errors.push('Duplicate task '+t.id);map.set(t.id,t);
 for(const k of required)if(t[k]===undefined||t[k]===null||t[k]===''||(Array.isArray(t[k])&&!t[k].length&&k!=='dependencies'))errors.push(`${t.id} missing ${k}`);
 if(!allowedStates.has(t.state))errors.push(`${t.id} invalid state`);
 if(!approaches.has(t.primaryApproach))errors.push(`${t.id} invalid approach`);
 if(!/^[a-f0-9]{40}$/.test(t.donor.pin))errors.push(`${t.id} invalid donor pin`);
 if(t.implementationAuthorized||['READY','IN_PROGRESS','TESTING','REVIEW','MERGED','VERIFIED'].includes(t.state))errors.push(`${t.id} unexpectedly authorized/advanced in research`);
 for(const p of t.sourceRefs)if(!await exists(resolve(repo,p)))errors.push(`${t.id} missing current source ${p}`);
 for(const p of t.targetFiles)if(!p.proposed&&!await exists(resolve(repo,p.path)))errors.push(`${t.id} existing target absent ${p.path}`);
}
const visiting=new Set(),done=new Set();
function visit(id){if(visiting.has(id)){errors.push('Dependency cycle '+id);return;}if(done.has(id))return;const t=map.get(id);if(!t){errors.push('Unknown dependency '+id);return;}visiting.add(id);for(const d of t.dependencies)visit(d);visiting.delete(id);done.add(id);}
for(const id of map.keys())visit(id);
const actualEdges=reg.tasks.flatMap(t=>t.dependencies.map(d=>d+'>'+t.id)).sort();
const declaredEdges=dag.edges.map(e=>e.from+'>'+e.to).sort();
if(JSON.stringify(actualEdges)!==JSON.stringify(declaredEdges))errors.push('DAG does not match registry');
checks.push({name:'task fields, source paths, pins and DAG',tasks:reg.tasks.length,edges:actualEdges.length,acyclic:!errors.some(x=>x.includes('cycle'))});
for(const f of docs.filter(p=>p.endsWith('.md'))){
 const text=await readFile(resolve(here,f),'utf8');
 if(text.includes('\uFFFD'))errors.push('Replacement Unicode character '+f);
 for(const m of text.matchAll(/\]\(([^\n)]+)\)/g)){
  let link=m[1].replace(/^<|>$/g,'').split('#')[0];
  if(!link||/^[a-z][a-z\d+.-]*:/i.test(link)||link.startsWith('/'))continue;
  if(!await exists(resolve(here,decodeURIComponent(link))))errors.push(`${f} missing link ${link}`);
 }
}
const donor=await readJson('evidence/donor-public-source-captures.json');
const selected=donor.selected;
const captureKeys=new Set(donor.captures.filter(c=>c.status==='captured').map(c=>selected[c.donor]?.repo+'@'+selected[c.donor]?.sha+':'+c.path));
const missingDonorPaths=[];
for(const t of reg.tasks){if(t.donor.repo.endsWith('/TheHalfMoon/Yamakan'))continue;for(const p of t.donor.paths){const key=t.donor.repo.replace('https://github.com/','')+'@'+t.donor.pin+':'+p;if(!captureKeys.has(key))missingDonorPaths.push({taskId:t.id,repo:t.donor.repo,pin:t.donor.pin,path:p});}}
if(missingDonorPaths.length)warnings.push({name:'donor paths require additional exact source capture or gate clarification',paths:missingDonorPaths});
for(const [name,v]of Object.entries(selected))if(!/^[a-f0-9]{40}$/.test(v.sha))errors.push('Donor invalid pin '+name);
const weights=[15,15,12,12,14,10,10,7,5];const scores={A:[3,3,3,5,4,3,5,5,4],B:[4,5,4,3,2,3,3,1,3],C:[3,2,3,3,2,5,2,2,3],D:[5,4,4,5,4,4,5,3,4]};
const weighted=Object.fromEntries(Object.entries(scores).map(([k,v])=>[k,Number(v.reduce((sum,s,i)=>sum+s*weights[i],0)/100).toFixed(2)]));
const options=await readFile(resolve(here,'09_ARCHITECTURE_OPTIONS.md'),'utf8');
for(const v of Object.values(weighted))if(!options.includes('**'+v+'**'))errors.push('Architecture score mismatch '+v);
checks.push({name:'architecture score arithmetic',weightsSum:weights.reduce((a,b)=>a+b),weighted});
const changed=execFileSync('git',['diff','--name-only',reg.baseline],{cwd:repo,encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
const untracked=execFileSync('git',['ls-files','--others','--exclude-standard'],{cwd:repo,encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
const allowed=p=>p.startsWith('docs/plans/YAMAKAN_ULTIMATE_MASTER_PLAN/')||p==='docs/adr/0004-canonical-creative-project-and-qualified-execution.md';
for(const p of [...changed,...untracked])if(!allowed(p))errors.push('Out-of-scope changed file '+p);
checks.push({name:'documentation-only scope',changedTracked:changed.length,untracked:untracked.length});
for(const [p,needle]of [['core/engines/contract.ts','ENGINE_ENABLED = false'],['core/router/explain.ts','ROUTER_PROVIDERS_ENABLED = false'],['core/preview/jassub-flags.ts','JASSUB_ENABLED = false']])if(!(await readFile(resolve(repo,p),'utf8')).includes(needle))errors.push('Disabled invariant changed '+p);
checks.push({name:'engine/provider/JASSUB disabled source invariants',verified:true});
warnings.push('No product functionality, native/media runtime, model quality, human gate or release is qualified by this validator.');
const report={schema:'yamakan.plan-validation/v1',checkedAt:new Date().toISOString(),baseline:reg.baseline,result:errors.length?'FAIL':'PASS_WITH_EXPLICIT_LIMITATIONS',checks,errors,warnings};
await writeFile(resolve(here,'evidence/plan-validation.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
process.exitCode=errors.length?1:0;
