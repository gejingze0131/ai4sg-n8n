#!/usr/bin/env python3
"""scholar: search fixed academic databases and follow citations, for the Codex search agent.

  scholar search --db openalex|europepmc|eric|worldbank|aearct --query '("machine learning" OR "deep learning") AND tuberculosis AND Bangladesh'
                 [--since 2020] [--limit 50] [--sort relevance|cited] [--no-reviews] [--anywhere] [--venues S1|S2] [--country India]
      (OpenAlex searches title and abstract unless --anywhere; --sort cited puts the most-cited papers first;
       --no-reviews leaves out reviews and editorial matter; --venues keeps OpenAlex works published in these sources.
       Europe PMC takes its own field syntax, e.g. TITLE_ABS:"tuberculosis" AND (TITLE_ABS:"Bangladesh" OR AFF:"Bangladesh").
       OpenAlex charges each search against a daily budget, so prefer Europe PMC for health and keep OpenAlex queries few.
       worldbank: World Bank Documents & Reports (Publications & Research: working papers, reports, briefs); each quoted
       term of the first OR group is searched in the full text, the documents tagged with --country are kept, and the whole
       query is then checked against the title and abstract.
       aearct: the AEA RCT Registry (all registered trials, downloaded once a week into a local cache); the query is checked
       against title, abstract, keywords, intervention, outcomes and countries; `papers` lists result papers when registered.)
  scholar refs W2741809807          works this paper cites (backward), via OpenAlex; a DOI also works
  scholar citedby 10.1038/s41746-023-00931-7   works that cite this paper (forward), via OpenAlex
  scholar work <doi or W-id>        one work with abstract and open-access links
  scholar resolve --doi D --url U   where to get the full text: Europe PMC XML, open-access PDFs, and the abstract

Prints one JSON object per line: db, id, doi, title, year, venue, authors, abstract (shortened), landing_url, oa_pdf_url,
cited_by_count. Free APIs, no key needed. Set SCHOLAR_MAILTO to join OpenAlex's polite pool.
"""
import argparse, csv, hashlib, io, json, os, re, sys, time, urllib.parse, urllib.request

OPENALEX = os.environ.get("OPENALEX_URL", "https://api.openalex.org")
EUROPEPMC = os.environ.get("EUROPEPMC_URL", "https://www.ebi.ac.uk/europepmc/webservices/rest")
ERIC = os.environ.get("ERIC_URL", "https://api.ies.ed.gov/eric/")
WORLDBANK = os.environ.get("WORLDBANK_URL", "https://search.worldbank.org/api/v2/wds")
AEARCT_CSV = os.environ.get("AEARCT_CSV_URL", "https://www.socialscienceregistry.org/site/csv")
CACHE = os.environ.get("SCHOLAR_CACHE") or ("/runs/_cache" if os.path.isdir("/runs") else os.path.expanduser("~/.cache/ai4sg-scholar"))
MAILTO = os.environ.get("SCHOLAR_MAILTO", "")
OPENALEX_KEY = os.environ.get("OPENALEX_API_KEY", "")
NOT_RESEARCH = ["review", "paratext", "erratum", "editorial", "letter", "retraction"]
UA = "ai4sg-scholar/1.0" + (f" (mailto:{MAILTO})" if MAILTO else "")


def get(url, params):
    if url.startswith(OPENALEX) and OPENALEX_KEY:
        params = {**params, "api_key": OPENALEX_KEY}
    q = urllib.parse.urlencode({k: v for k, v in params.items() if v not in (None, "")})
    req = urllib.request.Request(url + ("&" if "?" in url else "?") + q, headers={"User-Agent": UA, "Accept": "application/json"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and attempt < 3:
                time.sleep(3 + 5 * attempt); continue
            # OpenAlex answers 429 when the day's budget is used up (without a key $0.10 a day, about 100 searches) and 401
            # for requests that need a key; say which, with OpenAlex's own message
            if url.startswith(OPENALEX) and e.code in (401, 403, 429):
                try:
                    why = json.loads(e.read().decode("utf-8", "replace")).get("message", "")
                except Exception:
                    why = ""
                raise RuntimeError(f"OpenAlex refused the request (HTTP {e.code}){': ' + why[:200] if why else ''}"
                                   + ("" if OPENALEX_KEY else "; a free OPENALEX_API_KEY in .env gives 10x the daily budget")) from e
            raise
        except (urllib.error.URLError, TimeoutError):
            if attempt < 3:
                time.sleep(3); continue
            raise


def short(s, n=700):
    s = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s or "")).strip()
    return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + " …"


