"""ST-01 backend (Flask).  Local: python app.py     Render: gunicorn "app:create_app()" """
import datetime as dt
import uuid
import numpy as np
from flask import Flask, jsonify, request, g
from flask.json.provider import DefaultJSONProvider
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from sqlalchemy.pool import StaticPool
from st01 import config as C, pipeline
from st01.services import weather, soil, trends, ocr
from st01.services.ml import registry
from st01.db import db, get_or_create_client, delete_client_data


class NumpyJSON(DefaultJSONProvider):
    @staticmethod
    def default(o):
        if isinstance(o, np.integer): return int(o)
        if isinstance(o, np.floating): return float(o)
        if isinstance(o, np.bool_): return bool(o)
        if isinstance(o, np.ndarray): return o.tolist()
        return DefaultJSONProvider.default(o)


def create_app():
    app = Flask(__name__)
    app.json = NumpyJSON(app)
    registry.load()
    trends.price_signals(list(C.PRICES.fertilizer.unique()))     # warm the forecast cache

    app.config["SQLALCHEMY_DATABASE_URI"] = C.DATABASE_URL
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    if "sqlite" in C.DATABASE_URL and ":memory:" in C.DATABASE_URL:
        # a plain in-memory sqlite db is per-connection; pin it to one shared
        # connection so every request in this process (and every test) sees
        # the same data instead of a fresh empty db each time.
        app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {"poolclass": StaticPool, "connect_args": {"check_same_thread": False}}
    db.init_app(app)
    with app.app_context():
        db.create_all()

    limiter = Limiter(key_func=lambda: getattr(g, "client_id", None) or get_remote_address(),
                       app=app, default_limits=["120 per minute"], storage_uri="memory://")

    @app.after_request
    def cors(r):
        r.headers["Access-Control-Allow-Origin"] = "*"
        r.headers["Access-Control-Allow-Headers"] = "Content-Type, X-Client-Id"
        r.headers["Access-Control-Allow-Methods"] = "GET,POST,PATCH,DELETE,OPTIONS"
        if getattr(g, "client_id", None):
            r.headers["X-Client-Id"] = g.client_id
        return r

    @app.before_request
    def identify_client():
        # Anonymous client id: the frontend generates a UUID, stores it in
        # localStorage and sends it on every request. No name, phone or exact
        # address is stored - see st01/db.py Client model.
        if request.method == "OPTIONS":
            return
        cid = request.headers.get("X-Client-Id") or str(uuid.uuid4())
        try:
            uuid.UUID(cid)
        except ValueError:
            cid = str(uuid.uuid4())
        g.client_id = cid
        get_or_create_client(cid)

    @app.errorhandler(pipeline.InputError)
    def bad(e):
        return jsonify(error=str(e)), 400

    @app.errorhandler(404)
    def nf(e):
        return jsonify(error="not found"), 404

    @app.errorhandler(Exception)
    def boom(e):
        app.logger.exception(e)
        return jsonify(error="internal error"), 500

    def body():
        b = request.get_json(silent=True)
        if not isinstance(b, dict):
            raise pipeline.InputError("send a JSON object")
        return b

    @app.get("/api/me")
    def me():
        from st01.db import Client
        c = db.session.get(Client, g.client_id)
        return jsonify(id=c.id, created_at=c.created_at.isoformat(), language=c.language, consent_sharing=c.consent_sharing)

    @app.post("/api/me/consent")
    def set_consent():
        from st01.db import Client
        b = body()
        c = db.session.get(Client, g.client_id)
        c.consent_sharing = bool(b.get("consent_sharing", False))
        if b.get("language"):
            c.language = b["language"]
        db.session.commit()
        return jsonify(id=c.id, consent_sharing=c.consent_sharing, language=c.language)

    @app.delete("/api/me")
    def delete_me():
        delete_client_data(g.client_id)
        return jsonify(status="deleted")

    @app.get("/api/health")
    def health():
        return jsonify(status="ok", models_loaded=registry.bundle is not None, time=dt.datetime.now(dt.timezone.utc).isoformat())

    @app.get("/api/meta")
    def meta():
        return jsonify(crops=list(C.CROPS.index), districts=list(C.DIST.index), textures=C.TEXTURES,
                       fertilizers=list(C.FERTS.index), objectives=["cheapest", "balanced_inm", "eco_inm"])

    @app.get("/api/model-info")
    def model_info():
        return jsonify(registry.metrics)

    @app.get("/api/scenarios")
    def scenarios():
        return jsonify(C.SCEN.to_dict(orient="records"))

    @app.get("/api/context")
    def context():
        """Location -> district, live weather, SoilGrids estimate, climate trend (to pre-fill the form)."""
        lat, lon = request.args.get("lat", type=float), request.args.get("lon", type=float)
        if lat is None or lon is None:
            raise pipeline.InputError("lat and lon are required")
        d, km = weather.nearest_district(lat, lon)
        w = weather.get_weather(lat, lon, d)
        s = soil.get_soil_estimate(lat, lon, d)
        return jsonify(district=d, distance_km=km, weather=w, soil_estimate=s,
                       trend=trends.climate_trend(d, w["rain30"], dt.date.today().month),
                       note="SoilGrids has no available P or K: enter N, P, K from your soil report.")

    @app.get("/api/weather")
    def weather_ep():
        lat, lon = request.args.get("lat", type=float), request.args.get("lon", type=float)
        if lat is None or lon is None:
            raise pipeline.InputError("lat and lon are required")
        d, _ = weather.nearest_district(lat, lon)
        return jsonify(weather.get_weather(lat, lon, d))

    @app.get("/api/climate-trend")
    def climate_ep():
        d = request.args.get("district")
        if d not in C.DIST.index:
            raise pipeline.InputError("unknown district")
        return jsonify(trends.climate_trend(d))

    @app.get("/api/price-trend")
    def price_ep():
        f = request.args.get("fertilizer")
        t = trends.price_trend(f) if f else None
        if not t:
            raise pipeline.InputError("no price history for that fertilizer. Available: " + ", ".join(C.PRICES.fertilizer.unique()))
        return jsonify(t)

    @app.post("/api/recommend")
    def recommend():
        return jsonify(pipeline.recommend(body()))

    @app.post("/api/compare")
    def compare():
        b = body()
        if "A" not in b or "B" not in b:
            raise pipeline.InputError("send {A:{...}, B:{...}}")
        a, c = pipeline.recommend(b["A"]), pipeline.recommend(b["B"])
        diffs = []
        for n in C.NUT:
            da = a["dose"].get(n, {}).get("point", 0); db = c["dose"].get(n, {}).get("point", 0)
            if abs(da - db) > 5:
                diffs.append(f"{n} dose differs by {abs(da - db):.0f} kg/ha ({da:.0f} vs {db:.0f})")
        if a["crop"] != c["crop"]: diffs.append(f"different crop ({a['crop']} vs {c['crop']}): uptake, caps and efficiencies differ")
        ra, rc = a["resolved_inputs"], c["resolved_inputs"]
        if ra["texture"] != rc["texture"]: diffs.append(f"soil texture {ra['texture']} vs {rc['texture']}: leaching and P fixation differ")
        if abs(ra["rain30"] - rc["rain30"]) > 20: diffs.append("recent rainfall differs, which changes leaching risk and N/K adjustment")
        if a["soil_rating"] != c["soil_rating"]: diffs.append(f"soil ratings differ: {a['soil_rating']} vs {c['soil_rating']}")
        return jsonify(A=a, B=c, why_it_changed=diffs or ["inputs are almost identical"])

    @app.post("/api/crop-recommend")
    def crop_rec():
        return jsonify(pipeline.crop_recommend(body()))

    @app.post("/api/parse-report")
    def parse_report():
        if "file" in request.files:
            parsed, text = ocr.parse_pdf(request.files["file"])
        else:
            text = (request.get_json(silent=True) or {}).get("text", "")
            parsed = ocr.parse_report_text(text)
        return jsonify(parsed=parsed, note="Check these values before use; OCR can misread.")

    return app


if __name__ == "__main__":
    create_app().run(debug=True, port=5000)
