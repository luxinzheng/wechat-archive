import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] || process.cwd());
const domain = (process.env.SITE_DOMAIN || 'https://ai-studies.net').replace(/\/$/, '');

function decodeEntities(text = '') {
  return text.replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function stripTags(text = '') {
  return decodeEntities(text.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function escapeHtml(text = '') {
  return String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function parseDate(value = '') {
  const match = value.match(/(20\d{2})\D{0,3}(\d{1,2})\D{0,3}(\d{1,2})/);
  return match ? `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}` : '';
}

function encodedFolder(name) {
  return encodeURIComponent(name).replaceAll('%2F', '/');
}

async function readArticle(entry) {
  const dir = path.join(root, entry.name);
  let html;
  try { html = await fs.readFile(path.join(dir, 'index.html'), 'utf8'); } catch { return null; }
  let meta = {};
  try { meta = JSON.parse(await fs.readFile(path.join(dir, 'article.json'), 'utf8')); } catch {}
  const title = meta.title || stripTags(html.match(/<h1[^>]*id=["']activity-name["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '') || entry.name;
  const publishedText = meta.published || stripTags(html.match(/<[^>]+id=["']publish_time["'][^>]*>([\s\S]*?)<\//i)?.[1] || '');
  const author = meta.author || stripTags(html.match(/<meta\s+name=["']author["']\s+content=["']([^"']*)/i)?.[1] || '');
  const rawDescription = decodeEntities(html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)/i)?.[1] || '');
  const description = stripTags(rawDescription).replace(/^陆新征课题组微信公众号文章的公开备份[，。]?/u, '').trim();
  return { folder: entry.name, title, published: parseDate(publishedText), author, description: description !== title && description.length > 16 ? description.slice(0, 92) : '' };
}

const entries = (await fs.readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory());
const articles = (await Promise.all(entries.map(readArticle))).filter(Boolean).sort((a, b) =>
  (b.published || '').localeCompare(a.published || '') || a.title.localeCompare(b.title, 'zh-CN'),
);
const dated = articles.filter(article => article.published);
const yearCounts = new Map();
for (const article of articles) {
  const year = article.published?.slice(0, 4) || '日期待补';
  yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
}
const years = [...yearCounts.keys()].sort((a, b) => a === '日期待补' ? 1 : b === '日期待补' ? -1 : b.localeCompare(a));
const yearTotal = years.filter(year => /^\d{4}$/.test(year)).length;
const dateRange = dated.length ? `${dated.at(-1).published.slice(0, 4)}—${dated[0].published.slice(0, 4)}` : '';

const yearOptions = years.map(year => `<button class="chip" type="button" data-year="${escapeHtml(year)}">${escapeHtml(year)} <span>${yearCounts.get(year)}</span></button>`).join('');
const cards = articles.map(item => {
  const year = item.published?.slice(0, 4) || '日期待补';
  const search = escapeHtml(`${item.title} ${item.author} ${item.published} ${item.description}`.toLowerCase());
  const href = `./${encodedFolder(item.folder)}/`;
  return `<article class="card" data-search="${search}" data-year="${escapeHtml(year)}" data-date="${item.published}" data-title="${escapeHtml(item.title.toLowerCase())}">
  <time datetime="${item.published}">${item.published || '日期待补'}</time>
  <h2><a href="${href}">${escapeHtml(item.title)}</a></h2>
  ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
  <div class="foot">${item.author ? `<span>${escapeHtml(item.author)}</span>` : '<span></span>'}<a href="${href}" aria-label="阅读：${escapeHtml(item.title)}">阅读全文 →</a></div>
</article>`;
}).join('\n');

const jsonLd = JSON.stringify({
  '@context': 'https://schema.org', '@type': 'CollectionPage', name: '课题组公众号文案汇总', url: `${domain}/`,
  description: '陆新征课题组微信公众号文章汇总。',
  mainEntity: { '@type': 'ItemList', numberOfItems: articles.length,
    itemListElement: articles.slice(0, 50).map((item, position) => ({ '@type': 'ListItem', position: position + 1, name: item.title, url: `${domain}/${encodedFolder(item.folder)}/` })) },
}).replaceAll('<', '\\u003c');

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>课题组公众号文案汇总</title>
<meta name="description" content="陆新征课题组微信公众号文章汇总，共 ${articles.length} 篇，支持按标题、作者、日期检索。">
<meta name="robots" content="index,follow"><link rel="canonical" href="${domain}/"><meta name="theme-color" content="#24435f">
<meta property="og:title" content="课题组公众号文案汇总"><meta property="og:description" content="陆新征课题组微信公众号文章汇总"><meta property="og:type" content="website"><meta property="og:url" content="${domain}/">
<script type="application/ld+json">${jsonLd}</script>
<style>
:root{color-scheme:light;--ink:#172b3a;--muted:#667784;--line:#dce3e8;--blue:#244f70;--bg:#f5f7f8}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--ink);font-family:"PingFang SC","Microsoft YaHei",system-ui,-apple-system,sans-serif;line-height:1.65}.wrap{width:min(1120px,calc(100% - 36px));margin:auto}header{padding:44px 0 36px;border-bottom:1px solid var(--line);background:#fff}header h1{margin:0 0 10px;font-family:"Songti SC","SimSun",serif;font-size:36px;font-weight:600}header p{margin:0;color:var(--muted);font-size:14px}.main{padding:28px 0 60px}.tools{position:sticky;top:0;z-index:5;padding:12px 0 16px;background:rgba(245,247,248,.96);backdrop-filter:blur(8px)}.search-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px}.search{position:relative}.search input{width:100%;height:50px;padding:0 46px 0 16px;border:1px solid #bdc9d1;border-radius:10px;outline:0;background:#fff;color:var(--ink);font:inherit}.search input:focus{border-color:#5c86a3;box-shadow:0 0 0 3px rgba(36,79,112,.1)}.clear{position:absolute;right:7px;top:7px;width:36px;height:36px;border:0;border-radius:8px;background:transparent;color:var(--muted);font-size:20px;cursor:pointer}.sort{height:50px;padding:0 36px 0 14px;border:1px solid #bdc9d1;border-radius:10px;background:#fff;color:var(--ink);font:inherit}.year-row{display:flex;align-items:center;gap:8px;margin-top:12px}.label{flex:none;color:var(--muted);font-size:13px}.chips{display:flex;gap:7px;overflow-x:auto;padding:1px 1px 4px}.chip{flex:none;padding:6px 10px;border:1px solid var(--line);border-radius:7px;background:#fff;color:#516774;cursor:pointer;font:inherit;font-size:12px}.chip span{color:#8b9ba6}.chip:hover,.chip.active{border-color:var(--blue);background:var(--blue);color:#fff}.chip.active span{color:#dfeaf0}.head{display:flex;align-items:end;justify-content:space-between;gap:16px;margin:18px 0 14px}.head h2{margin:0;font-size:22px}.head p{margin:0;color:var(--muted);font-size:13px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.card{display:flex;min-width:0;min-height:208px;flex-direction:column;padding:20px;border:1px solid var(--line);border-radius:10px;background:#fff}.card:hover{border-color:#aebdc7;box-shadow:0 8px 24px rgba(23,43,58,.06)}.card[hidden]{display:none}.card time{color:var(--muted);font-size:12px}.card h2{margin:10px 0 8px;font-size:17px;line-height:1.5}.card h2 a{color:var(--ink);text-decoration:none}.card h2 a:hover{color:var(--blue);text-decoration:underline}.card p{display:-webkit-box;overflow:hidden;margin:0;color:var(--muted);font-size:13px;-webkit-line-clamp:3;-webkit-box-orient:vertical}.foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:auto;padding-top:16px;color:#7b8d99;font-size:12px}.foot a{color:var(--blue);font-weight:600;text-decoration:none}.empty{display:none;padding:60px 20px;text-align:center;color:var(--muted)}.more{display:block;margin:24px auto 0;padding:10px 28px;border:1px solid #aebdc7;border-radius:8px;background:#fff;color:var(--ink);cursor:pointer;font:inherit}.more[hidden]{display:none}.more:hover{border-color:var(--blue);color:var(--blue)}footer{padding:22px 0 34px;color:#8797a2;text-align:center;font-size:12px}
@media(max-width:700px){header{padding:32px 0 26px}header h1{font-size:28px}.search-row{grid-template-columns:1fr}.sort{width:100%}.tools{position:relative}.grid{grid-template-columns:1fr}.card{min-height:190px}.head{align-items:start;flex-direction:column;gap:2px}}
</style></head>
<body><header><div class="wrap"><h1>课题组公众号文案汇总</h1><p>共 ${articles.length} 篇 · ${yearTotal} 个年份${dateRange ? ` · ${dateRange}` : ''}</p></div></header>
<main class="main"><div class="wrap"><section class="tools" aria-label="文章筛选"><div class="search-row"><label class="search"><input id="q" type="search" placeholder="搜索标题、作者或日期" aria-label="搜索文章" autocomplete="off"><button id="clear" class="clear" type="button" aria-label="清空搜索" hidden>×</button></label><select id="sort" class="sort" aria-label="文章排序"><option value="newest">最新发布</option><option value="oldest">最早发布</option><option value="title">标题排序</option></select></div><div class="year-row"><span class="label">年份</span><div class="chips"><button class="chip active" type="button" data-year="all">全部</button>${yearOptions}</div></div></section>
<div class="head"><h2>文章列表</h2><p id="count" aria-live="polite">显示 ${Math.min(30, articles.length)} 篇，共 ${articles.length} 篇</p></div><section id="grid" class="grid">${cards}</section><p id="empty" class="empty">没有找到匹配的文章。</p><button id="more" class="more" type="button">显示更多</button></div></main><footer><div class="wrap">陆新征课题组公众号文案汇总</div></footer>
<script>
const state={q:'',year:'all',sort:'newest',limit:30};
const grid=document.getElementById('grid'),cards=[...grid.querySelectorAll('.card')],q=document.getElementById('q'),clear=document.getElementById('clear'),sort=document.getElementById('sort'),count=document.getElementById('count'),empty=document.getElementById('empty'),more=document.getElementById('more');
function filtered(){return cards.filter(c=>(!state.q||c.dataset.search.includes(state.q))&&(state.year==='all'||c.dataset.year===state.year)).sort((a,b)=>state.sort==='title'?a.dataset.title.localeCompare(b.dataset.title,'zh-CN'):state.sort==='oldest'?(a.dataset.date||'9999').localeCompare(b.dataset.date||'9999'):(b.dataset.date||'').localeCompare(a.dataset.date||''));}
function render(updateUrl=true){const list=filtered(),shown=new Set(list.slice(0,state.limit));for(const c of cards)c.hidden=!shown.has(c);for(const c of list)grid.append(c);count.textContent=list.length?'显示 '+Math.min(state.limit,list.length)+' 篇，共 '+list.length+' 篇':'没有匹配文章';empty.style.display=list.length?'none':'block';more.hidden=state.limit>=list.length;clear.hidden=!state.q;if(updateUrl){const p=new URLSearchParams();if(state.q)p.set('q',q.value.trim());if(state.year!=='all')p.set('year',state.year);if(state.sort!=='newest')p.set('sort',state.sort);history.replaceState(null,'',location.pathname+(p.size?'?'+p:''));}}
function reset(){state.limit=30;render();}
q.addEventListener('input',()=>{state.q=q.value.trim().toLowerCase();reset()});clear.addEventListener('click',()=>{q.value='';state.q='';q.focus();reset()});sort.addEventListener('change',()=>{state.sort=sort.value;reset()});more.addEventListener('click',()=>{state.limit+=30;render()});
document.querySelectorAll('.chip').forEach(btn=>btn.addEventListener('click',()=>{state.year=btn.dataset.year;document.querySelectorAll('.chip').forEach(x=>x.classList.toggle('active',x===btn));reset()}));
const params=new URLSearchParams(location.search);if(params.get('q')){q.value=params.get('q');state.q=q.value.toLowerCase()}if(params.get('sort')&&['newest','oldest','title'].includes(params.get('sort'))){state.sort=params.get('sort');sort.value=state.sort}if(params.get('year')){const btn=[...document.querySelectorAll('.chip')].find(x=>x.dataset.year===params.get('year'));if(btn){state.year=btn.dataset.year;document.querySelectorAll('.chip').forEach(x=>x.classList.toggle('active',x===btn))}}render(false);
</script></body></html>`;

const today = new Date().toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${domain}/</loc><lastmod>${today}</lastmod></url>\n${articles.map(item => `  <url><loc>${domain}/${encodedFolder(item.folder)}/</loc><lastmod>${item.published || today}</lastmod></url>`).join('\n')}\n</urlset>\n`;
const robots = `User-agent: *\nAllow: /\n\nSitemap: ${domain}/sitemap.xml\n`;

await fs.writeFile(path.join(root, 'index.html'), html, 'utf8');
await fs.writeFile(path.join(root, 'sitemap.xml'), sitemap, 'utf8');
await fs.writeFile(path.join(root, 'robots.txt'), robots, 'utf8');
console.log(`Built article index and sitemap: ${articles.length} articles, ${yearTotal} years`);
