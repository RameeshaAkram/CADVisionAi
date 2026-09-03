# CAD AI Capture Guide

This guide explains how to properly capture photos or video of an object for AI-assisted reconstruction. **CAD AI is designed to produce a *draft* for downstream CAD authoring (like Fusion 360 or SolidWorks), not a direct CAM-ready file.**

## What You Need
1. **The Object**: A distinct physical object (e.g., a bracket, a mug, a tool).
2. **A Camera**: Any smartphone or digital camera.
3. **A Tape Measure**: You will need to measure exactly *one* major dimension (like overall height or width) so the AI can scale the model to real-world units.

## How to Shoot (Photos)
For the best results, follow these rules:

- **Quantity**: 8 to 20 clear, distinct photos are much better than 200 blurry ones.
- **Coverage**: Walk in a full circle around the object. Shoot all 4 sides, and include a few shots from a high angle to capture the top.
- **Overlap**: Ensure each photo shares some visual overlap with the previous one.
- **Focus**: Keep the object in sharp focus. Blurry photos will be automatically rejected.
- **Framing**: The object should fill 50–80% of the frame. Do not cut off the edges of the object.

## How to Shoot (Video)
If you prefer video:

- Shoot **one continuous clip** walking slowly in a 360° orbit around the object. 
- A 10-15 second video is usually sufficient. 
- Keep the camera steady and the object centered.

## Environment & Lighting
- **Lighting**: Even, diffused lighting is best. Avoid harsh shadows or extreme glares.
- **Background**: A plain, matte background (like a desk or floor) with high contrast to the object helps the AI separate the object from its surroundings.
- **Avoid Reflections**: Highly reflective or transparent objects (like glass or shiny chrome) are difficult for the AI to reconstruct.

## Limitations & Expectations
- **Hidden Surfaces**: The AI cannot reconstruct what it cannot see. Internal cavities or the bottom surface will be approximated or flat.
- **Draft Quality**: The output DXF and 3D mesh are AI-assisted approximations. They are not metrology-grade records.
- **Verification**: Always verify critical dimensions in your CAD software before manufacturing.
