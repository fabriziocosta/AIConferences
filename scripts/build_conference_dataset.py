from __future__ import annotations

import argparse
import json
import re
import time
from datetime import date
from pathlib import Path
from urllib.parse import quote

import pandas as pd
import requests
import yaml
from dateutil import parser as date_parser

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)

CCF_API_ROOT = "https://api.github.com/repos/ccfddl/ccf-deadlines/contents/conference"
SOURCE_FOLDERS = ["AI", "DB"]

TOP_TITLES = {
    "AAAI", "AAMAS", "ACL", "AISTATS", "BMVC", "CIKM", "COLM",
    "COLT", "CoNLL", "CoRL", "CVPR", "EACL", "ECCV", "EMNLP",
    "ICAPS", "ICDAR", "ICLR", "ICML", "ICRA", "ICDE", "ICDM",
    "IJCAI", "IROS", "KR", "NeurIPS", "SIGIR", "SIGKDD", "UAI",
    "WACV", "WSDM", "RSS", "RECSYS", "ECIR", "PAKDD", "SDM",
}

IMPORTANCE_OVERRIDES = {
    "NeurIPS": 10.0,
    "ICML": 9.6,
    "ICLR": 9.4,
    "CVPR": 9.2,
    "ACL": 8.8,
    "EMNLP": 8.4,
    "AAAI": 8.2,
    "IJCAI": 8.0,
    "ECCV": 8.0,
    "SIGKDD": 8.0,
    "ICRA": 7.8,
    "ICDE": 7.6,
    "SIGIR": 7.5,
    "AISTATS": 7.4,
    "COLT": 7.3,
    "UAI": 7.1,
    "CoRL": 7.0,
    "IROS": 6.9,
    "WSDM": 6.8,
    "CIKM": 6.7,
    "COLM": 6.7,
    "WACV": 6.5,
    "EACL": 6.4,
    "BMVC": 6.2,
    "AAMAS": 6.1,
    "RSS": 7.0,
}

RANK_IMPORTANCE = {"A*": 7.8, "A": 6.8, "B": 5.3, "C": 4.0, "N": 3.0}

KNOWN_COORDS = {
    "singapore": (1.3521, 103.8198, "Singapore", "Singapore"),
    "montréal": (45.5019, -73.5674, "Montréal", "Canada"),
    "montreal": (45.5019, -73.5674, "Montréal", "Canada"),
    "paphos": (34.7720, 32.4297, "Paphos", "Cyprus"),
    "san diego": (32.7157, -117.1611, "San Diego", "United States"),
    "morocco": (31.7917, -7.0926, "Morocco", "Morocco"),
    "rabat": (34.0209, -6.8416, "Rabat", "Morocco"),
    "toronto": (43.6532, -79.3832, "Toronto", "Canada"),
    "lancaster": (54.0466, -2.8007, "Lancaster", "United Kingdom"),
    "maastricht": (50.8514, 5.6910, "Maastricht", "Netherlands"),
    "san francisco": (37.7749, -122.4194, "San Francisco", "United States"),
    "tübingen": (48.5216, 9.0576, "Tübingen", "Germany"),
    "tubingen": (48.5216, 9.0576, "Tübingen", "Germany"),
    "denver": (39.7392, -104.9903, "Denver", "United States"),
    "malmö": (55.6050, 13.0038, "Malmö", "Sweden"),
    "malmo": (55.6050, 13.0038, "Malmö", "Sweden"),
    "budapest": (47.4979, 19.0402, "Budapest", "Hungary"),
    "bruges": (51.2093, 3.2247, "Bruges", "Belgium"),
    "luxembourg": (49.6116, 6.1319, "Luxembourg", "Luxembourg"),
    "kyoto": (35.0116, 135.7681, "Kyoto", "Japan"),
    "san josé": (9.9281, -84.0907, "San José", "Costa Rica"),
    "san jose": (9.9281, -84.0907, "San José", "Costa Rica"),
    "padua": (45.4064, 11.8768, "Padua", "Italy"),
    "dublin": (53.3498, -6.2603, "Dublin", "Ireland"),
    "bremen": (53.0793, 8.8017, "Bremen", "Germany"),
    "vienna": (48.2082, 16.3738, "Vienna", "Austria"),
    "rio de janeiro": (-22.9068, -43.1729, "Rio de Janeiro", "Brazil"),
    "brazil": (-22.9068, -43.1729, "Rio de Janeiro", "Brazil"),
    "seoul": (37.5665, 126.9780, "Seoul", "South Korea"),
    "melbourne": (-37.8136, 144.9631, "Melbourne", "Australia"),
    "lyon": (45.7640, 4.8357, "Lyon", "France"),
    "boca raton": (26.3683, -80.1289, "Boca Raton", "United States"),
    "rome": (41.9028, 12.4964, "Rome", "Italy"),
    "hengqin": (22.1194, 113.5439, "Hengqin", "China"),
    "pittsburgh": (40.4406, -79.9959, "Pittsburgh", "United States"),
    "lisbon": (38.7223, -9.1393, "Lisbon", "Portugal"),
    "beijing": (39.9042, 116.4074, "Beijing", "China"),
    "sydney": (-33.8688, 151.2093, "Sydney", "Australia"),
    "macau": (22.1987, 113.5439, "Macau", "China"),
    "trento": (46.0748, 11.1217, "Trento", "Italy"),
    "guangzhou": (23.1291, 113.2644, "Guangzhou", "China"),
    "vilnius": (54.6872, 25.2797, "Vilnius", "Lithuania"),
    "amsterdam": (52.3676, 4.9041, "Amsterdam", "Netherlands"),
    "tucson": (32.2226, -110.9747, "Tucson", "United States"),
    "boise": (43.6150, -116.2023, "Boise", "United States"),
    "jeju": (33.4996, 126.5312, "Jeju", "South Korea"),
    "copenhagen": (55.6761, 12.5683, "Copenhagen", "Denmark"),
}