def bare_doi(d):
    return re.sub(r"^https?://(dx\.)?doi\.org/", "", (d or "").strip(), flags=re.I).lower()


# ---------- OpenAlex ----------
def oa_abstract(inv):
    if not inv:
        return ""
    words = sorted((p, w) for w, ps in inv.items() for p in ps)
    return " ".join(w for _, w in words)


def oa_record(w):
    loc = w.get("primary_location") or {}
    best = w.get("best_oa_location") or {}
    return {"db": "openalex", "id": (w.get("id") or "").rsplit("/", 1)[-1], "doi": bare_doi(w.get("doi")),
            "title": w.get("display_name") or w.get("title") or "", "year": w.get("publication_year"),
            "venue": ((loc.get("source") or {}).get("display_name") or ""),
            "type": w.get("type") or "",
            "authors": [((a.get("author") or {}).get("display_name") or "") for a in (w.get("authorships") or [])[:4]],
            "abstract": short(oa_abstract(w.get("abstract_inverted_index"))),
            "landing_url": loc.get("landing_page_url") or (("https://doi.org/" + bare_doi(w.get("doi"))) if w.get("doi") else w.get("id") or ""),
            "oa_pdf_url": best.get("pdf_url") or loc.get("pdf_url") or "",
            "is_oa": bool((w.get("open_access") or {}).get("is_oa")),
            "cited_by_count": w.get("cited_by_count") or 0}


def oa_works(filters="", search="", limit=50, sort=""):
    # page numbers, not cursor paging: without an API key OpenAlex refuses cursor= past the first page (HTTP 401),
    # while page=2, 3 ... work for the first 10,000 results either way
    out, page, per = [], 1, min(200, limit)
    while len(out) < limit and page * per <= 10000:
        d = get(OPENALEX + "/works", {"search": search, "filter": filters, "sort": sort, "per-page": per, "page": page, "mailto": MAILTO})
        res = d.get("results") or []
        out += [oa_record(w) for w in res]
        if len(res) < per:
            break
        page += 1
    return out[:limit]


def oa_search(query, since, limit, sort="relevance", no_reviews=False, anywhere=False, venues=""):
    """Title-and-abstract search (full-text matches of a country name are mostly noise); falls back to the plain search.
    Reviews are left out with negative filters, so new OpenAlex types (e.g. conference-paper) are kept."""
    base = [f"from_publication_date:{since}-01-01"] if since else []
    if no_reviews:
        base += [f"type:!{t}" for t in NOT_RESEARCH]
    if venues:
        base.append("primary_location.source.id:" + "|".join(v.strip() for v in re.split(r"[|,\s]+", venues) if v.strip()))
    order = "cited_by_count:desc" if sort == "cited" else ""
    if not anywhere:
        try:
            return oa_works(",".join(base + ["title_and_abstract.search:" + query.replace(",", " ")]), "", limit,
                            order or "relevance_score:desc")
        except urllib.error.HTTPError as e:
            if e.code == 429:
                raise
            try:
                return oa_works(",".join(base + ["title_and_abstract.search:" + query.replace(",", " ")]), "", limit, order)
            except urllib.error.HTTPError as e2:
                if e2.code == 429:
                    raise
    return oa_works(",".join(base), query, limit, order)


def oa_id(ref):
    ref = ref.strip()
    if re.match(r"^W\d+$", ref, re.I):
        return ref.upper()
    w = get(OPENALEX + "/works/" + ("doi:" + bare_doi(ref)), {"mailto": MAILTO})
    return (w.get("id") or "").rsplit("/", 1)[-1]


