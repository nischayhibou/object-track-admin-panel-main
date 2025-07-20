# Camera Activity History Feature

## Overview
The History feature provides comprehensive tracking and visualization of camera activity, object detection counts, and timestamps. It allows users to view detailed historical data about their camera systems and object tracking activities.

## Features

### 1. Historical Data Tracking
- **Camera Activity Periods**: Tracks when cameras are active/inactive with timestamps
- **Object Count History**: Records the number of objects detected at each timestamp
- **Detection Confidence**: Monitors the accuracy of object detection over time
- **File Management**: Links to video and image files generated during detections

### 2. Data Visualization
- **Summary Cards**: Quick overview of total cameras, detections, objects, and average confidence
- **Detailed Tables**: Comprehensive view of all camera activities with expandable details
- **Activity Periods**: Shows continuous activity periods with duration calculations
- **Recent Detections**: Lists the most recent detection events for each camera

### 3. Filtering and Search
- **Date Range Filtering**: Filter data by start and end dates
- **Camera Filtering**: View data for specific cameras
- **Object Type Filtering**: Filter by object types (person, car, truck, etc.)
- **Search Functionality**: Search across camera IDs, object IDs, types, and locations

### 4. Data Export
- **CSV Export**: Export filtered data to CSV format for external analysis
- **Customizable Exports**: Export only the data you need with current filters applied

## Database Schema

### Detections Table
```sql
CREATE TABLE detections (
  detection_id UUID DEFAULT uuid_generate_v4(),
  organization_id UUID,
  camera_id VARCHAR(255),
  tracking_id UUID,
  category_id UUID,
  detection_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  confidence DECIMAL(3,2),
  bounding_box JSONB,
  object_count INTEGER DEFAULT 1,
  video_filename VARCHAR(255),
  image_filename VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Camera Category Mapping Table
```sql
CREATE TABLE camera_category_mapping (
  ccmid SERIAL PRIMARY KEY,
  ccmguid UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  userid VARCHAR(255) NOT NULL,
  cameraid VARCHAR(255) NOT NULL,
  cameraurl TEXT NOT NULL,
  username VARCHAR(255) NOT NULL,
  objectid VARCHAR(255) NOT NULL,
  type VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'Inactive',
  location VARCHAR(255) NOT NULL,
  lastupdatedby VARCHAR(255) NOT NULL,
  lastmodifieddate TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

### GET /history/user/:userid
Retrieves historical data for a specific user.

**Query Parameters:**
- `startDate` (optional): Filter data from this date
- `endDate` (optional): Filter data until this date
- `cameraId` (optional): Filter by specific camera
- `type` (optional): Filter by object type

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "cameraId": "CAM001",
      "objectId": "person-1",
      "type": "person",
      "status": "Active",
      "location": "Entrance",
      "cameraUrl": "rtsp://camera1.com/stream",
      "totalDetections": 15,
      "totalObjects": 45,
      "maxObjectCount": 5,
      "avgConfidence": 0.87,
      "firstDetection": "2024-01-15T10:00:00Z",
      "lastDetection": "2024-01-15T16:30:00Z",
      "activityPeriods": [
        {
          "startTime": "2024-01-15T10:00:00Z",
          "endTime": "2024-01-15T12:30:00Z",
          "objectCount": 3,
          "maxObjectCount": 5
        }
      ],
      "detectionHistory": [
        {
          "detectionId": "uuid-123",
          "detectionTime": "2024-01-15T16:30:00Z",
          "objectCount": 2,
          "confidence": 0.92,
          "videoFilename": "video_001.mp4",
          "imageFilename": "image_001.jpg"
        }
      ]
    }
  ],
  "totalCameras": 3,
  "totalDetections": 45
}
```

## Frontend Components

### History.tsx
Main component that displays the history interface with:
- Summary statistics cards
- Filter controls
- Data table with expandable details
- Export functionality

### Key Features:
1. **Real-time Data Loading**: Fetches data from the API with loading states
2. **Responsive Design**: Works on desktop and mobile devices
3. **Interactive Tables**: Expandable rows showing detailed information
4. **Filter Controls**: Date range, camera, and type filtering
5. **Search Functionality**: Global search across all fields
6. **Export Capability**: Download filtered data as CSV

## Usage Instructions

### Accessing History
1. Log in to the dashboard
2. Click the "History" button in the top navigation bar
3. View the summary statistics at the top
4. Use filters to narrow down the data
5. Click "Details" on any camera row to see expanded information
6. Use the search bar to find specific cameras or objects
7. Click "Export" to download the current filtered data

### Understanding the Data
- **Activity Periods**: Show when cameras were continuously active
- **Detection History**: Lists individual detection events with timestamps
- **Confidence Scores**: Indicate how accurate the object detection was
- **Object Counts**: Number of objects detected in each event
- **File References**: Links to video and image files (if available)

### Filtering Tips
- Use date ranges to focus on specific time periods
- Filter by camera to analyze individual camera performance
- Filter by object type to focus on specific detection types
- Combine filters for precise data analysis

## Technical Implementation

### Backend
- **Controller**: `getHistoryData` in `objectController.js`
- **Route**: `/history/user/:userid` in `objectRoutes.js`
- **Database**: Complex queries joining detections and camera mappings
- **Performance**: Optimized with proper indexing and query limits

### Frontend
- **Component**: `History.tsx` with TypeScript interfaces
- **State Management**: React hooks for data, loading, and filters
- **UI Components**: Shadcn/ui components for consistent design
- **Responsive**: Mobile-first design with Tailwind CSS

## Data Flow
1. User navigates to History page
2. Component loads with user authentication check
3. API call fetches historical data with current filters
4. Data is processed and grouped by camera
5. Activity periods are calculated from detection timestamps
6. UI renders summary cards and detailed table
7. User can interact with filters, search, and export

## Future Enhancements
- **Charts and Graphs**: Visual representation of detection trends
- **Real-time Updates**: WebSocket integration for live history updates
- **Advanced Analytics**: Machine learning insights on detection patterns
- **Alert History**: Track and display system alerts and notifications
- **Performance Metrics**: Camera uptime and detection accuracy trends 