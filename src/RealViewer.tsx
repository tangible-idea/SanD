import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { STLLoader } from 'three-stdlib';
import * as THREE from 'three';

// 색상 타입 정의
type ColorType = 'blue' | 'red' | 'pink' | 'black' | 'gold';

const COLOR_VALUES: Record<ColorType, [number, number, number]> = {
  blue: [0, 0.5, 1],
  red: [1, 0, 0],
  pink: [1, 0.2, 0.7],
  black: [0.1, 0.1, 0.1],
  gold: [1, 0.84, 0]
};

// STL 로더 컴포넌트 (Z축 높이별 색상)
function STLModel({ url, zThreshold, backText, color }: { url: string; zThreshold: number; backText: string; color: ColorType }) {
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

      const selectedColor = COLOR_VALUES[color];

      for (let i = 0; i < positionAttribute.count; i++) {
        const z = positionAttribute.getZ(i);

        if (z > actualZ) {
          // Z가 threshold보다 높으면 흰색
          colors.push(1, 1, 1);
        } else {
          // Z가 threshold보다 낮으면 선택한 색상
          colors.push(...selectedColor);
        }
      }

      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

      // 메시 업데이트 강제
      if (meshRef.current) {
        meshRef.current.geometry.attributes.color.needsUpdate = true;
      }
    }
  }, [geometry, zThreshold, color]);

  return (
    <group position={[0, 0.5, 0]}>
      <mesh ref={meshRef} geometry={geometry}>
        <meshStandardMaterial
          vertexColors={true}
          roughness={0.2}
          metalness={0.2}
        />
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
    </group>
  );
}

// STL 섹션 컴포넌트
function STLSection() {
  const [error, setError] = useState<string | null>(null);
  const [backText, setBackText] = useState('');
  const [selectedModel, setSelectedModel] = useState<'instagram' | 'linkedin'>('instagram');
  const [selectedColor, setSelectedColor] = useState<ColorType>('blue');
  const [isPanelVisible, setIsPanelVisible] = useState(true);
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
        borderRadius: '20px 20px 0 0',
        fontSize: '14px',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
        borderTop: '1px solid #e0e0e0',
        transform: isPanelVisible ? 'translateY(0)' : 'translateY(calc(100% - 60px))',
        transition: 'transform 0.3s ease-in-out'
      }}>
        {/* 핸들 바 */}
        <div
          onClick={() => setIsPanelVisible(!isPanelVisible)}
          style={{
            padding: '12px 20px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            userSelect: 'none'
          }}
        >
          <div style={{
            fontSize: '12px',
            color: '#666',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            {isPanelVisible ? '▼ 숨기기' : '▲ 설정 열기'}
          </div>
        </div>

        {/* 컨텐츠 영역 */}
        <div style={{padding: '0 20px 20px 20px'}}>

        <p style={{margin: '0 0 15px 0', fontSize: '16px', fontWeight: '600'}}>
          {selectedModel === 'instagram' ? 'Instagram' : 'LinkedIn'} NFC 악세서리 미리보기
        </p>

        {/* 모델 선택 버튼 */}
        <div style={{marginBottom: '15px'}}>
          <label style={{display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500'}}>
            모델 선택:
          </label>
          <div style={{display: 'flex', gap: '10px'}}>
            <button
              onClick={() => setSelectedModel('instagram')}
              style={{
                padding: '12px 24px',
                fontSize: '14px',
                border: selectedModel === 'instagram' ? '2px solid #E1306C' : '2px solid #e0e0e0',
                borderRadius: '12px',
                background: selectedModel === 'instagram' ? '#ffe0ec' : 'white',
                cursor: 'pointer',
                fontWeight: selectedModel === 'instagram' ? '600' : '400',
                transition: 'all 0.2s',
                flex: 1
              }}
            >
              Instagram
            </button>
            <button
              onClick={() => setSelectedModel('linkedin')}
              style={{
                padding: '12px 24px',
                fontSize: '14px',
                border: selectedModel === 'linkedin' ? '2px solid #0077B5' : '2px solid #e0e0e0',
                borderRadius: '12px',
                background: selectedModel === 'linkedin' ? '#e0f2ff' : 'white',
                cursor: 'pointer',
                fontWeight: selectedModel === 'linkedin' ? '600' : '400',
                transition: 'all 0.2s',
                flex: 1
              }}
            >
              LinkedIn
            </button>
          </div>
        </div>

        {/* 색상 선택 버튼 */}
        <div style={{marginBottom: '15px'}}>
          <label style={{display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500'}}>
            색상 선택:
          </label>
          <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
            {(['blue', 'red', 'pink', 'black', 'gold'] as ColorType[]).map((colorOption) => {
              const colorNames: Record<ColorType, string> = {
                blue: '파란색',
                red: '빨간색',
                pink: '핑크색',
                black: '검정색',
                gold: '황금색'
              };
              const colorHex: Record<ColorType, string> = {
                blue: '#0080ff',
                red: '#ff0000',
                pink: '#ff66b3',
                black: '#1a1a1a',
                gold: '#ffd700'
              };
              return (
                <button
                  key={colorOption}
                  onClick={() => setSelectedColor(colorOption)}
                  style={{
                    padding: '10px 16px',
                    fontSize: '13px',
                    border: selectedColor === colorOption ? '2px solid #333' : '2px solid #e0e0e0',
                    borderRadius: '10px',
                    background: 'white',
                    cursor: 'pointer',
                    fontWeight: selectedColor === colorOption ? '600' : '400',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <div style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: colorHex[colorOption],
                    border: '1px solid #ccc'
                  }}></div>
                  {colorNames[colorOption]}
                </button>
              );
            })}
          </div>
        </div>

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
      </div>

      <Canvas 
        camera={{ position: [3, 3, 3] }}
        style={{ touchAction: 'none' }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} castShadow />
        <directionalLight position={[-5, -5, 5]} intensity={0.8} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        <pointLight position={[5, 5, 5]} intensity={0.6} />

        <Suspense fallback={
          <mesh>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="orange" />
          </mesh>
        }>
          <STLModel
            url={`/${selectedModel}.stl`}
            zThreshold={zThreshold}
            backText={backText}
            color={selectedColor}
          />
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