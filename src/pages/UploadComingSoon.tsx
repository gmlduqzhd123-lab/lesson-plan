import { Link } from 'react-router-dom';
import { ArrowRight, Clock3 } from 'lucide-react';

export default function UploadComingSoon() {
  return <div className="container page upload-page">
    <div className="page-heading"><span className="overline">COMING SOON</span><h1>지도안 분석·제출</h1></div>
    <section className="empty-state" aria-label="기능 준비 안내">
      <Clock3 size={42} aria-hidden="true" />
      <h2>해당 기능은 준비중입니다.</h2>
      <p>지도안 분석 및 제출 기능은 추후 제공할 예정입니다.</p>
      <Link className="button primary" to="/library">지도안 자료실 둘러보기 <ArrowRight size={17} /></Link>
    </section>
  </div>;
}
