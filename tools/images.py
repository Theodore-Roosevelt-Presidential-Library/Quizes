#!/usr/bin/env python3
"""
Image sourcing for the TRPL quiz platform.

The DAM is the first stop and always will be — it is curated and its records carry
the caveats that matter. But it is thin outside Roosevelt himself, and the roadmap
needs the Gilded Age, the Progressive era, other presidents, North Dakota, and the
natural world. So this falls through to the Library of Congress, which is public
domain and returns a rights statement with every record.

    python3 images.py search "1912 election cartoon"
    python3 images.py fetch <folder> slug=dam:<asset-id> slug=loc:<pk>

RULE: open every image before you use it. Titles lie. A promising LOC record has
already turned out to be a Puck cartoon about wind blowing hats off.
"""
import json, sys, os, io, urllib.request, urllib.parse

TRPL = os.environ.get("TRPL_ROOT", "/sessions/optimistic-inspiring-mayer/mnt/TRPL")
TOKEN_FILE = TRPL + "/Hootsuite/Trlibrary DAM Access Token.txt"
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {"User-Agent": "TRPL-quiz-platform/1.0"}

HAR = "Theodore Roosevelt Collection, Houghton Library, Harvard University."
LOC = "Library of Congress, Prints and Photographs Division."
NYPL = "The New York Public Library."


def dam_token():
    for line in open(TOKEN_FILE):
        line = line.strip()
        if line.startswith("trlibrary/"):
            return line


def dam_api(path, params=None):
    u = "https://api.widencollective.com/v2" + path
    if params:
        u += "?" + urllib.parse.urlencode(params)
    r = urllib.request.Request(u, headers={"Authorization": "Bearer " + dam_token()})
    return json.load(urllib.request.urlopen(r, timeout=90))


def dam_search(q, n=8):
    d = dam_api("/assets/search", {"query": q, "limit": n, "expand": "metadata"})
    out = []
    for i in d.get("items", []):
        m = (i.get("metadata") or {}).get("fields", {})
        out.append({"src": "dam", "id": i["id"], "file": i["filename"],
                    "title": (m.get("description") or [""])[0][:90]})
    return out


import re

# Theodore Roosevelt died in January 1919. Anything dated later is a different
# Roosevelt — and a search for "Roosevelt Christmas" or "Roosevelt birthday"
# returns overwhelmingly Franklin and Eleanor, correctly titled. Putting an FDR
# photograph on a T.R. presidential library quiz would be a real error, and the
# titles give no warning because they are not wrong, just about someone else.
TR_DIED = 1919


def year_of(datestr):
    """LOC writes inferred dates as "[19]39" and "[ca. 1902]", so the digits have
    to be normalised before any year can be read out of them."""
    d = re.sub(r"\[(\d\d)\](\d\d)", r"\1\2", datestr or "")   # [19]39 -> 1939
    d = d.replace("[", " ").replace("]", " ")
    # no \b: LOC writes "c1902" and "ca1902", where letter and digit are
    # both word characters and there is no boundary between them
    yrs = [int(y) for y in re.findall(r"(?<!\d)(1[6-9]\d\d|20\d\d)(?!\d)", d)]
    return min(yrs) if yrs else None


def loc_search(q, n=8, allow_late=False):
    u = "https://www.loc.gov/pictures/search/?" + urllib.parse.urlencode(
        {"q": q, "fo": "json", "c": n})
    d = json.load(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60))
    out = []
    for r in d.get("results", []):
        date = r.get("created_published_date") or ""
        y = year_of(date)
        late = y is not None and y > TR_DIED
        if late and not allow_late:
            continue
        out.append({"src": "loc", "id": r.get("pk"),
                    "title": (r.get("title") or "")[:90],
                    "date": date or "UNDATED - check before use",
                    "undated": y is None, "wrong_roosevelt": late,
                    "rights": (r.get("rights_information") or "")[:70],
                    "thumb": (r.get("image") or {}).get("full") or ""})
    return out


