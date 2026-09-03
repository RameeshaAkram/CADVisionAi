"""Segment 6 — Object Detector."""

import cv2
import numpy as np
import logging
from pathlib import Path
from backend.models.job_models import NormalizedImage
from backend.core.config import settings

logger = logging.getLogger(__name__)

def detect(images: list[NormalizedImage]) -> dict:
    """Detect object bounding box using classical foreground separation."""
    if not images:
        return _empty_result()
        
    best_bbox = None
    best_area = 0
    best_img_idx = -1
    best_confidence = 0.0
    
    warnings = []
    
    for i, img_meta in enumerate(images):
        img = cv2.imread(img_meta.stored_path)
        if img is None:
            continue
            
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        mask = None
        try:
            import rembg
            # rembg.remove returns RGBA, mask is alpha channel
            # For performance, we could skip this if the image is too large, but images are normalized
            rgba = rembg.remove(img)
            mask = rgba[:, :, 3]
            # Clean up the mask slightly
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
            morph = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
        except Exception as e:
            # Fallback to OpenCV
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
            h, w = gray.shape
            edge_pixels = np.concatenate([gray[0, :], gray[h-1, :], gray[:, 0], gray[:, w-1]])
            bg_mean = np.mean(edge_pixels)
            
            if bg_mean > 127:
                _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
            else:
                _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
                
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
            morph = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
            morph = cv2.morphologyEx(morph, cv2.MORPH_OPEN, kernel)
            
        # Find contours
        contours, _ = cv2.findContours(morph, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            continue
            
        # Find largest contour
        largest_contour = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(largest_contour)
        
        # If the largest contour is too small (e.g. < 2% of image), probably noise
        if area < (h * w * 0.02):
            continue
            
        # If the largest contour is too large (e.g. > 98%), probably failed separation
        if area > (h * w * 0.98):
            continue
            
        x, y, w_box, h_box = cv2.boundingRect(largest_contour)
        
        if area > best_area:
            best_area = area
            best_bbox = [int(x), int(y), int(w_box), int(h_box)]
            best_img_idx = i
            
            # Save the best mask
            mask_path = Path(images[best_img_idx].stored_path).parent / "best_mask.png"
            cv2.imwrite(str(mask_path), morph)
            
            # Confidence based on density of the bounding box and edge clearance
            bbox_area = w_box * h_box
            density = area / bbox_area if bbox_area > 0 else 0
            
            # Honest confidence: 
            # - High density -> solid object -> higher confidence
            # - Touches edges -> might be cut off -> lower confidence
            touches_edge = x <= 5 or y <= 5 or (x + w_box) >= (w - 5) or (y + h_box) >= (h - 5)
            
            best_confidence = float(density * 0.9)
            if touches_edge:
                best_confidence *= 0.6

    if best_bbox is None:
        warnings.append("Could not separate the object from the background.")
        return _empty_result(warnings)
        
    return {
        "components": [
            {
                "id": "part-1",
                "label": "main_object",
                "confidence": best_confidence,
                "bbox": best_bbox,
                "image_index": best_img_idx,
                "mask_path": str(mask_path)
            }
        ],
        "object_found": True,
        "warnings": warnings
    }

def _empty_result(warnings: list[str] = None) -> dict:
    return {
        "components": [],
        "object_found": False,
        "warnings": warnings or []
    }
