#!/usr/bin/env python3
"""Agrega noticias de series y cine desde feeds RSS/Atom y genera data/news.json.

Lo ejecuta GitHub Actions cada hora (.github/workflows/news.yml). Solo usa la
librería estándar, así que no necesita claves ni dependencias.
"""
import email.utils
import hashlib
import html
import json
import re
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

# (id, nombre, idioma, url, filtrar_por_palabras_clave, categoría: series | cine | plataformas | mixto)
SOURCES = [
    # Series
    ("decider", "Decider", "en", "https://decider.com/feed/", False, "plataformas"),
    ("variety", "Variety TV", "en", "https://variety.com/v/tv/feed/", False, "series"),
    ("tvline", "TVLine", "en", "https://tvline.com/feed/", False, "series"),
    ("thr", "The Hollywood Reporter", "en", "https://www.hollywoodreporter.com/c/tv/feed/", False, "series"),
    ("collider", "Collider TV", "en", "https://collider.com/feed/category/tv/", False, "series"),
    ("screenrant", "Screen Rant TV", "en", "https://screenrant.com/feed/tv/", False, "series"),
    ("cbr", "CBR", "en", "https://www.cbr.com/feed/category/tv/", False, "series"),
    ("tvinsider", "TV Insider", "en", "https://www.tvinsider.com/feed/", False, "series"),
    ("guardian", "The Guardian", "en", "https://www.theguardian.com/tv-and-radio/rss", False, "series"),
    ("bbc", "BBC", "en", "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml", True, "mixto"),
    ("sensacine", "SensaCine Series", "es", "https://www.sensacine.com/rss/noticias-series.xml", False, "series"),
    ("vertele", "Vertele", "es", "https://vertele.eldiario.es/rss/", False, "series"),
    ("elpais", "El País", "es", "https://elpais.com/rss/cultura/television.xml", False, "series"),
    # Cine
    ("variety-film", "Variety Cine", "en", "https://variety.com/v/film/feed/", False, "cine"),
    ("thr-movies", "THR Cine", "en", "https://www.hollywoodreporter.com/c/movies/feed/", False, "cine"),
    ("collider-movies", "Collider Cine", "en", "https://collider.com/feed/category/movies/", False, "cine"),
    ("screenrant-movies", "Screen Rant Cine", "en", "https://screenrant.com/feed/movies/", False, "cine"),
    ("slashfilm", "/Film", "en", "https://www.slashfilm.com/feed/", False, "mixto"),
    ("cinemablend", "CinemaBlend", "en", "https://www.cinemablend.com/rss/topic/news/movies", False, "cine"),
    ("sensacine-cine", "SensaCine Cine", "es", "https://www.sensacine.com/rss/noticias-cine.xml", False, "cine"),
    ("fotogramas", "Fotogramas", "es", "https://www.fotogramas.es/rss/all.xml/", False, "mixto"),
    ("cinemania", "Cinemanía", "es", "https://www.20minutos.es/rss/cinemania/", False, "mixto"),
    ("espinof", "Espinof", "es", "https://www.espinof.com/feedburner.xml", False, "mixto"),
    # Plataformas y streaming
    ("whatsonnetflix", "What's on Netflix", "en", "https://www.whats-on-netflix.com/feed/", False, "plataformas"),
    ("whatsondisney", "What's on Disney+", "en", "https://whatsondisneyplus.com/feed/", False, "plataformas"),
    ("cordcutters", "Cord Cutters News", "en", "https://cordcuttersnews.com/feed/", False, "plataformas"),
    ("xataka", "Xataka", "es", "https://www.xataka.com/feedburner.xml", True, "plataformas"),
]

PLATFORM_RE = re.compile(r"\b(netflix|hbo|max\b|disney\+?|prime video|amazon|apple tv|movistar|filmin|skyshowtime|paramount\+?|peacock|hulu|streaming|plataforma|suscripci|subscription)", re.I)
SERIES_RE = re.compile(r"\b(serie|series|temporada|season|episod|showrunner|renew|renuev|cancel|miniserie|tv show|sitcom)", re.I)
FILM_RE = re.compile(r"\b(película|pelicula|film|movie|cine|taquilla|box office|director|oscar|festival|estreno en cines|trailer)", re.I)

KEYWORDS = re.compile(
    r"\b(serie|series|temporada|season|episod|netflix|hbo|max|disney|prime video|apple tv|movistar|filmin|"
    r"skyshowtime|streaming|showrunner|tráiler|trailer|tv|televisi|renew|cancel|estreno|premiere)",
    re.I,
)

