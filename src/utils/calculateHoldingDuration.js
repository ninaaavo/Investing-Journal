import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase";

export function calculateHoldingDuration() {
  const [duration, setDuration] = useState(null);

  useEffect(() => {
    const fetchHoldingStats = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const statsRef = doc(db, "users", user.uid, "stats", "holdingDuration");
      const statsSnap = await getDoc(statsRef);

      if (!statsSnap.exists()) {
        setDuration(0);
        return;
      }

      const { totalHoldingDays = 0, totalCapital = 0 } = statsSnap.data();
      const avg = totalCapital === 0 ? 0 : totalHoldingDays / totalCapital;
      setDuration(avg);
    };

    fetchHoldingStats();
  }, []);

  return (
    <div className="text-sm text-gray-700">
      <strong>Avg Holding Duration:</strong>{" "}
      {duration === null
        ? "Loading..."
        : `${duration.toFixed(1)} days`}
    </div>
  );
}

