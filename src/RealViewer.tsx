import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { STLLoader } from 'three-stdlib';
import JSZip from 'jszip';
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

// 3MF 로더 컴포넌트
function ThreeMFModel({ url }: { url: string }) {
  const [mesh, setMesh] = useState<THREE.Mesh | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const load3MF = async () => {
      try {
        console.log('Loading 3MF:', url);

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        console.log('3MF buffer size:', buffer.byteLength);

        const zip = new JSZip();
        const zipContent = await zip.loadAsync(buffer);

        console.log('ZIP files:', Object.keys(zipContent.files));

        // 모든 3D 모델 파일 찾기
        const modelFileNames = [];
        for (const fileName of Object.keys(zipContent.files)) {
          if (fileName.match(/^3D\/.*\.model$/)) {
            modelFileNames.push(fileName);
          }
        }

        if (modelFileNames.length === 0) {
          throw new Error('No 3D model file found');
        }

        console.log('Found model files:', modelFileNames);

        // 모든 모델 파일을 파싱하여 오브젝트들을 수집
        let allObjectNodes: Element[] = [];
        let combinedXMLDoc = null;

        for (const modelFileName of modelFileNames) {
          console.log('Processing model file:', modelFileName);
          const modelFile = zipContent.files[modelFileName];
          const xmlText = await modelFile.async('text');

          console.log(`${modelFileName} XML length:`, xmlText.length);

          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlText, 'application/xml');

          const parseError = xmlDoc.querySelector('parsererror');
          if (parseError) {
            console.error(`XML parsing error in ${modelFileName}:`, parseError.textContent);
            continue;
          }

          // 첫 번째 유효한 XML을 기본으로 사용
          if (!combinedXMLDoc) {
            combinedXMLDoc = xmlDoc;
            console.log('XML root element:', xmlDoc.documentElement.tagName);
            console.log('All elements in XML:', Array.from(xmlDoc.querySelectorAll('*')).map(el => el.tagName));
          }

          // 이 파일의 모든 오브젝트 수집
          const objectNodes = xmlDoc.querySelectorAll('object');
          console.log(`${modelFileName}: found ${objectNodes.length} objects`);

          Array.from(objectNodes).forEach((obj, idx) => {
            const id = obj.getAttribute('id');
            const type = obj.getAttribute('type');
            console.log(`  ${modelFileName} Object ${idx}: id="${id}", type="${type}"`);
            allObjectNodes.push(obj);
          });
        }

        console.log(`Total objects found across all model files: ${allObjectNodes.length}`);
        console.log('All objects found in XML:', allObjectNodes.length);

        // 각 오브젝트의 ID와 위치 확인
        Array.from(allObjectNodes).forEach((obj, idx) => {
          const id = obj.getAttribute('id');
          const type = obj.getAttribute('type');
          const parent = (obj.parentNode as Element)?.tagName;
          console.log(`Object ${idx}: id="${id}", type="${type}", parent="${parent}"`);
        });

        if (allObjectNodes.length === 0) {
          throw new Error('No objects found');
        }

        // 모든 오브젝트를 확인하여 mesh를 찾기
        let allVertices: number[] = [];
        let allIndices: number[] = [];
        let meshesFound = 0;

        for (let i = 0; i < allObjectNodes.length; i++) {
          const obj = allObjectNodes[i];
          console.log(`Object ${i} attributes:`, Array.from(obj.attributes).map((attr: Attr) => `${attr.name}="${attr.value}"`));
          console.log(`Object ${i} children:`, Array.from(obj.children).map((child: Element) => child.tagName));

          // 자식 요소들을 더 자세히 살펴보기
          Array.from(obj.children).forEach((child: Element, idx) => {
            console.log(`  Child ${idx} (${child.tagName}) attributes:`, Array.from(child.attributes).map((attr: Attr) => `${attr.name}="${attr.value}"`));
            console.log(`  Child ${idx} children:`, Array.from(child.children).map((grandchild: Element) => grandchild.tagName));
          });

          // 직접 mesh 찾기
          let meshNode = obj.querySelector('mesh');

          if (!meshNode) {
            // components -> component에서 referenced object 찾기
            const componentsNode = obj.querySelector('components');
            if (componentsNode) {
              const componentNodes = componentsNode.querySelectorAll('component');
              console.log(`Found ${componentNodes.length} component references in object ${i}`);

              componentNodes.forEach((comp: Element, compIdx) => {
                const objectId = comp.getAttribute('objectid');
                console.log(`  Component ${compIdx} references object ID: ${objectId}`);

                if (objectId) {
                  // referenced object 찾기 (수집된 모든 오브젝트에서 검색)
                  const referencedObj = allObjectNodes.find(obj => obj.getAttribute('id') === objectId);
                  if (referencedObj) {
                    const referencedMesh = referencedObj.querySelector('mesh');
                    if (referencedMesh && !meshNode) {
                      meshNode = referencedMesh;
                      console.log(`Found mesh in referenced object ${objectId}`);
                    }
                  } else {
                    console.log(`Referenced object ${objectId} not found`);
                  }
                }
              });
            }
          }

          if (meshNode) {
            console.log(`Processing mesh from object ${i}`);

            // 버텍스 파싱
            const vertices: number[] = [];
            const vertexNodes = meshNode.querySelectorAll('vertices vertex');

            vertexNodes.forEach((vertex: Element) => {
              const x = parseFloat(vertex.getAttribute('x') || '0');
              const y = parseFloat(vertex.getAttribute('y') || '0');
              const z = parseFloat(vertex.getAttribute('z') || '0');
              vertices.push(x, y, z);
            });

            // 삼각형 파싱
            const indices: number[] = [];
            const triangleNodes = meshNode.querySelectorAll('triangles triangle');

            triangleNodes.forEach((triangle: Element) => {
              const v1 = parseInt(triangle.getAttribute('v1') || '0');
              const v2 = parseInt(triangle.getAttribute('v2') || '0');
              const v3 = parseInt(triangle.getAttribute('v3') || '0');
              // 기존 버텍스 인덱스에 offset 추가
              indices.push(
                v1 + allVertices.length / 3,
                v2 + allVertices.length / 3,
                v3 + allVertices.length / 3
              );
            });

            console.log(`Object ${i}: ${vertices.length/3} vertices, ${triangleNodes.length} triangles`);

            if (vertices.length > 0 && indices.length > 0) {
              allVertices.push(...vertices);
              allIndices.push(...indices);
              meshesFound++;
            }
          }
        }

        if (meshesFound === 0) {
          throw new Error('No valid mesh data found in 3MF file');
        }

        console.log(`Total: ${allVertices.length/3} vertices, ${allIndices.length/3} triangles from ${meshesFound} meshes`);

        // Three.js 지오메트리 생성
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(allVertices, 3));
        geometry.setIndex(allIndices);
        geometry.computeVertexNormals();
        geometry.computeBoundingBox();

        // 중앙 정렬 및 크기 조정
        const bbox = geometry.boundingBox;
        if (bbox) {
          const center = bbox.getCenter(new THREE.Vector3());
          const size = bbox.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = maxDim > 0 ? 2 / maxDim : 1;

          geometry.translate(-center.x, -center.y, -center.z);
          geometry.scale(scale, scale, scale);
        }

        const material = new THREE.MeshStandardMaterial({
          color: 0x888888,
          roughness: 0.4,
          metalness: 0.1
        });

        const createdMesh = new THREE.Mesh(geometry, material);

        if (!isCancelled) {
          setMesh(createdMesh);
          console.log('3MF loaded successfully');
        }

      } catch (err) {
        console.error('3MF loading error:', err);
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      }
    };

    load3MF();

    return () => {
      isCancelled = true;
    };
  }, [url]);

  if (error) {
    return (
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="red" />
      </mesh>
    );
  }

  if (!mesh) {
    return (
      <mesh>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="yellow" />
      </mesh>
    );
  }

  return <primitive object={mesh} />;
}

