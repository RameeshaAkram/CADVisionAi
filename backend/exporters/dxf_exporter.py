"""Segment 9 — DXF Exporter."""

from pathlib import Path
import ezdxf

def write(drawing_json: dict, path: str | Path) -> str:
    """Writes the 2D drawing JSON to a DXF file."""
    path = Path(path)
    
    doc = ezdxf.new(setup=True)
    msp = doc.modelspace()
    
    # Unit mapping: 1 = inches, 2 = feet, 4 = mm, 5 = cm
    # We default to mm
    doc.header["$INSUNITS"] = 4
    
    # Create layers
    doc.layers.new("CUT", dxfattribs={"color": 7}) # White/Black for outer contour
    doc.layers.new("HOLES", dxfattribs={"color": 1}) # Red for inner holes
    doc.layers.new("DIMENSIONS", dxfattribs={"color": 4}) # Cyan
    
    views = drawing_json.get("views", {})
    
    for view_name, view in views.items():
        for poly in view.get("polylines", []):
            layer = "CUT" if poly.get("role") == "outer" else "HOLES"
            points = [(p["x"], p["y"]) for p in poly.get("points", [])]
            
            if len(points) > 1:
                msp.add_lwpolyline(
                    points,
                    close=poly.get("is_closed", True),
                    dxfattribs={"layer": layer}
                )
                
    # Add Title Block / Note
    tb = drawing_json.get("title_block", {})
    note = tb.get("note", "AI-assisted reconstruction")
    msp.add_text(note, dxfattribs={"height": 5, "layer": "CUT"}).set_placement((0, -20))

    doc.saveas(str(path))
    return str(path)
