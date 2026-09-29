export type OnDeviceAiModuleEvents = {
  onToken: (params: { requestId: string; text: string }) => void;
  onDownloadProgress: (params: { bytes?: number; done?: boolean }) => void;
};

export type OnDeviceAvailability = {
  status: 'available' | 'downloadable' | 'downloading' | 'unavailable';
  reason?: 'deviceNotEligible' | 'notEnabled' | 'modelNotReady' | 'unsupportedOS' | 'unknown';
  engine: 'apple' | 'gemini-nano';
};
