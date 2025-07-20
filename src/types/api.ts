// API payload types for main endpoints

export interface UserInfo {
  username: string;
  firstname: string;
  lastname: string;
  userid?: string | number;
  [key: string]: any;
}

export interface RecentObject {
  id: number;
  name: string;
  type: string;
  status: string;
  location: string;
  timestamp: string;
  cameraId?: string;
  cameraURL?: string;
  objectId?: string;
}

export interface StatusHistoryEntry {
  id: number;
  object_id: string;
  user_id: string;
  status: string;
  changed_at: string;
  changed_by: string;
  cameraid: string;
  cameraurl: string;
  max_object_count: number;
} 