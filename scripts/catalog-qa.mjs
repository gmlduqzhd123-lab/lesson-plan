import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PlanSchema} from '../shared/schema.mjs';
const origin=process.env.QA_URL||'http://127.0.0.1:4186/lesson-plan/';
const output=path.resolve(process.env.QA_OUTPUT||'.tmp/catalog-qa');
await fs.mkdir(output,{recursive:true});
const response=await fetch(new URL('catalog/index.json',origin));assert(response.ok);
const records=(await response.json()).map(p=>PlanSchema.parse(p));assert(records.length>0);
const expected=JSON.parse(await fs.readFile('public/catalog/index.json','utf8')).map(p=>PlanSchema.parse(p));
assert.deepEqual(records,expected,'served catalog must match reviewed local records');
const checks=[];const verified=[];
for(let i=0;i<records.length;i+=4)await Promise.all(records.slice(i,i+4).map(async p=>{
 const r=await fetch(new URL(p.filePath,origin));assert.equal(r.status,200);
 const bytes=Buffer.from(await r.arrayBuffer());assert.equal(bytes.length,p.fileSize);assert.equal(createHash('sha256').update(bytes).digest('hex'),p.sha256);
 verified.push({id:p.id,status:r.status,sha256:p.sha256});
}));checks.push(`${verified.length}개 실제 HTTP 파일의 크기·SHA-256 일치`);
const browser=await chromium.launch({headless:true});
const errors=[],external=[];
try{
 const context=await browser.newContext({acceptDownloads:true});const page=await context.newPage();
 const waitCount=async n=>{await page.waitForFunction(n=>document.querySelectorAll('.plan-card').length===n,n);assert.equal(await page.locator('.plan-card').count(),n)};
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).origin!==new URL(origin).origin)external.push(r.url())});
 for(const width of [1440,1024,768,390,320]){
  await page.setViewportSize({width,height:900});
  await page.goto(origin);await page.locator('.plan-card').first().waitFor();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'home overflow '+width);
  await page.goto(origin+'#/library');await page.locator('.plan-card').nth(records.length-1).waitFor();assert.equal(await page.locator('.plan-card').count(),records.length);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'library overflow '+width);
  await page.screenshot({path:path.join(output,'library-'+width+'.png'),fullPage:false});
  checks.push(`홈·실제 자료실 ${width}px 표시·가로 넘침 없음`);
 }
 await page.getByLabel('학년',{exact:true}).selectOption('유아');await waitCount(records.filter(p=>p.educationLevel==='유아').length);
 await page.getByLabel('단원',{exact:true}).selectOption(records.find(p=>p.educationLevel==='유아').unit);await waitCount(1);checks.push('유아 학년·단원 동시 필터');
 await page.getByRole('button',{name:'필터 초기화'}).click();await waitCount(records.length);
 await page.getByLabel('자료 유형',{exact:true}).selectOption('수업 보조자료');await waitCount(1);checks.push('보조자료 필터');
 await page.getByRole('button',{name:'필터 초기화'}).click();await waitCount(records.length);
 await page.getByLabel('학년',{exact:true}).selectOption('6');await waitCount(records.filter(p=>p.grades.includes(6)).length);const multi=records.find(p=>p.grades.length===4);if(multi)assert(await page.locator(`a[href$="${multi.id}"]`).count());checks.push('복식학급 학년별 검색');
 await page.getByRole('button',{name:'필터 초기화'}).click();await waitCount(records.length);
 await page.getByLabel('자료 검색').fill('곤충 호텔');await waitCount(1);checks.push('실제 단원 검색');
 for(const format of ['HWP','HWPX','PDF']){
  const p=records.find(p=>p.fileFormat===format);if(!p)continue;
  await page.goto(origin+'#/library/'+p.id);await page.getByRole('heading',{level:1,name:p.title,exact:true}).waitFor();await page.reload();
  const button=page.getByRole('button',{name:'원본 다운로드',exact:true});await button.waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='원본 다운로드'&&!b.disabled));
  const [download]=await Promise.all([page.waitForEvent('download'),button.click()]);assert.equal(download.suggestedFilename(),p.originalFileName);assert.equal(await download.failure(),null);
  const bytes=await fs.readFile(await download.path());assert.equal(createHash('sha256').update(bytes).digest('hex'),p.sha256);checks.push(format+' 상세 새로고침·브라우저 원본 다운로드');
 }
 const redacted=records.find(p=>p.classificationNotes.some(n=>n.includes('민감 문단')));
 if(redacted){await page.goto(origin+'#/library/'+redacted.id);await page.getByText('분류 확인 메모',{exact:true}).waitFor();assert.equal(redacted.fileFormat,'PDF');checks.push('공개용 삭제본 안내와 PDF 연결');}
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);checks.push('브라우저 오류·외부 백엔드 요청 없음');
 const report={checkedAt:new Date().toISOString(),url:origin,catalogCount:records.length,checks,verifiedOriginals:verified,consoleErrors:errors,externalRequests:external,realDevicesTested:false};
 await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({catalog:records.length,checks,errors},null,2));
}finally{await browser.close()}
