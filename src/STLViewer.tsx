import React, { useState, Suspense, ErrorInfo } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { STLLoader } from 'three-stdlib';
import * as THREE from 'three';

const colorPresets = {
  red: '#e53935',
  black: '#111111',
  pink: '#ff4fa3'
};

interface STLModelWithLoadingProps {
  url: string;
  color: string;
  onLoadStart: () => void;
  onLoadComplete: () => void;
  onError: (error: string) => void;
}

function STLModelWithLoading({ url, color, onLoadStart, onLoadComplete, onError }: STLModelWithLoadingProps) {
  const [hasStarted, setHasStarted] = React.useState(false);
  const meshRef = React.useRef<THREE.Mesh>(null);

  React.useEffect(() => {
    if (!hasStarted) {
      onLoadStart();
      setHasStarted(true);
    }
  }, [hasStarted, onLoadStart]);

  const geometry = useLoader(STLLoader, url);

  React.useEffect(() => {
    if (geometry) {
      onLoadComplete();
    }
  }, [geometry, onLoadComplete]);

  React.useEffect(() => {
    if (geometry && meshRef.current) {
      // Center the geometry
      geometry.computeBoundingBox();
      const bbox = geometry.boundingBox;
      if (bbox) {
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        geometry.translate(-center.x, -center.y, -center.z);

        // Calculate scale to fit in a reasonable view
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = maxDim > 0 ? 3 / maxDim : 1;

        meshRef.current.scale.set(scale, scale, scale);
      }

      // Ensure normals are computed correctly
      geometry.computeVertexNormals();
    }
  }, [geometry]);

  if (!geometry) {
    return null;
  }

  return (
    <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color={color}
        roughness={0.3}
        metalness={0.1}
      />
    </mesh>
  );
}

interface ErrorBoundaryProps {
  onError: (error: string) => void;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('STL viewer error:', error, errorInfo);
    this.props.onError('STL 파일 처리 중 오류가 발생했습니다.');
  }

  render() {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}

function LoadingSpinner() {
  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      color: '#666',
      fontSize: '16px',
      zIndex: 10,
      backgroundColor: 'rgba(255,255,255,0.8)',
      padding: '12px 16px',
      borderRadius: '8px',
      pointerEvents: 'none'
    }}>
      Loading STL model...
    </div>
  );
}

interface ColorButtonProps {
  color: string;
  isSelected: boolean;
  onClick: () => void;
  label: string;
}

function ColorButton({ color, isSelected, onClick, label }: ColorButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        backgroundColor: color,
        border: isSelected ? '3px solid #007acc' : '2px solid #ccc',
        borderRadius: '6px',
        width: '40px',
        height: '40px',
        margin: '0 8px',
        cursor: 'pointer',
        boxShadow: isSelected ? '0 2px 8px rgba(0,122,204,0.3)' : '0 1px 3px rgba(0,0,0,0.2)'
      }}
      title={label}
    />
  );
}

export default function STLViewer() {
  const [selectedColor, setSelectedColor] = useState(colorPresets.red);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      {/* Color Selection Panel */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 10,
        backgroundColor: 'rgba(255,255,255,0.9)',
        padding: '16px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <div style={{ marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
          색상 선택
        </div>
        <div style={{ display: 'flex' }}>
          <ColorButton
            color={colorPresets.red}
            isSelected={selectedColor === colorPresets.red}
            onClick={() => setSelectedColor(colorPresets.red)}
            label="빨강"
          />
          <ColorButton
            color={colorPresets.black}
            isSelected={selectedColor === colorPresets.black}
            onClick={() => setSelectedColor(colorPresets.black)}
            label="검정"
          />
          <ColorButton
            color={colorPresets.pink}
            isSelected={selectedColor === colorPresets.pink}
            onClick={() => setSelectedColor(colorPresets.pink)}
            label="핑크"
          />
        </div>
      </div>

      {/* Loading Display */}
      {isLoading && <LoadingSpinner />}

      {/* Error Display */}
      {error && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(255,0,0,0.1)',
          color: '#d32f2f',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #d32f2f',
          zIndex: 20
        }}>
          <strong>로딩 오류:</strong> {error}
          <br />
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: '8px', padding: '4px 8px' }}
          >
            새로고침
          </button>
        </div>
      )}

      {/* 3D Canvas */}
      <Canvas
        shadows
        camera={{
          position: [5, 5, 5],
          fov: 50
        }}
        style={{ background: '#f5f5f5' }}
      >
        <Suspense fallback={null}>
          <Environment preset="studio" />
          <ambientLight intensity={0.4} />
          <directionalLight
            position={[10, 10, 5]}
            intensity={1.5}
            castShadow
            shadow-mapSize={[2048, 2048]}
          />
          <pointLight position={[-10, -10, -10]} intensity={0.3} />
          <ErrorBoundary onError={setError}>
            <STLModelWithLoading
              url="/linkedin.stl"
              color={selectedColor}
              onLoadStart={() => setIsLoading(true)}
              onLoadComplete={() => setIsLoading(false)}
              onError={(err) => setError(err)}
            />
          </ErrorBoundary>
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            panSpeed={0.5}
            rotateSpeed={0.5}
            zoomSpeed={0.8}
            minDistance={1}
            maxDistance={20}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}