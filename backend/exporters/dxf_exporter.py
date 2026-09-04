"""Segment 9 — DXF Exporter.

Writes the 2D drawing JSON to a DXF file.
- Outer contour      -> LWPOLYLINE on CUT layer
- Circular holes     -> CIRCLE on HOLES layer  (true CAD primitives)
- Non-circular holes -> LWPOLYLINE on HOLES layer
- Title note         -> TEXT on CUT layer
"""

from pathlib import Path
import ezdxf


def write(drawing_json: dict, path: str | Path, units: str = "mm") -> str:
    """Writes the 2D drawing JSON to a DXF file."""
    path = Path(path)

    doc = ezdxf.new(setup=True)
    msp = doc.modelspace()

    # Unit mapping: 1=inches, 2=feet, 4=mm, 5=cm
    unit_codes = {"inches": 1, "feet": 2, "mm": 4, "cm": 5}
    doc.header["$INSUNITS"] = unit_codes.get(units, 4)

    # Create layers
    doc.layers.new("CUT",        dxfattribs={"color": 7})  # White/Black for outer contour
    doc.layers.new("HOLES",      dxfattribs={"color": 1})  # Red for inner holes
    doc.layers.new("DIMENSIONS", dxfattribs={"color": 4})  # Cyan

    views = drawing_json.get("views", {})

    for view_name, view in views.items():
        # --- Polylines (outer contour + non-circular holes) ---
        for poly in view.get("polylines", []):
            layer = "CUT" if poly.get("role") == "outer" else "HOLES"
            points = [(p["x"], p["y"]) for p in poly.get("points", [])]
            if len(points) > 1:
                msp.add_lwpolyline(
                    points,
                    close=poly.get("is_closed", True),
                    dxfattribs={"layer": layer},
                )

        # --- True CIRCLE entities for circular holes ---
        for circ in view.get("circles", []):
            cx = circ["cx"]
            cy = circ["cy"]
            r  = circ["r"]
            if r > 0:
                msp.add_circle(
                    center=(cx, cy),
                    radius=r,
                    dxfattribs={"layer": "HOLES"},
                )

    # Add Title Block / Note
    tb = drawing_json.get("title_block", {})
    note = tb.get("note", "AI-assisted reconstruction")
    msp.add_text(note, dxfattribs={"height": 5, "layer": "CUT"}).set_placement((0, -20))

    doc.saveas(str(path))
    return str(path)
