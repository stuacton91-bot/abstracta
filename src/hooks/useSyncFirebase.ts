import { useEffect } from 'react';
import { db } from '../lib/firebase';
import { ref, onValue, off } from 'firebase/database';
import { useAppStore } from '../store/useAppStore';
import type { CustomShape, CanvasObject } from '../store/useAppStore';

export const useSyncFirebase = (roomId: string | null) => {
  useEffect(() => {
    if (!roomId) return;

    useAppStore.setState({ roomId });

    const libRef = ref(db, `rooms/${roomId}/library`);
    const canvasRef = ref(db, `rooms/${roomId}/canvasObjects`);
    const envRef = ref(db, `rooms/${roomId}/canvasEnv`);

    const unsubLib = onValue(libRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        useAppStore.setState({ library: Object.values(data) as CustomShape[] });
      } else {
        useAppStore.setState({ library: [] });
      }
    });

    const unsubCanvas = onValue(canvasRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        useAppStore.setState({ canvasObjects: Object.values(data) as CanvasObject[] });
      } else {
        useAppStore.setState({ canvasObjects: [] });
      }
    });

    const unsubEnv = onValue(envRef, (snapshot) => {
      const env = snapshot.val();
      if (env) {
        useAppStore.setState({ canvasEnv: env });
      }
    });

    return () => {
      off(libRef, 'value', unsubLib);
      off(canvasRef, 'value', unsubCanvas);
      off(envRef, 'value', unsubEnv);
      useAppStore.setState({ roomId: null });
    };
  }, [roomId]);
};
