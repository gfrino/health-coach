export type OnDeviceAiModuleEvents = {
  onToken: (params: { requestId: string; text: string }) => void;
  onDownloadProgress: (params: { bytes?: number; done?: boolean }) => void;
};

export type OnDeviceAvailability = {
  status: 'available' | 'downloadable' | 'downloading' | 'unavailable';
  reason?: 'deviceNotEligible' | 'notEnabled' | 'modelNotReady' | 'unsupportedOS' | 'unknown';
  engine: 'apple' | 'gemini-nano';
  /**
   * Private Cloud Compute (iOS 27, dalla build 1.41.0): modello Apple più capace sui server privati
   * di Apple. Assente nelle build precedenti e su Android.
   */
  pcc?: 'available' | 'quota' | 'deviceNotEligible' | 'systemNotReady' | 'notEntitled' | 'unsupportedOS';
};
