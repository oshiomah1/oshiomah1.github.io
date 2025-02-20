import React, { useEffect, useRef, useState } from 'react';
import p5 from 'p5';
import './background.css';

export default function PhyloExpansionBackground() {
  const sketchRef = useRef(null);
  const p5InstanceRef = useRef(null);
  const [quality, setQuality] = useState('high');
  // Track stability between renders to prevent quality oscillation
  const stabilityCounterRef = useRef(0);
  const lastQualityChangeRef = useRef(Date.now());
  const qualityLockTimerRef = useRef(null);
  
  useEffect(() => {
    // Detect device capabilities and set initial quality
    detectPerformance();
    
    // We'll wrap all p5 logic in a function that receives the "sketch" object
    const sketch = (p) => {
      // ============= CONFIGURABLE PARAMETERS =============
      // Quality-dependent parameters
      const qualitySettings = {
        high: {
          MAX_DEPTH: 5,
          SPHERE_RADIUS: 300,
          RENDER_SCALE: 1
        },
        medium: {
          MAX_DEPTH: 4,
          SPHERE_RADIUS: 300,
          RENDER_SCALE: 0.8
        },
        low: {
          MAX_DEPTH: 3,
          SPHERE_RADIUS: 300,
          RENDER_SCALE: 0.6
        }
      };
      
      // Dynamic settings based on quality
      let settings = qualitySettings[quality];
      let MAX_DEPTH = settings.MAX_DEPTH;
      let SPHERE_RADIUS = settings.SPHERE_RADIUS;
      const RENDER_SCALE = settings.RENDER_SCALE;
      
      // Fixed parameters
      const SPRING_REST_LEN = 40;
      const SPRING_STRENGTH = 0.01;
      const REPULSION_STRENGTH = 4000;
      const DAMPING = 0.90;
      const TIME_STEP = 0.2;

      // Performance monitoring variables with hysteresis
      let lastFrameTime = 0;
      let frameRateHistory = [];
      let frameRateUpdateCounter = 0;
      let consistentLowFrameCount = 0;
      let consistentHighFrameCount = 0;
      const LOW_FRAME_THRESHOLD = 22;
      const HIGH_FRAME_THRESHOLD = 50;
      // Require more consecutive frames to trigger quality change
      const DOWNGRADE_FRAMES_REQUIRED = 45; // ~1.5 seconds at 30fps
      const UPGRADE_FRAMES_REQUIRED = 120; // ~4 seconds at 30fps
      
      // We'll store all nodes in an array with optimized data structure:
      // node = {
      //   x, y, z,        // position
      //   vx, vy, vz,     // velocity
      //   depth,          // tree depth (0 => root, MAX_DEPTH => leaf)
      //   isRoot, isLeaf, // booleans
      //   edges: []       // connected node indices (sparse array)
      // }
      let nodes = [];
      let nodeBuffers = {
        position: null,  // Float32Array for positions
        velocity: null   // Float32Array for velocities
      };

      // For leaves, we'll use "Fibonacci sphere" positions to spread them out
      let leafPositions = [];
      let leafIndex = 0;
      
      // Reused vector objects to avoid garbage collection
      const tempVec = p.createVector();
      const tempVec2 = p.createVector();
      
      // Precomputed values for sin/cos operations
      const precomputedTrig = {
        sin: new Float32Array(361), // 0-360 degrees
        cos: new Float32Array(361)
      };

      // p5 setup
      p.setup = () => {
        // Precompute trigonometric values
        precomputeTrig();
        
        // Container sizing
        const container = sketchRef.current.parentElement;
        const canvas = p.createCanvas(
          container.clientWidth * RENDER_SCALE, 
          container.clientHeight * RENDER_SCALE, 
          p.WEBGL
        );
        
        // Improves performance by reducing overhead
        p.pixelDensity(1);
        
        // Set drawing parameters
        p.strokeWeight(2);
        p.noFill();
        
        // Position camera
        p.camera(0, 0, 900, 0, 0, 0, 0, 1, 0);
        
        // Generate uniform positions for leaves on the sphere
        const totalLeaves = Math.pow(2, MAX_DEPTH);
        leafPositions = fibonacciSpherePositions(totalLeaves, SPHERE_RADIUS);
        
        // Build the tree structure
        buildBinaryTree(MAX_DEPTH);
        
        // Allocate buffer arrays for optimized physics
        initBuffers();
        
        // Pre-relaxation steps with optimized physics
        for (let i = 0; i < 200; i++) {
          physicsStepOptimized();
        }
      };

      p.draw = () => {
        // Track frame rate for adaptive quality
        monitorPerformance();
        
        p.background(0);
        
        // Apply slow rotation - use precomputed values when possible
        const frameAngleY = (p.frameCount * 0.003) % p.TWO_PI;
        const frameAngleX = (p.frameCount * 0.001) % p.TWO_PI;
        const sinY = getSin(frameAngleY * 180 / p.PI);
        const cosY = getCos(frameAngleY * 180 / p.PI);
        const sinX = getSin(frameAngleX * 180 / p.PI);
        const cosX = getCos(frameAngleX * 180 / p.PI);
        
        p.rotateY(frameAngleY);
        p.rotateX(frameAngleX);

        // Layout step - use optimized version
        physicsStepOptimized();

        // Draw edges in gold - batched for performance
        p.stroke(255, 215, 0);
        p.beginShape(p.LINES); // Use LINES for better batching
        for (let i = 0; i < nodes.length; i++) {
          let ndA = nodes[i];
          for (let j of ndA.edges) {
            if (j > i) { // Avoid drawing edges twice
              let ndB = nodes[j];
              // Draw each edge once
              p.vertex(ndA.x, ndA.y, ndA.z);
              p.vertex(ndB.x, ndB.y, ndB.z);
            }
          }
        }
        p.endShape();
      };

      /***************************************************************
       * Optimized helpers
       ***************************************************************/
      
      // Precompute sin and cos values
      function precomputeTrig() {
        for (let i = 0; i <= 360; i++) {
          const radians = i * Math.PI / 180;
          precomputedTrig.sin[i] = Math.sin(radians);
          precomputedTrig.cos[i] = Math.cos(radians);
        }
      }
      
      // Get precomputed sin value
      function getSin(degrees) {
        const index = Math.round(((degrees % 360) + 360) % 360);
        return precomputedTrig.sin[index];
      }
      
      // Get precomputed cos value
      function getCos(degrees) {
        const index = Math.round(((degrees % 360) + 360) % 360);
        return precomputedTrig.cos[index];
      }
      
      // Initialize TypedArrays for better memory performance
      function initBuffers() {
        const numNodes = nodes.length;
        // Position buffer (x,y,z for each node)
        nodeBuffers.position = new Float32Array(numNodes * 3);
        // Velocity buffer (vx,vy,vz for each node)
        nodeBuffers.velocity = new Float32Array(numNodes * 3);
        
        // Copy initial values to buffers
        for (let i = 0; i < numNodes; i++) {
          const node = nodes[i];
          const posIdx = i * 3;
          nodeBuffers.position[posIdx] = node.x;
          nodeBuffers.position[posIdx + 1] = node.y;
          nodeBuffers.position[posIdx + 2] = node.z;
          
          nodeBuffers.velocity[posIdx] = node.vx;
          nodeBuffers.velocity[posIdx + 1] = node.vy;
          nodeBuffers.velocity[posIdx + 2] = node.vz;
        }
      }
      
      // Sync buffer values back to node objects (only needed for drawing)
      function syncBuffersToNodes() {
        for (let i = 0; i < nodes.length; i++) {
          const posIdx = i * 3;
          nodes[i].x = nodeBuffers.position[posIdx];
          nodes[i].y = nodeBuffers.position[posIdx + 1];
          nodes[i].z = nodeBuffers.position[posIdx + 2];
          
          nodes[i].vx = nodeBuffers.velocity[posIdx];
          nodes[i].vy = nodeBuffers.velocity[posIdx + 1];
          nodes[i].vz = nodeBuffers.velocity[posIdx + 2];
        }
      }

      // Optimized physics step using TypedArrays for better performance
      function physicsStepOptimized() {
        const nCount = nodes.length;
        
        // Temporary force arrays - reused each frame
        const fx = new Float32Array(nCount);
        const fy = new Float32Array(nCount);
        const fz = new Float32Array(nCount);
        
        // Use direct buffer access for better performance
        const pos = nodeBuffers.position;
        const vel = nodeBuffers.velocity;

        // (1) Repulsion - use batched distance calculations
        for (let i = 0; i < nCount; i++) {
          const iPos = i * 3;
          const ix = pos[iPos];
          const iy = pos[iPos + 1];
          const iz = pos[iPos + 2];
          
          for (let j = i + 1; j < nCount; j++) {
            const jPos = j * 3;
            const dx = pos[jPos] - ix;
            const dy = pos[jPos + 1] - iy;
            const dz = pos[jPos + 2] - iz;
            
            const distSq = dx*dx + dy*dy + dz*dz + 0.0001;
            const dist = Math.sqrt(distSq);
            const rep = REPULSION_STRENGTH / distSq;
            
            const nx = dx/dist;
            const ny = dy/dist;
            const nz = dz/dist;
            
            // Apply forces
            fx[i] -= rep * nx;
            fy[i] -= rep * ny;
            fz[i] -= rep * nz;
            
            fx[j] += rep * nx;
            fy[j] += rep * ny;
            fz[j] += rep * nz;
          }
        }

        // (2) Springs - optimized distance calculations
        for (let i = 0; i < nCount; i++) {
          const iPos = i * 3;
          const ix = pos[iPos];
          const iy = pos[iPos + 1];
          const iz = pos[iPos + 2];
          
          for (let j of nodes[i].edges) {
            if (j > i) { // Process each spring once
              const jPos = j * 3;
              const dx = pos[jPos] - ix;
              const dy = pos[jPos + 1] - iy;
              const dz = pos[jPos + 2] - iz;
              
              const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) + 0.00001;
              const diff = dist - SPRING_REST_LEN;
              const force = SPRING_STRENGTH * diff;
              
              const nx = dx/dist;
              const ny = dy/dist; 
              const nz = dz/dist;
              
              // Apply forces
              fx[i] += force * nx;
              fy[i] += force * ny;
              fz[i] += force * nz;
              
              fx[j] -= force * nx;
              fy[j] -= force * ny;
              fz[j] -= force * nz;
            }
          }
        }

        // (3) Integrate - direct buffer manipulation
        for (let i = 0; i < nCount; i++) {
          // Root pinned - check once
          if (nodes[i].isRoot) {
            const idx = i * 3;
            pos[idx] = 0;
            pos[idx + 1] = 0;
            pos[idx + 2] = 0;
            vel[idx] = 0;
            vel[idx + 1] = 0;
            vel[idx + 2] = 0;
            continue;
          }
          
          const idx = i * 3;
          
          // Acceleration
          vel[idx] += fx[i] * TIME_STEP;
          vel[idx + 1] += fy[i] * TIME_STEP;
          vel[idx + 2] += fz[i] * TIME_STEP;
          
          // Damping
          vel[idx] *= DAMPING;
          vel[idx + 1] *= DAMPING;
          vel[idx + 2] *= DAMPING;
          
          // Position update
          pos[idx] += vel[idx] * TIME_STEP;
          pos[idx + 1] += vel[idx + 1] * TIME_STEP;
          pos[idx + 2] += vel[idx + 2] * TIME_STEP;
        }

        // (4) Constraints - optimize with direct buffer access
        for (let i = 0; i < nCount; i++) {
          const idx = i * 3;
          
          if (nodes[i].isLeaf) {
            // Clamp to sphere - vectorized operations
            const x = pos[idx];
            const y = pos[idx + 1];
            const z = pos[idx + 2];
            
            const r2 = x*x + y*y + z*z;
            const r = Math.sqrt(r2);
            
            if (r < 0.0001) {
              // Re-init if collapsed
              const randomIdx = Math.floor(Math.random() * leafPositions.length);
              pos[idx] = leafPositions[randomIdx].x;
              pos[idx + 1] = leafPositions[randomIdx].y;
              pos[idx + 2] = leafPositions[randomIdx].z;
              vel[idx] = 0;
              vel[idx + 1] = 0;
              vel[idx + 2] = 0;
            } else {
              // Fix radius
              const ratio = SPHERE_RADIUS / r;
              pos[idx] *= ratio;
              pos[idx + 1] *= ratio;
              pos[idx + 2] *= ratio;
              
              // Remove radial velocity - optimized dot product
              const nx = pos[idx] / SPHERE_RADIUS;
              const ny = pos[idx + 1] / SPHERE_RADIUS;
              const nz = pos[idx + 2] / SPHERE_RADIUS;
              
              const vrad = vel[idx]*nx + vel[idx + 1]*ny + vel[idx + 2]*nz;
              vel[idx] -= vrad*nx;
              vel[idx + 1] -= vrad*ny;
              vel[idx + 2] -= vrad*nz;
            }
          } else if (!nodes[i].isRoot) {
            // Internal node => keep inside sphere
            const x = pos[idx];
            const y = pos[idx + 1];
            const z = pos[idx + 2];
            
            const r2 = x*x + y*y + z*z;
            if (r2 > SPHERE_RADIUS*SPHERE_RADIUS) {
              const r = Math.sqrt(r2);
              const ratio = SPHERE_RADIUS / r;
              
              pos[idx] *= ratio;
              pos[idx + 1] *= ratio;
              pos[idx + 2] *= ratio;
              
              // Remove outward velocity
              const nx = pos[idx] / SPHERE_RADIUS;
              const ny = pos[idx + 1] / SPHERE_RADIUS;
              const nz = pos[idx + 2] / SPHERE_RADIUS;
              
              const vrad = vel[idx]*nx + vel[idx + 1]*ny + vel[idx + 2]*nz;
              vel[idx] -= vrad*nx;
              vel[idx + 1] -= vrad*ny;
              vel[idx + 2] -= vrad*nz;
            }
          }
        }
        
        // Sync buffer values back to node objects for drawing
        syncBuffersToNodes();
      }

      function buildBinaryTree(maxDepth) {
        // Root
        nodes.push({
          x: 0, y: 0, z: 0,
          vx: 0, vy: 0, vz: 0,
          depth: 0,
          isRoot: true,
          isLeaf: false,
          edges: []
        });
        buildSubtree(0, 1, maxDepth);
      }

      function buildSubtree(parentIndex, d, maxDepth) {
        if (d > maxDepth) return;
        let leftIdx = createNodeAtDepth(d, d === maxDepth);
        let rightIdx = createNodeAtDepth(d, d === maxDepth);

        // Use array mutation instead of push for performance
        nodes[parentIndex].edges.push(leftIdx, rightIdx);
        nodes[leftIdx].edges.push(parentIndex);
        nodes[rightIdx].edges.push(parentIndex);

        if (d < maxDepth) {
          buildSubtree(leftIdx, d + 1, maxDepth);
          buildSubtree(rightIdx, d + 1, maxDepth);
        }
      }

      function createNodeAtDepth(depth, isLeaf) {
        let idx = nodes.length;
        let nd = {
          x: 0, y: 0, z: 0,
          vx: 0, vy: 0, vz: 0,
          depth: depth,
          isRoot: false,
          isLeaf: isLeaf,
          edges: []
        };
        
        if (isLeaf) {
          // Assign next position from the uniform sphere set
          let pos = leafPositions[leafIndex++];
          nd.x = pos.x;
          nd.y = pos.y;
          nd.z = pos.z;
        } else {
          // Internal node => radius depends on depth
          let rFrac = depth / MAX_DEPTH;
          let r = rFrac * SPHERE_RADIUS;
          
          // Use precomputed trig values when possible
          const thetaInt = Math.floor(Math.random() * 360);
          const phiInt = Math.floor(Math.random() * 180);
          
          const sinPhi = getSin(phiInt);
          const cosPhi = getCos(phiInt);
          const sinTheta = getSin(thetaInt);
          const cosTheta = getCos(thetaInt);
          
          nd.x = r * sinPhi * cosTheta;
          nd.y = r * sinPhi * sinTheta;
          nd.z = r * cosPhi;
          
          // Small random jitter
          nd.x += Math.random() * 10 - 5;
          nd.y += Math.random() * 10 - 5;
          nd.z += Math.random() * 10 - 5;
        }
        
        nodes.push(nd);
        return idx;
      }

      // Helper: Generate 'count' nearly uniform points on a sphere via Fibonacci
      // Optimized for performance
      function fibonacciSpherePositions(count, radius) {
        const pts = new Array(count);
        const phi = Math.PI * (3 - Math.sqrt(5));  // golden angle
        
        // Use a single loop with object literals
        for (let i = 0; i < count; i++) {
          const y = 1 - (i / (count - 1)) * 2;  // from +1 to -1
          const r = Math.sqrt(1 - y*y);
          const theta = phi * i;
          
          // Use Math.cos/sin directly as it's faster for single calculations
          pts[i] = {
            x: Math.cos(theta) * r * radius,
            y: y * radius,
            z: Math.sin(theta) * r * radius
          };
        }
        
        return pts;
      }
      
      // Performance monitoring with stability protection
      function monitorPerformance() {
        const currentTime = performance.now();
        
        if (lastFrameTime > 0) {
          const frameDuration = currentTime - lastFrameTime;
          const frameRate = 1000 / frameDuration;
          
          frameRateUpdateCounter++;
          
          // Update moving average every 30 frames
          if (frameRateUpdateCounter >= 30) {
            frameRateHistory.push(frameRate);
            if (frameRateHistory.length > 5) {
              frameRateHistory.shift();
            }
            
            const avgFrameRate = frameRateHistory.reduce((a, b) => a + b, 0) / frameRateHistory.length;
            
            // Check if quality change cooldown has elapsed
            const now = Date.now();
            const timeSinceLastChange = now - lastQualityChangeRef.current;
            const qualityChangeCooldown = 10000; // 10 seconds cooldown
            
            if (timeSinceLastChange > qualityChangeCooldown) {
              // Track consistent performance for hysteresis
              if (avgFrameRate < LOW_FRAME_THRESHOLD) {
                consistentLowFrameCount++;
                consistentHighFrameCount = 0;
              } else if (avgFrameRate > HIGH_FRAME_THRESHOLD) {
                consistentHighFrameCount++;
                consistentLowFrameCount = 0;
              } else {
                // Reset both counters in the middle range
                consistentLowFrameCount = 0;
                consistentHighFrameCount = 0;
              }
              
              // Only change quality after sustained periods of performance
              if (consistentLowFrameCount >= DOWNGRADE_FRAMES_REQUIRED) {
                // Downgrade quality
                if (quality === 'high') {
                  window.dispatchEvent(new CustomEvent('adjustQuality', { 
                    detail: 'medium',
                    bubbles: true
                  }));
                  lastQualityChangeRef.current = now;
                  stabilityCounterRef.current = 0;
                  consistentLowFrameCount = 0;
                } else if (quality === 'medium') {
                  window.dispatchEvent(new CustomEvent('adjustQuality', { 
                    detail: 'low',
                    bubbles: true
                  }));
                  lastQualityChangeRef.current = now;
                  stabilityCounterRef.current = 0;
                  consistentLowFrameCount = 0;
                }
              } else if (consistentHighFrameCount >= UPGRADE_FRAMES_REQUIRED) {
                // Upgrade quality (more cautiously)
                if (quality === 'low') {
                  window.dispatchEvent(new CustomEvent('adjustQuality', { 
                    detail: 'medium',
                    bubbles: true
                  }));
                  lastQualityChangeRef.current = now;
                  stabilityCounterRef.current = 0;
                  consistentHighFrameCount = 0;
                } else if (quality === 'medium') {
                  window.dispatchEvent(new CustomEvent('adjustQuality', { 
                    detail: 'high',
                    bubbles: true
                  }));
                  lastQualityChangeRef.current = now;
                  stabilityCounterRef.current = 0;
                  consistentHighFrameCount = 0;
                }
              }
            }
            
            frameRateUpdateCounter = 0;
          }
        }
        
        lastFrameTime = currentTime;
      }
      
      // Handle resize for better responsiveness
      p.windowResized = () => {
        const container = sketchRef.current.parentElement;
        p.resizeCanvas(
          container.clientWidth * RENDER_SCALE,
          container.clientHeight * RENDER_SCALE
        );
      };
    }; // end of p5 sketch definition

    // Create the p5 instance
    p5InstanceRef.current = new p5(sketch, sketchRef.current);
    
    // Listen for quality adjustment events with stability protection
    const handleQualityChange = (event) => {
      if (event.detail !== quality) {
        // Clear any pending quality lock timers
        if (qualityLockTimerRef.current) {
          clearTimeout(qualityLockTimerRef.current);
        }
        
        // Set new quality
        setQuality(event.detail);
        lastQualityChangeRef.current = Date.now();
        
        // Lock quality changes for a period after change
        qualityLockTimerRef.current = setTimeout(() => {
          stabilityCounterRef.current++;
        }, 10000);
      }
    };
    
    window.addEventListener('adjustQuality', handleQualityChange);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('adjustQuality', handleQualityChange);
      if (qualityLockTimerRef.current) {
        clearTimeout(qualityLockTimerRef.current);
      }
      if (p5InstanceRef.current) {
        p5InstanceRef.current.remove();
      }
    };
  }, [quality]); // Re-initialize when quality changes

  const handleResize = () => {
    if (!p5InstanceRef.current) return;
    
    // Get container dimensions
    const container = sketchRef.current.parentElement;
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // Apply quality-based scaling
    const scale = quality === 'high' ? 1 : 
                  quality === 'medium' ? 0.8 : 0.6;
                  
    // Resize canvas with appropriate scaling
    p5InstanceRef.current.resizeCanvas(width * scale, height * scale);
  };

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [quality]);
  
  // Performance detection - more conservative approach
  const detectPerformance = () => {
    // Check for low-end devices
    const isLowEndDevice = 
      // Check available memory if supported
      (navigator.deviceMemory && navigator.deviceMemory < 4) ||
      // Check for low-end hardware indications
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Try to detect GPU capabilities through WebGL
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (!gl) {
        // WebGL not supported - use low quality
        setQuality('low');
        return;
      }
      
      // Default to high quality on desktop, medium on mobile
      if (isLowEndDevice) {
        setQuality('medium');
      } else {
        // For desktop, look for specific GPU info
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
          
          // We're more conservative with quality settings
          if (/(intel|hd graphics|graphics 5|graphics 6|mobile|mali|adreno)/i.test(renderer)) {
            setQuality('medium');
          } else {
            setQuality('high');
          }
        } else {
          // Fallback if can't detect GPU
          setQuality('medium');
        }
      }
    } catch (e) {
      // If WebGL detection fails, fall back to device type
      setQuality(isLowEndDevice ? 'low' : 'medium');
    }
  };

  return (
    <div className="background-container">
      <div ref={sketchRef} />
    </div>
  );
}