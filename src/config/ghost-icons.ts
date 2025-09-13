/**
 * Ghost Hunter Icon Mappings
 * Maps Material Icons to ghost hunting features and functions
 */

// Import all required Material Icons
import {
  // Core Navigation & UI
  Home,
  Dashboard,
  Settings,
  Menu,
  Close,
  Search,
  FilterList,
  MoreVert,
  ArrowBack,
  ArrowForward,
  
  // Evidence Types
  Sensors as EmfIcon,
  Thermostat as TemperatureIcon,
  GraphicEq as AudioIcon,
  Videocam as VideoIcon,
  DirectionsRun as MotionIcon,
  Visibility as VisualIcon,
  CameraAlt as PhotoIcon,
  
  // Detection & Analysis
  Timeline,
  ShowChart,
  Insights,
  Psychology,
  TroubleshootOutlined,
  RadarOutlined,
  ScatterPlot,
  QueryStats,
  
  // Alerts & Notifications
  Warning,
  Error,
  Info,
  CheckCircle,
  NotificationImportant,
  NewReleases,
  ReportProblem,
  SecurityUpdate,
  
  // Recording & Playback
  PlayArrow,
  Pause,
  Stop,
  FiberManualRecord as Record,
  SkipNext,
  SkipPrevious,
  FastForward,
  FastRewind,
  VolumeUp,
  VolumeOff,
  
  // Tools & Equipment
  BuildCircle,
  Hardware,
  Memory,
  Router,
  Bluetooth,
  Usb,
  Cable,
  DeviceHub,
  
  // Data Management
  Save,
  Folder,
  FolderOpen,
  InsertDriveFile,
  CloudUpload,
  CloudDownload,
  Share,
  Delete,
  Archive,
  
  // Environmental
  LocationOn,
  Map,
  Explore,
  NightlightRound,
  WbSunny,
  Cloud,
  Air,
  Water,
  
  // Investigation Status
  PlayCircleOutline,
  PauseCircleOutline,
  StopCircle,
  RadioButtonChecked,
  AccessTime,
  Schedule,
  Event,
  DateRange,
  
  // Communication
  Mic,
  MicOff,
  Headset,
  Speaker,
  SpeakerPhone,
  CallEnd,
  SignalCellularAlt,
  WifiTethering,
  
  // Analysis Features
  AutoGraph,
  BarChart,
  PieChart,
  StackedLineChart,
  Equalizer,
  CompareArrows,
  TrendingUp,
  Analytics,
  
  // User Actions
  PersonAdd,
  GroupAdd,
  Edit,
  ContentCopy,
  ContentPaste,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  
  // Special Features
  AutoAwesome,
  Stars,
  FlashOn,
  FlashOff,
  NightSightAuto,
  RemoveRedEye,
  MotionPhotosOn,
  SlowMotionVideo,
  
  // Status Indicators
  SignalWifiStatusbar4Bar,
  SignalWifi4Bar,
  Battery90,
  BatteryCharging90,
  Storage,
  SdStorage,
  Speed,
  Timer
} from '@mui/icons-material';

