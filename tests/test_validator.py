import pytest
from backend.pipeline import validator

def test_validator_silhouette_hidden_surfaces():
    payload = {
        "result": {
            "reconstruction": {
                "vertex_count": 8,
                "method": "silhouette",
                "confidence": 0.5
            },
            "view_analysis": {
                "usable_count": 3
            },
            "enough_views": True,
            "object_detection": {
                "object_found": True
            },
            "scale_calibration": {
                "scale_factor": 1.5,
                "consistency": 0.95,
                "measurements": [
                    {"level": "measured", "source": "user_known", "value": 10.0}
                ]
            },
            "drawing_generation": {
                "title_block": {"note": "AI-assisted reconstruction — not a metrology record"}
            }
        },
        "outputs": [
            {"kind": "dxf", "path": "fake.dxf"}, # We won't test file existence strictly in unit tests unless we mock os.path
            {"kind": "mesh", "path": "fake.stl"}
        ],
        "known_dimensions": [{"label": "width", "value": 10.0}],
        "status": "completed"
    }

    # Mock os.path.exists
    import os
    original_exists = os.path.exists
    original_getsize = os.path.getsize
    os.path.exists = lambda p: True
    os.path.getsize = lambda p: 1024

    try:
        val = validator.validate(payload)
        
        assert val["ok"] is True
        assert val["confidence"] <= 0.5
        assert any(w["code"] == "hidden_surfaces" for w in val["warnings"])
    finally:
        os.path.exists = original_exists
        os.path.getsize = original_getsize

def test_validator_rewrites_fake_measured():
    payload = {
        "result": {
            "reconstruction": {"vertex_count": 8},
            "scale_calibration": {
                "scale_factor": 1.0,
                "measurements": [
                    {"level": "measured", "source": "inferred", "value": 5.0}
                ]
            }
        },
        "known_dimensions": [{"label": "width", "value": 10.0}],
        "status": "completed",
        "outputs": []
    }
    
    val = validator.validate(payload)
    
    # Check that measurements check failed or rewrote it
    meas_check = next(c for c in val["checks"] if c["id"] == "measurements")
    assert meas_check["ok"] is False
    
    # The payload measurement should now be "estimated"
    assert payload["result"]["scale_calibration"]["measurements"][0]["level"] == "estimated"

def test_validator_needs_more_views():
    payload = {
        "result": {
            "enough_views": False,
            "view_analysis": {"usable_count": 1}
        },
        "status": "needs_more_views",
        "outputs": []
    }
    
    val = validator.validate(payload)
    assert val["ok"] is False
    assert any(w["code"] == "low_coverage" for w in val["warnings"])
    assert val["confidence"] <= 0.3
