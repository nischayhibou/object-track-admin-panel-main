
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { DATE_TIME_FORMAT } from '@/dateFormat';
import axios from '@/utils/axiosInstance';
import { Search, Camera, Activity, Users, AlertTriangle, LogOut, Plus, MoreVertical } from 'lucide-react';
import { useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useWebSocket } from '@/hooks/useWebSocket';


interface RecentObject {
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

const Dashboard = () => {
  const { toast } = useToast();
  const menuRef = useRef<HTMLDivElement>(null);
  

  const [searchTerm, setSearchTerm] = useState('');
  const [userInfo, setUserInfo] = useState({ username: '', firstname: '', lastname: '' });
  const [liveStats, setLiveStats] = useState({
    totalObjects: 0,
    activeTracking: 0,
    inactiveAlerts: 0,
    latestUpdate: null,
    typeCounts: {}
  });
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const username = localStorage.getItem('username');
  const userid = localStorage.getItem('userid');

  const [editMode, setEditMode] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [recentObjects, setRecentObjects] = useState<RecentObject[]>([]);
  const [typeOptions, setTypeOptions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newObject, setNewObject] = useState({
    id: null,
    type: '',
    status: '',
    location: '',
    cameraId: '',
    cameraURL: '',
    objectId: ''
  });

  // WebSocket connection for real-time updates
  const wsUrl = `ws://localhost:5000/ws`;
  const { isConnected, isConnecting, error: wsError, requestStats, requestUpdates, requestFilteredStats } = useWebSocket({
    url: wsUrl,
    token: token || '',
    onTokenExpired: () => {
      console.log('Token refresh failed, redirecting to login');
      toast({
        title: "Session Expired",
        description: "Please log in again to continue.",
        variant: "destructive"
      });
      handleLogout();
    },
    onMessage: (message) => {
      switch (message.type) {
        case 'INITIAL_STATS':
        case 'COUNT_UPDATE':
          // Update stats with real-time data
          if (message.data?.stats) {
            const totalObjects = message.data.stats.reduce((sum: number, stat: any) => sum + stat.totalObjects, 0);
            const activeTracking = message.data.stats.reduce((sum: number, stat: any) => sum + stat.recentObjects, 0);
            setLiveStats({
              totalObjects,
              activeTracking,
              inactiveAlerts: 0,
              latestUpdate: message.data.timestamp,
              typeCounts: {}
            });
          }
          break;
        case 'OBJECT_UPDATES':
          // Update recent objects with real-time data
          if (message.data && Array.isArray(message.data)) {
            setRecentObjects(message.data);
          }
          break;
        case 'FILTERED_STATS':
          // Handle filtered stats
          console.log('Filtered stats:', message.data);
          break;
        case 'REAL_TIME_UPDATE':
          // Handle real-time updates
          console.log('Real-time update:', message.data);
          break;
        case 'ERROR':
          console.error('WebSocket error:', message.message);
          break;
        default:
          console.log('Unknown WebSocket message:', message);
      }
    },
    onConnect: () => {
      console.log('WebSocket connected');
      toast({
        title: "Success",
        description: "Real-time connection established",
        variant: "default"
      });
    },
    onDisconnect: () => {
      console.log('WebSocket disconnected');
      toast({
        title: "Warning",
        description: "Real-time connection lost",
        variant: "destructive"
      });
    },
    onError: (error) => {
      console.error('WebSocket error:', error);
      toast({
        title: "Error",
        description: "Real-time connection error",
        variant: "destructive"
      });
    }
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


useEffect(() => {
  if (!token || !username) {
    navigate('/');
    return;
  }

  const cacheKey = `userInfo:${username}`;
  const cachedData = localStorage.getItem(cacheKey);

  if (cachedData) {
    try {
      const parsed = JSON.parse(cachedData);
      setUserInfo(parsed);
      return;
    } catch (err) {
      localStorage.removeItem(cacheKey); // clear corrupted cache
    }
  }

  axios.get('/user', { params: { username } })
  .then(response => {
    localStorage.setItem(cacheKey, JSON.stringify(response.data));
    setUserInfo(response.data);
  })
  .catch(() => navigate('/'));
}, [token, username, navigate]);

  // Memoize stats calculation to prevent unnecessary re-renders
  const stats = useMemo(() => {
    // Use live stats from WebSocket if available, otherwise fall back to calculated stats
    if (isConnected && liveStats.totalObjects > 0) {
      return {
        totalObjects: liveStats.totalObjects,
        activeTracking: liveStats.activeTracking,
        alerts: liveStats.inactiveAlerts,
        latestDateTime: liveStats.latestUpdate
      };
    }

    // Fallback to calculated stats from recentObjects
    if (!Array.isArray(recentObjects) || recentObjects.length === 0) {
      return {
        totalObjects: 0,
        activeTracking: 0,
        alerts: 0,
        latestDateTime: null
      };
    }

    const totalObjects = recentObjects.length;
    const activeTracking = recentObjects.filter(obj => obj.status === 'Active').length;
    const alerts = recentObjects.filter(obj => obj.status === 'Inactive').length;
    const latestObject = recentObjects.reduce((latest, current) =>
      new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest
    );
    const latestDateTime = latestObject.timestamp;

    return {
      totalObjects,
      activeTracking,
      alerts,
      latestDateTime
    };
  }, [isConnected, liveStats, recentObjects]);


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-500';
      case 'Lost': return 'bg-red-500';
      case 'Inactive': return 'bg-gray-500';
      default: return 'bg-blue-500';
    }
  };

  const handleLogout = () => {
  // Clear local storage
  localStorage.removeItem('token');
  localStorage.removeItem('userInfo');

  // Clear session storage
  sessionStorage.clear();

  // Invalidate cached pages by forcing a hard reload
  window.location.replace('/');
  window.location.reload(); // deprecated in most modern browsers
};

  const handleEdit = (object: RecentObject) => {
    debugger
    setEditMode(true);
    setNewObject({
      id: object.id,
      type: object.type,
      status: object.status,
      location: object.location,
      cameraId: object.cameraId || '',
      cameraURL: object.cameraURL || '',
      objectId: object.objectId || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (object: RecentObject) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete ${object.name}?`);
    if (!confirmDelete) return;

    try {
      await axios.delete(`/objects/${object.id}`);
      toast({
        title: "Success",
        description: "Object deleted successfully!",
        variant: "default"
      });
      setRecentObjects(prev => prev.filter(item => item.id !== object.id));
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete object.",
        variant: "destructive"
      });
      console.error("Delete error:", error);
    }
  };

useEffect(() => {
  axios.get('/dropdown-options')
    .then(response => setTypeOptions(response.data))
    .catch(console.error);
}, []);

useEffect(() => {
  if (userid) {
    axios.get(`/objects/user/${userid}`)
      .then(res => setRecentObjects(res.data))
      .catch(() => toast({
        title: "Error",
        description: "Failed to load recent objects.",
        variant: "destructive"
      }));
  }
}, [userid, toast]);


  const filteredObjects = recentObjects.filter((obj) => {
    const search = searchTerm.toLowerCase();
    return (
      obj.name?.toLowerCase().includes(search) ||
      obj.type?.toLowerCase().includes(search) ||
      obj.status?.toLowerCase().includes(search) ||
      obj.location?.toLowerCase().includes(search)
    );
  });

const handleFormSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!newObject.type || !newObject.status) {
    toast({
      title: "Warning",
      description: "Please select both type and status.",
      variant: "destructive"
    });
    return;
  }

  try {
    // Fetch current user info
    const response = await axios.get(`/user`, {
      params: { username }
    });

    const payload = {
      id : newObject.id,
      userId: String(response.data.userid),
      cameraId: String(newObject.cameraId),
      cameraURL: newObject.cameraURL,
      userName: response.data.username,
      objectId: newObject.objectId,
      type: newObject.type,
      status: newObject.status,
      location: newObject.location,
      lastUpdatedBy: response.data.username,
    };

    // Call the unified upsert API
    const result = await axios.post(`/objects`, payload);

    if (result.data.success) {
      toast({
        title: "Success",
        description: `Object ${result.data.action} successfully!`,
        variant: "default"
      });
    } else {
      toast({
        title: "Warning",
        description: "No changes made to the object.",
        variant: "destructive"
      });
    }

    // Reset modal and reload data
    setShowModal(false);
    setEditMode(false);
    setNewObject({
      id: null,
      type: '',
      status: '',
      location: '',
      cameraId: '',
      cameraURL: '',
      objectId: ''
    });

    const res = await axios.get(`/objects/user/${userid}`);
    setRecentObjects(res.data);
  } catch (error: any) {
    if (error.response) {
      if (error.response.status === 404) {
        toast({
          title: "Error",
          description: "Error 404: API endpoint not found.",
          variant: "destructive"
        });
      } else if (error.response.status === 500) {
        toast({
          title: "Error",
          description: "Internal Server Error. Please try again later.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Error",
          description: `Error ${error.response.status}: ${error.response.data?.error || "Unexpected error"}`,
          variant: "destructive"
        });
      }
    } else if (error.request) {
      toast({
        title: "Warning",
        description: "No response from server. Please check your network.",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Error",
        description: "Error: " + error.message,
        variant: "destructive"
      });
    }
    console.error("Error saving/updating object:", error);
  }
};


  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
                <Camera className="h-8 w-8 text-blue-600 mr-3" />
                <h1 className="text-2xl font-bold text-gray-900">TraceEye Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                    {isConnected ? (
                        <div className="flex items-center text-green-600">
                            <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></div>
                            <span className="text-xs">Live</span>
                        </div>
                    ) : isConnecting ? (
                        <div className="flex items-center text-yellow-600">
                            <div className="w-2 h-2 bg-yellow-500 rounded-full mr-1 animate-pulse"></div>
                            <span className="text-xs">Connecting...</span>
                        </div>
                    ) : (
                        <div className="flex items-center text-red-600">
                            <div className="w-2 h-2 bg-red-500 rounded-full mr-1"></div>
                            <span className="text-xs">Offline</span>
                        </div>
                    )}
                </div>
                <span className="text-sm text-gray-600">Welcome, {userInfo.firstname + " " + userInfo.lastname}</span>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                </Button>
            </div>
        </div>
    </div>
</header>

<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Objects</CardTitle>
                <Camera className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
  <div className="text-2xl font-bold">{stats.totalObjects}</div>
  {stats.latestDateTime ? (
    <p className="text-xs text-muted-foreground">
      Last Updated - {new Date(stats.latestDateTime).toLocaleString(DATE_TIME_FORMAT.locale, DATE_TIME_FORMAT.options)}
    </p>
  ) : (
    <p className="text-xs text-muted-foreground">(no recent update)</p>
  )}
</CardContent>
        </Card>

        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Tracking</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{stats.activeTracking}</div>
                <p className="text-xs text-muted-foreground">Currently being tracked</p>
            </CardContent>
        </Card>

        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Inactive Alerts</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.alerts}</div>
                <p className="text-xs text-muted-foreground">Requires attention</p>
            </CardContent>
        </Card>

        {/* <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">System Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{stats.users}</div>
                <p className="text-xs text-muted-foreground">Active users</p>
            </CardContent>
        </Card> */}
    </div>
    {/* Controls and Table */}
    <Card>
        <CardHeader>
          <div className="w-full">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <CardTitle>Recent Tracked Objects</CardTitle>
                    <CardDescription>
                        Monitor and manage object tracking data in real-time
                    </CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 gap-2 w-full sm:w-auto">
                    <div className="relative sm:w-64 w-full">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                            placeholder="Search objects..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 w-full"
                        />
                    </div>
                    <Button className="w-full sm:w-auto" size="sm" onClick={() => setShowModal(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Object
                    </Button>
                </div>
            </div>
            </div>
        </CardHeader>
        <CardContent>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b">
                            <th className="text-left p-3 font-medium text-gray-900">Object ID</th>
                            <th className="text-left p-3 font-medium text-gray-900">Type</th>
                            <th className="text-left p-3 font-medium text-gray-900">Status</th>
                            <th className="text-left p-3 font-medium text-gray-900">Location</th>
                            <th className="text-left p-3 font-medium text-gray-900">Last Updated</th>
                            <th className="text-right p-3 font-medium text-gray-900">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredObjects.map((object) => (
                            <tr key={object.id} className="border-b hover:bg-gray-50">
                                <td className="p-3 font-mono text-sm">{object.name}</td>
                                <td className="p-3">
                                    <Badge variant="outline">{object.type}</Badge>
                                </td>
                                <td className="p-3">
                                    <div className="flex items-center">
                                        <div className={`w-2 h-2 rounded-full mr-2 ${getStatusColor(object.status)}`} />
                                        {object.status}
                                    </div>
                                </td>
                                <td className="p-3 text-gray-600">{object.location}</td>
                                <td className="p-3 text-gray-600 text-sm">{new Date(object.timestamp).toLocaleString(DATE_TIME_FORMAT.locale, DATE_TIME_FORMAT.options)}</td>
                                <td className="p-3 text-right relative">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setOpenMenuId(openMenuId === object.id ? null : object.id)}
                                    >
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>

                                    {openMenuId === object.id && (
        <div
          ref={menuRef}
          className="absolute right-3 top-10 w-28 bg-white shadow-md rounded-md z-10"
        >
          <ul className="text-sm text-gray-700">
            <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer" onClick={() => handleEdit(object)}>Edit</li>
            <li className="px-4 py-2 hover:bg-gray-100 cursor-pointer" onClick={() => handleDelete(object)}>Delete</li>
          </ul>
        </div>
      )}

                                </td>

                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </CardContent>
    </Card>
</div>
      {showModal && (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h2 className="text-xl font-semibold mb-4">{editMode ? 'Edit Object' : 'Add New Object'}</h2>
            <form onSubmit={handleFormSubmit} className="space-y-4">

                <label className="block text-sm font-medium text-gray-700">Type</label>
                <select
                  value={newObject.type}
                  onChange={(e) => {
                    const selectedType = e.target.value;                 
                    const count = recentObjects.filter(obj => obj.type === selectedType).length;
                    const objectId = `${selectedType.toLowerCase().replace(/\s+/g, '-')}-${count + 1}`;
                  
                    setNewObject({ 
                      ...newObject, 
                      type: selectedType, 
                      objectId 
                    });
                  }}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring focus:ring-blue-500 text-sm"
                >
                  <option value="">Select a type</option>
                  {typeOptions.map((option: any) => (
                    <option key={option.id} value={option.name}>{option.name}</option>
                  ))}
                </select>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <div className="flex items-center space-x-4">
                    <label className="inline-flex items-center">
                        <input
                            type="radio"
                            name="status"
                            value="Active"
                            checked={newObject.status === 'Active'}
                            onChange={(e) => setNewObject({ ...newObject, status: e.target.value })}
                            className="form-radio text-green-600"
                        />
                        <span className="ml-2">Active</span>
                    </label>
                    <label className="inline-flex items-center">
                        <input
                            type="radio"
                            name="status"
                            value="Inactive"
                            checked={newObject.status === 'Inactive'}
                            onChange={(e) => setNewObject({ ...newObject, status: e.target.value })}
                            className="form-radio text-gray-600"
                        />
                        <span className="ml-2">Inactive</span>
                    </label>
                </div>
                <label className="block text-sm font-medium text-gray-700">Object ID</label>
                <Input
                  value={newObject.objectId}
                  readOnly
                  className="bg-gray-100 cursor-not-allowed"
                />
                <label className="block text-sm font-medium text-gray-700">Camera Id</label>
                <Input
                    placeholder="Camera Id"
                    value={newObject.cameraId}
                    onChange={(e) => {
                        const numericValue = e.target.value.replace(/\D/g, ''); // Remove non-digits
                        setNewObject({ ...newObject, cameraId: numericValue });
                    }}
                />
                <label className="block text-sm font-medium text-gray-700">Camera URL</label>
                <Input
                    placeholder="Camera URL"
                    value={newObject.cameraURL}
                    onChange={(e) => setNewObject({ ...newObject, cameraURL: e.target.value })}
                />
                <label className="block text-sm font-medium text-gray-700">Location</label>
                <Input
                    placeholder="Location"
                    value={newObject.location}
                    onChange={(e) => setNewObject({ ...newObject, location: e.target.value })}
                />
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => {
  setShowModal(false);
  setEditMode(false);
  setNewObject({
    id: null,
    type: '',
    status: '',
    location: '',
    cameraId: '',
    cameraURL: '',
    objectId: '',
  });
}}
>Cancel</Button>
                    <Button type="submit">{editMode ? 'Update' : 'Add'}</Button>
                </div>
            </form>
        </div>
    </div>
)}
    </div>
  );
};

export default Dashboard;
