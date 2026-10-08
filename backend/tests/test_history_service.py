import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import datetime as dt
from st01.services import history


def test_season_for_kharif():
    assert history.season_for(dt.date(2026, 7, 15)) == "Kharif"


def test_season_for_rabi_wraps_year_end():
    assert history.season_for(dt.date(2026, 12, 20)) == "Rabi"
    assert history.season_for(dt.date(2026, 2, 10)) == "Rabi"


def test_season_for_zaid():
    assert history.season_for(dt.date(2026, 4, 20)) == "Zaid"


def test_application_schedule_empty_dose():
    assert history.application_schedule(dt.date(2026, 6, 1), {}) == []


def test_application_schedule_has_three_stages():
    sched = history.application_schedule(dt.date(2026, 6, 1), {"N": 100, "P": 50, "K": 50})
    assert [s["stage"] for s in sched] == ["basal", "top_dress_1", "top_dress_2"]
    assert sched[0]["suggested_date"] == "2026-06-01"


def test_application_schedule_defers_basal_on_heavy_rain():
    normal = history.application_schedule(dt.date(2026, 6, 1), {"N": 100}, defer_application=False)
    deferred = history.application_schedule(dt.date(2026, 6, 1), {"N": 100}, defer_application=True)
    assert deferred[0]["suggested_date"] > normal[0]["suggested_date"]
    assert "Shifted later" in deferred[0]["note"]
