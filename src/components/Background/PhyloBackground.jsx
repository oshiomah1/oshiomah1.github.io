import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import './background.css';

export default function PhyloBackground() {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const frameIdRef = useRef(null);
  const phyloObjectRef = useRef(null);
  const qualitySettingRef = useRef('high');

  useEffect(() => {
    // Performance detection and quality settings
    detectPerformance();
    
    let rawNewick;
    let treeRoot;
    let maxDepth = 0;
    
    const sphereRadius = 300;
    const MIN_WEDGE = 3 * Math.PI / 180; // 3° in radians

    // Performance monitoring variables
    let frameCounter = 0;
    let lastTime = performance.now();
    let fpsHistory = [];

    const initScene = () => {
      sceneRef.current = new THREE.Scene();
      
      cameraRef.current = new THREE.PerspectiveCamera(
        75,
        canvasRef.current.clientWidth / canvasRef.current.clientHeight,
        0.1,
        1000
      );
      cameraRef.current.position.set(0, 0, 600);
      cameraRef.current.lookAt(0, 0, 0);
      
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

    /**
     * Parse Newick string into tree object
     * Optimized to avoid excessive string operations
     */
    function parseNewick(str) {
      const tokens = str.split(/\s*(;|\(|\)|,|:)\s*/);
      const stack = [];
      const tree = {};
      let current = tree;

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token === '(') {
          const child = { children: [] };
          if (!current.children) current.children = [];
          current.children.push(child);
          stack.push(current);
          current = child;
        } else if (token === ',') {
          const sibling = { children: [] };
          stack[stack.length - 1].children.push(sibling);
          current = sibling;
        } else if (token === ')') {
          current = stack.pop();
        } else if (token === ':') {
          // Next token is branch length - handled in next iteration
        } else if (token === ';') {
          break;
        } else {
          // Name or branch length
          const nextToken = tokens[i + 1];
          if (nextToken === ':') {
            current.name = token;
          } else {
            if (!current.name) {
              current.name = token;
            } else {
              current.length = parseFloat(token);
            }
          }
        }
      }
      return tree;
    }

    /**
     * Count leaves in each subtree
     * @returns {number} Number of leaves
     */
    function computeLeafCounts(node) {
      if (!node.children || node.children.length === 0) {
        node._leafCount = 1;
        return 1;
      }
      let sum = 0;
      for (let c of node.children) {
        sum += computeLeafCounts(c);
      }
      node._leafCount = sum;
      return sum;
    }

    /**
     * Calculate maximum tree depth
     */
    function getMaxDepth(node, depth = 0) {
      if (!node.children || node.children.length === 0) {
        return depth;
      }
      let best = depth;
      for (let c of node.children) {
        const d = getMaxDepth(c, depth + 1);
        if (d > best) best = d;
      }
      return best;
    }

    /**
     * Assign angles to each node in the tree
     * Uses spherical coordinates optimization
     */
    function assignAngles(node, startAngle, endAngle, depth) {
      // Map depth to theta (polar angle)
      node._theta = THREE.MathUtils.mapLinear(depth, 0, maxDepth, 0, Math.PI);
      // Use phi (azimuthal angle) from the parent's wedge
      node._phi = 0.5 * (startAngle + endAngle);

      if (!node.children || node.children.length === 0) return;

      const totalTips = node._leafCount || 1;
      const availableAngle = endAngle - startAngle;

      // Calculate wedges with minimum enforcement
      const wedges = [];
      let sumWedges = 0;
      for (let child of node.children) {
        const fraction = (child._leafCount || 1) / totalTips;
        const desired = fraction * availableAngle;
        const w = Math.max(MIN_WEDGE, desired);
        wedges.push(w);
        sumWedges += w;
      }

      // Scale if needed
      let scale = 1;
      if (sumWedges > availableAngle) {
        scale = availableAngle / sumWedges;
      }

      // Assign child angles recursively
      let currentAngle = startAngle;
      for (let i = 0; i < node.children.length; i++) {
        const w = wedges[i] * scale;
        const childStart = currentAngle;
        const childEnd = currentAngle + w;
        assignAngles(node.children[i], childStart, childEnd, depth + 1);
        currentAngle += w;
      }
    }

    /**
     * Convert spherical coordinates to Cartesian
     * Optimized with pre-calculated trigonometric values
     */
    function sphericalToCartesian(R, theta, phi) {
      const sinTheta = Math.sin(theta);
      const x = R * sinTheta * Math.cos(phi);
      const y = R * Math.cos(theta);
      const z = R * sinTheta * Math.sin(phi);
      return new THREE.Vector3(x, y, z);
    }

    /**
     * Build the tree geometry
     * Uses efficient BufferGeometry for better performance
     */
    function buildTreeGeometry(node, R) {
      // Create array for all line segments
      const linePoints = [];
      
      // Define recursive tree traversal function
      function traverseTree(node) {
        if (!node.children) return;
        
        // Current node position
        const { x, y, z } = sphericalToCartesian(R, node._theta, node._phi);
        const nodePos = new THREE.Vector3(x, y, z);
        
        // Add line segments to all children
        for (let child of node.children) {
          const { x: cx, y: cy, z: cz } = sphericalToCartesian(R, child._theta, child._phi);
          linePoints.push(nodePos, new THREE.Vector3(cx, cy, cz));
          traverseTree(child);
        }
      }
      
      // Start traversal
      traverseTree(node);
      
      // Create single efficient geometry from all points
      const geometry = new THREE.BufferGeometry().setFromPoints(linePoints);
      return geometry;
    }

    /**
     * Create and render the tree
     * Uses efficient WebGL rendering techniques
     */
    async function createPhyloTree() {
      try {
        // Fetch the Newick tree data
        const response = await fetch('src/assets/phylo.txt');
        const text = await response.text();
        rawNewick = text.split('\n');
        
        // Parse the tree
        treeRoot = parseNewick(rawNewick.join(''));
        
        // Compute tree metrics
        computeLeafCounts(treeRoot);
        maxDepth = getMaxDepth(treeRoot);
        
        // Assign node positions
        assignAngles(treeRoot, 0, 2 * Math.PI, 0);
        
        // Build geometry
        const geometry = buildTreeGeometry(treeRoot, sphereRadius);
        
        // Create shader material for distance-based fading
        const material = new THREE.ShaderMaterial({
          uniforms: {
            color: { value: new THREE.Color(0xffd700) }, // Gold color
            fogNear: { value: 300 },
            fogFar: { value: 800 }
          },
          vertexShader: `
            varying float vDistance;
            
            void main() {
              // Transform to world space
              vec4 worldPosition = modelMatrix * vec4(position, 1.0);
              
              // Calculate distance from camera
              vDistance = distance(worldPosition.xyz, cameraPosition);
              
              // Project to screen space
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
        
        // Create line segments for better performance
        const phyloObject = new THREE.LineSegments(geometry, material);
        sceneRef.current.add(phyloObject);
        phyloObjectRef.current = phyloObject;
        
        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        sceneRef.current.add(ambientLight);
        
      } catch (error) {
        console.error('Error creating phylogenetic tree:', error);
      }
    }

    /**
     * Main animation loop with performance monitoring
     */
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
            if (rendererRef.current) {
              rendererRef.current.setPixelRatio(1);
            }
          }
        }
        
        frameCounter = 0;
        lastTime = now;
      }
      
      // Apply rotation to the tree object
      if (phyloObjectRef.current) {
        phyloObjectRef.current.rotation.y += 0.003;
        phyloObjectRef.current.rotation.x += 0.001;
      }
      
      // Render the scene
      if (sceneRef.current && rendererRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    /**
     * Detect device performance capabilities
     */
    function detectPerformance() {
      // Try to access WebGL renderer info
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
      
      // Check device memory if available
      if (navigator.deviceMemory && navigator.deviceMemory < 4) {
        qualitySettingRef.current = 'low';
      }
    }

    /**
     * Handle window resize events
     */
    const handleResize = () => {
      if (!canvasRef.current || !rendererRef.current || !cameraRef.current) return;
      
      const container = canvasRef.current.parentElement;
      const width = container.clientWidth;
      const height = container.clientHeight;
      
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      
      rendererRef.current.setSize(width, height);
    };

    // Initialize 
    const container = canvasRef.current.parentElement;
    canvasRef.current.style.width = `${container.clientWidth}px`;
    canvasRef.current.style.height = `${container.clientHeight}px`;
    
    initScene();
    createPhyloTree();
    animate();
    
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
      }
      
      // Dispose of GPU resources
      if (phyloObjectRef.current) {
        phyloObjectRef.current.geometry.dispose();
        phyloObjectRef.current.material.dispose();
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