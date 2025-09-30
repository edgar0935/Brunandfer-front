import React, { useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import LoadingScreen from "@/components/LoadingScreen";

type Props = React.PropsWithChildren<{
  /** tiempo mínimo de splash en ms (ej. 900 ms) */
  minDelay?: number;
}>;

const LoadingGate: React.FC<Props> = ({ minDelay = 900, children }) => {
  const { loading } = useAuth(); // viene de AuthProvider
  const [elapsed, setElapsed] = useState(false);
  const [visible, setVisible] = useState(true);

  // contamos el tiempo mínimo
  useEffect(() => {
    const t = setTimeout(() => setElapsed(true), minDelay);
    return () => clearTimeout(t);
  }, [minDelay]);

  // cuando termina el loading + delay, activamos fade-out y desmontamos
  useEffect(() => {
    if (!loading && elapsed) {
      const timeout = setTimeout(() => setVisible(false), 400); // coincide con animación CSS
      return () => clearTimeout(timeout);
    }
  }, [loading, elapsed]);

  if (!visible) return <>{children}</>;

  return (
    <div className={!loading && elapsed ? "fade-out" : ""}>
      <LoadingScreen />
    </div>
  );
};

export default LoadingGate;
