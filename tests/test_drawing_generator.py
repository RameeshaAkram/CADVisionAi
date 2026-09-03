import pytest
from backend.pipeline import drawing_generator

def test_drawing_generator():
    cad = {
        "units": "feet",
        "solids": [
            {
                "id": "box1",
                "kind": "box",
                "params": {"w": 8, "h": 3, "d": 2, "origin": [4, 1.5, 1]},
                "level": "estimated"
            }
        ],
        "holes": []
    }
    measurements = [
        {"label": "Width", "value": 8.00, "level": "measured", "tolerance": 0},
        {"label": "Height", "value": 3.0, "level": "estimated", "tolerance": 0.2},
        {"label": "Depth", "value": 2.0, "level": "low", "tolerance": 0.5}
    ]
    
    out = drawing_generator.generate(cad, measurements)
    
    # Check that drawing has 3 views
    assert "front" in out["views"]
    assert "top" in out["views"]
    assert "side" in out["views"]
    
    # Check dimensions
    # Width (measured) -> front view
    # Height (estimated) -> front view
    # Depth (low) -> omitted
    front_dims = out["views"]["front"]["dimensions"]
    side_dims = out["views"]["side"]["dimensions"]
    
    # One of the dims in front should have text "8.00"
    dim_texts = [d["text"] for d in front_dims]
    assert "8.00" in dim_texts
    
    # 3.0 estimated should be "3.0 ±0.2"
    assert "3.0 ±0.2" in dim_texts
    
    # Depth dimension should not be there because level is low
    all_dims = front_dims + out["views"]["top"]["dimensions"] + side_dims
    assert not any("2.0" in d["text"] for d in all_dims if "±0.5" in d["text"] or d["text"] == "2.00")
    
    # Title block
    assert "not a metrology record" in out["title_block"]["note"]
