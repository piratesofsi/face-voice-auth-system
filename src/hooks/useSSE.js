import { useEffect, useState, useRef } from 'react';

export function useSSE(url, authHeaders) {
  const [data, setData] = useState([]);
  const [lastEventId, setLastEventId] = useState(null);
  const updateQueueRef = useRef(null);
  const pendingUpdateRef = useRef(null);

  useEffect(() => {
    const eventSource = new EventSource(url, {
      withCredentials: false,
    });

    // Debounce batch updates to prevent excessive re-renders
    const flushUpdates = () => {
      if (pendingUpdateRef.current) {
        setData(prev => [pendingUpdateRef.current, ...prev.slice(0, 50)]);
        pendingUpdateRef.current = null;
      }
    };

    const scheduleUpdate = (newData) => {
      pendingUpdateRef.current = newData;
      if (updateQueueRef.current) clearTimeout(updateQueueRef.current);
      updateQueueRef.current = setTimeout(flushUpdates, 50); // Batch updates every 50ms
    };

    eventSource.onmessage = (event) => {
      try {
        const newData = JSON.parse(event.data);
        scheduleUpdate(newData);
        setLastEventId(event.lastEventId);
      } catch (e) {
        console.error('SSE parse error:', e);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE error:', err);
      // Reconnect after 5s instead of immediate close
      const reconnectTimer = setTimeout(() => {
        if (eventSource.readyState === EventSource.CLOSED) {
          // Error will propagate and event source will auto-close
        }
      }, 5000);
      
      return () => clearTimeout(reconnectTimer);
    };

    return () => {
      if (updateQueueRef.current) clearTimeout(updateQueueRef.current);
      eventSource.close();
    };
  }, [url]);

  return { data, lastEventId };
}

