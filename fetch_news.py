import json
import re
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

OUTPUT_FILE = "news.json"

CATEGORY_QUERIES = {
    "Data Centers": [
        '"data center" cooling',
        '"liquid cooling" data center',
        '"data center" construction',
        '"hyperscale" data center',
    ],

    "Industrial Expansion": [
        '"manufacturing plant" expansion',
        '"new manufacturing facility"',
        '"plant expansion" manufacturing',
        '"industrial project" construction',
    ],

    "Energy & Process": [
        '"refinery expansion"',
        '"petrochemical" expansion',
        '"chemical plant" expansion',
        '"LNG project"',
    ],

    "Platform Watch": [
        '"Texcel"',
        '"Stainless Hose Fittings"',
        '"OmegaOne"',
        '"APG" seals industrial',
        '"Harbour Group" industrial',
    ],
}

HIGH_VALUE_TERMS = {
    "data center": 15,
    "liquid cooling": 12,
    "cooling": 7,
    "billion": 10,
    "million": 5,
    "investment": 8,
    "expansion": 9,
    "expand": 7,
    "construction": 8,
    "new facility": 10,
    "new plant": 10,
    "campus": 7,
    "capacity": 6,
    "manufacturing": 8,
    "refinery": 9,
    "petrochemical": 9,
    "chemical plant": 9,
    "lng": 8,
    "acquisition": 7,
    "acquires": 7,
    "contractor": 5,
    "project": 4,
    "texas": 4,
    "gulf coast": 5,
}

SALES_ANGLES = {
    "Data Centers":
        "Investigate cooling-system OEMs, mechanical contractors and operators "
        "for hose, fittings, couplings, seals and other fluid-handling requirements.",

    "Industrial Expansion":
        "Identify the plant owner, EPC/contractor and maintenance team, then evaluate "
        "new OEM, MRO, hose, fitting and fluid-transfer demand.",

    "Energy & Process":
        "Review process-fluid, transfer, stainless fitting, sealing and maintenance "
        "requirements tied to the project or facility expansion.",

    "Platform Watch":
        "Review for competitive, acquisition, product, channel or platform implications "
        "that could affect sales strategy.",
}


def clean_text(value):
    value = value or ""
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def normalize_title(title):
    title = clean_text(title).lower()
    title = re.sub(r"[^a-z0-9 ]+", " ", title)
    title = re.sub(r"\s+", " ", title)
    return title.strip()


def parse_date(value):
    if not value:
        return None

    try:
        dt = parsedate_to_datetime(value)

        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)

        return dt.astimezone(timezone.utc).isoformat()

    except Exception:
        return None


def score_article(title, category):
    text = f"{title} {category}".lower()

    score = 45

    for term, points in HIGH_VALUE_TERMS.items():
        if term in text:
            score += points

    if category == "Data Centers":
        score += 8

    elif category == "Industrial Expansion":
        score += 5

    elif category == "Energy & Process":
        score += 5

    return min(score, 99)


def google_news_rss(query):

    params = {
        "q": f"{query} when:7d",
        "hl": "en-US",
        "gl": "US",
        "ceid": "US:en",
    }

    url = (
        "https://news.google.com/rss/search?"
        + urllib.parse.urlencode(params)
    )

    request = urllib.request.Request(
        url,
        headers={
            "User-Agent":
                "Mozilla/5.0 "
                "(compatible; CemTexIntelligence/1.0)"
        },
    )

    with urllib.request.urlopen(
        request,
        timeout=20
    ) as response:

        data = response.read()

    root = ET.fromstring(data)

    items = []

    for item in root.findall("./channel/item"):

        title = clean_text(
            item.findtext("title")
        )

        link = clean_text(
            item.findtext("link")
        )

        pub_date = parse_date(
            item.findtext("pubDate")
        )

        source_node = item.find("source")

        source = clean_text(
            source_node.text
            if source_node is not None
            else ""
        )

        if not title or not link:
            continue

        items.append(
            {
                "title": title,
                "url": link,
                "source": source or "Google News",
                "published_at": pub_date,
            }
        )

    return items


def gather_news():

    collected = []

    for category, queries in CATEGORY_QUERIES.items():

        print(f"\nScanning: {category}")

        for query in queries:

            print(f"  Searching: {query}")

            try:
                articles = google_news_rss(query)

            except Exception as exc:

                print(f"  ERROR: {exc}")
                continue

            for article in articles[:12]:

                article["category"] = category

                article["score"] = score_article(
                    article["title"],
                    category
                )

                article["sales_angle"] = (
                    SALES_ANGLES[category]
                )

                article["matched_query"] = query

                collected.append(article)

            time.sleep(1)

    return collected


def deduplicate(articles):

    seen_links = set()
    seen_titles = set()

    unique = []

    for article in articles:

        link = article.get(
            "url",
            ""
        )

        title_key = normalize_title(
            article.get(
                "title",
                ""
            )
        )

        if not link or not title_key:
            continue

        if (
            link in seen_links
            or title_key in seen_titles
        ):
            continue

        seen_links.add(link)
        seen_titles.add(title_key)

        unique.append(article)

    return unique


def sort_articles(articles):

    def sort_key(article):

        published = (
            article.get(
                "published_at"
            )
            or ""
        )

        return (
            article.get(
                "score",
                0
            ),
            published
        )

    return sorted(
        articles,
        key=sort_key,
        reverse=True
    )


def main():

    articles = gather_news()

    articles = deduplicate(
        articles
    )

    articles = sort_articles(
        articles
    )

    articles = articles[:100]

    payload = {

        "generated_at":
            datetime.now(
                timezone.utc
            ).isoformat(),

        "article_count":
            len(articles),

        "high_priority_count":
            sum(
                1
                for article in articles
                if article["score"] >= 80
            ),

        "data_center_count":
            sum(
                1
                for article in articles
                if article["category"]
                == "Data Centers"
            ),

        "industrial_expansion_count":
            sum(
                1
                for article in articles
                if article["category"]
                == "Industrial Expansion"
            ),

        "articles":
            articles
    }

    with open(
        OUTPUT_FILE,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            payload,
            file,
            indent=2,
            ensure_ascii=False
        )

    print(
        f"\nSaved "
        f"{len(articles)} "
        f"articles to "
        f"{OUTPUT_FILE}"
    )


if __name__ == "__main__":
    main()
