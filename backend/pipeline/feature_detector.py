"""Segment 6 — Feature Detector (2D Contour Extraction)."""

import cv2
import numpy as np
import logging
from backend.models.job_models import NormalizedImage

logger = logging.getLogger(__name__)

def detect(images: list[NormalizedImage], components: list = None) -> dict:
    """Extract closed 2D contours from the primary image."""
    if not images:
        return {"contours": [], "warnings": ["No images provided."]}
        
    component = next((c for c in (components or []) if c.get("label") == "main_object"), None)
    primary_index = component.get("image_index", 0) if component else 0
    if primary_index < 0 or primary_index >= len(images):
        primary_index = 0
    img_meta = images[primary_index]
    img = cv2.imread(img_meta.stored_path)
    if img is None:
        return {"contours": [], "warnings": ["Could not read image."]}
        
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Prefer the detector's foreground mask so contour extraction is not
    # affected by the raw image's background brightness.
    mask_path = next((c.get("mask_path") for c in (components or []) if c.get("mask_path")), None)
    if mask_path and cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE) is not None:
        thresh = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
    else:
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    
    # Find contours with hierarchy to detect holes inside the main outline
    contours, hierarchy = cv2.findContours(thresh, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        return {"contours": [], "warnings": ["No contours found in the image."]}
        
    # Find the largest contour which we assume is the outer boundary of the part
    largest_idx = max(range(len(contours)), key=lambda i: cv2.contourArea(contours[i]))
    
    result_contours = []
    
    # The hierarchy array is [Next, Previous, First_Child, Parent]
    # We only care about the largest contour (outer) and its immediate children (holes)
    
    def process_contour(contour, role="outer"):
        # Simplify contour
        epsilon = 0.002 * cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, epsilon, True)
        # Convert to list of points
        points = [{"x": float(p[0][0]), "y": float(p[0][1])} for p in approx]
        return {
            "role": role,
            "points": points,
            "area": float(cv2.contourArea(approx)),
            "is_closed": True
        }
    
    # Add the outer contour
    result_contours.append(process_contour(contours[largest_idx], "outer"))
    
    # Add children (holes)
    if hierarchy is not None:
        child_idx = hierarchy[0][largest_idx][2]
        while child_idx >= 0:
            area = cv2.contourArea(contours[child_idx])
            if area > 100: # Filter out tiny noise holes
                result_contours.append(process_contour(contours[child_idx], "hole"))
            child_idx = hierarchy[0][child_idx][0] # Go to next sibling
            
    return {
        "contours": result_contours,
        "primary_image_index": primary_index,
        "warnings": []
    }
