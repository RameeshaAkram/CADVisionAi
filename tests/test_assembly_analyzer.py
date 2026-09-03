"""Tests for basic assembly analysis."""

import pytest
from backend.pipeline import assembly_analyzer

def test_assembly_analyzer_single_component():
    reconstruction = {
        "type": "mesh",
        "vertex_count": 100,
        "bounds": {"min": [0,0,0], "max": [10,10,10]}
    }
    
    # A single valid component
    components = [
        {"bbox": [0, 0, 100, 100], "confidence": 0.9}
    ]
    
    result = assembly_analyzer.analyze(reconstruction, components)
    
    assert result["mode"] == "single"
    assert len(result["parts"]) == 1
    assert result["parts"][0]["label"] == "Main body"
    assert len(result["relationships"]) == 0
    assert "Treated as a single part" in result["warnings"][0]

def test_assembly_analyzer_multiple_components():
    reconstruction = {
        "type": "mesh",
        "vertex_count": 500,
        "bounds": {"min": [0,0,0], "max": [20,10,10]}
    }
    
    # Multiple valid components
    components = [
        {"bbox": [0, 0, 50, 50], "confidence": 0.9},
        {"bbox": [60, 0, 110, 50], "confidence": 0.8}
    ]
    
    result = assembly_analyzer.analyze(reconstruction, components)
    
    assert result["mode"] == "assembly"
    assert len(result["parts"]) == 2
    assert result["parts"][0]["label"] == "Component A"
    assert result["parts"][1]["label"] == "Component B"
    assert len(result["relationships"]) == 1
    rel = result["relationships"][0]
    assert rel["a"] == "part-0"
    assert rel["b"] == "part-1"
    assert rel["kind"] == "touching"

def test_assembly_analyzer_ignores_empty():
    reconstruction = {
        "type": "mesh",
        "bounds": {"min": [0,0,0], "max": [10,10,10]}
    }
    
    components = [
        {"bbox": [0, 0, 50, 50]},
        {"confidence": 0.1} # Missing bbox
    ]
    
    result = assembly_analyzer.analyze(reconstruction, components)
    
    # Should fall back to single mode since only 1 component is valid
    assert result["mode"] == "single"
    assert len(result["parts"]) == 1