WIKIPEDIA_IMAGE_PAGES = {
    "singapore": "Marina Bay Sands",
    "boise": "Boise, Idaho",
    "tucson": "Tucson, Arizona",
    "morocco": "Rabat",
    "rabat": "Rabat",
    "delft": "Delft",
    "rio de janeiro": "Rio de Janeiro",
    "montréal": "Montreal",
    "montreal": "Montreal",
    "paphos": "Paphos",
    "vienna": "Vienna",
    "denver": "Denver",
    "hong kong": "Hong Kong",
    "dublin": "Dublin",
    "san diego": "San Diego",
    "seoul": "Seoul",
    "sydney": "Sydney",
    "melbourne": "Melbourne",
    "lisbon": "Lisbon",
    "jeju": "Jeju Island",
    "bremen": "Bremen",
    "amsterdam": "Amsterdam",
    "malmö": "Malmö",
    "malmo": "Malmö",
    "pittsburgh": "Pittsburgh",
    "san francisco": "San Francisco",
    "budapest": "Budapest",
    "rome": "Rome",
    "austin": "Austin, Texas",
    "shenyang": "Shenyang",
    "沈阳市": "Shenyang",
    "lancaster": "Lancaster, Lancashire",
    "copenhagen": "Copenhagen",
}

COLUMNS = [
    "id", "title", "full_name", "year", "subfield", "rank", "importance", "link", "source",
    "deadline", "abstract_deadline", "deadline_timezone",
    "event_start", "event_end", "date_text",
    "place", "city", "country", "latitude", "longitude", "image_url",
    "deadline_status", "event_status", "notes",
]

MONTH_RE = re.compile(
    r"\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|"
    r"Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b",
    re.IGNORECASE,
)


def fetch_yaml_files(folder: str) -> list[dict]:
    response = requests.get(f"{CCF_API_ROOT}/{folder}?ref=main", timeout=30)
    response.raise_for_status()
    files = response.json()
    rows = []
    for file_info in files:
        if not file_info["name"].endswith((".yml", ".yaml")):
            continue
        raw = requests.get(file_info["download_url"], timeout=30)
        raw.raise_for_status()
        try:
            docs = yaml.safe_load(raw.text) or []
        except yaml.YAMLError as exc:
            print(f"Skipping {file_info['path']}: {exc}")
            continue
        for doc in docs:
            doc["_source_path"] = file_info["path"]
            rows.append(doc)
    return rows


def first_timeline(conference: dict) -> dict:
    timeline = conference.get("timeline") or []
    return timeline[-1] if timeline else {}


def clean_date(value) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    return "TBD" if text.upper() == "TBD" else text


def date_only(value: str) -> str:
    value = clean_date(value)
    if not value or value == "TBD":
        return value
    return value.split()[0]


def iso_date(dt) -> str:
    return dt.date().isoformat()


