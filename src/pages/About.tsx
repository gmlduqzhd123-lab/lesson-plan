import { Link } from 'react-router-dom';
import { FileSearch, PackageCheck, ShieldCheck } from 'lucide-react';

export default function About() {
  return <div className="container page about-page"><div className="page-heading"><span className="overline">OUR LIBRARY</span><h1>좋은 수업은, 나눌수록 넓어집니다</h1><p>지도안 대백과는 초등 선생님들의 수업 경험을 모으는 공개 자료실입니다.</p></div>
    <div className="about-intro"><h2>교실의 경험을 다음 교실로</h2><p>학년·교과·단원으로 교수학습과정안을 찾아보고, 원본 한글 파일을 다운로드하세요. 지도안 분석 및 제출 기능은 준비 중입니다.</p><Link to="/library" className="button primary">자료실 둘러보기</Link></div>
    <div className="about-steps">{[[FileSearch, '01', '지도안 찾기', '학년·교과·단원별 분류와 검색으로 필요한 수업 자료를 찾아보세요.'], [ShieldCheck, '02', '자료 정보 확인', '지도안의 수업 내용과 출처, 이용 조건을 확인하고 학급에 맞게 참고하세요.'], [PackageCheck, '03', '원본 다운로드', '공개된 지도안의 상세 화면에서 원본 파일을 다운로드할 수 있습니다.']].map(([Icon, no, title, text]) => { const I = Icon as typeof FileSearch; return <article key={String(no)}><I size={26} /><span>{String(no)}</span><h3>{String(title)}</h3><p>{String(text)}</p></article>; })}</div>
    <section className="guide-panel"><h2>이용 전에 알아두세요</h2><ul><li>지도안 분석 및 제출 기능은 준비 중이며, 현재 파일을 제출할 수 없습니다.</li><li>자료는 수업 목적 및 공개 수업 지도안 작성 시 참고 자료로만 사용해주세요.</li><li>지도안의 원본과 수정·편집한 자료를 재배포하거나 상업적인 수단으로 이용할 수 없습니다.</li><li>원본 파일 형식(HWP·HWPX·PDF)에 맞는 프로그램에서 자료를 확인해주세요.</li></ul></section>
  </div>;
}
