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
jupyter nbconvert --to notebook --execute --inplace notebooks/build_conference_dataset.ipynb
```

The notebook fetches structured CCF Deadlines YAML, filters top academic AI/ML and adjacent venues, geocodes venues with a local cache plus Nominatim fallback, adds deterministic location image URLs, and writes `data/conferences.csv`.

## Files

- `index.html`, `styles.css`, `app.js`: static browser app.
- `notebooks/build_conference_dataset.ipynb`: data collection and CSV build notebook.
- `data/conferences.csv`: visualization dataset.
- `data/geocode_cache.json`: cached fallback geocoder responses.
