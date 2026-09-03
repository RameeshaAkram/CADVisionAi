import pytest
import ezdxf
from backend.exporters import dxf_exporter

def test_dxf_exporter(tmp_path):
    drawing_json = {
        "units": "inches",
        "views": {
            "front": {
                "lines": [{"x1": 0, "y1": 0, "x2": 10, "y2": 0, "role": "outline", "level": "estimated"}],
                "circles": [],
                "dimensions": [
                    {"kind": "linear", "a": [0,0], "b": [10,0], "text": "10.00", "level": "measured"}
                ]
            }
        },
        "title_block": {
            "note": "AI-assisted reconstruction — not a metrology record"
        }
    }
    
    out_path = tmp_path / "test.dxf"
    dxf_exporter.write(drawing_json, out_path)
    
    assert out_path.exists()
    assert out_path.stat().st_size > 0
    
    # Verify ezdxf can read it back
    doc = ezdxf.readfile(out_path)
    msp = doc.modelspace()
    
    lines = msp.query("LWPOLYLINE")
    assert len(lines) > 0
    
    texts = msp.query("TEXT")
    assert any("not a metrology record" in text.dxf.text for text in texts)