function STLSection() {
  const [error, setError] = useState<string | null>(null);
  const [zThreshold, setZThreshold] = useState(0.5); // 0.0~1.0 범위

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
        background: 'rgba(255,255,255,0.95)',
        padding: '15px',
        borderRadius: '8px',
        fontSize: '12px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        minWidth: '200px'
      }}>
        <h3 style={{margin: '0 0 10px 0'}}>STL 뷰어</h3>
        <p style={{margin: '0 0 10px 0'}}>linkedin.stl</p>

        <div style={{marginBottom: '10px'}}>
          <label style={{display: 'block', marginBottom: '5px', fontSize: '11px'}}>
            Z 높이 기준점: {(zThreshold * 100).toFixed(0)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={zThreshold}
            onChange={(e) => setZThreshold(parseFloat(e.target.value))}
            style={{
              width: '100%',
              height: '6px',
              borderRadius: '3px',
              background: 'linear-gradient(to right, #0080ff 0%, #ffffff 100%)',
              outline: 'none',
              cursor: 'pointer'
            }}
          />
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
        borderRadius: '5px',
        fontSize: '12px'
      }}>
        <h3>3MF 뷰어</h3>
        <p>linkedin.3mf</p>
      </div>

      <Canvas camera={{ position: [3, 3, 3] }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.3} />

        <ThreeMFModel url="/linkedin.3mf" />

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
      <ThreeMFSection />
    </div>
  );
}