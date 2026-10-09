"""Covers the versioned-registry bookkeeping (backup/rollback) in
scripts/retrain_with_feedback.py without running a real XGBoost retrain each
time - the actual retrain-and-promote flow was verified manually (see the
session notes): a candidate trained with 13 verified feedback rows merged
correctly with the 6000 synthetic rows, and a deliberately-noisy candidate
was correctly rejected by the not-worse check.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import scripts.retrain_with_feedback as retrain


def test_backup_then_rollback_restores_the_previous_model(tmp_path, monkeypatch):
    from st01 import config as C
    monkeypatch.setattr(C, "MODELS_DIR", str(tmp_path))
    monkeypatch.setattr(retrain, "REGISTRY_PATH", str(tmp_path / "registry.json"))

    model_path = tmp_path / "models.joblib"
    metrics_path = tmp_path / "metrics.json"
    model_path.write_bytes(b"ORIGINAL_MODEL_BYTES")
    metrics_path.write_text(json.dumps({"yield": {"r2": 0.5}}))

    reg = retrain._load_registry()
    reg = retrain._backup_current(reg)
    assert len(reg["versions"]) == 1

    # simulate a promotion that overwrites the live files
    model_path.write_bytes(b"NEW_CANDIDATE_BYTES")
    metrics_path.write_text(json.dumps({"yield": {"r2": 0.9}}))

    retrain.rollback()

    assert model_path.read_bytes() == b"ORIGINAL_MODEL_BYTES"
    assert json.loads(metrics_path.read_text())["yield"]["r2"] == 0.5
    assert retrain._load_registry()["versions"] == []


def test_rollback_with_no_prior_version_does_not_crash(tmp_path, monkeypatch, capsys):
    from st01 import config as C
    monkeypatch.setattr(C, "MODELS_DIR", str(tmp_path))
    monkeypatch.setattr(retrain, "REGISTRY_PATH", str(tmp_path / "registry.json"))
    retrain.rollback()
    assert "No previous version" in capsys.readouterr().out