NS = {
    "media": "http://search.yahoo.com/mrss/",
    "content": "http://purl.org/rss/1.0/modules/content/",
    "atom": "http://www.w3.org/2005/Atom",
    "dc": "http://purl.org/dc/elements/1.1/",
}
UA = "Mozilla/5.0 (compatible; TVDaily-news/1.0; +https://github.com/wilderwests/TVDaily)"
PER_SOURCE = 20
MAX_ITEMS = 500


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/rss+xml, application/xml, text/xml, */*"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read()


def text(el):
    return (el.text or "").strip() if el is not None else ""


def clean(s, limit=320):
    s = re.sub(r"<[^>]+>", " ", s or "")
    s = html.unescape(s)
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"(The post .* appeared first on .*|La entrada .* se publicó primero en .*)$", "", s).strip()
    return (s[: limit - 1] + "…") if len(s) > limit else s


def parse_date(s):
    if not s:
        return 0
    try:
        return int(email.utils.parsedate_to_datetime(s).timestamp())
    except Exception:
        pass
    try:
        return int(datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp())
    except Exception:
        return 0


def first_img(*htmls):
    for h in htmls:
        m = re.search(r"<img[^>]+src=[\"']([^\"']+)", h or "", re.I)
        if m and not m.group(1).startswith("data:"):
            return html.unescape(m.group(1))
    return ""


def image_of(item):
    for tag in ("media:content", "media:thumbnail"):
        for el in item.findall(tag, NS):
            url = el.get("url")
            if url and (el.get("medium") in (None, "image") or re.search(r"\.(jpe?g|png|webp)", url, re.I)):
                return url
    for el in item.findall("media:group/media:content", NS):
        if el.get("url"):
            return el.get("url")
    enc = item.find("enclosure")
    if enc is not None and (enc.get("type") or "").startswith("image"):
        return enc.get("url")
    return first_img(text(item.find("content:encoded", NS)), text(item.find("description")))


def classify(cat, text):
    if cat != "mixto":
        return cat
    if PLATFORM_RE.search(text) and not FILM_RE.search(text):
        return "plataformas"
    if SERIES_RE.search(text):
        return "series"
    return "cine"


def parse_feed(src):
    sid, name, lang, url, filt, cat = src
    try:
        root = ET.fromstring(fetch(url))
    except Exception as e:
        print(f"[news] {name}: {e}", file=sys.stderr)
        return []
    out = []
    items = root.findall("./channel/item") or root.findall("atom:entry", NS)
    for it in items[:PER_SOURCE * 2]:
        is_atom = it.tag.endswith("entry")
        title = clean(text(it.find("atom:title", NS) if is_atom else it.find("title")), 220)
        if is_atom:
            link_el = it.find("atom:link[@rel='alternate']", NS) or it.find("atom:link", NS)
            link = link_el.get("href") if link_el is not None else ""
            date = parse_date(text(it.find("atom:updated", NS)) or text(it.find("atom:published", NS)))
            summary = clean(text(it.find("atom:summary", NS)) or text(it.find("atom:content", NS)))
        else:
            link = text(it.find("link"))
            date = parse_date(text(it.find("pubDate")) or text(it.find("dc:date", NS)))
            summary = clean(text(it.find("description")) or text(it.find("content:encoded", NS)))
        if not title or not link:
            continue
        if filt and not KEYWORDS.search(title + " " + summary):
            continue
        img = image_of(it) if not is_atom else first_img(text(it.find("atom:content", NS)))
        out.append({
            "id": hashlib.sha1(link.encode()).hexdigest()[:12],
            "title": title,
            "link": link,
            "source": sid,
            "sourceName": name,
            "lang": lang,
            "cat": classify(cat, title + " " + summary),
            "date": date,
            "summary": summary,
            "image": img.replace("http://", "https://", 1) if img else "",
        })
        if len(out) >= PER_SOURCE:
            break
    print(f"[news] {name}: {len(out)}", file=sys.stderr)
    return out


def main():
    with ThreadPoolExecutor(max_workers=8) as ex:
        results = list(ex.map(parse_feed, SOURCES))
    seen, items = set(), []
    for it in sorted((x for r in results for x in r), key=lambda x: -x["date"]):
        key = re.sub(r"\W+", "", it["title"].lower())[:80]
        if key in seen or it["link"] in seen:
            continue
        seen.update({key, it["link"]})
        items.append(it)
    items = items[:MAX_ITEMS]
    active = {i["source"] for i in items}
    data = {
        "generatedAt": int(time.time()),
        "sources": [{"id": s[0], "name": s[1], "lang": s[2], "cat": s[5]} for s in SOURCES if s[0] in active],
        "items": items,
    }
    out = Path(__file__).resolve().parent.parent / "data" / "news.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"[news] {len(items)} noticias de {len(active)} fuentes → {out}", file=sys.stderr)


if __name__ == "__main__":
    main()
