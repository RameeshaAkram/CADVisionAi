"""Visual hull / Space carving reconstruction."""

import os
import cv2
import numpy as np
import logging
from backend.storage import file_manager
try:
    from skimage import measure
    SKIMAGE_AVAILABLE = True
except ImportError:
    SKIMAGE_AVAILABLE = False

logger = logging.getLogger(__name__)

def reconstruct(images: list, *, view=None, objects=None, features=None, job_id=None) -> dict:
    if not images or not job_id:
        return _empty_fallback()
        
    warnings = ["Approximate shape from silhouettes; hidden surfaces are not recovered."]
    
    if not SKIMAGE_AVAILABLE:
        warnings.append("skimage not found; falling back to bounding box extrusion.")
        return _fallback_box(images, objects, job_id, warnings)
        
    # 1. Determine masks for each image
    masks = []
    max_w, max_h = 0, 0
    for img_meta in images:
        path = img_meta.stored_path if hasattr(img_meta, "stored_path") else img_meta.get("stored_path", "")
        # load image
        img = cv2.imread(path)
        if img is None:
            continue
            
        h, w = img.shape[:2]
        max_w = max(max_w, w)
        max_h = max(max_h, h)
        
        # Try to use object detection mask
        mask = None
        if objects and "components" in objects:
            # find corresponding component? The prompt doesn't specify how to match images to components.
            # Usually components are detected per image.
            # Since we don't have the full mapping, we'll just compute a quick Otsu mask.
            pass
            
        if mask is None:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            # Try rembg
            try:
                import rembg
                rgba = rembg.remove(img)
                thresh = rgba[:, :, 3]
            except Exception:
                _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
            
            # Find largest contour to remove noise
            contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if contours:
                c = max(contours, key=cv2.contourArea)
                mask = np.zeros_like(thresh)
                cv2.drawContours(mask, [c], -1, 255, thickness=cv2.FILLED)
            else:
                mask = thresh
                
        masks.append({"mask": mask, "w": w, "h": h})
        
    if not masks:
        return _empty_fallback()
        
    # 2. Voxel grid setup
    from backend.core.config import settings
    grid_res = getattr(settings, "RECON_RESOLUTION", 96)
    if max_w == 0: max_w = 512
    if max_h == 0: max_h = 512
    max_dim = max(max_w, max_h)
    
    # Grid bounds in arbitrary world units (we'll just use pixel scale of max_dim)
    half_size = max_dim / 2.0
    x_range = np.linspace(-half_size, half_size, grid_res)
    y_range = np.linspace(-half_size, half_size, grid_res)
    z_range = np.linspace(-half_size * 0.5, half_size * 0.5, grid_res) # limit depth
    
    xv, yv, zv = np.meshgrid(x_range, y_range, z_range, indexing='ij')
    voxel_points = np.stack([xv.ravel(), yv.ravel(), zv.ravel()], axis=-1)
    
    occupancy = np.ones(grid_res ** 3, dtype=bool)
    
    # 3. Carving
    import time
    start_time = time.time()
    timeout_s = 30.0
    
    num_views = len(masks)
    # If multiple views, assume orbit around Y axis
    for i, mask_data in enumerate(masks):
        if time.time() - start_time > timeout_s:
            warnings.append("Reconstruction timed out. Shape may be incomplete.")
            break
            
        mask = mask_data["mask"]
        w = mask_data["w"]
        h = mask_data["h"]
        
        angle = (i * 2 * np.pi) / num_views if num_views > 1 else 0
        
        # Rotation matrix around Y axis
        cos_a = np.cos(angle)
        sin_a = np.sin(angle)
        R = np.array([
            [cos_a, 0, sin_a],
            [0, 1, 0],
            [-sin_a, 0, cos_a]
        ])
        
        # Rotate points
        rotated_points = voxel_points @ R.T
        
        # Orthographic projection onto XY plane
        px = rotated_points[:, 0]
        py = rotated_points[:, 1]
        
        # Map to image coordinates (centered)
        ix = np.round(px + w / 2).astype(int)
        iy = np.round(py + h / 2).astype(int)
        
        # Check bounds
        valid = (ix >= 0) & (ix < w) & (iy >= 0) & (iy < h)
        
        # For valid points, check mask
        in_silhouette = np.zeros_like(valid)
        in_silhouette[valid] = mask[iy[valid], ix[valid]] > 127
        
        occupancy = occupancy & in_silhouette
        
    occupancy_grid = occupancy.reshape((grid_res, grid_res, grid_res))
    
    # Check if completely empty
    if not np.any(occupancy_grid):
        raise ValueError("Reconstruction resulted in empty volume.")
        
    # 4. Marching cubes
    # skimage marching_cubes returns verts, faces, normals, values
    try:
        verts, faces, normals, values = measure.marching_cubes(occupancy_grid, level=0.5)
    except Exception as e:
        logger.exception("Marching cubes failed.")
        return _fallback_box(images, objects, job_id, warnings)
        
    if len(verts) == 0:
        raise ValueError("Reconstruction resulted in empty mesh (0 vertices).")
        
    # Scale vertices back to world coords
    verts[:, 0] = x_range[0] + (verts[:, 0] / (grid_res - 1)) * (x_range[-1] - x_range[0])
    verts[:, 1] = y_range[0] + (verts[:, 1] / (grid_res - 1)) * (y_range[-1] - y_range[0])
    verts[:, 2] = z_range[0] + (verts[:, 2] / (grid_res - 1)) * (z_range[-1] - z_range[0])
    
    # Bounds
    min_b = verts.min(axis=0)
    max_b = verts.max(axis=0)
    
    # 5. Write OBJ
    job_dir = file_manager.job_dir(job_id)
    preview_name = "preview.obj"
    preview_path = job_dir / preview_name
    
    with open(preview_path, "w") as f:
        f.write("# CAD AI Visual Hull\n")
        for v in verts:
            f.write(f"v {v[0]} {v[1]} {v[2]}\n")
        for face in faces:
            # OBJ is 1-indexed
            f.write(f"f {face[0]+1} {face[1]+1} {face[2]+1}\n")
            
    confidence = 0.6 if num_views > 1 else 0.35
            
    return {
        "type": "mesh",
        "units": "relative",
        "vertex_count": len(verts),
        "face_count": len(faces),
        "bounds": {
            "min": min_b.tolist(),
            "max": max_b.tolist()
        },
        "preview_path": f"outputs/{job_id}/{preview_name}",
        "preview_format": "obj",
        "method": "visual_hull",
        "confidence": confidence,
        "warnings": warnings
    }

