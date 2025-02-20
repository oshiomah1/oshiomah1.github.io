import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import './background.css';

const Background = () => {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const frameIdRef = useRef(null);
  const edgesGroupRef = useRef(null);
  const orbInfosRef = useRef([]);
  const qualitySettingRef = useRef('high');

  const sphereRadius = 7.0;
  const orbSize = 0.015;
  const starSides = 7;
  const starStep = 2;
  const ringCount = 10;

  // Utility for clamped range mapping (like "fog fade")
  function mapRange(value, inMin, inMax, outMin, outMax) {
    const t = Math.max(0, Math.min(1, (value - inMin) / (inMax - inMin)));
    return outMin + t * (outMax - outMin);
  }

  // Performance detection function
  function detectPerformance() {
    // Check for WebGL capabilities
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) {
      qualitySettingRef.current = 'low';
      return;
    }
    
    // Check GPU info if available
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      
      // Lower quality for integrated GPUs
      if (/(intel|hd graphics|integrated)/i.test(renderer)) {
        qualitySettingRef.current = 'low';
      }
    }
    
    // Check device memory if available
    if (navigator.deviceMemory && navigator.deviceMemory < 4) {
      qualitySettingRef.current = 'low';
    }
  }

  useEffect(() => {
    // Detect performance capability first
    detectPerformance();
    
    // Performance monitoring variables
    let frameCounter = 0;
    let lastTime = performance.now();
    let fpsHistory = [];
    
    // Pre-calculate instances instead of generating individually
    const orbs = [];
    const connections = new Set();

    function generateStarPolygon(sides, step) {
      // Pre-allocate array with known size
      const baseIndices = new Array(sides);
      for (let i = 0; i < sides; i++) {
        baseIndices[i] = i;
      }
      
      const starIndices = [];
      let current = 0;
      while (true) {
        starIndices.push(current);
        current = (current + step) % sides;
        if (current === 0) break;
      }
      
      // Pre-allocate array with known size for better memory efficiency
      const points2D = new Array(starIndices.length);
      for (let i = 0; i < starIndices.length; i++) {
        const idx = starIndices[i];
        const angle = (2 * Math.PI * idx) / sides;
        const x = Math.cos(angle);
        const y = Math.sin(angle);
        points2D[i] = new THREE.Vector2(x, y);
      }
      return points2D;
    }

    // Optimized rotation functions using matrix operations
    function rotateAroundX(v, alpha) {
      const c = Math.cos(alpha);
      const s = Math.sin(alpha);
      return new THREE.Vector3(
        v.x,
        v.y * c - v.z * s,
        v.y * s + v.z * c
      );
    }

    function rotateAroundZ(v, alpha) {
      const c = Math.cos(alpha);
      const s = Math.sin(alpha);
      return new THREE.Vector3(
        v.x * c - v.y * s,
        v.x * s + v.y * c,
        v.z
      );
    }

    function buildStarSphere() {
      const baseStar2D = generateStarPolygon(starSides, starStep);
      const angleX = Math.PI / (ringCount - 1);
      const angleZ = (2 * Math.PI) / ringCount;
      
      // Pre-allocate for known size
      const expectedSize = ringCount * ringCount * baseStar2D.length;
      orbs.length = 0; // Clear existing array
      orbs.length = expectedSize; // Pre-allocate
      
      let orbIndex = 0;
      
      // Pre-compute trig values outside the loops
      const cosAnglesX = new Array(ringCount);
      const sinAnglesX = new Array(ringCount);
      const cosAnglesZ = new Array(ringCount);
      const sinAnglesZ = new Array(ringCount);
      
      for (let i = 0; i < ringCount; i++) {
        const alphaX = i * angleX;
        cosAnglesX[i] = Math.cos(alphaX);
        sinAnglesX[i] = Math.sin(alphaX);
        
        const alphaZ = i * angleZ;
        cosAnglesZ[i] = Math.cos(alphaZ);
        sinAnglesZ[i] = Math.sin(alphaZ);
      }
      
      // Vectorized approach
      for (let i = 0; i < ringCount; i++) {
        for (let j = 0; j < ringCount; j++) {
          for (let pIdx = 0; pIdx < baseStar2D.length; pIdx++) {
            const p = baseStar2D[pIdx];
            
            // Avoid creating temporary vectors - direct calculation
            // Rotate around X
            const rx_x = p.x;
            const rx_y = p.y * cosAnglesX[i] - 0 * sinAnglesX[i]; // z is 0
            const rx_z = p.y * sinAnglesX[i] + 0 * cosAnglesX[i]; // z is 0
            
            // Rotate around Z
            const rz_x = rx_x * cosAnglesZ[j] - rx_y * sinAnglesZ[j];
            const rz_y = rx_x * sinAnglesZ[j] + rx_y * cosAnglesZ[j];
            const rz_z = rx_z;
            
            // Normalize and scale
            const mag = Math.sqrt(rz_x*rz_x + rz_y*rz_y + rz_z*rz_z);
            orbs[orbIndex] = new THREE.Vector3(
              (rz_x / mag) * sphereRadius,
              (rz_y / mag) * sphereRadius,
              (rz_z / mag) * sphereRadius
            );
            orbIndex++;
          }
        }
      }
    }

    function addOrbs() {
      // Use instanced mesh for better performance
      const orbGeo = new THREE.SphereGeometry(1, 
        qualitySettingRef.current === 'high' ? 8 : 6, 
        qualitySettingRef.current === 'high' ? 8 : 6);
        
      const orbMat = new THREE.MeshStandardMaterial({
        color: 0xffdd33, // gold
        metalness: 0.8,
        roughness: 0.2,
        transparent: true,
        opacity: 1.0,
      });
      
      // Create instanced mesh
      const instancedMesh = new THREE.InstancedMesh(
        orbGeo, 
        orbMat, 
        orbs.length
      );
      
      const orbInfos = [];
      const matrix = new THREE.Matrix4();
      const scale = new THREE.Vector3(orbSize, orbSize, orbSize);
      
      for (let i = 0; i < orbs.length; i++) {
        matrix.makeTranslation(orbs[i].x, orbs[i].y, orbs[i].z);
        matrix.scale(scale);
        instancedMesh.setMatrixAt(i, matrix);
        
        // Store position data for connections
        orbInfos.push({ 
          position: orbs[i].clone(),
          index: i 
        });
      }
      
      instancedMesh.instanceMatrix.needsUpdate = true;
      sceneRef.current.add(instancedMesh);
      orbInfosRef.current = orbInfos;
    }

    function connectNearestNeighbors() {
      // Create a single group for all edges
      const edges = new THREE.Group();
      edgesGroupRef.current = edges;
      sceneRef.current.add(edges);
      
      function getSurfacePoint(c1, c2, r) {
        const dir = c2.clone().sub(c1).normalize();
        return c1.clone().add(dir.multiplyScalar(r));
      }
      
      // Use uniform approach for efficient batching
      const allLinePoints = [];
      const allLineMaterials = [];
      
      // Use spatial indexing for nearest neighbor search
      // Simple approach: sort by distance once per node
      const orbInfos = orbInfosRef.current;
      
      for (let i = 0; i < orbInfos.length; i++) {
        const distances = [];
        for (let j = 0; j < orbInfos.length; j++) {
          if (i === j) continue;
          const dist = orbInfos[i].position.distanceTo(orbInfos[j].position);
          distances.push({ index: j, dist });
        }
        distances.sort((a, b) => a.dist - b.dist);

        // Group indices by their distances
        const distanceGroups = [];
        let currentGroup = [distances[0]];
        let currentDist = distances[0].dist;

        for (let d = 1; d < distances.length; d++) {
          if (Math.abs(distances[d].dist - currentDist) < 1e-12) {
            currentGroup.push(distances[d]);
          } else {
            distanceGroups.push(currentGroup);
            currentGroup = [distances[d]];
            currentDist = distances[d].dist;
          }
        }
        if (currentGroup.length > 0) {
          distanceGroups.push(currentGroup);
        }

        // Connect to nodes in the first few distance groups
        // Limit based on quality setting
        const maxGroups = qualitySettingRef.current === 'high' ? 5 : 3;
        for (let g = 0; g < Math.min(maxGroups, distanceGroups.length); g++) {
          const group = distanceGroups[g];
          group.forEach(({ index }) => {
            const key = i < index ? `${i}-${index}` : `${index}-${i}`;
            if (!connections.has(key)) {
              connections.add(key);
              
              const start = getSurfacePoint(
                orbInfos[i].position,
                orbInfos[index].position,
                orbSize
              );
              const end = getSurfacePoint(
                orbInfos[index].position,
                orbInfos[i].position,
                orbSize
              );
              
              allLinePoints.push(start, end);
            }
          });
        }
      }
      
      // Create a single buffer geometry for all lines
      const linesGeometry = new THREE.BufferGeometry().setFromPoints(allLinePoints);
      
      // Create material with distance-based fading in shader
      const lineMaterial = new THREE.ShaderMaterial({
        uniforms: {
          color: { value: new THREE.Color(0xffd700) },
          fogNear: { value: 5 },
          fogFar: { value: 25 }
        },
        vertexShader: `
          varying float vDistance;
          
          void main() {
            // Transform to world space
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            
            // Calculate distance from camera
            vDistance = distance(worldPosition.xyz, cameraPosition);
            
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
          }
        `,
        fragmentShader: `
          uniform vec3 color;
          uniform float fogNear;
          uniform float fogFar;
          varying float vDistance;
          
          void main() {
            float alpha = 1.0 - smoothstep(fogNear, fogFar, vDistance);
            gl_FragColor = vec4(color, alpha);
          }
        `,
        transparent: true,
        depthWrite: false
      });
      
      // Create a single LineSegments object for better performance
      const lines = new THREE.LineSegments(linesGeometry, lineMaterial);
      edges.add(lines);
    }

    function initScene() {
      sceneRef.current = new THREE.Scene();
      
      // Camera setup
      cameraRef.current = new THREE.PerspectiveCamera(
        75,
        canvasRef.current.clientWidth / canvasRef.current.clientHeight,
        0.1,
        1000
      );
      cameraRef.current.position.z = 16;

      // Renderer with quality-based settings
      rendererRef.current = new THREE.WebGLRenderer({
        canvas: canvasRef.current,
        antialias: qualitySettingRef.current === 'high',
        powerPreference: 'high-performance'
      });
      rendererRef.current.setSize(
        canvasRef.current.clientWidth,
        canvasRef.current.clientHeight
      );
      rendererRef.current.setPixelRatio(
        qualitySettingRef.current === 'high' 
          ? Math.min(window.devicePixelRatio, 2) 
          : 1
      );

      // Minimal lighting
      const ambient = new THREE.AmbientLight(0xffffff, 0.3);
      sceneRef.current.add(ambient);
      const pointLight = new THREE.PointLight(0xffffff, 1, 100);
      pointLight.position.set(0, 0, 10);
      sceneRef.current.add(pointLight);
    }

    // Performance monitor and animation loop
    function animate() {
      frameIdRef.current = requestAnimationFrame(animate);
      
      // Performance monitoring
      frameCounter++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        const fps = Math.round(frameCounter * 1000 / (now - lastTime));
        fpsHistory.push(fps);
        
        if (fpsHistory.length > 5) {
          fpsHistory.shift();
          const avgFps = fpsHistory.reduce((sum, val) => sum + val, 0) / fpsHistory.length;
          
          // Dynamically adjust quality if needed
          if (avgFps < 30 && qualitySettingRef.current === 'high') {
            qualitySettingRef.current = 'low';
            if (rendererRef.current) {
              rendererRef.current.setPixelRatio(1);
            }
          }
        }
        
        frameCounter = 0;
        lastTime = now;
      }
      
      if (sceneRef.current && rendererRef.current && cameraRef.current) {
        // Slow rotation - more efficient than updating individual objects
        sceneRef.current.rotation.y += 0.001;
        
        // Render
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    }

    function handleResize() {
      if (!rendererRef.current || !cameraRef.current || !canvasRef.current) return;

      const container = canvasRef.current.parentElement;
      
      // Update size
      const width = container.clientWidth;
      const height = container.clientHeight;
      
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      
      rendererRef.current.setSize(width, height);
    }

    // Initialize
    const container = canvasRef.current.parentElement;
    canvasRef.current.style.width = `${container.clientWidth}px`;
    canvasRef.current.style.height = `${container.clientHeight}px`;

    initScene();
    buildStarSphere();
    addOrbs();
    connectNearestNeighbors();
    animate();

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
      }
      
      // Proper disposal of GPU resources
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      
      if (edgesGroupRef.current) {
        edgesGroupRef.current.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
      }
      
      if (sceneRef.current) {
        sceneRef.current.clear();
      }
    };
  }, []);

  return (
    <div className="background-container">
      <canvas ref={canvasRef} id="backgroundCanvas" />
    </div>
  );
};

export default Background;