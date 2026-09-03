import pytest
from backend.utils.geometry_utils import aabb_extents, choose_axis, apply_scale

def test_aabb_extents():
    bounds = {"min": [0, 0, 0], "max": [2, 4, 1]}
    extents = aabb_extents(bounds)
    assert extents == {"x": 2.0, "y": 4.0, "z": 1.0}

def test_choose_axis():
    extents = {"x": 2.0, "y": 4.0, "z": 1.0}
    assert choose_axis("Height", extents) == "y"
    assert choose_axis("overall height", extents) == "y"
    assert choose_axis("Width", extents) == "x"  # 2.0 > 1.0
    assert choose_axis("length", extents) == "z" # remaining
    
    extents2 = {"x": 1.0, "y": 4.0, "z": 3.0}
    assert choose_axis("width", extents2) == "z" # 3.0 > 1.0
    
    assert choose_axis("unknown", extents) is None

def test_apply_scale():
    assert apply_scale(2.5, 2.0) == 5.0