// Ghost Hunter specific icon mappings
export const GhostIcons = {
  // Main Navigation
  navigation: {
    home: Home,
    dashboard: Dashboard,
    settings: Settings,
    menu: Menu,
    close: Close,
    search: Search,
    filter: FilterList,
    more: MoreVert,
    back: ArrowBack,
    forward: ArrowForward
  },
  
  // Evidence Types
  evidence: {
    emf: EmfIcon,
    temperature: TemperatureIcon,
    audio: AudioIcon,
    video: VideoIcon,
    motion: MotionIcon,
    visual: VisualIcon,
    photo: PhotoIcon,
    timeline: Timeline,
    chart: ShowChart
  },
  
  // Detection Systems
  detection: {
    analyze: Insights,
    psychology: Psychology,
    troubleshoot: TroubleshootOutlined,
    radar: RadarOutlined,
    scatter: ScatterPlot,
    stats: QueryStats,
    autoGraph: AutoGraph,
    compare: CompareArrows
  },
  
  // Alert Levels
  alerts: {
    safe: CheckCircle,
    info: Info,
    warning: Warning,
    danger: Error,
    critical: NotificationImportant,
    new: NewReleases,
    report: ReportProblem,
    security: SecurityUpdate
  },
  
  // Media Controls
  media: {
    play: PlayArrow,
    pause: Pause,
    stop: Stop,
    record: Record,
    next: SkipNext,
    previous: SkipPrevious,
    forward: FastForward,
    rewind: FastRewind,
    volumeUp: VolumeUp,
    volumeOff: VolumeOff
  },
  
  // Hardware & Sensors
  hardware: {
    sensor: Hardware,
    memory: Memory,
    router: Router,
    bluetooth: Bluetooth,
    usb: Usb,
    cable: Cable,
    hub: DeviceHub,
    build: BuildCircle
  },
  
  // File Operations
  files: {
    save: Save,
    folder: Folder,
    folderOpen: FolderOpen,
    file: InsertDriveFile,
    upload: CloudUpload,
    download: CloudDownload,
    share: Share,
    delete: Delete,
    archive: Archive
  },
  
  // Environment
  environment: {
    location: LocationOn,
    map: Map,
    explore: Explore,
    night: NightlightRound,
    day: WbSunny,
    cloud: Cloud,
    air: Air,
    water: Water
  },
  
  // Investigation
  investigation: {
    start: PlayCircleOutline,
    pause: PauseCircleOutline,
    stop: StopCircle,
    active: RadioButtonChecked,
    time: AccessTime,
    schedule: Schedule,
    event: Event,
    dateRange: DateRange
  },
  
  // Communication
  communication: {
    mic: Mic,
    micOff: MicOff,
    headset: Headset,
    speaker: Speaker,
    speakerPhone: SpeakerPhone,
    endCall: CallEnd,
    signal: SignalCellularAlt,
    tethering: WifiTethering
  },
  
  // Analysis
  analysis: {
    barChart: BarChart,
    pieChart: PieChart,
    lineChart: StackedLineChart,
    equalizer: Equalizer,
    trending: TrendingUp,
    analytics: Analytics
  },
  
  // Actions
  actions: {
    addPerson: PersonAdd,
    addGroup: GroupAdd,
    edit: Edit,
    copy: ContentCopy,
    paste: ContentPaste,
    undo: Undo,
    redo: Redo,
    zoomIn: ZoomIn,
    zoomOut: ZoomOut
  },
  
  // Special Features
  special: {
    auto: AutoAwesome,
    stars: Stars,
    flashOn: FlashOn,
    flashOff: FlashOff,
    nightMode: NightSightAuto,
    redEye: RemoveRedEye,
    motionPhoto: MotionPhotosOn,
    slowMotion: SlowMotionVideo
  },
  
  // Status
  status: {
    wifiStrong: SignalWifiStatusbar4Bar,
    wifi: SignalWifi4Bar,
    battery: Battery90,
    charging: BatteryCharging90,
    storage: Storage,
    sdCard: SdStorage,
    speed: Speed,
    timer: Timer
  }
};

// Helper function to get icon by path
export function getGhostIcon(category: keyof typeof GhostIcons, name: string) {
  const categoryIcons = GhostIcons[category];
  if (categoryIcons && name in categoryIcons) {
    return (categoryIcons as Record<string, string>)[name];
  }
  return null;
}

// Semantic icon mappings for common use cases
export const SemanticIcons = {
  // Evidence severity levels
  evidenceSeverity: {
    none: CheckCircle,
    low: Info,
    medium: Warning,
    high: Error,
    critical: NotificationImportant
  },
  
  // Connection status
  connectionStatus: {
    connected: CheckCircle,
    connecting: Timer,
    disconnected: Error,
    error: ReportProblem
  },
  
  // Recording states
  recordingState: {
    idle: Stop,
    recording: Record,
    paused: Pause,
    processing: Timer
  },
  
  // Analysis confidence
  confidence: {
    veryLow: Error,
    low: Warning,
    medium: Info,
    high: CheckCircle,
    veryHigh: Stars
  }
};

export default GhostIcons;