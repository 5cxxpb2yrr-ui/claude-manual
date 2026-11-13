#!/usr/bin/env python3
"""Builds drill-down trees for pages that no index file lists.
Each page's breadcrumb (top of the HTML) gives its folder path, so we read only the first 8 KB of
every unindexed page via the Worker's /m/ route and assemble a tree. Run from the repo root."""
import os, re, json, html, sys, time, urllib.request, urllib.parse, urllib.error
from concurrent.futures import ThreadPoolExecutor

BASE = os.environ.get("BASE", "https://claude-manual.phillipstg.workers.dev").rstrip("/")
DEFAULT = [
    {"manual": "subaru-service-manual", "folder": "2019 Subaru Crosstrek Limited", "maxid": 38502, "out": "subaru-more.json"},
    {"manual": "scion-service-manual", "folder": "2006 Scion xB L4-1.5L (1NZ-FE)", "maxid": 7569, "out": "scion-more.json"},
]
CFG = json.loads(os.environ["CRAWL_CONFIG"]) if os.environ.get("CRAWL_CONFIG") else DEFAULT
TAG = re.compile(r"<[^>]+>")
CR = re.compile(r'<a[^>]*class="breadcrumb-part"[^>]*href="([^"]*)"[^>]*>(.*?)</a>', re.S)
txt = lambda s: html.unescape(TAG.sub("", s)).strip()

def leaves(n, o):
    for c in n.get("c", []):
        if isinstance(c.get("p"), int): o.add(c["p"])
        else: leaves(c, o)
    return o

def fetch(u):
    for i in range(4):
        try:
            req = urllib.request.Request(u, headers={"User-Agent": "LifeOS-Indexer/1.0"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read(8192).decode("utf-8", "ignore")
        except urllib.error.HTTPError as e:
            if e.code == 404: return None
        except Exception:
            pass
        time.sleep(1 + i)
    return ""  # failed after retries

def place(t, pid):
    cr = [(h, txt(x)) for h, x in CR.findall(t)]
    m = re.search(r"<h1>(.*?)</h1>", t, re.S); h1 = txt(m.group(1)) if m else ""
    idx = next((i for i, (h, _) in enumerate(cr) if re.search(r"pages/1\.html$", h)), None)
    rest = cr[idx + 1:] if idx is not None else cr[4:]
    if rest and re.search(rf"pages/{pid}\.html$", rest[-1][0]):
        title, rest = rest[-1][1], rest[:-1]
    else:
        title = h1 or f"Page {pid}"
    return [n for _, n in rest if n], title

def add(root, path, pid, title):
    node = root
    for name in path:
        nxt = next((c for c in node["c"] if "c" in c and c["n"] == name), None)
        if not nxt:
            nxt = {"n": name, "c": []}; node["c"].append(nxt)
        node = nxt
    node["c"].append({"n": title, "p": pid})

def merge(n):  # a folder page and its folder share a name -> fold the page in as "Overview"
    for c in n["c"]:
        if "c" in c: merge(c)
    leafs = {c["n"]: c for c in n["c"] if "p" in c}
    for f in [c for c in n["c"] if "c" in c]:
        l = leafs.get(f["n"])
        if l:
            n["c"].remove(l); f["c"].insert(0, {"n": "Overview", "p": l["p"]})

def main():
    mp = "public/data/manifest.json"
    man = json.load(open(mp)); fails = total = 0
    for cfg in CFG:
        v = next(v for v in man["vehicles"] if v["manual"] == cfg["manual"])
        known = set(range(1, 6))
        for g in v["guides"]:
            if os.path.basename(g["tree"]) == cfg["out"]: continue
            known |= leaves(json.load(open("public/" + g["tree"])), set())
        ids = [i for i in range(1, cfg["maxid"] + 1) if i not in known]
        base = f'{BASE}/m/{urllib.parse.quote(cfg["manual"])}/{urllib.parse.quote(cfg["folder"])}/pages/'
        print(f'{cfg["manual"]}: crawling {len(ids)} unindexed ids', flush=True)
        with ThreadPoolExecutor(24) as ex:
            res = list(ex.map(lambda i: fetch(f"{base}{i}.html"), ids))
        root = {"title": "Additional Pages", "c": []}; n = 0
        for i, t in zip(ids, res):
            if t is None: continue
            if t == "": fails += 1; continue
            path, title = place(t, i); add(root, path, i, title); n += 1
        total += len(ids); merge(root)
        json.dump(root, open("public/data/" + cfg["out"], "w"), separators=(",", ":"), ensure_ascii=False)
        print(f'  indexed {n} pages, {len(root["c"])} top-level folders', flush=True)
        if not any(os.path.basename(g["tree"]) == cfg["out"] for g in v["guides"]):
            v["guides"].append({"title": "Additional Pages", "sub": "Pages not in the main index", "tree": "data/" + cfg["out"]})
    json.dump(man, open(mp, "w"), ensure_ascii=False, indent=1)
    print(f"failed fetches: {fails}")
    if fails > 0.02 * max(total, 1): sys.exit("too many failed fetches")

main()