# ---------- Europe PMC (PubMed, PMC, preprints such as medRxiv) ----------
def epmc_search(query, since, limit, sort="relevance", no_reviews=False):
    q = f"({query})" + (f" AND PUB_YEAR:[{since} TO 3000]" if since else "") + (' NOT PUB_TYPE:"review"' if no_reviews else "")
    out, mark = [], "*"
    while len(out) < limit and mark:
        d = get(EUROPEPMC + "/search", {"query": q, "format": "json", "resultType": "core", "pageSize": min(500, limit), "cursorMark": mark,
                                        "sort": "CITED desc" if sort == "cited" else ""})
        res = (d.get("resultList") or {}).get("result") or []
        for r in res:
            urls = ((r.get("fullTextUrlList") or {}).get("fullTextUrl")) or []
            pdf = next((u.get("url") for u in urls if u.get("documentStyle") == "pdf" and u.get("availabilityCode") in ("OA", "F")), "")
            html = next((u.get("url") for u in urls if u.get("documentStyle") == "html"), "")
            ident = r.get("pmid") or r.get("id") or ""
            out.append({"db": "europepmc", "id": f"{r.get('source', '')}:{r.get('id', '')}", "doi": bare_doi(r.get("doi")),
                        "title": short(r.get("title"), 400), "year": int(r["pubYear"]) if str(r.get("pubYear", "")).isdigit() else None,
                        "venue": (((r.get("journalInfo") or {}).get("journal") or {}).get("title") or ""),
                        "type": "preprint" if r.get("source") == "PPR" else "article",
                        "authors": [a.strip() for a in (r.get("authorString") or "").split(",")[:4] if a.strip()],
                        "abstract": short(r.get("abstractText")),
                        "landing_url": ("https://doi.org/" + bare_doi(r.get("doi"))) if r.get("doi") else html or (f"https://europepmc.org/article/{r.get('source')}/{r.get('id')}"),
                        "oa_pdf_url": pdf, "is_oa": r.get("isOpenAccess") == "Y", "cited_by_count": r.get("citedByCount") or 0,
                        "pmid": r.get("pmid") or "", "pmcid": r.get("pmcid") or "",
                        "affiliation": short(r.get("affiliation"), 300)})
        mark = d.get("nextCursorMark") if res and d.get("nextCursorMark") != mark else None
    return out[:limit]


# ---------- ERIC (education) ----------
def eric_search(query, since, limit):
    q = query + (f" AND publicationdateyear:[{since} TO *]" if since else "")
    d = get(ERIC, {"search": q, "format": "json", "rows": min(200, limit), "start": 0,
                   "fields": "id,title,description,publicationdateyear,source,author,url,e_fulltextauth,peerreviewed,publicationtype"})
    out = []
    for r in ((d.get("response") or {}).get("docs") or [])[:limit]:
        eid = r.get("id", "")
        full = eid.startswith("ED") and str(r.get("e_fulltextauth", "")) == "1"
        out.append({"db": "eric", "id": eid, "doi": "", "title": r.get("title", ""), "year": r.get("publicationdateyear"),
                    "venue": r.get("source", ""), "type": ", ".join(r.get("publicationtype") or []),
                    "authors": (r.get("author") or [])[:4], "abstract": short(r.get("description")),
                    "landing_url": r.get("url") or f"https://eric.ed.gov/?id={eid}",
                    "oa_pdf_url": f"https://files.eric.ed.gov/fulltext/{eid}.pdf" if full else "",
                    "is_oa": full, "cited_by_count": 0})
    return out



# ---------- a small boolean matcher for databases searched locally: (a OR "b c") AND (d OR e) AND "India" ----------
def _split_top(q, sep):
    parts, depth, cur, i, quote = [], 0, "", 0, False
    while i < len(q):
        c = q[i]
        if c == '"':
            quote = not quote
        if not quote:
            if c == "(":
                depth += 1
            elif c == ")":
                depth -= 1
            elif depth == 0 and q[i:i + len(sep)] == sep:
                parts.append(cur); cur = ""; i += len(sep); continue
        cur += c; i += 1
    parts.append(cur)
    return [p.strip() for p in parts if p.strip()]


