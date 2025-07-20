import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { DATE_TIME_FORMAT } from '@/dateFormat';
import axios from '@/utils/axiosInstance';
import { Search, Camera, Activity, Clock, Filter, Download, Calendar, BarChart3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ActivityPeriod {
  startTime: string;
  endTime: string;
  objectCount: number;
  maxObjectCount: number;
}

interface DetectionHistory {
  detectionId: string;
  detectionTime: string;
  objectCount: number;
  confidence: number;
  videoFilename?: string;
  imageFilename?: string;
}

interface HistoryEntry {
  cameraId: string;
  objectId: string;
  type: string;
  status: string;
  location: string;
  cameraUrl: string;
  totalDetections: number;
  totalObjects: number;
  maxObjectCount: number;
  avgConfidence: number;
  firstDetection: string;
  lastDetection: string;
  activityPeriods: ActivityPeriod[];
  detectionHistory: DetectionHistory[];
}

interface StatusHistoryEntry {
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

const History = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const username = localStorage.getItem('username');
  const userid = localStorage.getItem('userid');

  const [historyData, setHistoryData] = useState<StatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCamera, setSelectedCamera] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedCamera, setExpandedCamera] = useState<string | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryEntry[]>([]);
  const [statusHistoryLoading, setStatusHistoryLoading] = useState(false);
  const [statusObjectId, setStatusObjectId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [cameraOptions, setCameraOptions] = useState<string[]>([]);
  const [statusOptions, setStatusOptions] = useState<string[]>([]);

  // Get unique cameras and types for filters
  const cameras = useMemo(() => {
    const uniqueCameras = [...new Set(historyData.map(entry => entry.cameraid))];
    return uniqueCameras.sort();
  }, [historyData]);

  const types = useMemo(() => {
    const uniqueTypes = [...new Set(historyData.map(entry => entry.status))];
    return uniqueTypes.sort();
  }, [historyData]);

  const loadHistoryData = async () => {
    if (!userid) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', String(limit));
      if (searchTerm) params.append('search', searchTerm);
      if (selectedCamera) params.append('cameraId', selectedCamera);
      if (selectedType) params.append('status', selectedType);
      const response = await axios.get(`/history/user/${userid}?${params.toString()}`);
      if (response.data.success) {
        setHistoryData(response.data.data);
        setTotal(response.data.total || 0);
      }
    } catch (error) {
      console.error('Error loading history data:', error);
      toast({
        title: "Error",
        description: "Failed to load history data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token || !username) {
      navigate('/');
      return;
    }
    loadHistoryData();
    // eslint-disable-next-line
  }, [token, username, navigate, page, limit]);

  useEffect(() => {
    if (!userid) return;
    axios.get(`/all-cameras/${userid}`).then(res => setCameraOptions(res.data));
    axios.get('/all-statuses').then(res => setStatusOptions(res.data));
  }, [userid]);

  const handleExportData = () => {
    const csvData = historyData.map(entry => ({
      'ID': entry.id,
      'Object ID': entry.object_id,
      'User ID': entry.user_id,
      'Status': entry.status,
      'Changed At': entry.changed_at,
      'Changed By': entry.changed_by,
      'Camera ID': entry.cameraid,
      'Camera URL': entry.cameraurl,
      'Max Object Count': entry.max_object_count
    }));

    const csv = [
      Object.keys(csvData[0] || {}).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `camera_history_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Add a getStatusColor function for status badge colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-500';
      case 'Lost': return 'bg-red-500';
      case 'Inactive': return 'bg-gray-500';
      default: return 'bg-blue-500';
    }
  };

  const formatDuration = (startTime: string, endTime: string) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h`;
    if (diffHours > 0) return `${diffHours}h ${diffMins % 60}m`;
    return `${diffMins}m`;
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userInfo');
    sessionStorage.clear();
    window.location.replace('/');
    window.location.reload();
  };

  const fetchStatusHistory = async (objectId: string) => {
    setStatusHistoryLoading(true);
    setStatusObjectId(objectId);
    try {
      const response = await axios.get(`/status-history/${objectId}`);
      if (response.data.success) {
        setStatusHistory(response.data.data);
        setShowStatusModal(true);
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load status history', variant: 'destructive' });
    } finally {
      setStatusHistoryLoading(false);
    }
  };

  // Calculate totalDetections and totalObjects as described
  const totalDetections = historyData.reduce((sum, row) => sum + (Number(row.max_object_count) || 0), 0);
  const objectIdCounts = historyData.reduce((acc, row) => {
    acc[row.object_id] = (acc[row.object_id] || 0) + 1;
    return acc;
  }, {});
  const totalObjects = (Object.values(objectIdCounts) as number[]).reduce((sum, count) => sum + count, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Camera className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">TraceEye History</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
                Dashboard
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Detections</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalDetections}</div>
              <p className="text-xs text-muted-foreground">Sum of max object count</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Objects</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalObjects}</div>
              <p className="text-xs text-muted-foreground">Total object count of object IDs</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {historyData.length > 0 
                  ? (historyData.reduce((sum, entry) => sum + 1, 0) / historyData.length).toFixed(1)
                  : '0.0'
                }%
              </div>
              <p className="text-xs text-muted-foreground">Detection accuracy</p>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Camera Activity History</CardTitle>
                <CardDescription>
                  View detailed camera activity, detection counts, and timestamps
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadHistoryData}
                  disabled={loading}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  {loading ? 'Loading...' : 'Refresh'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportData}
                  disabled={historyData.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </CardHeader>

          {/* Filters */}
          {showFilters && (
            <CardContent className="border-t">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Camera</label>
                  <select
                    value={selectedCamera}
                    onChange={e => { setSelectedCamera(e.target.value); setPage(1); }}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring focus:ring-blue-500 text-sm"
                  >
                    <option value="">All Cameras</option>
                    {cameraOptions.map(camera => (
                      <option key={camera} value={camera}>{camera}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={selectedType}
                    onChange={e => { setSelectedType(e.target.value); setPage(1); }}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring focus:ring-blue-500 text-sm"
                  >
                    <option value="">All Statuses</option>
                    {statusOptions.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          )}

          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search cameras, objects, types, or locations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* History Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-4 font-medium text-gray-900">ID</th>
                    <th className="text-left p-4 font-medium text-gray-900">Object ID</th>
                    <th className="text-left p-4 font-medium text-gray-900">User ID</th>
                    <th className="text-left p-4 font-medium text-gray-900">Status</th>
                    <th className="text-left p-4 font-medium text-gray-900">Changed At</th>
                    <th className="text-left p-4 font-medium text-gray-900">Changed By</th>
                    <th className="text-left p-4 font-medium text-gray-900">Camera ID</th>
                    <th className="text-left p-4 font-medium text-gray-900">Camera URL</th>
                    <th className="text-left p-4 font-medium text-gray-900">Max Object Count</th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.length > 0 ? (
                    historyData.map((row) => (
                      <tr key={row.id} className="border-b hover:bg-gray-50">
                        <td className="p-4">{row.id}</td>
                        <td className="p-4">{row.object_id}</td>
                        <td className="p-4">{row.user_id}</td>
                        <td className="p-4">
                          <div className="flex items-center">
                            <div className={`w-2 h-2 rounded-full mr-2 ${getStatusColor(row.status)}`} />
                            {row.status}
                          </div>
                        </td>
                        <td className="p-4">{new Date(row.changed_at).toLocaleString(DATE_TIME_FORMAT.locale, DATE_TIME_FORMAT.options)}</td>
                        <td className="p-4">{row.changed_by}</td>
                        <td className="p-4">{row.cameraid}</td>
                        <td className="p-4">{row.cameraurl}</td>
                        <td className="p-4">{row.max_object_count}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-gray-500">
                        <div className="flex flex-col items-center space-y-2">
                          <Search className="h-8 w-8 text-gray-400" />
                          <p className="text-lg font-medium">No History Data Found</p>
                          <p className="text-sm">Try adjusting your filters or refresh the data</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        <div className="flex flex-col md:flex-row justify-between items-center mt-4 gap-2">
          <div className="flex items-center gap-2">
            <Button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <span>Page {page} of {Math.max(1, Math.ceil(total / limit))}</span>
            <Button disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm">Page size:</label>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={limit}
              onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
            >
              {[5, 10, 20, 50, 100].map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
            <label className="text-sm ml-4">Jump to:</label>
            <input
              type="number"
              min={1}
              max={Math.ceil(total / limit) || 1}
              value={page}
              onChange={e => {
                let val = Number(e.target.value);
                if (val < 1) val = 1;
                if (val > Math.ceil(total / limit)) val = Math.ceil(total / limit);
                setPage(val);
              }}
              className="border rounded px-2 py-1 w-16 text-sm"
            />
          </div>
        </div>
      </div>
      {showStatusModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-xl">
            <h2 className="text-xl font-semibold mb-4">Status Change History</h2>
            <Button className="absolute top-2 right-2" size="sm" variant="ghost" onClick={() => setShowStatusModal(false)}>Close</Button>
            {statusHistoryLoading ? (
              <div className="text-center py-8">Loading...</div>
            ) : statusHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Changed By</th>
                      <th className="text-left p-2">Changed At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statusHistory.map((h) => (
                      <tr key={h.id} className="border-b">
                        <td className="p-2">{h.status}</td>
                        <td className="p-2">{h.changed_by}</td>
                        <td className="p-2">{new Date(h.changed_at).toLocaleString(DATE_TIME_FORMAT.locale, DATE_TIME_FORMAT.options)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">No status history found.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default History; 