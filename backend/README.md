# ST-01 backend (Flask)

    pip install -r requirements.txt
    python train.py            # optional: models auto-train on first start if models/ is missing
    python app.py              # http://localhost:5000
    python -m pytest -q tests  # 24 tests
    Render: Procfile -> gunicorn "app:create_app()"

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

## API
    GET  /api/health | /api/meta | /api/model-info | /api/scenarios
    GET  /api/context?lat=&lon=            district + weather + soil estimate + climate trend (pre-fill the form)
    GET  /api/weather?lat=&lon=            GET /api/climate-trend?district=      GET /api/price-trend?fertilizer=
    POST /api/recommend                    body: crop, N, P, K (required) + district or lat/lon; optional texture, pH, OC,
                                           rain30, rain90, rain48, temp, target, objective (cheapest|balanced_inm|eco_inm),
                                           dap_change, urea_change, price_changes{fert:pct}, polish, language
    POST /api/compare                      body: {A:{...}, B:{...}}  -> both results + why_it_changed
    POST /api/crop-recommend               body: district, N, P, K, (pH, temp, humidity, rainfall)
    POST /api/parse-report                 body: {text} or multipart file (PDF)

## Honesty notes
All data is synthetic; model scores (models/metrics.json) show the pipeline works, not real-field accuracy.
Thresholds, STCR parameters, prices, GHG factors and weights are assumptions: verify with ICAR / Soil Health Card / state university guidance.
Outputs are estimates and ranges, never guaranteed yield. A high-risk warning is not a food-safety statement.
