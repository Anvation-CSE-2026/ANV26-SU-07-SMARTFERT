"""Shared SQLAlchemy models for history, feedback/adaptive learning, chat and satellite caching.

Every table is scoped to an anonymous client_id (a UUID the frontend generates and sends as
the X-Client-Id header - see middleware in app.py). No name, phone number or exact address is
stored by default. DATABASE_URL defaults to a local sqlite file; use Postgres in production
(Render's free-tier disk is ephemeral and a sqlite file there will not survive a redeploy).
"""
import datetime as dt
import uuid

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def now():
    return dt.datetime.now(dt.timezone.utc)


def new_id():
    return str(uuid.uuid4())


class Client(db.Model):
    __tablename__ = "clients"
    id = db.Column(db.String(36), primary_key=True)
    created_at = db.Column(db.DateTime, default=now, nullable=False)
    language = db.Column(db.String(8), default="en")
    consent_sharing = db.Column(db.Boolean, default=False, nullable=False)


class Field(db.Model):
    __tablename__ = "fields"
    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.String(36), db.ForeignKey("clients.id"), nullable=False, index=True)
    name = db.Column(db.String(120))
    lat = db.Column(db.Float)
    lon = db.Column(db.Float)
    radius_m = db.Column(db.Float)
    area_ha = db.Column(db.Float)
    texture = db.Column(db.String(16))
    created_at = db.Column(db.DateTime, default=now, nullable=False)


class Recommendation(db.Model):
    __tablename__ = "recommendations"
    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.String(36), db.ForeignKey("clients.id"), nullable=False, index=True)
    field_id = db.Column(db.Integer, db.ForeignKey("fields.id"), nullable=True)
    season = db.Column(db.String(16))
    created_at = db.Column(db.DateTime, default=now, nullable=False)
    crop = db.Column(db.String(64))
    inputs_json = db.Column(db.JSON)
    output_json = db.Column(db.JSON)
    model_version = db.Column(db.String(32))
    status = db.Column(db.String(16), default="planned")  # planned|applied|partially|skipped
    confidence = db.Column(db.Float)
    sustainability = db.Column(db.Float)


class Application(db.Model):
    __tablename__ = "applications"
    id = db.Column(db.Integer, primary_key=True)
    rec_id = db.Column(db.Integer, db.ForeignKey("recommendations.id"), nullable=False, index=True)
    date = db.Column(db.Date)
    items_json = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=now, nullable=False)


class Feedback(db.Model):
    __tablename__ = "feedback"
    id = db.Column(db.Integer, primary_key=True)
    rec_id = db.Column(db.Integer, db.ForeignKey("recommendations.id"), nullable=False, index=True)
    client_id = db.Column(db.String(36), db.ForeignKey("clients.id"), nullable=False, index=True)
    applied_status = db.Column(db.String(16))  # yes|partly|no
    applied_doses_json = db.Column(db.JSON)
    actual_yield_t_ha = db.Column(db.Float)
    issues_json = db.Column(db.JSON)  # e.g. ["yellowing", "lodging", "runoff_event"]
    retest_json = db.Column(db.JSON)  # {N, P, K, pH, OC}
    rating = db.Column(db.Integer)  # 1-5
    verified = db.Column(db.Boolean, default=False, nullable=False)
    simulated = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=now, nullable=False)


class Calibration(db.Model):
    __tablename__ = "calibration"
    crop = db.Column(db.String(64), primary_key=True)
    region_key = db.Column(db.String(64), primary_key=True)
    n_reports = db.Column(db.Integer, default=0, nullable=False)
    yield_bias = db.Column(db.Float, default=0.0, nullable=False)
    dose_mult_N = db.Column(db.Float, default=1.0, nullable=False)
    dose_mult_P = db.Column(db.Float, default=1.0, nullable=False)
    dose_mult_K = db.Column(db.Float, default=1.0, nullable=False)
    simulated = db.Column(db.Boolean, default=False, nullable=False)
    updated_at = db.Column(db.DateTime, default=now, onupdate=now, nullable=False)


class ChatMessage(db.Model):
    __tablename__ = "chat_messages"
    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.String(36), db.ForeignKey("clients.id"), nullable=False, index=True)
    rec_id = db.Column(db.Integer, db.ForeignKey("recommendations.id"), nullable=True)
    role = db.Column(db.String(16))  # user|assistant
    text = db.Column(db.Text)
    lang = db.Column(db.String(8))
    flagged = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=now, nullable=False)


class SatelliteCache(db.Model):
    __tablename__ = "satellite_cache"
    key = db.Column(db.String(128), primary_key=True)
    payload_json = db.Column(db.JSON)
    fetched_at = db.Column(db.DateTime, default=now, nullable=False)


def get_or_create_client(client_id, language=None):
    c = db.session.get(Client, client_id)
    if c is None:
        c = Client(id=client_id, language=language or "en")
        db.session.add(c)
        db.session.commit()
    return c


def delete_client_data(client_id):
    """Removes every row for this client. Used by DELETE /api/me."""
    rec_ids = [r.id for r in Recommendation.query.filter_by(client_id=client_id).all()]
    if rec_ids:
        Application.query.filter(Application.rec_id.in_(rec_ids)).delete(synchronize_session=False)
    Feedback.query.filter_by(client_id=client_id).delete(synchronize_session=False)
    ChatMessage.query.filter_by(client_id=client_id).delete(synchronize_session=False)
    Recommendation.query.filter_by(client_id=client_id).delete(synchronize_session=False)
    Field.query.filter_by(client_id=client_id).delete(synchronize_session=False)
    Client.query.filter_by(id=client_id).delete(synchronize_session=False)
    db.session.commit()
