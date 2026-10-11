import { Link } from 'react-router-dom';
import { FileSearch, PackageCheck, ShieldCheck } from 'lucide-react';

export default function About() {
  return <div className="container page about-page"><div className="page-heading"><span className="overline">OUR LIBRARY</span><h1>좋은 수업은, 나눌수록 넓어집니다</h1><p>엽쌤 지도안 라이브러리는 초등 선생님들의 수업 경험을 모으는 공개 자료실입니다.</p></div>
    <div className="about-intro"><h2>교실의 경험을 다음 교실로</h2><p>학년·교과·단원으로 교수학습과정안을 찾아보고, 원본 한글 파일을 다운로드하세요. 선생님의 자료는 브라우저 안에서 분석한 뒤 관리자 제출용 ZIP으로 내보낼 수 있습니다.</p><Link to="/library" className="button primary">자료실 둘러보기</Link></div>
    <div className="about-steps">{[[FileSearch, '01', '내 기기에서 분석', '파일 선택은 서버 업로드가 아닙니다. HWPX 본문과 표를 분석하고, HWP·PDF는 파일명으로 추정합니다.'], [ShieldCheck, '02', '선생님과 관리자의 검토', '분류를 직접 확인하고 학생 이름·연락처·사진 및 저작권을 검토합니다. ZIP을 생성해도 공개 등록되지는 않습니다.'], [PackageCheck, '03', '승인된 자료만 공개', '관리자가 비공개 staging에서 검토한 뒤 명시적으로 승인합니다. 저장소 반영과 배포가 끝나면 자료실에서 찾아볼 수 있습니다.']].map(([Icon, no, title, text]) => { const I = Icon as typeof FileSearch; return <article key={String(no)}><I size={26} /><span>{String(no)}</span><h3>{String(title)}</h3><p>{String(text)}</p></article>; })}</div>
    <section className="guide-panel"><h2>이용 전에 알아두세요</h2><ul><li>HWPX는 ZIP/XML 텍스트 분석을 지원합니다. 그림 속 글자와 원본 페이지 배치는 분석하지 않습니다.</li><li>PDF는 원본 다운로드와 직접 분류를 지원합니다. 브라우저의 PDF 본문 자동 분석은 지원하지 않습니다.</li><li>HWP 5.x 바이너리는 원본 보존·파일명 분류·직접 입력을 지원합니다. 본문 파서와 실제 HWP 호환성 검증은 미완료입니다.</li><li>자동 분류는 참고 결과입니다. 성취기준의 학년군과 실제 수업 학년을 구분하고, 교육과정 정보를 직접 확인하세요.</li><li>공개 저장소의 파일은 누구나 접근할 수 있습니다. 비공개가 필요한 원본은 제출하지 마세요.</li><li>교과서·문제집·타인의 저작물은 배포 권한을 확보한 경우에만 공유해주세요.</li><li>관리자에게 전달하는 ZIP은 이메일 또는 학교에서 합의한 별도 전달 방식으로 보내세요. 이 사이트에는 자동 전송 기능이 없습니다.</li></ul></section>
  </div>;
}
