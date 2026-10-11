import {webcrypto} from 'node:crypto';
import {beforeAll,describe,it,expect,vi} from 'vitest';
import {analyzeFile} from '../src/lib/parsers/analyze';
import {PlanSchema} from '../shared/schema.mjs';
import {searchPlans} from '../src/lib/search';
import {createSubmission} from '../src/lib/submission';
import {unpackSubmission} from '../scripts/lib.mjs';
import {recordFixture,hwpxFixture} from './fixtures.mjs';
beforeAll(()=>vi.stubGlobal('crypto',webcrypto));
const filter={query:'',grade:'',subject:'',unit:'',sort:'latest'};
describe('public PDF and kindergarten catalog',()=>{
 it('preserves PDF bytes through browser draft, ZIP and administrator import',async()=>{
  const bytes=new TextEncoder().encode('%PDF-1.7\n% test signature fixture only\n%%EOF');
  const file={name:'3학년_국어.pdf',size:bytes.length,arrayBuffer:async()=>bytes.buffer}as File;
  const result=await analyzeFile(file);
  expect(result.plan?.fileFormat).toBe('PDF');expect(result.warning).toContain('본문을 자동 분석하지');
  const plan=PlanSchema.parse({...result.plan,license:'fixture only'});
  const submission=await createSubmission([{key:'pdf',file,state:'완료',plan}],{privacy:true,copyright:true});
  const unpacked=unpackSubmission(new Uint8Array(await submission.blob.arrayBuffer()));
  expect(unpacked.records[0].plan.fileFormat).toBe('PDF');expect(Array.from(unpacked.records[0].file)).toEqual(Array.from(bytes));
 });
 it('rejects a fake PDF signature and mismatched record extensions',async()=>{
  const bytes=new Uint8Array([0x50,0x4b,3,4]);
  await expect(analyzeFile({name:'fake.pdf',size:bytes.length,arrayBuffer:async()=>bytes.buffer}as File)).rejects.toThrow('PDF 서명');
  const old=recordFixture(await hwpxFixture());expect(PlanSchema.safeParse({...old,fileFormat:'PDF'}).success).toBe(false);
 });
 it('defaults old submissions and rejects elementary grades on kindergarten records',async()=>{
  const old=recordFixture(await hwpxFixture());const p=PlanSchema.parse(old);
  expect(p.educationLevel).toBe('초등');expect(p.materialType).toBe('지도안');expect(p.classificationNotes).toEqual([]);
  expect(PlanSchema.safeParse({...old,educationLevel:'유아'}).success).toBe(false);
 });
 it('filters kindergarten, multi-grade classes, and supplementary material independently',async()=>{
  const old=recordFixture(await hwpxFixture());
  const primary=PlanSchema.parse({...old,grades:[3,4,5,6]});
  const preschool=PlanSchema.parse({...old,grades:[],educationLevel:'유아',subject:'유아교육'});
  const aid=PlanSchema.parse({...old,materialType:'수업 보조자료'});
  const rows=[primary,preschool,aid];
  expect(searchPlans(rows,{...filter,grade:'유아'})).toEqual([preschool]);
  expect(searchPlans(rows,{...filter,grade:'6'})).toEqual([primary]);
  expect(searchPlans(rows,{...filter,materialType:'수업 보조자료'})).toEqual([aid]);
  expect(searchPlans(rows,{...filter,query:'유아교육'})).toEqual([preschool]);
 });
});
