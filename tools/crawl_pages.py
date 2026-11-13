#!/usr/bin/env python3
"""Build additional drill-down trees for manual pages absent from the main indexes.

Each page's breadcrumb supplies its folder path. The crawler reads only the first
8 KB of each candidate page through the Worker's /m/ route. Run from the repo root.
"""
import os
import re
import json
import html
import sys
import time
import urllib.request
import urllib.parse
import urllib.error
from concurrent.futures import ThreadPoolExecutor

BASE = os.environ.get("BASE", "https://claude-manual.phillipstg.workers.dev").rstrip("/")
DEFAULT = [
    {
        "manual": "subaru-service-manual",
        "folder": "2019 Subaru Crosstrek Limited",
        "maxid": 38502,
        "out": "subaru-more.json",
    },
    {
        "manual": "scion-service-manual",
        "folder": "2006 Scion xB L4-1.5L (1NZ-FE)",
        "maxid": 7569,
        "out": "scion-more.json",
    },
]
CFG = json.loads(os.environ["CRAWL_CONFIG"]) if os.environ.get("CRAWL_CONFIG") else DEFAULT
TAG = re.compile(r"<[^>]+>")
CR = re.compile(
    r'<a[^>]*class="breadcrumb-part"[^>]*href="([^"]*)"[^>]*>(.*?)</a>',
    re.S,
)


def txt(value):
    return html.unescape(TAG.sub("", value)).strip()


def leaves(node, output):
    for child in node.get("c", []):
        if isinstance(child.get("p"), int):
            output.add(child["p"])
        else:
            leaves(child, output)
    return output


def fetch(url):
    for attempt in range(4):
        try:
            request = urllib.request.Request(
                url, headers={"User-Agent": "LifeOS-Indexer/1.0"}
            )
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.read(8192).decode("utf-8", "ignore")
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return None
        except Exception:
            pass
        if attempt < 3:
            time.sleep(1 + attempt)
    return ""


def place(source, page_id):
    crumbs = [(href, txt(label)) for href, label in CR.findall(source)]
    heading = re.search(r"<h1>(.*?)</h1>", source, re.S)
    h1 = txt(heading.group(1)) if heading else ""

    first_page = next(
        (
            index
            for index, (href, _) in enumerate(crumbs)
            if re.search(r"pages/1\.html$", href)
        ),
        None,
    )
    rest = crumbs[first_page + 1 :] if first_page is not None else crumbs[4:]

    if rest and re.search(rf"pages/{page_id}\.html$", rest[-1][0]):
        title, rest = rest[-1][1], rest[:-1]
    else:
        title = h1 or f"Page {page_id}"

    return [name for _, name in rest if name], title


def add(root, path, page_id, title):
    node = root
    for name in path:
        child = next(
            (
                item
                for item in node["c"]
                if "c" in item and item["n"] == name
            ),
            None,
        )
        if child is None:
            child = {"n": name, "c": []}
            node["c"].append(child)
        node = child
    node["c"].append({"n": title, "p": page_id})


def merge(node):
    # If a folder and a page share a name, expose the page as that folder's Overview.
    for child in node["c"]:
        if "c" in child:
            merge(child)

    page_by_name = {
        child["n"]: child for child in node["c"] if "p" in child
    }
    for folder in [child for child in node["c"] if "c" in child]:
        page = page_by_name.get(folder["n"])
        if page:
            node["c"].remove(page)
            folder["c"].insert(0, {"n": "Overview", "p": page["p"]})


def validate_tree(tree, label):
    if not isinstance(tree, dict) or not isinstance(tree.get("c"), list):
        raise ValueError(f"{label}: tree root must contain a children list")
    stack = list(tree["c"])
    while stack:
        node = stack.pop()
        if not isinstance(node, dict) or not isinstance(node.get("n"), str):
            raise ValueError(f"{label}: invalid tree node: {node!r}")
        if "p" in node:
            if not isinstance(node["p"], int):
                raise ValueError(f"{label}: page ID must be an integer")
        elif isinstance(node.get("c"), list):
            stack.extend(node["c"])
        else:
            raise ValueError(f"{label}: node has neither a page ID nor children")


def main():
    manifest_path = "public/data/manifest.json"
    with open(manifest_path, encoding="utf-8") as source:
        manifest = json.load(source)

    pending = []
    total_candidates = 0
    total_failures = 0

    for config in CFG:
        vehicle = next(
            (
                item
                for item in manifest["vehicles"]
                if item["manual"] == config["manual"]
            ),
            None,
        )
        if vehicle is None:
            raise ValueError(
                f'Manifest has no vehicle for manual "{config["manual"]}"'
            )

        known = set(range(1, 6))
        for guide in vehicle["guides"]:
            if os.path.basename(guide["tree"]) == config["out"]:
                continue
            tree_path = os.path.join("public", guide["tree"])
            with open(tree_path, encoding="utf-8") as source:
                known |= leaves(json.load(source), set())

        page_ids = [
            page_id
            for page_id in range(1, config["maxid"] + 1)
            if page_id not in known
        ]
        base_url = (
            f'{BASE}/m/{urllib.parse.quote(config["manual"])}/'
            f'{urllib.parse.quote(config["folder"])}/pages/'
        )
        print(
            f'{config["manual"]}: crawling {len(page_ids)} unindexed IDs',
            flush=True,
        )

        with ThreadPoolExecutor(max_workers=24) as executor:
            results = list(
                executor.map(
                    lambda page_id: fetch(f"{base_url}{page_id}.html"),
                    page_ids,
                )
            )

        root = {"title": "Additional Pages", "c": []}
        indexed = 0
        failures = 0

        for page_id, source in zip(page_ids, results):
            if source is None:
                continue
            if source == "":
                failures += 1
                continue
            path, title = place(source, page_id)
            add(root, path, page_id, title)
            indexed += 1

        merge(root)
        validate_tree(root, config["out"])
        pending.append((config, vehicle, root))
        total_candidates += len(page_ids)
        total_failures += failures
        print(
            f"  indexed {indexed} pages; {failures} fetch failures; "
            f"{len(root['c'])} top-level folders",
            flush=True,
        )

    failure_rate = total_failures / max(total_candidates, 1)
    if failure_rate > 0.02:
        raise RuntimeError(
            f"aborting without writing: {total_failures}/{total_candidates} "
            f"fetches failed ({failure_rate:.1%}; maximum allowed is 2%)"
        )

    # Write only after every configured manual has crawled and passed validation.
    for config, vehicle, tree in pending:
        output_path = os.path.join("public/data", config["out"])
        with open(output_path, "w", encoding="utf-8") as output:
            json.dump(
                tree,
                output,
                separators=(",", ":"),
                ensure_ascii=False,
            )

        if not any(
            os.path.basename(guide["tree"]) == config["out"]
            for guide in vehicle["guides"]
        ):
            vehicle["guides"].append(
                {
                    "title": "Additional Pages",
                    "sub": "Pages not in the main index",
                    "tree": "data/" + config["out"],
                }
            )

    # Confirm every guide referenced by the manifest exists and parses as JSON.
    for vehicle in manifest["vehicles"]:
        for guide in vehicle["guides"]:
            path = os.path.join("public", guide["tree"])
            with open(path, encoding="utf-8") as source:
                json.load(source)

    with open(manifest_path, "w", encoding="utf-8") as output:
        json.dump(manifest, output, ensure_ascii=False, indent=1)
        output.write("\n")

    print(
        f"crawl complete: {total_failures} failed fetches across "
        f"{total_candidates} candidate IDs"
    )


if __name__ == "__main__":
    main()
