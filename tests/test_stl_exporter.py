from pathlib import Path

from backend.exporters.stl_exporter import write


def test_write_extruded_profile(tmp_path: Path):
    drawing = {
        "views": {
            "top": {
                "polylines": [
                    {
                        "role": "outer",
                        "points": [
                            {"x": 0, "y": 0},
                            {"x": 20, "y": 0},
                            {"x": 20, "y": 10},
                            {"x": 0, "y": 10},
                        ],
                    },
                    {
                        "role": "hole",
                        "points": [
                            {"x": 5, "y": 3},
                            {"x": 8, "y": 3},
                            {"x": 8, "y": 6},
                            {"x": 5, "y": 6},
                        ],
                    },
                ]
            }
        }
    }

    output = Path(write(drawing, tmp_path / "model.stl", thickness=2.5))

    assert output.is_file()
    assert output.stat().st_size > 0