def query_groups(query):
    """'(a OR "b c") AND d' -> [['a', 'b c'], ['d']]"""
    groups = []
    for part in _split_top(query.strip(), " AND "):
        part = part.strip()
        while part.startswith("(") and part.endswith(")"):
            part = part[1:-1].strip()
        terms = [t.strip().strip('"').strip() for t in _split_top(part, " OR ")]
        if terms := [t for t in terms if t]:
            groups.append(terms)
    return groups


def term_rx(t):
    body = r"[\s-]+".join(re.escape(w) for w in re.split(r"[\s-]+", t))
    flags = 0 if (t.isupper() and len(t) <= 5) else re.I   # AI, LLM, NLP: capitals only
    return re.compile(r"(?<![\w])" + body + r"(?![\w])", flags)


def matcher(query):
    groups = [[term_rx(t) for t in g] for g in query_groups(query)]
    return lambda text: all(any(rx.search(text) for rx in g) for g in groups)


def cache_path(name):
    os.makedirs(CACHE, exist_ok=True)
    return os.path.join(CACHE, name)


# ---------- World Bank Documents & Reports ----------
def wb_text(v):
    if isinstance(v, dict):
        return v.get("cdata!") or " ".join(str(x) for x in v.values())
    return str(v or "")


def wb_search(query, since, limit, country="", all_types=False):
    """Each term of the first OR group is searched on its own (the API's own OR also matches single words of a phrase),
    documents tagged with the country are kept, and the whole query is checked against the title and abstract."""
    groups = query_groups(query)
    if not groups:
        return []
    ok = matcher(query)
    key = hashlib.sha1(json.dumps([query, since, country, all_types]).encode()).hexdigest()[:16]
    cp = cache_path(f"worldbank-{key}.json")
    if os.path.exists(cp) and time.time() - os.path.getmtime(cp) < 86400:
        return json.load(open(cp))[:limit]
    docs = {}
    for term in groups[0]:
        params = {"format": "json", "qterm": f'"{term}"' if " " in term else term, "rows": 200,
                  "fl": "display_title,docdt,docty,majdocty,pdfurl,url,count,abstracts,repnb"}
        if not all_types:
            params["majdocty_exact"] = "Publications & Research"
        if country:
            params["count_exact"] = country
        if since:
            params.update({"strdate": f"{since}-01-01", "enddate": "2100-12-31"})
        for os_ in range(0, 1000, 200):
            d = get(WORLDBANK, {**params, "os": os_})
            got = [(k, v) for k, v in (d.get("documents") or {}).items() if isinstance(v, dict) and v.get("display_title")]
            for k, v in got:
                docs.setdefault(k, v)
            if len(got) < 200:
                break
    out = []
    for k, v in docs.items():
        title = re.sub(r"\s+", " ", wb_text(v.get("display_title"))).strip()
        abstract = re.sub(r"\s+", " ", wb_text(v.get("abstracts"))).strip()
        countries = wb_text(v.get("count"))
        if not ok(f"{title} {abstract}"):   # the full-text search is noisy: the terms must be in the title or abstract
            continue
        year = (v.get("docdt") or "")[:4]
        out.append({"db": "worldbank", "id": k, "doi": "", "title": title, "year": int(year) if year.isdigit() else None,
                    "venue": "World Bank " + (v.get("docty") or "document"), "type": v.get("docty") or "",
                    "authors": [],
                    "abstract": short(abstract), "countries": countries[:120],
                    "landing_url": (v.get("url") or "").replace("http://", "https://"),
                    "oa_pdf_url": (v.get("pdfurl") or "").replace("http://", "https://"), "is_oa": bool(v.get("pdfurl")),
                    "cited_by_count": 0})
    json.dump(out, open(cp, "w"))
    return out[:limit]


