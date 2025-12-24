import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { STLLoader } from 'three-stdlib';
import * as THREE from 'three';

// STL 로더 컴포넌트 (Z축 높이별 색상)
function STLModel({ url, zThreshold, backText }: { url: string; zThreshold: number; backText: string }) {
  const geometry = useLoader(STLLoader, url);
  const meshRef = useRef<THREE.Mesh>(null);
  const [modelSize, setModelSize] = useState<THREE.Vector3 | null>(null);

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
      
      // 모델 크기 저장 (스케일링 후)
      if (geometry.boundingBox) {
        const scaledSize = new THREE.Vector3();
        geometry.boundingBox.getSize(scaledSize);
        setModelSize(scaledSize.clone());
      }
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
    <>
      <mesh ref={meshRef} geometry={geometry}>
        <meshStandardMaterial vertexColors={true} roughness={0.3} metalness={0.1} />
      </mesh>
      
      {/* 뒷면에 텍스트 표시 */}
      {backText && modelSize && (
        <Text
          position={[0, 0, -modelSize.z / 2 - 0.005]}
          fontSize={0.3}
          color="#cccccc"
          anchorX="center"
          anchorY="middle"
          rotation={[0, Math.PI, 0]}
          depthOffset={-1}
          material-toneMapped={false}
        >
          {backText}
        </Text>
      )}
    </>
  );
}

// STL 섹션 컴포넌트
function STLSection() {
  const [error, setError] = useState<string | null>(null);
  const [backText, setBackText] = useState('');
  const zThreshold = 0.75; // 75% 고정

  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative'
    }}>
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0, zIndex: 10,
        background: 'rgba(255,255,255,0.98)',
        padding: '20px',
        borderRadius: '20px 20px 0 0',
        fontSize: '14px',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
        borderTop: '1px solid #e0e0e0'
      }}>

        <p style={{margin: '0 0 15px 0', fontSize: '16px', fontWeight: '600'}}>LinkedIn NFC 악세서리 미리보기</p>

        <div style={{marginBottom: '15px'}}>
          <label style={{display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500'}}>
            뒷면 텍스트 (최대 5글자):
          </label>
          <input
            type="text"
            value={backText}
            onChange={(e) => setBackText(e.target.value.slice(0, 5))}
            placeholder="텍스트를 입력하세요"
            maxLength={5}
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: '16px',
              border: '2px solid #e0e0e0',
              borderRadius: '12px',
              boxSizing: 'border-box',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = '#007acc'}
            onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
          />
          <div style={{fontSize: '12px', color: '#666', marginTop: '8px'}}>
            입력한 텍스트가 모델 뒷면에 표시됩니다
          </div>
        </div>

        {error && <p style={{color: '#d32f2f', margin: '10px 0 0 0', fontSize: '14px', padding: '10px', background: '#ffebee', borderRadius: '8px'}}>에러: {error}</p>}
      </div>

      <Canvas 
        camera={{ position: [3, 3, 3] }}
        style={{ touchAction: 'none' }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.3} />

        <Suspense fallback={
          <mesh>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="orange" />
          </mesh>
        }>
          <STLModel url="/linkedin.stl" zThreshold={zThreshold} backText={backText} />
        </Suspense>

        <OrbitControls 
          enableDamping
          dampingFactor={0.05}
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={2}
          maxDistance={10}
        />
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