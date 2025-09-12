/**
 * SLS (Structured Light Sensor) Type Definitions
 */

export enum SensorType {
  KINECT_V1 = 'kinect_v1',
  KINECT_V2 = 'kinect_v2',
  AZURE_KINECT = 'azure_kinect',
  REALSENSE = 'realsense',
  ORBBEC = 'orbbec',
  STRUCTURE = 'structure',
  ZED = 'zed'
}

export enum SensorStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  CALIBRATING = 'calibrating',
  STREAMING = 'streaming',
  RECORDING = 'recording',
  ERROR = 'error'
}

export interface DepthSensor {
  id: string;
  name: string;
  type: SensorType;
  status: SensorStatus;
  capabilities: SensorCapabilities;
  connection: SensorConnection;
  calibration?: CalibrationData;
  lastSeen: Date;
}

export interface SensorCapabilities {
  depthResolution: Resolution;
  colorResolution?: Resolution;
  infraredResolution?: Resolution;
  depthRange: { min: number; max: number };
  fieldOfView: { horizontal: number; vertical: number };
  frameRate: number;
  hasColor: boolean;
  hasInfrared: boolean;
  hasIMU: boolean;
  hasSkeletalTracking: boolean;
  maxSkeletons: number;
}

export interface Resolution {
  width: number;
  height: number;
}

export interface SensorConnection {
  type: 'usb' | 'network';
  port?: string;
  address?: string;
  serialNumber?: string;
  firmwareVersion?: string;
}

export interface PointCloud {
  points: Float32Array;  // x, y, z coordinates
  colors?: Uint8Array;   // r, g, b values
  normals?: Float32Array; // nx, ny, nz normals
  timestamp: number;
  frameNumber: number;
  sensorId: string;
}

export interface DepthFrame {
  depthData: Uint16Array;  // Depth values in mm
  width: number;
  height: number;
  timestamp: number;
  frameNumber: number;
  minDepth: number;
  maxDepth: number;
}

export interface InfraredFrame {
  data: Uint8Array;
  width: number;
  height: number;
  timestamp: number;
  frameNumber: number;
}

export interface ColorFrame {
  data: Uint8Array;  // RGBA data
  width: number;
  height: number;
  timestamp: number;
  frameNumber: number;
}

export interface Skeleton {
  id: number;
  joints: Joint[];
  confidence: number;
  tracked: boolean;
  timestamp: number;
  centerOfMass?: Vector3;
  boundingBox?: BoundingBox3D;
}

export interface Joint {
  type: JointType;
  position: Vector3;
  orientation?: Quaternion;
  confidence: number;
  tracked: boolean;
}