def parse_event_range(date_text: str, fallback_year: int) -> tuple[str, str]:
    text = clean_date(date_text)
    if not text or text == "TBD":
        return "", ""

    text = text.replace("–", "-").replace("—", "-")
    text = re.sub(r"\bSept\b", "Sep", text)
    year_match = re.search(r"(20\d{2})", text)
    year = int(year_match.group(1)) if year_match else int(fallback_year)
    body = re.sub(r",?\s*20\d{2}.*$", "", text).strip(" .,")

    try:
        if "-" not in body:
            dt = date_parser.parse(f"{body} {year}", fuzzy=True, default=date_parser.parse(f"Jan 1 {year}"))
            return iso_date(dt), iso_date(dt)

        left, right = [part.strip(" .,()") for part in body.split("-", 1)]
        start_dt = date_parser.parse(f"{left} {year}", fuzzy=True, default=date_parser.parse(f"Jan 1 {year}"))
        if MONTH_RE.search(right):
            end_dt = date_parser.parse(f"{right} {year}", fuzzy=True, default=date_parser.parse(f"Jan 1 {year}"))
        else:
            month_name = start_dt.strftime("%B")
            end_dt = date_parser.parse(
                f"{month_name} {right} {year}",
                fuzzy=True,
                default=date_parser.parse(f"Jan 1 {year}"),
            )
            if end_dt < start_dt:
                end_dt = date_parser.parse(f"{month_name} {right} {year + 1}", fuzzy=True)
        return iso_date(start_dt), iso_date(end_dt)
    except (ValueError, TypeError, OverflowError):
        return "", ""


def rank_label(rank: dict | None) -> str:
    rank = rank or {}
    for key in ["ccf", "core", "thcpl"]:
        if rank.get(key):
            return str(rank[key])
    return ""


def importance_for(title: str, rank: str) -> float:
    if title in IMPORTANCE_OVERRIDES:
        return IMPORTANCE_OVERRIDES[title]
    return RANK_IMPORTANCE.get(rank, 4.5)


def infer_subfield(title: str, default: str) -> str:
    mapping = {
        "CVPR": "CV", "ECCV": "CV", "WACV": "CV", "BMVC": "CV", "ICDAR": "CV",
        "ACL": "NLP", "EMNLP": "NLP", "EACL": "NLP", "CoNLL": "NLP", "COLM": "NLP",
        "ICRA": "RO", "IROS": "RO", "RSS": "RO", "CoRL": "RO",
        "SIGKDD": "DM", "SIGIR": "IR", "WSDM": "DM", "CIKM": "DM", "ICDE": "DB",
    }
    return mapping.get(title, default or "AI/ML")


def normalize_title(title: str) -> str:
    return "NeurIPS" if title == "NIPS" else title


def parse_records(years: set[int]) -> pd.DataFrame:
    records = []
    for folder in SOURCE_FOLDERS:
        for entry in fetch_yaml_files(folder):
            title = normalize_title(entry.get("title", ""))
            if title not in TOP_TITLES:
                continue
            rank = rank_label(entry.get("rank"))
            for conf in entry.get("confs", []) or []:
                if conf.get("year") not in years:
                    continue
                timeline = first_timeline(conf)
                deadline = clean_date(timeline.get("deadline"))
                abstract_deadline = clean_date(timeline.get("abstract_deadline"))
                event_start = date_only(conf.get("start", ""))
                event_end = date_only(conf.get("end", ""))
                if not event_start:
                    event_start, event_end = parse_event_range(conf.get("date", ""), conf.get("year"))
                records.append({
                    "id": conf.get("id") or f"{title.lower()}{conf.get('year')}",
                    "title": title,
                    "full_name": entry.get("description", title),
                    "year": conf.get("year"),
                    "subfield": infer_subfield(title, entry.get("sub", "")),
                    "rank": rank,
                    "importance": importance_for(title, rank),
                    "link": conf.get("link", ""),
                    "source": f"CCF Deadlines:{entry.get('_source_path')}",
                    "deadline": deadline,
                    "abstract_deadline": abstract_deadline,
                    "deadline_timezone": conf.get("timezone", ""),
                    "event_start": event_start,
                    "event_end": event_end,
                    "date_text": conf.get("date", ""),
                    "place": conf.get("place", ""),
                    "deadline_status": "TBD" if deadline == "TBD" else ("known" if deadline else "missing"),
                    "event_status": "TBD" if event_start == "TBD" else ("known" if event_start else "missing"),
                    "notes": timeline.get("comment", ""),
                })
    df = pd.DataFrame(records)
    return df.sort_values(["year", "importance", "title"], ascending=[True, False, True]).reset_index(drop=True)