# ---------- AEA RCT Registry ----------
def aea_rows():
    """The whole registry as a CSV (about 80 MB), downloaded at most once a week; an old copy is used if the download fails."""
    cp = cache_path("aearct.csv")
    fresh = os.path.exists(cp) and time.time() - os.path.getmtime(cp) < 7 * 86400
    if not fresh:
        try:
            req = urllib.request.Request(AEARCT_CSV, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=300) as r, open(cp + ".part", "wb") as f:
                while chunk := r.read(1 << 20):
                    f.write(chunk)
            if os.path.getsize(cp + ".part") > 1_000_000:
                os.replace(cp + ".part", cp)
        except Exception as e:  # noqa: BLE001
            if not os.path.exists(cp):
                raise RuntimeError(f"AEA RCT Registry download failed: {type(e).__name__}: {e}") from e
    if not os.path.exists(cp):
        raise RuntimeError("AEA RCT Registry download failed: the file was too small")
    csv.field_size_limit(1 << 30)
    with open(cp, encoding="utf-8", errors="replace", newline="") as f:
        yield from csv.DictReader(f)


EMAIL = re.compile(r"\S+@\S+")


def aea_search(query, since, limit):
    ok = matcher(query)
    out = []
    for r in aea_rows():
        g = lambda *ks: " ".join((r.get(k) or "") for k in ks)
        text = g("Title", "Abstract", "Keywords", "Intervention", "Primary outcome end points", "Country names", "Partners", "Sponsors")
        if not ok(text):
            continue
        years = [int(x[:4]) for x in (r.get("End date"), r.get("Start date"), r.get("First registered on")) if (x or "")[:4].isdigit()]
        if since and years and max(years) < since:
            continue
        pis = [re.sub(r"\s+", " ", EMAIL.sub("", p.split("(")[0])).strip() for p in [r.get("Primary Investigator") or ""] +
               (r.get("Other Primary Investigators") or "").split(";")]
        start = (r.get("Start date") or r.get("First registered on") or "")[:4]
        out.append({"db": "aearct", "id": r.get("RCT_ID") or "", "doi": bare_doi(r.get("DOI Number")),
                    "title": short(r.get("Title"), 400), "year": int(start) if start.isdigit() else None,
                    "venue": "AEA RCT Registry", "type": "trial registration", "status": r.get("Status") or "",
                    "authors": [p for p in pis if p][:4],
                    "abstract": short((r.get("Abstract") or "") + " Intervention: " + (r.get("Intervention") or "")),
                    "countries": (r.get("Country names") or "")[:120],
                    "papers": short(EMAIL.sub("", r.get("Relevant papers for csv") or ""), 400),
                    "landing_url": (r.get("Url") or "").replace("http://", "https://"),
                    "oa_pdf_url": "", "is_oa": True, "cited_by_count": 0})
        if len(out) >= limit:
            break
    return out


