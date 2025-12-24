import React, { useState, Suspense, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import JSZip from 'jszip';

interface SimpleCubeProps {
  position?: [number, number, number];
  color?: string;
}

function SimpleCube({ position = [0, 0, 0], color = '#888888' }: SimpleCubeProps) {
  return (
    <mesh position={position}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

interface ThreeMFModelProps {
  url: string;
  onLoadStart: () => void;
  onLoadComplete: () => void;
  onError: (error: string) => void;
}

function ThreeMFModel({ url, onLoadStart, onLoadComplete, onError }: ThreeMFModelProps) {
  const [meshes, setMeshes] = useState<THREE.Mesh[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    if (hasStarted) return; // Prevent multiple loads

    let isCancelled = false;
    setHasStarted(true);

    const loadModel = async () => {
      try {
        onLoadStart();
        console.log('Starting to load 3MF file:', url);

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        console.log('3MF file loaded, size:', buffer.byteLength);

        const zip = new JSZip();
        const zipContent = await zip.loadAsync(buffer);
        console.log('ZIP extracted, files:', Object.keys(zipContent.files));

        // Find the 3D model file
        let modelFileName = '';
        Object.keys(zipContent.files).forEach(fileName => {
          if (fileName.match(/^3D\/.*\.model$/)) {
            modelFileName = fileName;
          }
        });

        if (!modelFileName) {
          console.log('Available files:', Object.keys(zipContent.files));
          throw new Error('No 3D model file found in 3MF');
        }

        console.log('Found model file:', modelFileName);

        const modelFile = zipContent.files[modelFileName];
        const modelXML = await modelFile.async('text');
        console.log('Model XML loaded, length:', modelXML.length);

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(modelXML, 'application/xml');

        const parseError = xmlDoc.querySelector('parsererror');
        if (parseError) {
          throw new Error('Failed to parse 3MF XML: ' + parseError.textContent);
        }

        console.log('XML parsed successfully');

        // Parse the model
        const resourcesNode = xmlDoc.querySelector('resources');
        if (!resourcesNode) {
          throw new Error('No resources found in 3MF model');
        }

        const objectNodes = resourcesNode.querySelectorAll('object');
        console.log('Found objects:', objectNodes.length);

        const createdMeshes: THREE.Mesh[] = [];

        objectNodes.forEach((objectNode, index) => {
          const meshNode = objectNode.querySelector('mesh');
          if (!meshNode) return;

          console.log(`Processing object ${index + 1}`);

          // Parse vertices
          const vertices: number[] = [];
          const vertexNodes = meshNode.querySelectorAll('vertices vertex');

          vertexNodes.forEach(vertex => {
            const x = parseFloat(vertex.getAttribute('x') || '0');
            const y = parseFloat(vertex.getAttribute('y') || '0');
            const z = parseFloat(vertex.getAttribute('z') || '0');
            vertices.push(x, y, z);
          });

          console.log(`Object ${index + 1}: ${vertexNodes.length} vertices`);

          // Parse triangles
          const indices: number[] = [];
          const triangleNodes = meshNode.querySelectorAll('triangles triangle');

          triangleNodes.forEach(triangle => {
            const v1 = parseInt(triangle.getAttribute('v1') || '0');
            const v2 = parseInt(triangle.getAttribute('v2') || '0');
            const v3 = parseInt(triangle.getAttribute('v3') || '0');
            indices.push(v1, v2, v3);
          });

          console.log(`Object ${index + 1}: ${triangleNodes.length} triangles`);

          if (vertices.length === 0 || indices.length === 0) {
            console.log(`Object ${index + 1}: No geometry data, skipping`);
            return;
          }

          // Create geometry
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
          geometry.setIndex(indices);
          geometry.computeVertexNormals();
          geometry.computeBoundingBox();

          // Create material
          const material = new THREE.MeshStandardMaterial({
            color: 0x888888,
            roughness: 0.4,
            metalness: 0.1,
            side: THREE.DoubleSide
          });

          // Create mesh
          const mesh = new THREE.Mesh(geometry, material);
          createdMeshes.push(mesh);

          console.log(`Object ${index + 1}: Mesh created successfully`);
        });

        if (createdMeshes.length === 0) {
          throw new Error('No valid meshes found in 3MF file');
        }

        // Center and scale all meshes together
        const boundingBox = new THREE.Box3();
        createdMeshes.forEach(mesh => {
          mesh.geometry.computeBoundingBox();
          if (mesh.geometry.boundingBox) {
            boundingBox.expandByObject(mesh);
          }
        });

        const center = boundingBox.getCenter(new THREE.Vector3());
        const size = boundingBox.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = maxDim > 0 ? 2 / maxDim : 1;

        createdMeshes.forEach(mesh => {
          mesh.position.sub(center);
          mesh.scale.setScalar(scale);
        });

        console.log(`Successfully created ${createdMeshes.length} meshes, scale: ${scale}`);

        if (!isCancelled) {
          setMeshes(createdMeshes);
          setIsLoaded(true);
          onLoadComplete();
        }

      } catch (error) {
        console.error('3MF loading error:', error);
        if (!isCancelled) {
          onError(error instanceof Error ? error.message : 'Unknown error loading 3MF');
        }
      }
    };

    loadModel();

    return () => {
      isCancelled = true;
    };
  }, []); // Empty dependency to run only once

  // Show a test cube while loading, but don't cause infinite re-renders
  if (!isLoaded) {
    return <SimpleCube color="#ff0000" />;
  }

  if (meshes.length === 0) {
    return <SimpleCube color="#0000ff" />;
  }

  return (
    <>
      {meshes.map((mesh, index) => (
        <primitive key={index} object={mesh} />
      ))}
    </>
  );
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
      backgroundColor: 'rgba(255,255,255,0.9)',
      padding: '12px 16px',
      borderRadius: '8px',
      border: '1px solid #ddd',
      pointerEvents: 'none'
    }}>
      3MF 모델 로딩 중...
    </div>
  );
}