def _fallback_box(images, objects, job_id, warnings) -> dict:
    if not images or not job_id:
        return _empty_fallback()
        
    max_w = images[0].width * 0.8 if hasattr(images[0], "width") else 512 * 0.8
    max_h = images[0].height * 0.8 if hasattr(images[0], "height") else 512 * 0.8
        
    depth = max_w * 0.5

    x0, x1 = -max_w/2, max_w/2
    y0, y1 = -max_h/2, max_h/2
    z0, z1 = -depth/2, depth/2

    vertices = [
        [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
        [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]
    ]

    faces = [
        [1, 2, 3, 4], [8, 7, 6, 5], [4, 3, 7, 8],
        [5, 6, 2, 1], [5, 1, 4, 8], [2, 6, 7, 3]
    ]

    job_dir = file_manager.job_dir(job_id)
    preview_name = "preview.obj"
    preview_path = job_dir / preview_name
    
    with open(preview_path, "w") as f:
        f.write("# CAD AI Fallback Extrusion\n")
        for v in vertices:
            f.write(f"v {v[0]} {v[1]} {v[2]}\n")
        for face in faces:
            f.write(f"f {' '.join(map(str, face))}\n")

    warnings.append("Shape used bounding box because reconstruction failed; it is not the object.")

    return {
        "type": "mesh",
        "units": "relative",
        "vertex_count": len(vertices),
        "face_count": len(faces),
        "bounds": {
            "min": [x0, y0, z0],
            "max": [x1, y1, z1]
        },
        "preview_path": f"outputs/{job_id}/{preview_name}",
        "preview_format": "obj",
        "method": "aabb_fallback",
        "confidence": 0.2,
        "warnings": warnings
    }

def _empty_fallback() -> dict:
    return {
        "type": "mesh",
        "units": "relative",
        "vertex_count": 0,
        "face_count": 0,
        "bounds": {"min": [0,0,0], "max": [0,0,0]},
        "preview_path": "",
        "preview_format": "obj",
        "method": "fallback_empty",
        "confidence": 0.0,
        "warnings": ["No images or job ID provided."]
    }
