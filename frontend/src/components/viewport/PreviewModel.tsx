import React, { useMemo } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Center, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import DimensionOverlay from './DimensionOverlay';

interface ModelProps {
  url: string;
  onExtentsCalculated: (extents: {x: number, y: number, z: number}) => void;
}

function Model({ url, onExtentsCalculated }: ModelProps) {
  const obj = useLoader(OBJLoader, url);

  const clonedObj = useMemo(() => {
    const clone = obj.clone();
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = new THREE.MeshStandardMaterial({
          color: '#8c8b89', // Warm matte grey
          roughness: 0.9,
          metalness: 0.1,
        });
      }
    });
    return clone;
  }, [obj]);

  React.useEffect(() => {
    const box = new THREE.Box3().setFromObject(clonedObj);
    const size = box.getSize(new THREE.Vector3());
    onExtentsCalculated({ x: size.x, y: size.y, z: size.z });
  }, [clonedObj, onExtentsCalculated]);

  return (
    <Center>
      <primitive object={clonedObj} />
    </Center>
  );
}

export default function PreviewModel({ url, status, showDimensions }: { url: string, status?: any, showDimensions: boolean }) {
  // Extract extents if we have them. 
  // We can compute them from the mesh using Box3, or assume relative bounds are ~ extents.
  // We need to wait until Model loads to compute extents exactly, or use backend bounds.
  // Let's use backend bounds if available? Actually, we don't have the raw bounds in the status response currently.
  // We'll compute extents within the Model component.

  const [extents, setExtents] = React.useState({ x: 0, y: 0, z: 0 });

  return (
    <div className="absolute inset-0">
      <Canvas camera={{ position: [200, 200, 200], fov: 50 }}>
        <ambientLight intensity={1.2} />
        <directionalLight position={[100, 200, 100]} intensity={1.5} />
        <directionalLight position={[-100, -200, -100]} intensity={0.5} />
        <directionalLight position={[100, -100, -100]} intensity={0.3} />
        
        <React.Suspense fallback={null}>
          <Model url={url} onExtentsCalculated={setExtents} />
          {status && status.measurements && (
            <DimensionOverlay 
              measurements={status.measurements} 
              extents={extents} 
              visible={showDimensions} 
            />
          )}
        </React.Suspense>
        
        <Grid 
          infiniteGrid 
          fadeDistance={1000} 
          sectionColor="#333" 
          cellColor="#222" 
          position={[0, -100, 0]} 
        />
        <OrbitControls enableDamping dampingFactor={0.05} />
      </Canvas>
    </div>
  );
}
