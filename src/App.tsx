import { useCallback, useEffect, useMemo, useState } from 'react';
import { MemoryGraph } from '@supermemory/memory-graph';
import { Boxes, BrainCircuit, CircleHelp, FileText, FolderOpen, RefreshCw, Search, Sparkles, X } from 'lucide-react';
import type { DocumentRecord, MemoryRecord } from './types';

type View='graph'|'tags'|'browse';
const nav=[
  {id:'graph' as View,label:'Graph',icon:BrainCircuit},
  {id:'tags' as View,label:'Tags',icon:Boxes},
  {id:'browse' as View,label:'Browse',icon:FolderOpen},
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
      {view==='browse'&&<BrowseView documents={documents} tags={tags.map(t=>t.name)}/>}
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

function BrowseView({documents,tags}:{documents:DocumentRecord[];tags:string[]}){
  const [q,setQ]=useState('');
  const [tag,setTag]=useState('');
  const [selectedId,setSelectedId]=useState<string|null>(documents[0]?.id||null);
  const matches=useMemo(()=>{
    const needle=q.trim().toLowerCase();
    return documents.filter(document=>{
      if(tag&&!document.containerTags?.includes(tag)) return false;
      if(!needle) return true;
      const memories=(document.memories||[]) as MemoryRecord[];
      const haystack=[document.title,document.summary,document.content,...(document.containerTags||[]),...memories.map(memory=>memory.memory)].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  },[documents,q,tag]);
  useEffect(()=>{
    if(!matches.some(document=>document.id===selectedId)) setSelectedId(matches[0]?.id||null);
  },[matches,selectedId]);
  const selected=matches.find(document=>document.id===selectedId)||null;
  const selectedMemories=(selected?.memories||[]) as MemoryRecord[];

  return <section className="page browse-page"><PageHeading eyebrow="Library" title="Browse documents" description="Filter source material and inspect the memories extracted from each document."/>
    <div className="browse-toolbar"><div className="browse-search"><Search size={18}/><input value={q} onChange={event=>setQ(event.target.value)} placeholder="Filter titles, content, or memories…" autoFocus/></div><select value={tag} onChange={event=>setTag(event.target.value)} aria-label="Container tag"><option value="">Every space</option>{tags.map(value=><option key={value}>{value}</option>)}</select></div>
    <div className="browse-layout">
      <div className="document-list"><div className="document-count">{matches.length} document{matches.length!==1?'s':''}</div>{matches.map(document=><button key={document.id} className={`document-row ${selectedId===document.id?'selected':''}`} onClick={()=>setSelectedId(document.id)}><span className="document-icon"><FileText size={16}/></span><span className="document-row-copy"><strong>{document.title||'Untitled document'}</strong><small>{document.summary||document.documentType||'No summary available'}</small><span>{(document.memories||[]).length} memories · {document.updatedAt?new Date(document.updatedAt).toLocaleDateString():'Unknown date'}</span></span></button>)}{!matches.length&&<Empty icon={Search} title="No matching documents" copy="Try a shorter term or search every space."/>}</div>
      <article className="document-detail">{selected?<><div className="document-detail-head"><span className="document-type">{selected.documentType||selected.type||'document'}</span><h2>{selected.title||'Untitled document'}</h2><p>{selected.summary||'No summary is available for this document.'}</p><div className="detail-tags">{selected.containerTags?.map(value=><span key={value}>{value}</span>)}</div></div>{selected.content&&<section className="source-content"><h3>Source content</h3><p>{selected.content}</p></section>}<section className="memory-list"><h3>Extracted memories <span>{selectedMemories.length}</span></h3>{selectedMemories.map(memory=><div className="memory-item" key={memory.id}><Sparkles size={14}/><p>{memory.memory}</p></div>)}{!selectedMemories.length&&<p className="no-memories">No memories were extracted from this document.</p>}</section></>:<Empty icon={FolderOpen} title="Select a document" copy="Choose a document to inspect its source and memories."/>}</article>
    </div>
  </section>
}

function Empty({icon:Icon,title,copy}:{icon:typeof CircleHelp;title:string;copy:string}){return <div className="empty"><Icon size={26}/><strong>{title}</strong><p>{copy}</p></div>}
