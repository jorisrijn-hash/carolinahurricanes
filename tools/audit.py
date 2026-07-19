#!/usr/bin/env python3
"""
audit.py - accessibility regression check.

Re-measures the exact defects found on the uploaded production page against
every page of the rebuild. Any non-zero column except IMGS and LAZY is a bug.

    python3 -m http.server 8899     # from the project root, in another shell
    python3 tools/audit.py
"""
from playwright.sync_api import sync_playwright
PAGES=["index.html","schedule.html","roster.html","game.html","news.html",
       "article.html","tickets.html","shop.html","my-canes.html",
       "storm-tracker.html","accessibility.html","es/index.html","es/tickets.html"]
JS = """() => {
  const imgs=[...document.images];
  const btns=[...document.querySelectorAll('button')];
  const name=el=>(el.textContent||'').trim()||el.getAttribute('aria-label')||el.getAttribute('title');
  const links=[...document.querySelectorAll('a')];
  return {
    h1: document.querySelectorAll('h1').length,
    imgs: imgs.length,
    noAlt: imgs.filter(i=>!i.hasAttribute('alt')).length,
    noDims: imgs.filter(i=>!(i.getAttribute('width')&&i.getAttribute('height'))).length,
    lazy: imgs.filter(i=>i.loading==='lazy').length,
    btnNoName: btns.filter(b=>!name(b)).length,
    linkNoName: links.filter(a=>!name(a)&&!a.querySelector('img[alt]')).length,
    iframes: document.querySelectorAll('iframe').length,
    landmarks: ['header','nav','main','footer'].filter(t=>document.querySelector(t)).length,
    lang: document.documentElement.lang || '(none)'
  };
}"""
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1280,"height":900})
    pg.add_init_script("try{sessionStorage.setItem('canes:booted','1')}catch(e){}")
    print("%-15s %3s %5s %5s %6s %5s %6s %6s %5s"%("PAGE","H1","IMGS","NOALT","NODIMS","LAZY","BTN!NM","LNK!NM","LMRK"))
    print("-"*72)
    bad=0
    for page in PAGES:
        pg.goto(f"http://localhost:8899/{page}", wait_until="load"); pg.wait_for_timeout(500)
        r=pg.evaluate(JS)
        flag = r["h1"]!=1 or r["noAlt"] or r["noDims"] or r["btnNoName"] or r["linkNoName"] or r["landmarks"]<4
        bad += 1 if flag else 0
        print("%-15s %3d %5d %5d %6d %5d %6d %6d %5d %s"%(page,r["h1"],r["imgs"],r["noAlt"],
              r["noDims"],r["lazy"],r["btnNoName"],r["linkNoName"],r["landmarks"], "" if not flag else "<-- CHECK"))
    print("-"*72); print(f"{bad} page(s) flagged.")
    b.close()