def loc_item(pk):
    """Resolve a LOC record to the largest available file."""
    u = "https://www.loc.gov/pictures/item/%s/?fo=json" % pk
    d = json.load(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60))
    it = d.get("item", {})
    urls = []
    # LOC returns several size keys per resource and some of them are placeholder
    # GIFs reading "not digitized" rather than the picture. Take them largest
    # first and drop anything that is not actually an image file - an hdl.loc.gov
    # handle is a landing page, not something PIL can open.
    def usable(u):
        if not isinstance(u, str) or not u.startswith("http"):
            return False
        if "notdig" in u or u.endswith(".gif") or "hdl.loc.gov" in u:
            return False
        return u.lower().endswith((".tif", ".tiff", ".jpg", ".jpeg", ".jp2", ".png"))

    for r in (d.get("resources") or []):
        for k in ("largest", "larger", "large", "medium", "fullsize", "image"):
            if usable(r.get(k)):
                urls.append(r[k])
    img = (it.get("image") or {})
    for k in ("full", "thumb"):
        if usable(img.get(k)):
            urls.append(img[k])
    if not urls:
        raise RuntimeError("no downloadable image on LOC record %s - it may not be "
                           "digitised at this resolution" % pk)
    return {"title": it.get("title", ""), "date": it.get("created_published_date", ""),
            "rights": it.get("rights_information") or it.get("rights_advisory") or "",
            "urls": urls}


def fetch(folder, pairs):
    from PIL import Image
    out_dir = os.path.join(BASE, "assets", "img", folder)
    os.makedirs(out_dir, exist_ok=True)
    cpath = os.path.join(out_dir, "credits.json")
    credits = json.load(open(cpath)) if os.path.exists(cpath) else {}

    for pair in pairs:
        slug, ref = pair.split("=", 1)
        src, ident = ref.split(":", 1)
        try:
            if src == "dam":
                d = dam_api("/assets/%s" % ident, {"expand": "embeds,metadata"})
                m = (d.get("metadata") or {}).get("fields", {})
                url = (d.get("embeds") or {}).get("original", {}).get("url")
                fn = d["filename"]
                coll = LOC if fn.startswith("loc_") else (NYPL if fn.startswith("nypl_") else HAR)
                desc = (m.get("description") or [""])[0]
                rights = (m.get("copyright") or [""])[0]
            else:
                it = loc_item(ident)
                y = year_of(it.get("date", ""))
                if y is not None and y > TR_DIED:
                    print("WARN %-30s dated %s — after T.R. died in 1919. "
                          "Almost certainly Franklin or Eleanor." % (slug, y))
                url, fn, coll = it["urls"][0], "loc_pictures_%s" % ident, LOC
                desc, rights = it["title"], it["rights"]

            raw = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300).read()
            im = Image.open(io.BytesIO(raw)).convert("RGB")
            w, h = im.size
            if w > 1400:
                im = im.resize((1400, int(h * 1400 / w)), Image.LANCZOS)
            im.save(os.path.join(out_dir, slug + ".jpg"), "JPEG",
                    quality=84, optimize=True, progressive=True)
            credits[slug] = {"source": src, "ref": ident, "source_file": fn,
                             "description": desc, "rights": rights,
                             "collection": coll, "px": "%dx%d" % im.size}
            print("ok   %-30s %-11s %s" % (slug, "%dx%d" % im.size, coll.split(",")[0]))
        except Exception as e:
            print("FAIL %-30s %s" % (slug, repr(e)[:90]))
    json.dump(credits, open(cpath, "w"), indent=1)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "help"
    if cmd == "search":
        for q in sys.argv[2:]:
            print("\n=== %s" % q)
            try:
                for r in dam_search(q, 5):
                    # print the full asset id - a truncated one cannot be pasted
                    # into the fetch command, which is the only reason to run search
                    print("  DAM %s" % r["id"])
                    print("      %-46s %s" % (r["file"][:46], r["title"][:60]))
            except Exception as e:
                print("  DAM failed:", repr(e)[:60])
            try:
                hits = loc_search(q, 12)
                if not hits:
                    print("  LOC: no pre-1919 results (later Roosevelts filtered out)")
                for r in hits[:6]:
                    print("  LOC %-8s | %-58s | %s" % (r["id"], r["title"][:58], r["date"][:12]))
            except Exception as e:
                print("  LOC failed:", repr(e)[:60])
    elif cmd == "fetch":
        fetch(sys.argv[2], sys.argv[3:])
    else:
        print(__doc__)
