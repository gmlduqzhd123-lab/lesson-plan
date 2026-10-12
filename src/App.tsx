import { lazy, Suspense, useEffect, useState } from 'react';
import { HashRouter, Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { ArrowUpRight, BookOpen, Menu, X } from 'lucide-react';
import Home from './pages/Home';
import LibraryPage from './pages/LibraryPage';
import Detail from './pages/Detail';
import About from './pages/About';
import { useCatalog } from './hooks/useCatalog';
import AccessGate from './components/AccessGate';
const Upload = lazy(() => import('./pages/Upload'));

function Shell({ catalog }: { catalog: ReturnType<typeof useCatalog> }) {
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  useEffect(() => { setMenu(false); window.scrollTo(0, 0); }, [location.pathname]);
  return <><a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus(); }}>본문으로 이동</a><header className="header"><div className="container header-inner"><Link className="brand" to="/"><span className="logo"><BookOpen size={23} /></span><div><strong>지도안 대백과</strong><small>LESSON PLAN ENCYCLOPEDIA</small></div></Link><nav className={menu ? 'open' : ''} aria-label="주 메뉴"><NavLink to="/" end>홈</NavLink><NavLink to="/library">지도안 자료실</NavLink><NavLink to="/about">이용 안내</NavLink><NavLink className="nav-submit" to="/upload">지도안 분석·제출 <ArrowUpRight size={16} /></NavLink></nav><div className="header-actions"><button type="button" className="app-chip install" data-ys-install="">📲 <span className="chip-wide">앱 </span>설치</button><button type="button" className="app-chip" data-qr="" aria-label="QR 코드로 접속">📱 QR</button><button className="menu-button" aria-label={menu ? '메뉴 닫기' : '메뉴 열기'} aria-expanded={menu} onClick={() => setMenu(v => !v)}>{menu ? <X /> : <Menu />}</button></div></div></header>
    <main id="main-content" tabIndex={-1}><Suspense fallback={<div className="container status" role="status">화면을 불러오고 있어요.</div>}><Routes><Route path="/" element={<Home {...catalog} />} /><Route path="/library" element={<LibraryPage {...catalog} />} /><Route path="/library/:id" element={<Detail {...catalog} />} /><Route path="/upload" element={<Upload publishedPlans={catalog.plans} />} /><Route path="/about" element={<About />} /><Route path="*" element={<div className="container page empty-state"><h1>페이지를 찾을 수 없어요</h1><Link className="button primary" to="/">홈으로 이동</Link></div>} /></Routes></Suspense></main>
    <footer className="footer"><div className="container footer-inner"><div><Link className="footer-brand" to="/"><BookOpen size={20} /> 지도안 대백과</Link><p>선생님의 경험을 나누고, 함께 더 좋은 수업을 만듭니다.</p><small>© 2026 엽쌤. All rights reserved. · <a className="footer-hub" href="https://gmlduqzhd123-lab.github.io/YScode/">엽쌤의 다른 앱 보기 →</a></small></div><div className="footer-links"><Link to="/about">이용 안내</Link><Link to="/upload">자료 분석·제출</Link><a href="https://github.com/gmlduqzhd123-lab/lesson-plan" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={14} /></a></div></div></footer></>;
}
export default function App() {
  const catalog = useCatalog();
  return <HashRouter><AccessGate catalog={catalog}><Shell catalog={catalog} /></AccessGate></HashRouter>;
}
