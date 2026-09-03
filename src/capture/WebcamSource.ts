export interface CameraOption { deviceId: string; label: string; }

export async function listCameras(): Promise<CameraOption[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === "videoinput").map((device, index) => ({
    deviceId: device.deviceId,
    label: device.label || `Camera ${index + 1}`,
  }));
}

export async function startCamera(deviceId?: string): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: deviceId ? { deviceId: { exact: deviceId } } : { width: { ideal: 1280 }, height: { ideal: 720 } },
  });
}

export function stopCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}
