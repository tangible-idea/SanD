import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { STLLoader } from 'three-stdlib';
import * as THREE from 'three';

// STL 로더 컴포넌트 (Z축 높이별 색상)
function STLModel({ url, zThreshold }: { url: string; zThreshold: number }) {
  const geometry = useLoader(STLLoader, url);
  const meshRef = useRef<THREE.Mesh>(null);

  // 지오메트리 초기 설정 (한 번만)
  useEffect(() => {
    if (geometry) {
      geometry.computeBoundingBox();
      const bbox = geometry.boundingBox;
      if (bbox) {
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        geometry.translate(-center.x, -center.y, -center.z);

        const size = new THREE.Vector3();
        bbox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
          const scale = 2 / maxDim;
          geometry.scale(scale, scale, scale);
        }
      }
      geometry.computeVertexNormals();
      geometry.computeBoundingBox(); // 스케일링 후 다시 계산
    }
  }, [geometry]);

  // Z threshold가 변경될 때마다 색상 업데이트
  useEffect(() => {
    if (geometry && geometry.boundingBox) {
      const positionAttribute = geometry.getAttribute('position');
      const colors = [];

      const bbox = geometry.boundingBox;
      const minZ = bbox.min.z;
      const maxZ = bbox.max.z;
      const range = maxZ - minZ;
      const actualZ = minZ + (range * zThreshold);

      console.log(`STL Z range: ${minZ.toFixed(2)} to ${maxZ.toFixed(2)}, threshold at: ${actualZ.toFixed(2)} (${(zThreshold * 100).toFixed(0)}%)`);

      for (let i = 0; i < positionAttribute.count; i++) {
        const z = positionAttribute.getZ(i);

        if (z > actualZ) {
          // Z가 threshold보다 높으면 흰색
          colors.push(1, 1, 1);
        } else {
          // Z가 threshold보다 낮으면 파란색
          colors.push(0, 0.5, 1);
        }
      }

      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

      // 메시 업데이트 강제
      if (meshRef.current) {
        meshRef.current.geometry.attributes.color.needsUpdate = true;
      }
    }
  }, [geometry, zThreshold]);

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial vertexColors={true} roughness={0.3} metalness={0.1} />
    </mesh>
  );
}

// STL 섹션 컴포넌트
function STLSection() {
  const [error, setError] = useState<string | null>(null);
  const zThreshold = 0.75; // 75% 고정

  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative'
    }}>
      <div style={{
        position: 'absolute',
        top: 10, left: 10, zIndex: 10,
        background: 'rgba(255,255,255,0.95)',
        padding: '15px',
        borderRadius: '8px',
        fontSize: '12px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        minWidth: '200px',
        maxWidth: '90vw'
      }}>
        <h3 style={{margin: '0 0 10px 0', fontSize: '14px'}}>STL 뷰어</h3>
        <p style={{margin: '0 0 10px 0', fontSize: '12px'}}>linkedin.stl</p>

        <div style={{marginBottom: '10px'}}>
          <label style={{display: 'block', marginBottom: '5px', fontSize: '11px'}}>
            Z 높이 기준점: 75%
          </label>
          <div style={{fontSize: '10px', color: '#666', marginTop: '2px'}}>
            이 높이보다 위: 흰색 | 아래: 파란색
          </div>
        </div>

        {error && <p style={{color: 'red', margin: '5px 0 0 0', fontSize: '11px'}}>에러: {error}</p>}
      </div>

      <Canvas camera={{ position: [3, 3, 3] }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.3} />

        <Suspense fallback={
          <mesh>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="orange" />
          </mesh>
        }>
          <STLModel url="/linkedin.stl" zThreshold={zThreshold} />
        </Suspense>

        <OrbitControls />
        <gridHelper args={[5, 5]} position={[0, -1, 0]} />
      </Canvas>
    </div>
  );
}


export default function RealViewer() {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      background: 'linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%)'
    }}>
      <STLSection />
    </div>
  );
}