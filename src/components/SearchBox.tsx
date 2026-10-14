import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowRight, Search, X } from 'lucide-react';
import { searchSuggestions } from '../lib/search';
import type { Plan } from '../types';
import '../search-navigation.css';

export default function SearchBox({ value = '', plans, onSearch, live = false, label, placeholder, className = '' }: { value?: string; plans: Plan[]; onSearch: (query: string) => void; live?: boolean; label: string; placeholder: string; className?: string }) {
  const [draft, setDraft] = useState(value), [focused, setFocused] = useState(false), [active, setActive] = useState(-1), [composing, setComposing] = useState(false);
  const composition = useRef(false), wrapper = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null);
  const id = useId();
  useEffect(() => { if (!composition.current) setDraft(value); }, [value]);
  const choices = useMemo(() => searchSuggestions(plans, draft), [plans, draft]);
  const open = focused && !composing && choices.length > 0;
  const choose = (text: string) => { setDraft(text); setFocused(false); setActive(-1); onSearch(text); };
  return <div className={`search-completion ${className}`} ref={wrapper} onBlur={e => { if (!wrapper.current?.contains(e.relatedTarget as Node)) { setFocused(false); setActive(-1); } }}>
    <form className="searchbox" onSubmit={e => { e.preventDefault(); if (!composition.current) choose(active >= 0 && open ? choices[active]?.value || draft : draft); }}>
      <Search size={21} /><input ref={input} role="combobox" aria-label={label} aria-autocomplete="list" aria-expanded={open} aria-controls={open ? id : undefined} aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined} placeholder={placeholder} value={draft} onFocus={() => setFocused(true)}
        onCompositionStart={() => { composition.current = true; setComposing(true); setActive(-1); }}
        onCompositionEnd={e => { composition.current = false; setComposing(false); setDraft(e.currentTarget.value); if (live) onSearch(e.currentTarget.value); }}
        onChange={e => { setDraft(e.target.value); setFocused(true); setActive(-1); if (live && !composition.current && !(e.nativeEvent as InputEvent).isComposing) onSearch(e.target.value); }}
        onKeyDown={e => {
          if (composition.current || e.nativeEvent.isComposing || e.keyCode === 229) return;
          if (e.key === 'Escape') { e.preventDefault(); setFocused(false); setActive(-1); }
          if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && choices.length) { e.preventDefault(); setFocused(true); setActive(previous => e.key === 'ArrowDown' ? (previous + 1) % choices.length : (previous <= 0 ? choices.length : previous) - 1); }
        }} />
      {draft && <button type="button" aria-label="검색어 지우기" onClick={() => { composition.current = false; setComposing(false); setDraft(''); setActive(-1); setFocused(false); if (live) onSearch(''); input.current?.focus(); }}><X size={18} /></button>}
      {!live && <button aria-label="검색하기" type="submit"><ArrowRight size={21} /></button>}
    </form>
    {open && <div className="search-options" id={id} role="listbox" aria-label="검색어 추천">{choices.map((choice, i) => <button type="button" role="option" tabIndex={-1} id={`${id}-${i}`} key={choice.value} aria-selected={i === active} onPointerDown={e => e.preventDefault()} onClick={() => choose(choice.value)}><span>{choice.value}</span><small>자료 기반 추천</small></button>)}</div>}
  </div>;
}