def load_geocode_cache() -> dict:
    cache_path = DATA_DIR / "geocode_cache.json"
    if cache_path.exists():
        return json.loads(cache_path.read_text())
    return {}


def save_geocode_cache(cache: dict) -> None:
    cache_path = DATA_DIR / "geocode_cache.json"
    cache_path.write_text(json.dumps(cache, indent=2, sort_keys=True))


def normalize_place_key(place: str) -> str:
    text = (place or "").lower()
    text = text.replace("united states", "usa")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def known_geocode(place: str):
    key = normalize_place_key(place)
    if not key or "virtual" in key or "online" == key:
        return None
    for needle, value in KNOWN_COORDS.items():
        if needle in key:
            lat, lon, city, country = value
            return {"latitude": lat, "longitude": lon, "city": city, "country": country}
    return None


def nominatim_geocode(place: str, cache: dict):
    key = normalize_place_key(place)
    if not key:
        return None
    if key in cache:
        return cache[key]

    response = requests.get(
        "https://nominatim.openstreetmap.org/search",
        params={"q": place, "format": "jsonv2", "limit": 1, "addressdetails": 1},
        headers={"User-Agent": "AIConferenceGlobe/1.0 contact: dataset-script"},
        timeout=20,
    )
    if not response.ok or not response.json():
        cache[key] = None
        return None

    item = response.json()[0]
    address = item.get("address", {})
    result = {
        "latitude": float(item["lat"]),
        "longitude": float(item["lon"]),
        "city": address.get("city") or address.get("town") or address.get("state") or "",
        "country": address.get("country", ""),
    }
    cache[key] = result
    time.sleep(1.0)
    return result


def geocode_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    cache = load_geocode_cache()
    enriched = []
    for row in df.to_dict(orient="records"):
        geo = known_geocode(row["place"]) or nominatim_geocode(row["place"], cache)
        row.update(geo or {"latitude": "", "longitude": "", "city": "", "country": ""})
        enriched.append(row)
    save_geocode_cache(cache)
    return pd.DataFrame(enriched)


def image_query_value(value) -> str:
    if value is None or pd.isna(value):
        return ""
    return str(value).strip()


def wikipedia_page_for(row: pd.Series) -> str:
    candidates = [
        image_query_value(row.get("city")),
        image_query_value(row.get("place")).split(",")[0].strip(),
        image_query_value(row.get("country")),
    ]
    for candidate in candidates:
        key = candidate.lower()
        if key in WIKIPEDIA_IMAGE_PAGES:
            return WIKIPEDIA_IMAGE_PAGES[key]
    return candidates[0] or candidates[1] or candidates[2] or "Conference"


def wikipedia_thumbnail_url(page_title: str) -> str:
    try:
        response = requests.get(
            "https://en.wikipedia.org/api/rest_v1/page/summary/" + quote(page_title, safe=""),
            timeout=12,
            headers={"User-Agent": "AIConferenceGlobe/1.0 dataset-script"},
        )
        response.raise_for_status()
        data = response.json()
        return data.get("thumbnail", {}).get("source", "") or data.get("originalimage", {}).get("source", "")
    except Exception as exc:
        print(f"Image lookup failed for {page_title}: {exc}")
        return ""


def add_image_urls(df: pd.DataFrame) -> pd.DataFrame:
    cache = {}

    def stock_image_url(row: pd.Series) -> str:
        page = wikipedia_page_for(row)
        if page not in cache:
            cache[page] = wikipedia_thumbnail_url(page)
        return cache[page]

    df = df.copy()
    df["image_url"] = df.apply(stock_image_url, axis=1)
    return df


def build_dataset(current_year: int) -> pd.DataFrame:
    years = {current_year, current_year + 1}
    df = parse_records(years)
    df = geocode_dataframe(df)
    df = add_image_urls(df)
    output = df[COLUMNS].copy()
    output["importance"] = output["importance"].round(1)
    return output.sort_values(["year", "event_start", "importance"], ascending=[True, True, False])


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build data/conferences.csv for the AI conference globe.")
    parser.add_argument(
        "--current-year",
        type=int,
        default=date.today().year,
        help="First conference year to include. The script also includes current-year + 1.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DATA_DIR / "conferences.csv",
        help="CSV output path.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output = build_dataset(args.current_year)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    output.to_csv(args.output, index=False)
    print(f"Wrote {len(output)} rows to {args.output}")
    print(f"Mapped rows: {output['latitude'].ne('').sum()}")
    print(f"Image URLs: {output['image_url'].astype(bool).sum()}")


if __name__ == "__main__":
    main()
