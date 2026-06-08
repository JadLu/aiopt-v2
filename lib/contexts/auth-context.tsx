"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/auth";
import { subscribeToCredits, initUserCredits } from "@/lib/firebase/credits";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  credits: number | null;
  creditsLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState<number | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const unsubCreditsRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      // Cancel any previous credits subscription
      unsubCreditsRef.current?.();
      unsubCreditsRef.current = null;

      setUser(u);
      setLoading(false);

      if (u) {
        setCreditsLoading(true);
        // Ensure existing users who predate the credit system get their document created
        initUserCredits(u.uid).catch(() => {});
        unsubCreditsRef.current = subscribeToCredits(
          u.uid,
          (bal) => {
            setCredits(bal);
            setCreditsLoading(false);
          },
          () => {
            // Firestore permission error or network failure — show 0, don't block UI
            setCredits(0);
            setCreditsLoading(false);
          }
        );
      } else {
        setCredits(null);
        setCreditsLoading(false);
      }
    });

    return () => {
      unsub();
      unsubCreditsRef.current?.();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, credits, creditsLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