export default function ThreeMFViewer() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      {/* Header */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 10,
        backgroundColor: 'rgba(255,255,255,0.95)',
        padding: '16px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        border: '1px solid #ddd'
      }}>
        <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
          3MF 뷰어
        </div>
        <div style={{ fontSize: '12px', color: '#666' }}>
          파일: linkedin.3mf {isLoading ? '(로딩 중...)' : '(완료)'}
        </div>
      </div>

      {/* Loading indicator */}
      {isLoading && <LoadingSpinner />}

      {/* Error display */}
      {error && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#ffebee',
          color: '#c62828',
          padding: '20px',
          borderRadius: '8px',
          border: '1px solid #ef5350',
          zIndex: 20,
          maxWidth: '400px'
        }}>
          <div style={{ fontWeight: '600', marginBottom: '8px' }}>로딩 오류</div>
          <div style={{ fontSize: '14px', marginBottom: '12px' }}>{error}</div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px',
              backgroundColor: '#c62828',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            새로고침
          </button>
        </div>
      )}

      {/* Debug info */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        zIndex: 10,
        backgroundColor: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '12px',
        borderRadius: '4px',
        fontSize: '12px',
        fontFamily: 'monospace'
      }}>
        <div>로딩 상태: {isLoading ? '진행중' : '완료'}</div>
        <div>에러: {error ? '있음' : '없음'}</div>
        <div>마우스: 드래그=회전, 휠=줌, 우클릭=이동</div>
      </div>

      {/* 3D Canvas */}
      <Canvas
        shadows
        camera={{
          position: [3, 3, 3],
          fov: 60
        }}
        style={{ background: 'linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%)' }}
      >
        <Suspense fallback={null}>
          <Environment preset="studio" />

          {/* Enhanced lighting */}
          <ambientLight intensity={0.6} />
          <directionalLight
            position={[10, 10, 5]}
            intensity={1}
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          <directionalLight
            position={[-5, 5, 5]}
            intensity={0.3}
          />

          {/* Show a red test cube immediately, then load the model */}
          <SimpleCube position={[2, 0, 0]} color="#00ff00" />

          <ThreeMFModel
            url="/linkedin.3mf"
            onLoadStart={() => setIsLoading(true)}
            onLoadComplete={() => setIsLoading(false)}
            onError={(err) => setError(err)}
          />

          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            panSpeed={1}
            rotateSpeed={1}
            zoomSpeed={1}
            minDistance={0.5}
            maxDistance={50}
            target={[0, 0, 0]}
          />

          {/* Ground grid for reference */}
          <gridHelper args={[10, 10, '#cccccc', '#eeeeee']} position={[0, -1, 0]} />
        </Suspense>
      </Canvas>
    </div>
  );
}