import { useState, useEffect } from "react";
import ShopApp from "./shop/ShopApp";

// ── URL routing (lightweight, no router library needed) ─────────────────────
// Maps a browser path like "/shop" to the internal page name, and back. This
// is what makes each page a real, shareable link instead of just internal
// state that resets to the homepage on refresh. ShopApp (src/shop/) owns all
// actual page rendering and its own nav/CSS/sub-screen state; this file is
// just the URL <-> page-name mapping and the one shared site-content fetch.
const ROUTABLE_PAGES = ["shop","product","cart","checkout","custom","catalog","contact","clients","admin"];
function pathToPage(pathname){
  const parts=(pathname||"/").replace(/^\/|\/$/g,"").split("/");
  const slug=parts[0]||"";
  return ROUTABLE_PAGES.includes(slug)?slug:"home";
}
function pageToPath(page){
  return page==="home" ? "/" : `/${page}`;
}

async function apiGet(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

const SITE_CONTENT_URL = "/.netlify/functions/get-site-content";

export default function App(){
  const [ready,setReady]=useState(false);
  const [page,setPage]=useState(()=>pathToPage(window.location.pathname));
  // Raw get-site-content response, fetched once here and handed down to
  // ShopApp so it doesn't have to make its own duplicate fetch.
  const [rawSiteContent,setRawSiteContent]=useState(null);

  useEffect(()=>{
    (async()=>{
      try{
        setRawSiteContent(await apiGet(SITE_CONTENT_URL));
      }catch{
        // ShopApp falls back to its own fetch if this comes back empty.
      }
      setReady(true);
    })();
  },[]);

  const nav=(p)=>{
    setPage(p);
    const path=pageToPath(p);
    if(window.location.pathname!==path) window.history.pushState({},"",path);
    window.scrollTo(0,0);
  };

  // Keep state in sync with the browser's back/forward buttons.
  useEffect(()=>{
    const onPop=()=>{setPage(pathToPage(window.location.pathname));};
    window.addEventListener("popstate",onPop);
    return ()=>window.removeEventListener("popstate",onPop);
  },[]);

  if(!ready) return(<><style>{`body{background:#ebe8e8;display:flex;align-items:center;justify-content:center;height:100vh;font-family:'Jost',sans-serif;color:#52805f;font-size:1rem;letter-spacing:.1em;}`}</style><div>Loading Shop 1104…</div></>);

  return <ShopApp page={page} nav={nav} initialContent={rawSiteContent}/>;
}
