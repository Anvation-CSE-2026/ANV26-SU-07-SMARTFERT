# ST-01 backend (Flask)

    pip install -r requirements.txt
    python train.py            # optional: models auto-train on first start if models/ is missing
    python app.py              # http://localhost:5000
    python -m pytest -q tests  # growing test suite (started at 24, see CI output for current count)
    Render: Procfile -> gunicorn "app:create_app()"

## Environment variables
    DATABASE_URL            default sqlite:///st01.db (use Postgres in production - Render's free
                             disk is ephemeral and a sqlite file there will not survive a redeploy)
    ST01_ADMIN_TOKEN         required to call /api/admin/* endpoints once they exist; unset = disabled
    FEATURE_HISTORY          default on - local-only (My Season / history), no external key needed
    FEATURE_FEEDBACK         default on - local-only (feedback-loop learning), no external key needed
    FEATURE_CHAT             default off - needs ANTHROPIC_API_KEY + ST01_LLM_MODEL to do anything useful
    FEATURE_SATELLITE        default off - set SAT_PROVIDER=demo|copernicus|earthengine|planetary + that
                             provider's keys; "demo" needs no keys at all
    ANTHROPIC_API_KEY, ST01_LLM_MODEL   optional LLM wording polish (st01/services/wording.py) and chat

Every flagged feature degrades gracefully (a clear "not available" response, never a crash) when its
flag, key or network dependency is missing.

## Layout
    app.py                      routes, CORS, JSON errors
    train.py                    trains models on data/*.csv and writes models/metrics.json
    data/                       ALL thresholds, crop table, prices, rules, weights, templates (synthetic / assumptions, editable)
    st01/config.py              loads the CSVs
    st01/pipeline.py            S1..S12: validate -> rate -> early-warning + cross-check (report wins) -> no-deficiency branch
                                -> dose -> weather/trend rules -> risk loop-back -> LP cost plans -> yield range -> sustainability -> explain
    st01/services/rules.py      rating, nutrient balance (STCR-style), bounded rule engine (reads nutrient_weather_rules.csv)
    st01/services/ml.py         RandomForest early warning, XGBoost yield + split-conformal 80% interval + SHAP, crop recommender
    st01/services/optimizer.py  linprog cheapest plan (+10% over-supply cap), INM plans, price-forecast alternative
    st01/services/trends.py     Mann-Kendall + Sen slope, anomaly z, CUSUM, Holt-Winters price forecast
    st01/services/risk.py       risk score + loop-back, sustainability (environmental + balanced score)
    st01/services/weather.py    Open-Meteo -> NASA POWER -> district averages (offline)
    st01/services/soil.py       SoilGrids pH/OC/texture (no P/K) -> district defaults
    st01/services/ocr.py        stretch: parse soil report text/PDF
    st01/services/wording.py    optional LLM rephrase (needs ANTHROPIC_API_KEY + ST01_LLM_MODEL), number-preservation guardrail
    st01/services/confidence.py 0-100 heuristic confidence score (data quality, model agreement, interval
                                tightness, in-distribution check, feedback support, satellite agreement);
                                capped at 90 until real verified feedback exists (data/confidence_weights.csv)
    st01/services/history.py    season assignment (data/seasons.csv), split-dose application timeline,
                                and lazy per-client demo-history seeding so a new client's history is never empty
    st01/services/chat.py       chatbot: grounds every answer in ONE stored recommendation's own numbers plus
                                data/knowledge/*.json; calls the Anthropic Messages API when ANTHROPIC_API_KEY +
                                ST01_LLM_MODEL are set, verified by a number-subset guardrail (no invented doses
                                or prices survive); otherwise (or if the guardrail trips) falls back to a
                                template-based intent matcher that needs no network and no key at all
    st01/db.py                  SQLAlchemy models: clients, fields, recommendations, applications, feedback,
                                calibration, chat_messages, satellite_cache - every row scoped to an anonymous
                                X-Client-Id (UUID header), never a name/phone/exact address

## Privacy
Every client is identified only by an anonymous UUID (`X-Client-Id` header; the backend assigns one if
missing). `GET /api/me` returns that client's profile, `POST /api/me/consent` toggles anonymised-feedback
sharing, and `DELETE /api/me` permanently removes every row tied to that client (fields, recommendations,
applications, feedback, chat messages). One client can never read, edit or delete another client's data -
a request for someone else's row 404s ("no such recommendation"), it never reveals whether it exists.

## API
    GET  /api/health | /api/meta | /api/model-info | /api/scenarios
    GET  /api/context?lat=&lon=            district + weather + soil estimate + climate trend (pre-fill the form)
    GET  /api/weather?lat=&lon=            GET /api/climate-trend?district=      GET /api/price-trend?fertilizer=
    GET  /api/me | DELETE /api/me | POST /api/me/consent {consent_sharing, language}
    POST /api/recommend                    body: crop, N, P, K (required) + district or lat/lon; optional texture, pH, OC,
                                           rain30, rain90, rain48, temp, target, objective (cheapest|balanced_inm|eco_inm),
                                           dap_change, urea_change, price_changes{fert:pct}, polish, language,
                                           save (persist to history), field_id, soil_report_age_years
                                           -> adds `confidence` (score/band/components/how_to_improve) to the
                                           usual response, and `recommendation_id` when save=true
    POST /api/compare                      body: {A:{...}, B:{...}}  -> both results + why_it_changed
    POST /api/crop-recommend               body: district, N, P, K, (pH, temp, humidity, rainfall)
    POST /api/parse-report                 body: {text} or multipart file (PDF)
    GET  /api/history?season=&crop=&field_id=     this client's saved recommendations (seeds 3 demo rows,
                                                  clearly marked simulated=true, the first time it's ever empty)
    GET  /api/history/<id>                        one recommendation + logged applications + a suggested
                                                  basal/top-dress split-dose timeline
    PATCH /api/history/<id>/status                body: {status: planned|applied|partially|skipped}
    POST /api/history/<id>/applications            body: {date, items}  - log what was actually applied and when
    DELETE /api/history/<id>
    GET  /api/history/export.csv
    POST /api/fields                       body: {name, lat, lon, radius_m, area_ha, texture}
    GET  /api/fields
    POST /api/chat                         body: {message, language, recommendation_id?, history?}
                                           -> {reply, language, grounded_on, fallback, guardrail, available}
                                           (recommendation_id must belong to this client or it's ignored -
                                           same isolation guarantee as /api/history)
    GET  /api/chat/suggestions?language=&recommendation_id=   a few relevant question chips

## Honesty notes
All data is synthetic; model scores (models/metrics.json) show the pipeline works, not real-field accuracy.
Thresholds, STCR parameters, prices, GHG factors and weights are assumptions: verify with ICAR / Soil Health Card / state university guidance.
Outputs are estimates and ranges, never guaranteed yield. A high-risk warning is not a food-safety statement.
