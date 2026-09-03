import pytest
from backend.pipeline.scale_calibration import calibrate

def test_calibrate_success():
    recon = {
        "bounds": {"min": [0, 0, 0], "max": [1, 2, 1]},
        "confidence": 0.8,
        "method": "mvs"
    }
    known = [{"label": "height", "value": 8.0}]
    
    result = calibrate(recon, known, "ft", features=None)
    
    assert result["scale_factor"] == 4.0
    assert len(result["measurements"]) == 3
    
    m_height = next(m for m in result["measurements"] if m["id"] == "height")
    assert m_height["level"] == "measured"
    assert m_height["value"] == 8.0
    
    m_width = next(m for m in result["measurements"] if m["id"] == "width")
    assert m_width["level"] == "estimated"
    assert m_width["value"] == 4.0

def test_calibrate_disagreement():
    recon = {
        "bounds": {"min": [0, 0, 0], "max": [2, 2, 2]},
        "confidence": 0.8,
        "method": "mvs"
    }
    # Y height is 2, X width is 2.
    # Height = 10 -> scale = 5.0
    # Width = 8 -> scale = 4.0
    # mismatch is (5-4)/5 = 0.2 > 0.10
    known = [
        {"label": "height", "value": 10.0},
        {"label": "width", "value": 8.0}
    ]
    
    result = calibrate(recon, known, "ft", features=None)
    assert result["consistency"] == 0.8  # 1.0 - 0.2
    assert any("disagree by more than 10%" in w for w in result["warnings"])
    assert result["scale_factor"] == 4.5  # median of 4.0 and 5.0
