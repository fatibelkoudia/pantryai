export type DevicePlatform = 'ios' | 'android';

export interface RegisterDeviceDto {
  expoPushToken: string;
  platform: DevicePlatform;
}

export interface UserDevice {
  id: string;
  userId: string;
  expoPushToken: string;
  platform: DevicePlatform;
  createdAt: string;
}
