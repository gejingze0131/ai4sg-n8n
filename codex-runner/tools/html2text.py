#!/usr/bin/env python3
"""html2text: readable text of a saved web page (main content only), for reading and for quote checking.
Usage: html2text page.html > page.txt
Keeps <article> or <main> when the page has one, otherwise <body>; drops scripts, styles, navigation, headers,
footers, sidebars and forms. Block elements become line breaks."""
import html, re, sys
from html.parser import HTMLParser

DROP = {"script", "style", "noscript", "nav", "header", "footer", "aside", "form", "svg", "iframe", "button", "template"}
BLOCK = {"p", "div", "section", "article", "main", "br", "li", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6", "tr", "table",
         "blockquote", "pre", "figcaption", "dd", "dt"}
VOID = {"br", "img", "hr", "meta", "link", "input", "source", "wbr", "area", "base", "col", "embed", "param", "track"}


XML_BLOCK = {"title", "sec", "abstract", "article-title", "label", "caption", "ref", "fig", "table-wrap", "list-item", "kwd-group",
             "contrib-group", "aff", "fn", "def-item", "disp-quote", "td", "th"}


class P(HTMLParser):
    def __init__(self, xml=False):
        super().__init__(convert_charrefs=True)
        self.xml = xml
        self.stack, self.parts = [], {"article": [], "main": [], "body": [], "all": []}
        self.drop = 0
        self.title = ""
        self._in_title = False

    def handle_starttag(self, tag, attrs):
        if self.xml and tag in XML_BLOCK:
            self._add("\n")
        if tag == "title" and not self.xml:
            self._in_title = True
        if tag in VOID:
            if tag == "br":
                self._add("\n")
            return
        self.stack.append(tag)
        if tag in DROP:
            self.drop += 1
        if tag in BLOCK:
            self._add("\n")

    def handle_endtag(self, tag):
        if self.xml and tag in XML_BLOCK:
            self._add("\n")
        if tag == "title":
            self._in_title = False
        if tag in VOID or tag not in self.stack:
            return
        while self.stack:
            t = self.stack.pop()
            if t in DROP:
                self.drop -= 1
            if t == tag:
                break
        if tag in BLOCK:
            self._add("\n")

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        self._add(data)

    def _add(self, s):
        if self.drop:
            return
        self.parts["all"].append(s)
        for k in ("article", "main", "body"):
            if k in self.stack:
                self.parts[k].append(s)


def clean(chunks):
    t = "".join(chunks)
    t = re.sub(r"[ \t\r\f\v ]+", " ", t)
    t = re.sub(r" *\n *", "\n", t)
    return re.sub(r"\n{3,}", "\n\n", t).strip()


def main():
    raw = open(sys.argv[1], "rb").read()
    m = re.search(rb'charset=["\']?([\w-]+)', raw[:4000], re.I)
    enc = (m.group(1).decode() if m else "utf-8")
    try:
        doc = raw.decode(enc, errors="replace")
    except LookupError:
        doc = raw.decode("utf-8", errors="replace")
    # journal full text in JATS XML (Europe PMC): section titles are headings, not the page title
    p = P(xml=sys.argv[1].lower().endswith(".xml") or doc.lstrip().startswith("<?xml")); p.feed(doc); p.close()
    for k in ("article", "main", "body", "all"):
        text = clean(p.parts[k])
        if len(text) >= 200 or k == "all":
            break
    title = html.unescape(re.sub(r"\s+", " ", p.title)).strip()
    sys.stdout.write((title + "\n\n" if title and not text.startswith(title) else "") + text + "\n")


if __name__ == "__main__":
    main()