# ---------- where to get a paper's full text ----------
def resolve(doi="", url=""):
    """Europe PMC full-text XML (open access), open-access PDFs from OpenAlex and Europe PMC, and the abstract as a fallback."""
    url = url or ""
    doi = bare_doi(doi) or bare_doi((re.search(r"doi\.org/(10\.[^?#\s]+)", url) or [None, ""])[1])
    pmcid = (re.search(r"(PMC\d+)", url, re.I) or [None, ""])[1].upper()
    pmid = (re.search(r"pubmed\.ncbi\.nlm\.nih\.gov/(\d+)", url) or [None, ""])[1]
    out = {"doi": doi, "pmcid": pmcid, "pmid": pmid, "title": "", "abstract": "", "full_text": [], "errors": []}
    q = f'DOI:"{doi}"' if doi else f"PMCID:{pmcid}" if pmcid else f"EXT_ID:{pmid} AND SRC:MED" if pmid else ""
    if q:
        try:
            r = ((get(EUROPEPMC + "/search", {"query": q, "format": "json", "resultType": "core", "pageSize": 1}).get("resultList") or {}).get("result") or [None])[0]
            if r:
                out["pmcid"] = out["pmcid"] or (r.get("pmcid") or "")
                out["doi"] = out["doi"] or bare_doi(r.get("doi"))
                out["title"] = short(r.get("title"), 400)
                out["abstract"] = re.sub(r"<[^>]+>", " ", r.get("abstractText") or "").strip()
                if out["pmcid"] and (r.get("isOpenAccess") == "Y" or r.get("inEPMC") == "Y"):
                    out["full_text"].append({"url": f"{EUROPEPMC}/{out['pmcid']}/fullTextXML", "note": "Europe PMC open-access full text (XML)"})
                for u in ((r.get("fullTextUrlList") or {}).get("fullTextUrl")) or []:
                    if u.get("documentStyle") == "pdf" and u.get("availabilityCode") in ("OA", "F") and "europepmc.org" not in (u.get("url") or ""):
                        out["full_text"].append({"url": u["url"], "note": "open-access PDF (Europe PMC link)"})
        except Exception as e:  # noqa: BLE001
            out["errors"].append(f"europepmc: {type(e).__name__}: {e}"[:200])
    if out["doi"]:
        try:   # a single-work lookup does not count against the OpenAlex search budget
            w = get(OPENALEX + "/works/doi:" + urllib.parse.quote(out["doi"]), {"mailto": MAILTO})
            out["title"] = out["title"] or (w.get("display_name") or "")
            out["abstract"] = out["abstract"] or oa_abstract(w.get("abstract_inverted_index"))
            locs = [w.get("best_oa_location") or {}] + (w.get("locations") or [])
            for l in locs:
                if l.get("pdf_url") and l.get("is_oa", True):
                    out["full_text"].append({"url": l["pdf_url"], "note": "open-access PDF (" + ((l.get("source") or {}).get("display_name") or "OpenAlex") + ")"})
        except Exception as e:  # noqa: BLE001
            out["errors"].append(f"openalex: {type(e).__name__}: {e}"[:200])
    seen, ft = set(), []
    for f in out["full_text"]:
        if f["url"] not in seen:
            seen.add(f["url"]); ft.append(f)
    out["full_text"] = ft[:5]
    return out


def main():
    ap = argparse.ArgumentParser(prog="scholar", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("search"); s.add_argument("--db", required=True, choices=["openalex", "europepmc", "eric", "worldbank", "aearct"])
    s.add_argument("--query", required=True); s.add_argument("--since", type=int); s.add_argument("--limit", type=int, default=50)
    s.add_argument("--sort", choices=["relevance", "cited"], default="relevance")
    s.add_argument("--no-reviews", action="store_true"); s.add_argument("--anywhere", action="store_true")
    s.add_argument("--venues", default=""); s.add_argument("--country", default="", help="worldbank: documents tagged with this country")
    s.add_argument("--all-types", action="store_true", help="worldbank: all document types, not only Publications & Research")
    rv = sub.add_parser("resolve"); rv.add_argument("--doi", default=""); rv.add_argument("--url", default="")
    for c in ("refs", "citedby", "work"):
        p = sub.add_parser(c); p.add_argument("ref"); p.add_argument("--limit", type=int, default=100)
    a = ap.parse_args()
    try:
        if a.cmd == "search":
            if a.db == "openalex":
                rows = oa_search(a.query, a.since, a.limit, a.sort, a.no_reviews, a.anywhere, a.venues)
            elif a.db == "europepmc":
                rows = epmc_search(a.query, a.since, a.limit, a.sort, a.no_reviews)
            elif a.db == "worldbank":
                rows = wb_search(a.query, a.since, a.limit, a.country, a.all_types)
            elif a.db == "aearct":
                rows = aea_search(a.query, a.since, a.limit)
            else:
                rows = eric_search(a.query, a.since, a.limit)
        elif a.cmd == "resolve":
            rows = [resolve(a.doi, a.url)]
        elif a.cmd == "work":
            w = get(OPENALEX + "/works/" + (oa_id(a.ref)), {"mailto": MAILTO}); rows = [oa_record(w)]
        else:
            wid = oa_id(a.ref)
            if not wid:
                raise SystemExit(f"not found in OpenAlex: {a.ref}")
            rows = oa_works(("cited_by:" if a.cmd == "refs" else "cites:") + wid, "", a.limit)
    except Exception as e:  # noqa: BLE001 - report, never crash the agent
        print(json.dumps({"error": f"{type(e).__name__}: {e}"[:300]}), flush=True); sys.exit(2)
    for r in rows:
        print(json.dumps(r, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
