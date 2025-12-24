import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

function TestCube() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="hotpink" />
    </mesh>
  );
}

function STLSection() {
  return (
    <div style={{
      width: '50%',
      height: '100%',
      position: 'relative',
      borderRight: '2px solid #333'
    }}>
      <div style={{
        position: 'absolute',
        top: 10, left: 10, zIndex: 10,
        background: 'rgba(255,255,255,0.9)',
        padding: '10px',
        borderRadius: '5px'
      }}>
        <h3>STL 뷰어</h3>
        <p>linkedin.stl 파일</p>
      </div>

      <Canvas camera={{ position: [2, 2, 2] }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} />
        <TestCube />
        <OrbitControls />
      </Canvas>
    </div>
  );
}

function ThreeMFSection() {
  return (
    <div style={{
      width: '50%',
      height: '100%',
      position: 'relative'
    }}>
      <div style={{
        position: 'absolute',
        top: 10, left: 10, zIndex: 10,
        background: 'rgba(255,255,255,0.9)',
        padding: '10px',
        borderRadius: '5px'
      }}>
        <h3>3MF 뷰어</h3>
        <p>linkedin.3mf 파일</p>
      </div>

      <Canvas camera={{ position: [2, 2, 2] }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} />
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.8, 32, 32]} />
          <meshStandardMaterial color="lightblue" />
        </mesh>
        <OrbitControls />
      </Canvas>
    </div>
  );
}

export default function SimpleViewer() {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      background: '#f0f0f0'
    }}>
      <STLSection />
      <ThreeMFSection />
    </div>
  );
}