import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import './background.css';

export default function DragonSphereBackground() {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const linesRef = useRef(null);
  const frameIdRef = useRef(null);
  const qualitySettingRef = useRef('high');

  useEffect(() => {
    const sphereRadius = 200;
    const iterations = qualitySettingRef.current === 'high' ? 11 : 9;
    
    // Initialize scene, camera, and renderer
    const initThree = () => {
      sceneRef.current = new THREE.Scene();
      
      // Camera setup
      cameraRef.current = new THREE.PerspectiveCamera(
        60,
        canvasRef.current.clientWidth / canvasRef.current.clientHeight,
        0.1,
        2000
      );
      cameraRef.current.position.set(0, 0, 600);
      cameraRef.current.lookAt(0, 0, 0);
      
      // Renderer with antialiasing only on high-end devices
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
    };
    
    // Generate 2D dragon curve points
    const generateDragonCurve = (iterations) => {
      let path = [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(1, 0)
      ];
      
      for (let i = 0; i < iterations; i++) {
        path = iterateDragon(path);
      }
      
      return path;
    };
    
    const iterateDragon = (path) => {
      const pivot = path[path.length - 1];
      const newPath = [...path];
      
      for (let i = path.length - 2; i >= 0; i--) {
        const dx = path[i].x - pivot.x;
        const dy = path[i].y - pivot.y;
        // 90° rotation about pivot => (dx, dy) → (−dy, dx)
        const rx = -dy;
        const ry = dx;
        newPath.push(new THREE.Vector2(pivot.x + rx, pivot.y + ry));
      }
      
      return newPath;
    };
    
    // Find min/max values in 2D points array
    const find2DMinMax = (points) => {
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      
      for (const point of points) {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
      }
      
      return { minX, maxX, minY, maxY };
    };
    
    // Convert spherical to cartesian coordinates
    const sphericalToCartesian = (theta, phi, r) => {
      const x = r * Math.sin(theta) * Math.cos(phi);
      const y = r * Math.sin(theta) * Math.sin(phi);
      const z = r * Math.cos(theta);
      
      return new THREE.Vector3(x, y, z);
    };
    
    // Create dragon curve on sphere surface
    const createDragonCurveOnSphere = () => {
      // Generate the 2D dragon curve
      const dragon2D = generateDragonCurve(iterations);
      const { minX, maxX, minY, maxY } = find2DMinMax(dragon2D);
      
      // Create a single line geometry using BufferGeometry for better performance
      const linePoints = [];
      
      // Map each segment onto the sphere
      for (let i = 0; i < dragon2D.length - 1; i++) {
        const xA = THREE.MathUtils.mapLinear(dragon2D[i].x, minX, maxX, -1, 1);
        const yA = THREE.MathUtils.mapLinear(dragon2D[i].y, minY, maxY, -1, 1);
        const xB = THREE.MathUtils.mapLinear(dragon2D[i + 1].x, minX, maxX, -1, 1);
        const yB = THREE.MathUtils.mapLinear(dragon2D[i + 1].y, minY, maxY, -1, 1);
        
        const thetaA = THREE.MathUtils.mapLinear(yA, -1, 1, 0, Math.PI);
        const phiA = THREE.MathUtils.mapLinear(xA, -1, 1, -Math.PI, Math.PI);
        const thetaB = THREE.MathUtils.mapLinear(yB, -1, 1, 0, Math.PI);
        const phiB = THREE.MathUtils.mapLinear(xB, -1, 1, -Math.PI, Math.PI);
        
        const pA = sphericalToCartesian(thetaA, phiA, sphereRadius);
        const pB = sphericalToCartesian(thetaB, phiB, sphereRadius);
        
        linePoints.push(pA, pB);
      }
      
      // Create a more efficient BufferGeometry for all lines
      const geometry = new THREE.BufferGeometry().setFromPoints(linePoints);
      
      // We'll calculate distance in the shader instead of pre-computing it
      // This approach ensures the fog effect updates correctly with rotation
      
      // Custom shader material with camera-based fog
      const material = new THREE.ShaderMaterial({
        uniforms: {
          color: { value: new THREE.Color(0xffd700) },
          fogNear: { value: 300 },
          fogFar: { value: 800 }
          // No need to define cameraPosition as it's already available in Three.js shaders
        },
        vertexShader: `
          varying float vDistance;
          
          void main() {
            // Transform to world space
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            
            // Calculate distance from camera to this vertex in world space
            // cameraPosition is a built-in uniform in Three.js
            vDistance = distance(worldPosition.xyz, cameraPosition);
            
            // Standard projection
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
      
      // Create line segments for better performance than LINE
      const lines = new THREE.LineSegments(geometry, material);
      sceneRef.current.add(lines);
      linesRef.current = lines;
      
      // Add simple ambient light
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      sceneRef.current.add(ambientLight);
    };
    
    // Animation loop with performance monitoring
    let frameCounter = 0;
    let lastTime = performance.now();
    let fpsHistory = [];
    
    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate);
      
      // Performance monitoring
      frameCounter++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        const fps = Math.round(frameCounter * 1000 / (now - lastTime));
        fpsHistory.push(fps);
        
        if (fpsHistory.length > 10) {
          fpsHistory.shift();
          const avgFps = fpsHistory.reduce((sum, val) => sum + val, 0) / fpsHistory.length;
          
          // Dynamically adjust quality if needed
          if (avgFps < 30 && qualitySettingRef.current === 'high') {
            qualitySettingRef.current = 'low';
            rendererRef.current.setPixelRatio(1);
            // Further optimizations could be applied here
          }
        }
        
        frameCounter = 0;
        lastTime = now;
      }
      
      // Update rotation
      if (linesRef.current) {
        linesRef.current.rotation.y += 0.0015;
        linesRef.current.rotation.x += 0.0005;
        
        // No need to update cameraPosition as it's handled automatically by Three.js
      }
      
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    };
    
    // Resize handler
    const handleResize = () => {
      if (!canvasRef.current || !rendererRef.current || !cameraRef.current) return;
      
      const container = canvasRef.current.parentElement;
      const width = container.clientWidth;
      const height = container.clientHeight;
      
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      
      rendererRef.current.setSize(width, height);
    };
    
    // Detect device performance
    const detectPerformance = () => {
      const gl = document.createElement('canvas').getContext('webgl');
      if (!gl) {
        qualitySettingRef.current = 'low';
        return;
      }
      
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        
        // Set low quality for known low-performance GPUs
        if (/(intel|hd graphics|integrated)/i.test(renderer)) {
          qualitySettingRef.current = 'low';
        }
      }
      
      // Also check device memory if available
      if (navigator.deviceMemory && navigator.deviceMemory < 4) {
        qualitySettingRef.current = 'low';
      }
    };
    
    // Initialize
    detectPerformance();
    
    const container = canvasRef.current.parentElement;
    canvasRef.current.style.width = `${container.clientWidth}px`;
    canvasRef.current.style.height = `${container.clientHeight}px`;
    
    initThree();
    createDragonCurveOnSphere();
    animate();
    
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
      }
      
      // Dispose of all resources
      if (linesRef.current) {
        linesRef.current.geometry.dispose();
        linesRef.current.material.dispose();
      }
      
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      
      if (sceneRef.current) {
        sceneRef.current.clear();
      }
    };
  }, []);
  
  return (
    <div className="background-container">
      <canvas ref={canvasRef} />
    </div>
  );
}