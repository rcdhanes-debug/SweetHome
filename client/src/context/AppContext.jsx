import { createContext, useContext, useEffect, useCallback, useState } from 'react';
import * as fundingApi from '../services/funding';
import * as expenseApi from '../services/expenses';
import * as choreApi from '../services/chores';
import { listRedeems } from '../services/redeem';
import { getBoard } from '../services/noticeboard';
import * as eventApi from '../services/events';
import * as notificationApi from '../services/notifications';
import { listUsers } from '../services/users';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [funding, setFunding] = useState(null);
  const [history, setHistory] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [chores, setChores] = useState([]);
  const [today, setToday] = useState(null);
  const [redeems, setRedeems] = useState([]);
  const [board, setBoard] = useState({ shopping: [], fixes: [], guests: [], resolutions: [] });
  const [events, setEvents] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState({ users: true, funding: true, expenses: true, chores: true, redeems: true, board: true, events: true, notifications: true });

  const reloadUsers = useCallback(async () => {
    try {
      setUsers(await listUsers());
    } catch (err) {
      console.error('users', err.message);
    } finally {
      setLoading((l) => ({ ...l, users: false }));
    }
  }, []);

  const reloadFunding = useCallback(async () => {
    try {
      const [cur, hist] = await Promise.all([fundingApi.getCurrent(), fundingApi.getHistory()]);
      setFunding(cur);
      setHistory(hist);
    } catch (err) {
      console.error('funding', err.message);
    } finally {
      setLoading((l) => ({ ...l, funding: false }));
    }
  }, []);

  const reloadExpenses = useCallback(async () => {
    try {
      const [expList, cur, hist] = await Promise.all([
        expenseApi.listExpenses(),
        fundingApi.getCurrent(),
        fundingApi.getHistory()
      ]);
      setExpenses(expList);
      setFunding(cur);
      setHistory(hist);
    } catch (err) {
      console.error('expenses', err.message);
    } finally {
      setLoading((l) => ({ ...l, expenses: false }));
    }
  }, []);

  const reloadChores = useCallback(async () => {
    try {
      const [all, t] = await Promise.all([choreApi.listChores(), choreApi.getToday()]);
      setChores(all);
      setToday(t);
    } catch (err) {
      console.error('chores', err.message);
    } finally {
      setLoading((l) => ({ ...l, chores: false }));
    }
  }, []);

  const reloadBoard = useCallback(async () => {
    try {
      setBoard(await getBoard());
    } catch (err) {
      console.error('noticeboard', err.message);
    } finally {
      setLoading((l) => ({ ...l, board: false }));
    }
  }, []);

  const reloadRedeems = useCallback(async () => {
    try {
      const [redList, expList, cur, hist] = await Promise.all([
        listRedeems(),
        expenseApi.listExpenses(),
        fundingApi.getCurrent(),
        fundingApi.getHistory()
      ]);
      setRedeems(redList);
      setExpenses(expList);
      setFunding(cur);
      setHistory(hist);
    } catch (err) {
      console.error('redeem', err.message);
    } finally {
      setLoading((l) => ({ ...l, redeems: false }));
    }
  }, []);

  const reloadEvents = useCallback(async () => {
    try {
      const now = new Date();
      const start = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1)).toISOString().slice(0, 10);
      const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 2, 0)).toISOString().slice(0, 10);
      setEvents(await eventApi.listEvents(start, end));
    } catch (err) {
      console.error('events', err.message);
    } finally {
      setLoading((l) => ({ ...l, events: false }));
    }
  }, []);

  const reloadNotifications = useCallback(async () => {
    try {
      setNotifications(await notificationApi.listNotifications());
    } catch (err) {
      console.error('notifications', err.message);
    } finally {
      setLoading((l) => ({ ...l, notifications: false }));
    }
  }, []);

  const reloadAll = useCallback(async () => {
    await Promise.all([
      reloadUsers(),
      reloadFunding(),
      reloadExpenses(),
      reloadChores(),
      reloadRedeems(),
      reloadBoard(),
      reloadEvents(),
      reloadNotifications()
    ]);
  }, [reloadUsers, reloadFunding, reloadExpenses, reloadChores, reloadRedeems, reloadBoard, reloadEvents, reloadNotifications]);

  const doMarkAllRead = useCallback(async () => {
    try {
      setNotifications(await notificationApi.markAllRead());
    } catch (err) {
      console.error('notifications mark read', err.message);
    }
  }, []);

  const doDismiss = useCallback(
    async (id) => {
      try {
        await notificationApi.dismiss(id);
        setNotifications((list) => list.filter((n) => n._id !== id));
      } catch (err) {
        console.error('notifications dismiss', err.message);
      }
    },
    []
  );

  const doClearAll = useCallback(async () => {
    try {
      await notificationApi.clearAll();
      setNotifications([]);
    } catch (err) {
      console.error('notifications clear all', err.message);
    }
  }, []);

  useEffect(() => {
    reloadAll();
  }, [reloadAll]);

  // Cloud Live Auto-Sync: Polls cloud every 10s when tab is active & re-syncs on window focus
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        reloadFunding();
        reloadExpenses();
        reloadRedeems();
        reloadNotifications();
      }
    }, 10000);

    const handleFocus = () => {
      reloadAll();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
    };
  }, [reloadFunding, reloadExpenses, reloadRedeems, reloadNotifications, reloadAll]);

  return (
    <AppContext.Provider
      value={{
        users,
        funding,
        history,
        expenses,
        chores,
        today,
        redeems,
        board,
        events,
        notifications,
        loading,
        reloadUsers,
        reloadFunding,
        reloadExpenses,
        reloadChores,
        reloadRedeems,
        reloadBoard,
        reloadEvents,
        reloadNotifications,
        reloadAll,
        markAllRead: doMarkAllRead,
        dismissNotification: doDismiss,
        clearAllNotifications: doClearAll
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