export enum JointType {
  HEAD = 'head',
  NECK = 'neck',
  SHOULDER_LEFT = 'shoulder_left',
  SHOULDER_RIGHT = 'shoulder_right',
  ELBOW_LEFT = 'elbow_left',
  ELBOW_RIGHT = 'elbow_right',
  WRIST_LEFT = 'wrist_left',
  WRIST_RIGHT = 'wrist_right',
  HAND_LEFT = 'hand_left',
  HAND_RIGHT = 'hand_right',
  SPINE_SHOULDER = 'spine_shoulder',
  SPINE_MID = 'spine_mid',
  SPINE_BASE = 'spine_base',
  HIP_LEFT = 'hip_left',
  HIP_RIGHT = 'hip_right',
  KNEE_LEFT = 'knee_left',
  KNEE_RIGHT = 'knee_right',
  ANKLE_LEFT = 'ankle_left',
  ANKLE_RIGHT = 'ankle_right',
  FOOT_LEFT = 'foot_left',
  FOOT_RIGHT = 'foot_right'
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface BoundingBox3D {
  min: Vector3;
  max: Vector3;
  center: Vector3;
  size: Vector3;
}

export interface CalibrationData {
  intrinsics: CameraIntrinsics;
  extrinsics?: CameraExtrinsics;
  distortion?: DistortionCoefficients;
  timestamp: Date;
  accuracy?: number;
}

export interface CameraIntrinsics {
  fx: number;  // Focal length x
  fy: number;  // Focal length y
  cx: number;  // Principal point x
  cy: number;  // Principal point y
  width: number;
  height: number;
}

export interface CameraExtrinsics {
  rotation: number[];    // 3x3 rotation matrix
  translation: number[]; // 3x1 translation vector
}

export interface DistortionCoefficients {
  k1: number;
  k2: number;
  k3?: number;
  p1?: number;
  p2?: number;
}

export interface SLSDetection {
  id: string;
  type: DetectionType;
  skeleton?: Skeleton;
  anomaly?: DepthAnomaly;
  confidence: number;
  timestamp: number;
  frameNumber: number;
  position: Vector3;
  size?: Vector3;
  description: string;
}

export enum DetectionType {
  FIGURE = 'figure',
  SKELETAL = 'skeletal',
  ANOMALY = 'anomaly',
  MOTION = 'motion',
  SHADOW = 'shadow',
  MANIFESTATION = 'manifestation',
  DISTORTION = 'distortion'
}

export interface DepthAnomaly {
  type: 'void' | 'mass' | 'distortion' | 'unknown';
  region: BoundingBox3D;
  depthDeviation: number;
  volumetric: boolean;
  intensity: number;
}

export interface TrackingConfig {
  sensitivity: number;          // 0-1
  minConfidence: number;        // 0-1
  maxTrackingDistance: number;  // meters
  smoothing: number;           // 0-1
  predictionFrames: number;    // frames ahead to predict
  skeletonTracking: boolean;
  gestureRecognition: boolean;
  faceTracking: boolean;
}

export interface DetectionThresholds {
  minDepthChange: number;      // mm
  minVolumeSize: number;       // cubic meters
  motionThreshold: number;     // meters/second
  skeletonConfidence: number;  // 0-1
  anomalyIntensity: number;    // 0-1
  noiseReduction: number;      // 0-1
}

export interface RecordingConfig {
  format: 'ply' | 'pcd' | 'obj' | 'raw';
  includeColor: boolean;
  includeInfrared: boolean;
  includeNormals: boolean;
  compression: boolean;
  frameRate: number;
  duration?: number;
  outputPath: string;
}

export interface SLSFrame {
  depth?: DepthFrame;
  color?: ColorFrame;
  infrared?: InfraredFrame;
  pointCloud?: PointCloud;
  skeletons?: Skeleton[];
  detections?: SLSDetection[];
}

export interface VisualizationConfig {
  renderMode: 'points' | 'mesh' | 'wireframe';
  colorMode: 'depth' | 'rgb' | 'infrared' | 'normal' | 'height';
  pointSize: number;
  depthScale: number;
  colorScale: ColorScale;
  showSkeletons: boolean;
  showBoundingBoxes: boolean;
  showGrid: boolean;
  backgroundColor: string;
  cameraPosition?: Vector3;
  cameraTarget?: Vector3;
}

export interface ColorScale {
  min: string;  // hex color
  max: string;  // hex color
  steps?: string[];
}

export interface StreamStatistics {
  frameRate: number;
  droppedFrames: number;
  latency: number;
  bandwidth: number;
  pointsPerFrame: number;
  detectionsCount: number;
  skeletonsTracked: number;
}

export interface CalibrationStep {
  name: string;
  description: string;
  type: 'capture' | 'move' | 'wait';
  duration?: number;
  targetPosition?: Vector3;
  completed: boolean;
  data?: any;
}

export interface CalibrationSession {
  id: string;
  sensorId: string;
  steps: CalibrationStep[];
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: CalibrationData;
  error?: string;
}

export interface GestureEvent {
  type: 'wave' | 'swipe' | 'push' | 'pull' | 'circle' | 'custom';
  hand: 'left' | 'right' | 'both';
  direction?: Vector3;
  confidence: number;
  timestamp: number;
  skeletonId: number;
}

export interface FaceDetection {
  id: number;
  position: Vector3;
  orientation: Quaternion;
  bounds: BoundingBox3D;
  features?: FaceFeatures;
  expression?: string;
  confidence: number;
}

export interface FaceFeatures {
  leftEye?: Vector3;
  rightEye?: Vector3;
  nose?: Vector3;
  mouth?: Vector3;
  chin?: Vector3;
}

export interface DepthFilter {
  type: 'median' | 'bilateral' | 'temporal' | 'morphological';
  strength: number;
  kernelSize?: number;
  temporalWindow?: number;
}

export interface NoiseProfile {
  spatial: number;   // Spatial noise level
  temporal: number;  // Temporal noise level
  pattern: 'gaussian' | 'salt_pepper' | 'structured';
}

export interface SensorAlignment {
  depthToColor?: number[];  // 4x4 transformation matrix
  depthToInfrared?: number[];
  colorToDepth?: number[];
  timestamp: Date;
}

export interface EnvironmentMap {
  planes: Plane[];
  objects: Object3D[];
  boundaries: Vector3[];
  floorLevel: number;
  ceilingLevel?: number;
}

export interface Plane {
  normal: Vector3;
  distance: number;
  points: Vector3[];
  type: 'floor' | 'wall' | 'ceiling' | 'other';
}

export interface Object3D {
  id: string;
  type: string;
  position: Vector3;
  rotation: Quaternion;
  scale: Vector3;
  mesh?: MeshData;
}

export interface MeshData {
  vertices: Float32Array;
  indices: Uint32Array;
  normals?: Float32Array;
  uvs?: Float32Array;
}