import { useState, useEffect } from 'react';
import axios from '@/utils/axiosInstance';
import { useNavigate } from 'react-router-dom';

interface UserInfo {
  username: string;
  firstname: string;
  lastname: string;
  [key: string]: any;
}

export function useUserInfo(username?: string) {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!username) {
      setUserInfo(null);
      setLoading(false);
      return;
    }
    const cacheKey = `userInfo:${username}`;
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        setUserInfo(parsed);
        setLoading(false);
        return;
      } catch (err) {
        localStorage.removeItem(cacheKey);
      }
    }
    axios.get('/user', { params: { username } })
      .then(response => {
        localStorage.setItem(cacheKey, JSON.stringify(response.data));
        setUserInfo(response.data);
      })
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [username, navigate]);

  return { userInfo, loading };
} 