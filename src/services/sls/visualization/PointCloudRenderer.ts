/**
 * Point Cloud Renderer
 * Real-time 3D visualization using Three.js
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { 
  PointCloud, 
  Skeleton, 
  Vector3,
  VisualizationConfig,
  BoundingBox3D,
  SLSDetection,
  JointType
} from '../types';
import { logger } from '../../../utils/logger';

export class PointCloudRenderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private container: HTMLElement;
  
  private pointCloudMesh: THREE.Points | null = null;
  private skeletonGroup: THREE.Group;
  private boundingBoxGroup: THREE.Group;
  private gridHelper: THREE.GridHelper | null = null;
  
  private config: VisualizationConfig;
  private animationId: number | null = null;
  private stats: { fps: number; points: number } = { fps: 0, points: 0 };

  constructor(container: HTMLElement, config?: Partial<VisualizationConfig>) {
    this.container = container;
    this.config = this.getDefaultConfig(config);
    
    // Initialize Three.js scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.config.backgroundColor);
    
    // Setup camera
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 10000);
    this.setCameraPosition(this.config.cameraPosition);
    
    // Setup renderer
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);
    
    // Setup controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.rotateSpeed = 0.5;
    this.controls.zoomSpeed = 1.2;
    this.controls.panSpeed = 0.8;
    
    if (this.config.cameraTarget) {
      this.controls.target.set(
        this.config.cameraTarget.x,
        this.config.cameraTarget.y,
        this.config.cameraTarget.z
      );
    }
    
    // Setup groups
    this.skeletonGroup = new THREE.Group();
    this.scene.add(this.skeletonGroup);
    
    this.boundingBoxGroup = new THREE.Group();
    this.scene.add(this.boundingBoxGroup);
    
    // Setup lighting
    this.setupLighting();
    
    // Setup helpers
    this.setupHelpers();
    
    // Handle resize
    window.addEventListener('resize', this.handleResize);
    
    // Start render loop
    this.startRenderLoop();
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(config?: Partial<VisualizationConfig>): VisualizationConfig {
    return {
      renderMode: 'points',
      colorMode: 'depth',
      pointSize: 2,
      depthScale: 1,
      colorScale: {
        min: '#0000ff',
        max: '#ff0000',
        steps: ['#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff0000']
      },
      showSkeletons: true,
      showBoundingBoxes: true,
      showGrid: true,
      backgroundColor: '#000000',
      cameraPosition: { x: 0, y: 500, z: 2000 },
      cameraTarget: { x: 0, y: 0, z: 0 },
      ...config
    };
  }

  /**
   * Setup lighting
   */
  private setupLighting(): void {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    
    // Directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 1000, 1000);
    this.scene.add(directionalLight);
    
    // Point light at camera position
    const pointLight = new THREE.PointLight(0xffffff, 0.3);
    this.camera.add(pointLight);
    this.scene.add(this.camera);
  }

  /**
   * Setup helpers
   */
  private setupHelpers(): void {
    // Grid
    if (this.config.showGrid) {
      this.gridHelper = new THREE.GridHelper(4000, 40, 0x444444, 0x222222);
      this.scene.add(this.gridHelper);
    }
    
    // Axes
    const axesHelper = new THREE.AxesHelper(500);
    this.scene.add(axesHelper);
  }

  /**
   * Update point cloud
   */
  updatePointCloud(pointCloud: PointCloud): void {
    // Remove existing point cloud
    if (this.pointCloudMesh) {
      this.scene.remove(this.pointCloudMesh);
      this.pointCloudMesh.geometry.dispose();
      if (Array.isArray(this.pointCloudMesh.material)) {
        this.pointCloudMesh.material.forEach(m => m.dispose());
      } else {
        this.pointCloudMesh.material.dispose();
      }
    }
    
    // Create geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(pointCloud.points, 3));
    
    // Add colors based on mode
    const colors = this.generateColors(pointCloud);
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    // Add normals if available
    if (pointCloud.normals) {
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(pointCloud.normals, 3));
    }
    
    // Create material
    const material = this.createPointMaterial();
    
    // Create points mesh
    this.pointCloudMesh = new THREE.Points(geometry, material);
    this.scene.add(this.pointCloudMesh);
    
    // Update stats
    this.stats.points = pointCloud.points.length / 3;
  }

  /**
   * Generate colors for point cloud
   */
  private generateColors(pointCloud: PointCloud): Float32Array {
    const numPoints = pointCloud.points.length / 3;
    const colors = new Float32Array(numPoints * 3);
    
    switch (this.config.colorMode) {
      case 'rgb':
        if (pointCloud.colors) {
          // Use provided colors
          for (let i = 0; i < numPoints; i++) {
            colors[i * 3] = pointCloud.colors[i * 3] / 255;
            colors[i * 3 + 1] = pointCloud.colors[i * 3 + 1] / 255;
            colors[i * 3 + 2] = pointCloud.colors[i * 3 + 2] / 255;
          }
        } else {
          // Default white
          colors.fill(1);
        }
        break;
        
      case 'depth':
        // Color by Z depth
        let minZ = Infinity, maxZ = -Infinity;
        for (let i = 0; i < numPoints; i++) {
          const z = pointCloud.points[i * 3 + 2];
          minZ = Math.min(minZ, z);
          maxZ = Math.max(maxZ, z);
        }
        
        for (let i = 0; i < numPoints; i++) {
          const z = pointCloud.points[i * 3 + 2];
          const t = (z - minZ) / (maxZ - minZ);
          const color = this.interpolateColor(t);
          colors[i * 3] = color.r;
          colors[i * 3 + 1] = color.g;
          colors[i * 3 + 2] = color.b;
        }
        break;
        
      case 'height':
        // Color by Y height
        let minY = Infinity, maxY = -Infinity;
        for (let i = 0; i < numPoints; i++) {
          const y = pointCloud.points[i * 3 + 1];
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
        
        for (let i = 0; i < numPoints; i++) {
          const y = pointCloud.points[i * 3 + 1];
          const t = (y - minY) / (maxY - minY);
          const color = this.interpolateColor(t);
          colors[i * 3] = color.r;
          colors[i * 3 + 1] = color.g;
          colors[i * 3 + 2] = color.b;
        }
        break;
        
      case 'normal':
        // Color by normal direction
        if (pointCloud.normals) {
          for (let i = 0; i < numPoints; i++) {
            colors[i * 3] = Math.abs(pointCloud.normals[i * 3]);
            colors[i * 3 + 1] = Math.abs(pointCloud.normals[i * 3 + 1]);
            colors[i * 3 + 2] = Math.abs(pointCloud.normals[i * 3 + 2]);
          }
        } else {
          colors.fill(0.5);
        }
        break;
        
      case 'infrared':
        // Grayscale for infrared
        for (let i = 0; i < numPoints; i++) {
          const value = 0.5 + Math.random() * 0.5; // Simulate IR intensity
          colors[i * 3] = value;
          colors[i * 3 + 1] = value;
          colors[i * 3 + 2] = value;
        }
        break;
        
      default:
        colors.fill(1);
    }
    
    return colors;
  }

  /**
   * Create point material
   */
  private createPointMaterial(): THREE.PointsMaterial {
    return new THREE.PointsMaterial({
      size: this.config.pointSize,
      vertexColors: true,
      sizeAttenuation: true,
      alphaTest: 0.5,
      transparent: true,
      opacity: 0.9
    });
  }

  /**
   * Interpolate color from gradient
   */
  private interpolateColor(t: number): { r: number; g: number; b: number } {
    const steps = this.config.colorScale.steps || [
      this.config.colorScale.min,
      this.config.colorScale.max
    ];
    
    const numSteps = steps.length - 1;
    const scaledT = t * numSteps;
    const stepIndex = Math.floor(scaledT);
    const stepT = scaledT - stepIndex;
    
    const color1 = new THREE.Color(steps[Math.min(stepIndex, numSteps)]);
    const color2 = new THREE.Color(steps[Math.min(stepIndex + 1, numSteps)]);
    
    return {
      r: color1.r + (color2.r - color1.r) * stepT,
      g: color1.g + (color2.g - color1.g) * stepT,
      b: color1.b + (color2.b - color1.b) * stepT
    };
  }

  /**
   * Update skeletons
   */
  updateSkeletons(skeletons: Skeleton[]): void {
    // Clear existing skeletons
    this.skeletonGroup.clear();
    
    if (!this.config.showSkeletons) return;
    
    for (const skeleton of skeletons) {
      if (skeleton.tracked) {
        this.renderSkeleton(skeleton);
      }
    }
  }

  /**
   * Render single skeleton
   */
  private renderSkeleton(skeleton: Skeleton): void {
    const group = new THREE.Group();
    
    // Joint spheres
    const jointGeometry = new THREE.SphereGeometry(20, 8, 8);
    const jointMaterial = new THREE.MeshPhongMaterial({
      color: skeleton.confidence > 0.7 ? 0x00ff00 : 0xffff00,
      emissive: 0x004400,
      emissiveIntensity: 0.2
    });
    
    const jointPositions: Map<JointType, THREE.Vector3> = new Map();
    
    for (const joint of skeleton.joints) {
      if (joint.tracked) {
        const sphere = new THREE.Mesh(jointGeometry, jointMaterial);
        sphere.position.set(joint.position.x, joint.position.y, joint.position.z);
        group.add(sphere);
        
        jointPositions.set(joint.type, new THREE.Vector3(
          joint.position.x,
          joint.position.y,
          joint.position.z
        ));
      }
    }
    
    // Bone connections
    const bones = this.getSkeletonBones();
    const lineGeometry = new THREE.BufferGeometry();
    const linePositions: number[] = [];
    
    for (const [joint1, joint2] of bones) {
      const pos1 = jointPositions.get(joint1);
      const pos2 = jointPositions.get(joint2);
      
      if (pos1 && pos2) {
        linePositions.push(pos1.x, pos1.y, pos1.z);
        linePositions.push(pos2.x, pos2.y, pos2.z);
      }
    }
    
    if (linePositions.length > 0) {
      lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x00ff00,
        linewidth: 2
      });
      const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
      group.add(lines);
    }
    
    // Add ID label
    if (skeleton.centerOfMass) {
      const label = this.createTextSprite(`ID: ${skeleton.id}`, 0xffffff);
      label.position.set(
        skeleton.centerOfMass.x,
        skeleton.centerOfMass.y + 200,
        skeleton.centerOfMass.z
      );
      group.add(label);
    }
    
    this.skeletonGroup.add(group);
  }

  /**
   * Get skeleton bone connections
   */
  private getSkeletonBones(): Array<[JointType, JointType]> {
    return [
      // Spine
      [JointType.HEAD, JointType.NECK],
      [JointType.NECK, JointType.SPINE_SHOULDER],
      [JointType.SPINE_SHOULDER, JointType.SPINE_MID],
      [JointType.SPINE_MID, JointType.SPINE_BASE],
      
      // Left arm
      [JointType.SPINE_SHOULDER, JointType.SHOULDER_LEFT],
      [JointType.SHOULDER_LEFT, JointType.ELBOW_LEFT],
      [JointType.ELBOW_LEFT, JointType.WRIST_LEFT],
      [JointType.WRIST_LEFT, JointType.HAND_LEFT],
      
      // Right arm
      [JointType.SPINE_SHOULDER, JointType.SHOULDER_RIGHT],
      [JointType.SHOULDER_RIGHT, JointType.ELBOW_RIGHT],
      [JointType.ELBOW_RIGHT, JointType.WRIST_RIGHT],
      [JointType.WRIST_RIGHT, JointType.HAND_RIGHT],
      
      // Left leg
      [JointType.SPINE_BASE, JointType.HIP_LEFT],
      [JointType.HIP_LEFT, JointType.KNEE_LEFT],
      [JointType.KNEE_LEFT, JointType.ANKLE_LEFT],
      [JointType.ANKLE_LEFT, JointType.FOOT_LEFT],
      
      // Right leg
      [JointType.SPINE_BASE, JointType.HIP_RIGHT],
      [JointType.HIP_RIGHT, JointType.KNEE_RIGHT],
      [JointType.KNEE_RIGHT, JointType.ANKLE_RIGHT],
      [JointType.ANKLE_RIGHT, JointType.FOOT_RIGHT]
    ];
  }

  /**
   * Update detections with bounding boxes
   */
  updateDetections(detections: SLSDetection[]): void {
    // Clear existing bounding boxes
    this.boundingBoxGroup.clear();
    
    if (!this.config.showBoundingBoxes) return;
    
    for (const detection of detections) {
      if (detection.position && detection.size) {
        this.renderBoundingBox(detection);
      }
    }
  }

  /**
   * Render bounding box for detection
   */
  private renderBoundingBox(detection: SLSDetection): void {
    const geometry = new THREE.BoxGeometry(
      detection.size!.x,
      detection.size!.y,
      detection.size!.z
    );
    
    const material = new THREE.MeshBasicMaterial({
      color: this.getDetectionColor(detection),
      wireframe: true,
      transparent: true,
      opacity: 0.5
    });
    
    const box = new THREE.Mesh(geometry, material);
    box.position.set(
      detection.position.x,
      detection.position.y,
      detection.position.z
    );
    
    // Add label
    const label = this.createTextSprite(
      `${detection.type} (${Math.round(detection.confidence * 100)}%)`,
      this.getDetectionColor(detection)
    );
    label.position.set(
      detection.position.x,
      detection.position.y + (detection.size!.y / 2) + 50,
      detection.position.z
    );
    
    this.boundingBoxGroup.add(box);
    this.boundingBoxGroup.add(label);
  }

  /**
   * Get color for detection type
   */
  private getDetectionColor(detection: SLSDetection): number {
    const colors: { [key: string]: number } = {
      figure: 0x00ff00,
      skeletal: 0x00ffff,
      anomaly: 0xff0000,
      motion: 0xffff00,
      shadow: 0x800080,
      manifestation: 0xff00ff,
      distortion: 0xff8800
    };
    
    return colors[detection.type] || 0xffffff;
  }

  /**
   * Create text sprite
   */
  private createTextSprite(text: string, color: number): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 64;
    
    context.fillStyle = '#000000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    context.font = '24px Arial';
    context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true
    });
    
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(200, 50, 1);
    
    return sprite;
  }

  /**
   * Set camera position
   */
  private setCameraPosition(position?: Vector3): void {
    if (position) {
      this.camera.position.set(position.x, position.y, position.z);
    } else {
      this.camera.position.set(0, 500, 2000);
    }
  }

  /**
   * Start render loop
   */
  private startRenderLoop(): void {
    let lastTime = performance.now();
    let frameCount = 0;
    
    const animate = () => {
      this.animationId = requestAnimationFrame(animate);
      
      // Update controls
      this.controls.update();
      
      // Render scene
      this.renderer.render(this.scene, this.camera);
      
      // Update FPS
      frameCount++;
      const currentTime = performance.now();
      if (currentTime - lastTime >= 1000) {
        this.stats.fps = frameCount;
        frameCount = 0;
        lastTime = currentTime;
      }
    };
    
    animate();
  }

  /**
   * Handle window resize
   */
  private handleResize = (): void => {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height);
  };

  /**
   * Update configuration
   */
  updateConfig(config: Partial<VisualizationConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Update scene background
    if (config.backgroundColor) {
      this.scene.background = new THREE.Color(config.backgroundColor);
    }
    
    // Update grid visibility
    if (config.showGrid !== undefined) {
      if (this.gridHelper) {
        this.gridHelper.visible = config.showGrid;
      }
    }
    
    // Update point size
    if (config.pointSize && this.pointCloudMesh) {
      const material = this.pointCloudMesh.material as THREE.PointsMaterial;
      material.size = config.pointSize;
    }
  }

  /**
   * Take screenshot
   */
  takeScreenshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  /**
   * Get statistics
   */
  getStats(): { fps: number; points: number } {
    return this.stats;
  }

  /**
   * Reset camera view
   */
  resetCamera(): void {
    this.setCameraPosition(this.config.cameraPosition);
    if (this.config.cameraTarget) {
      this.controls.target.set(
        this.config.cameraTarget.x,
        this.config.cameraTarget.y,
        this.config.cameraTarget.z
      );
    }
    this.controls.update();
  }

  /**
   * Clear scene
   */
  clear(): void {
    if (this.pointCloudMesh) {
      this.scene.remove(this.pointCloudMesh);
      this.pointCloudMesh.geometry.dispose();
      if (Array.isArray(this.pointCloudMesh.material)) {
        this.pointCloudMesh.material.forEach(m => m.dispose());
      } else {
        this.pointCloudMesh.material.dispose();
      }
      this.pointCloudMesh = null;
    }
    
    this.skeletonGroup.clear();
    this.boundingBoxGroup.clear();
  }

  /**
   * Dispose renderer
   */
  dispose(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    window.removeEventListener('resize', this.handleResize);
    
    this.clear();
    this.controls.dispose();
    this.renderer.dispose();
    
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}