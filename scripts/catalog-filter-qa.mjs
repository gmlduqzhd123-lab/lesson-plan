import {chromium}from'@playwright/test';import fs from'node:fs/promises';import path from'node:path';import assert from'node:assert/strict';
import {searchPlans}from'../src/lib/search/index.ts';
const base=process.env.QA_URL||'http://127.0.0.1:4186/lesson-plan/',out=process.env.QA_OUTPUT||'.tmp/catalog-filter-qa';
const records=await(await fetch(base+'catalog/index.json')).json();const browser=await chromium.launch({headless:true});const checks=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'#/library');
 const match=async f=>{
  const expected=searchPlans(records,{query:'',grade:'',subject:'',unit:'',sort:'latest',...f});const ids=expected.slice(0,60).map(p=>p.id);
  await page.waitForFunction(({n,ids})=>document.querySelector('.results-toolbar strong')?.textContent===String(n)&&JSON.stringify([...document.querySelectorAll('.library-cards .plan-card')].map(n=>n.href.split('/').pop()))===JSON.stringify(ids),{n:expected.length,ids});
  checks.push({filters:f,count:expected.length});
 };
 const reset=async()=>{await page.getByRole('button',{name:'필터 초기화'}).click();await match({})};await match({});
 for(const grade of ['유아','1','2','3','4','5','6']){await reset();await page.getByLabel('학년',{exact:true}).selectOption(grade);await match({grade});}
 for(const subject of [...new Set(records.map(r=>r.subject))]){await reset();await page.getByLabel('교과',{exact:true}).selectOption(subject);await match({subject});}
 await reset();let i=0;for(const unit of [...new Set(records.map(r=>r.unit).filter(Boolean))]){
  await page.getByLabel('단원',{exact:true}).selectOption(unit);await match({unit});if(++i%100===0)console.log('단원 필터',i);
 }
 for(const query of ['여수교육지원청','2022년 게시','2023년 게시','실제 학년 미표기']){await reset();await page.getByLabel('자료 검색').fill(query);await match({query});}
 await reset();await page.getByRole('button',{name:'자료 더 보기',exact:true}).click();assert.equal(await page.locator('.library-cards .plan-card').count(),120);
 await page.getByLabel('교과',{exact:true}).selectOption('국어');await match({subject:'국어'});await reset();assert.equal(await page.locator('.library-cards .plan-card').count(),60);
 const candidates=[...new Set(records.filter(r=>r.keywords.includes('2022년 게시')||r.keywords.includes('2023년 게시')).map(r=>r.id))];
 for(const id of candidates.filter((_,i)=>i%61===0)){
  const r=records.find(r=>r.id===id);await reset();await page.getByLabel('자료 검색').fill(r.title);await match({query:r.title});
 }
 assert.deepEqual(errors,[]);await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'filters.json'),JSON.stringify({checkedAt:new Date().toISOString(),url:base,catalogCount:records.length,checks,pageErrors:errors,mockedResponses:false},null,2));console.log('필터 검증 통과',checks.length);
}finally{await browser.close()}
