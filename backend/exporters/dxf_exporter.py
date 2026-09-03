"""Segment 9 — DXF Exporter"""

from pathlib import Path
import ezdxf

def write(drawing_json: dict, path: str | Path) -> str:
    """Writes the 2D drawing JSON to a DXF file."""
    path = Path(path)
    
    doc = ezdxf.new(setup=True)
    msp = doc.modelspace()
    
    # Unit mapping: 1 = inches, 2 = feet, 4 = mm, 5 = cm
    units_map = {
        "inches": 1,
        "feet": 2,
        "mm": 4,
        "cm": 5
    }
    unit_str = drawing_json.get("units", "mm")
    doc.header["$INSUNITS"] = units_map.get(unit_str, 4)
    
    # Create layers
    doc.layers.new("OUTLINE", dxfattribs={"color": 7}) # White/Black
    doc.layers.new("HIDDEN", dxfattribs={"color": 8, "linetype": "HIDDEN"}) # Gray
    doc.layers.new("CENTER", dxfattribs={"color": 3, "linetype": "CENTER"}) # Green
    doc.layers.new("DIM_MEASURED", dxfattribs={"color": 4}) # Cyan
    doc.layers.new("DIM_ESTIMATED", dxfattribs={"color": 2}) # Yellow
    
    views = drawing_json.get("views", {})
    
    # We will offset views so they don't overlap. 
    # For MVP, assuming they are pre-positioned in the JSON, or we position them here.
    # The JSON usually has coordinates. If not, we just draw them as they are.
    
    for view_name, view in views.items():
        for line in view.get("lines", []):
            layer = "OUTLINE"
            if line.get("role") == "hidden":
                layer = "HIDDEN"
            elif line.get("role") == "center":
                layer = "CENTER"
                
            msp.add_lwpolyline(
                [(line["x1"], line["y1"]), (line["x2"], line["y2"])],
                dxfattribs={"layer": layer}
            )
            
        for circle in view.get("circles", []):
            layer = "OUTLINE"
            if circle.get("role") == "hole":
                layer = "OUTLINE"
                
            msp.add_circle(
                (circle["cx"], circle["cy"]),
                radius=circle["r"],
                dxfattribs={"layer": layer}
            )
            
        for dim in view.get("dimensions", []):
            layer = "DIM_MEASURED" if dim.get("level") == "measured" else "DIM_ESTIMATED"
            a = dim["a"]
            b = dim["b"]
            text = dim.get("text", "")
            
            # ezdxf linear dimension
            dim_ent = msp.add_linear_dim(
                base=(a[0], a[1] + 10), # Offset the dimension line
                p1=(a[0], a[1]),
                p2=(b[0], b[1]),
                text=text,
                dxfattribs={"layer": layer}
            )
            dim_ent.render()

    # Add Title Block / Note
    tb = drawing_json.get("title_block", {})
    note = tb.get("note", "AI-assisted reconstruction — not a metrology record")
    msp.add_text(note, dxfattribs={"height": 5, "layer": "OUTLINE"}).set_placement((0, -20))

    doc.saveas(str(path))
    return str(path)
