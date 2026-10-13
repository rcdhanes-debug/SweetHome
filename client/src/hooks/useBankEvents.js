import { useEffect, useRef } from 'react';

/**
 * Custom React hook for real-time Server-Sent Events (SSE).
 * Listens to the backend and triggers a callback ONLY when a new bank SMS is processed.
 * Zero polling, zero flickering.
 * 
 * @param {Function} onBankUpdate Callback invoked when a new bank SMS update arrives
 */
export function useBankEvents(onBankUpdate) {
  const callbackRef = useRef(onBankUpdate);

  useEffect(() => {
    callbackRef.current = onBankUpdate;
  }, [onBankUpdate]);

  useEffect(() => {
    // Resolve API URL (Vite dev proxy or full backend URL)
    const backendBase = (import.meta.env.VITE_API_URL || '').startsWith('http')
      ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
      : (window.location.hostname === 'localhost'
          ? 'https://sweet-home-backend-y21s.onrender.com'
          : window.location.origin);

    const sseUrl = `${backendBase}/api/bank/events`;
    let eventSource = null;

    try {
      eventSource = new EventSource(sseUrl);

      eventSource.addEventListener('bank_update', (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (callbackRef.current) {
            callbackRef.current(payload);
          }
        } catch (err) {
          console.error('[BankSSE] Error parsing event data:', err);
        }
      });

      eventSource.onerror = () => {
        // EventSource will automatically retry in the background
      };
    } catch (err) {
      console.warn('[BankSSE] Failed to establish EventSource connection:', err);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);
}
