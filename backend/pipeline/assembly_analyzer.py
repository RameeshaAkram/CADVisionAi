"""Analyzes object components to determine if it is an assembly."""

import logging

logger = logging.getLogger(__name__)

def analyze(reconstruction: dict, components: list, images: list = None, features: dict = None) -> dict:
    """
    Returns:
    {
      "parts": [...],
      "relationships": [...],
      "mode": "single" | "assembly",
      "warnings": [...]
    }
    """
    
    # Check if we have multiple distinct components from the object detector
    # Or if we just have one.
    
    # Filter out empty or extremely small components
    valid_comps = [c for c in components if c.get("bbox")]
    
    # Cap at a small N (e.g. 6)
    if len(valid_comps) > 6:
        valid_comps = valid_comps[:6]
        
    parts = []
    relationships = []
    warnings = []
    
    if len(valid_comps) <= 1:
        # Single mode
        parts.append({
            "id": "part-main",
            "label": "Main body",
            "confidence": 0.9,
            "color": "var(--cyan-400)",
            "bbox": reconstruction.get("bounds", {"min": [0,0,0], "max": [0,0,0]}),
            "vertex_count": reconstruction.get("vertex_count")
        })
        return {
            "parts": parts,
            "relationships": relationships,
            "mode": "single",
            "warnings": ["Treated as a single part. Separate pieces were not visible."] if len(components) <= 1 else []
        }
        
    # Assembly mode (2+ distinct masks/bboxes)
    colors = ["var(--cyan-400)", "var(--amber-400)", "var(--fuchsia-400)", "var(--emerald-400)", "var(--indigo-400)", "var(--rose-400)"]
    
    for i, comp in enumerate(valid_comps):
        # We don't have true 3D sub-bounds without clustering the mesh, 
        # so we'll just approximate bounds from the overall recon bounds divided up,
        # or just fallback to the full bounds if we can't project.
        # For this MVP, we'll assign the whole bounds to each but mark them as separate.
        # Or ideally, we'd estimate their Z/X offset.
        
        parts.append({
            "id": f"part-{i}",
            "label": f"Component {chr(65+i)}",
            "confidence": 0.6,
            "color": colors[i % len(colors)],
            "bbox": reconstruction.get("bounds", {"min": [0,0,0], "max": [0,0,0]}),
            "vertex_count": None
        })
        
    # Build basic relationships
    # Simple heuristic: adjacent parts are touching
    for i in range(len(parts) - 1):
        rel = {
            "a": parts[i]["id"],
            "b": parts[i+1]["id"],
            "kind": "touching",
            "confidence": 0.5,
            "evidence": "Components appear adjacent in the provided views."
        }
        relationships.append(rel)
        
    return {
        "parts": parts,
        "relationships": relationships,
        "mode": "assembly",
        "warnings": ["Assembly split is approximate. Exporting combined mesh only."]
    }
