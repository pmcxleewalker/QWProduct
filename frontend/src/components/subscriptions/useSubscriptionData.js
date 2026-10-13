import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';

export const subscriptionApi = `${process.env.REACT_APP_BACKEND_URL}/api`;
export const money = (cents) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
export const newKey = () => crypto.randomUUID();
export const errorMessage = (error) => {
  const detail = error?.response?.data?.detail;
  return typeof detail === 'string' ? detail : detail?.message || 'Unable to save. Please check your connection and retry.';
};

export function useSubscriptionData(path, scope = '') {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [generation, setGeneration] = useState(0);
  const reload = useCallback(() => setGeneration(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setData(null);
    axios.get(`${subscriptionApi}${path}`, { signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) setData(response.data); })
      .catch(err => { if (!controller.signal.aborted) setError(errorMessage(err)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path, scope, generation]);
  return { data, setData, error, loading, reload };
}