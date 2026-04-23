# AI Conference Globe

Interactive static visualization for 2026 and 2027 AI/ML conference locations, deadlines, and event dates.

## Live demo

The GitHub Pages deployment is available at:

https://fabriziocosta.github.io/AIConferences/

## Run the visualization

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/`.

## Rebuild the dataset

```bash
python3 scripts/build_conference_dataset.py --current-year 2026
```

The script fetches structured CCF Deadlines YAML, filters top academic AI/ML and adjacent venues, geocodes venues with a local cache plus Nominatim fallback, adds direct Wikimedia location image URLs, and writes `data/conferences.csv`.

## Files

- `index.html`, `styles.css`, `app.js`: static browser app.
- `scripts/build_conference_dataset.py`: scriptable data collection and CSV build pipeline.
- `notebooks/build_conference_dataset.ipynb`: exploratory notebook version of the data build.
- `data/conferences.csv`: visualization dataset.
- `data/geocode_cache.json`: cached fallback geocoder responses.
