import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import 'pretendard/dist/web/variable/pretendardvariable.css';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);

// 📲 오프라인 열기(서비스 워커) — 설치 버튼은 ys-install.js가 맡음
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined); });
}
