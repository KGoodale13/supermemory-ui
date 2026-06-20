import { useCallback, useEffect, useMemo, useState } from 'react';
import { MemoryGraph } from '@supermemory/memory-graph';
import { Boxes, BrainCircuit, CircleHelp, Command, Database, FileText, RefreshCw, Search, Sparkles, X } from 'lucide-react';
import type { DocumentRecord, SearchResult } from './types';

type View='graph'|'tags'|'search';
const nav=[
  {id:'graph' as View,label:'Graph',icon:BrainCircuit},
  {id:'tags' as View,label:'Tags',icon:Boxes},
  {id:'search' as View,label:'Search',icon:Search},
];

async function post<T>(url:string, data:unknown={}):Promise<T>{
  const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
  if(!response.ok) throw new Error((await response.json().catch(()=>({}))).error||`Request failed (${response.status})`);
  return response.json();
}

export default function App(){
  const [view,setView]=useState<View>('graph');
  const [documents,setDocuments]=useState<DocumentRecord[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<Error|null>(null);
  const [demo,setDemo]=useState(false);
  const [selectedTag,setSelectedTag]=useState<string>('');

  const load=useCallback(async()=>{
    setLoading(true); setError(null);
    try {
      const data=await post<{memories?:DocumentRecord[];documents?:DocumentRecord[];demo?:boolean}>('/api/documents');
      const source=Array.isArray(data.documents)?data.documents:Array.isArray(data.memories)?data.memories:[];
      setDocuments(source.filter(document=>document&&typeof document.id==='string').map(document=>({
        ...document,
        memories:Array.isArray(document.memories)?document.memories:[],
      })));
      setDemo(Boolean(data.demo));
    }
    catch(e){ setError(e instanceof Error?e:new Error('Unable to load memories')); }
    finally{ setLoading(false); }
  },[]);
  useEffect(()=>{ void load(); },[load]);

  const tags=useMemo(()=>{
    const map=new Map<string,{count:number,updated?:string}>();
    documents.forEach(d=>(d.containerTags||[]).forEach(tag=>{ const old=map.get(tag)||{count:0}; map.set(tag,{count:old.count+1,updated:!old.updated||String(d.updatedAt)>old.updated?d.updatedAt:old.updated}); }));
    return [...map].map(([name,value])=>({name,...value})).sort((a,b)=>b.count-a.count);
  },[documents]);
  const visibleDocuments=selectedTag?documents.filter(d=>d.containerTags?.includes(selectedTag)):documents;
  const memoryCount=documents.reduce((n,d)=>n+(Array.isArray(d.memories)?d.memories.length:0),0);

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark"><Sparkles size={17}/></span><span>memory<span className="brand-light"> observatory</span></span></div>
      <div className="topbar-actions">
        {demo&&<span className="status-pill"><span className="status-dot"/>sample data</span>}
        <button className="icon-button" onClick={load} aria-label="Refresh"><RefreshCw size={17} className={loading?'spin':''}/></button>
      </div>
    </header>

    <main className="main">
      {view==='graph'&&<section className="graph-view">
        <div className="view-heading graph-heading">
          <div><p className="eyebrow">Knowledge map</p><h1>Your memory, connected.</h1><p className="subhead">Explore documents, facts, and the relationships forming between them.</p></div>
          <div className="metrics"><div><strong>{documents.length}</strong><span>documents</span></div><div><strong>{memoryCount||'—'}</strong><span>memories</span></div><div><strong>{tags.length}</strong><span>spaces</span></div></div>
        </div>
        <div className="graph-card">
          {selectedTag&&<button className="filter-chip" onClick={()=>setSelectedTag('')}>{selectedTag}<X size={13}/></button>}
          <MemoryGraph documents={visibleDocuments as never[]} isLoading={loading} error={error} variant="console" />
        </div>
      </section>}
      {view==='tags'&&<TagsView tags={tags} documents={documents} onOpen={(tag)=>{setSelectedTag(tag);setView('graph')}}/>}
      {view==='search'&&<SearchView tags={tags.map(t=>t.name)}/>}
    </main>

    <nav className="dock" aria-label="Primary navigation">
      {nav.map(item=><button key={item.id} className={view===item.id?'active':''} onClick={()=>setView(item.id)} aria-label={item.label}><item.icon size={20}/><span>{item.label}</span></button>)}
    </nav>
  </div>;
}

function PageHeading({eyebrow,title,description}:{eyebrow:string;title:string;description:string}){return <div className="view-heading"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="subhead">{description}</p></div>}

function TagsView({tags,documents,onOpen}:{tags:{name:string;count:number;updated?:string}[];documents:DocumentRecord[];onOpen:(tag:string)=>void}){
  return <section className="page"><PageHeading eyebrow="Organization" title="Container tags" description="The spaces keeping your memories cleanly separated."/>
    <div className="tag-grid">{tags.map((tag,i)=><button className="tag-card" key={tag.name} onClick={()=>onOpen(tag.name)}>
      <div className={`tag-icon hue-${i%5}`}><Boxes size={20}/></div><div className="tag-title">{tag.name}</div><div className="tag-meta"><span>{tag.count} document{tag.count!==1?'s':''}</span><span>{tag.updated?new Date(tag.updated).toLocaleDateString():''}</span></div>
      <div className="tag-files">{documents.filter(d=>d.containerTags?.includes(tag.name)).slice(0,3).map(d=><span key={d.id}><FileText size={13}/>{d.title||'Untitled'}</span>)}</div>
    </button>)}</div>
    {!tags.length&&<Empty icon={Boxes} title="No container tags yet" copy="Tags found on your documents will appear here."/>}
  </section>
}

function SearchView({tags}:{tags:string[]}){
  const [q,setQ]=useState(''); const [tag,setTag]=useState(''); const [results,setResults]=useState<SearchResult[]>([]); const [timing,setTiming]=useState<number|null>(null); const [busy,setBusy]=useState(false); const [searched,setSearched]=useState(false);
  const run=async(e:React.FormEvent)=>{e.preventDefault();if(!q.trim())return;setBusy(true);setSearched(true);try{const data=await post<{results:SearchResult[];timing?:number}>('/api/search',{q:q.trim(),...(tag?{containerTag:tag}:{})});setResults(data.results||[]);setTiming(data.timing??null)}finally{setBusy(false)}};
  return <section className="page search-page"><PageHeading eyebrow="Recall" title="Search your knowledge" description="Use natural language to retrieve memories and source material."/>
    <form className="search-box" onSubmit={run}><Search size={22}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="What do I know about…" autoFocus/><select value={tag} onChange={e=>setTag(e.target.value)} aria-label="Container tag"><option value="">Every space</option>{tags.map(t=><option key={t}>{t}</option>)}</select><button disabled={busy||!q.trim()}>{busy?'Searching…':'Search'}<Command size={14}/></button></form>
    {searched&&<div className="result-summary"><span>{results.length} result{results.length!==1?'s':''}</span>{timing!==null&&<span>{Math.round(timing)} ms</span>}</div>}
    <div className="results">{results.map((result,i)=><article className="result-card" key={result.id||i}><div className="score">{Math.round((result.similarity||0)*100)}%</div><div><div className="result-kind"><Database size={13}/>{result.memory?'Memory':'Document'}</div><p>{result.memory||result.chunk}</p>{Boolean(result.metadata?.documentTitle)&&<span className="source">{String(result.metadata?.documentTitle)}</span>}</div></article>)}</div>
    {!searched&&<div className="search-prompts"><span>Try asking</span>{['What changed recently?','How is audio configured?','What caused the latency?'].map(x=><button key={x} onClick={()=>setQ(x)}>{x}</button>)}</div>}
    {searched&&!busy&&!results.length&&<Empty icon={Search} title="No close matches" copy="Try a broader question or search every space."/>}
  </section>
}

function Empty({icon:Icon,title,copy}:{icon:typeof CircleHelp;title:string;copy:string}){return <div className="empty"><Icon size={26}/><strong>{title}</strong><p>{copy}</p></div>}
