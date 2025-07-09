import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";
import { useUser } from "../context/UserContext";

import StockCard from "../components/PositionComponents/StockCard";
import OverviewCard from "../components/PositionComponents/OverviewCard/OverviewCard";
import InputForm from "../components/PositionComponents/InputForm";
import ExitForm from "../components/PositionComponents/ExitForm";

export default function Positions() {
  const [isEditingLayout, setIsEditingLayout] = useState(false);
  const [showExitForm, setShowExitForm] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const [stockList, setStockList] = useState([]);
  const [journalMap, setJournalMap] = useState({});
  const { user } = useUser();

  // Fetch current positions
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(collection(db, "users", user.uid, "currentPositions"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const stocks = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setStockList(stocks);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Fetch all journal entries and group them by ticker+direction
useEffect(() => {
  if (!user?.uid) return;

  const q = query(
    collection(db, "users", user.uid, "journalEntries"), 
    orderBy("createdAt", "asc")
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const map = {};

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const ticker = data?.ticker;
      const direction = data?.direction;

      if (!ticker || !direction) return;

      const key = `${ticker}_${direction}`;
      if (!map[key]) map[key] = [];

      map[key].push({ id: docSnap.id, ...data });
    });

    setJournalMap(map);
  });

  return () => unsubscribe();
}, [user?.uid]);



  const handleExitClick = (stock) => {
    const key = `${stock.ticker}_${stock.direction}`;
    const entries = journalMap[key] || [];
    console.log("Your stocks are", stock);
    const matchingBuys = entries.filter((entry) => entry.journalType === "buy");
    const mostRecentBuy = matchingBuys.at(-1);
    const expectationText = mostRecentBuy?.expectations || "";
    const totalShares = stock.shares;
    const averagePrice = stock.averagePrice;
    const entryDate = mostRecentBuy?.entryDate || "";

    setSelectedStock({
      ...stock,
      expectations: expectationText,
      availableShares: totalShares,
      averagePriceFromFIFO: averagePrice,
      entryDate,
    });
    setShowExitForm(true);
  };

  const sampleChecklist = {
    "Graph pattern": {
      value: "positive",
      comment: "Double bottoms near support zone",
      weight: 4,
    },
    Volume: {
      value: "positive",
      comment: "Volume surge at breakout",
      weight: 2,
    },
    RSI: {
      value: "neutral",
      comment: "RSI was mid-level, not too overbought",
      weight: 1,
    },
    "EMA alignment": {
      value: "positive",
      comment: "Price was above 50 EMA",
      weight: 3,
    },
    "News sentiment": {
      value: "negative",
      comment: "Mixed news around earnings report",
      weight: 2,
    },
  };

  // Sort stocks: long first, then short
  const sortedStocks = [...stockList].sort((a, b) => {
    if (a.direction === b.direction) return 0;
    return a.direction === "long" ? -1 : 1;
  });

  return (
    <motion.div
      key="positions"
      className="flex gap-6 h-[calc(100vh-150px)] bg-[var(--color-background)] rounded-xl overflow-hidden shadow-lg p-6 justify-between"
    >
      {/* Left Side */}
      <div className="flex flex-col w-[calc((100%-40px)/2)]">
        {showExitForm ? (
          <ExitForm
            onSubmit={() => setShowExitForm(false)}
            onClose={() => setShowExitForm(false)}
            stock ={selectedStock}
            pastChecklist={sampleChecklist}
          />
        ) : (
          <>
            <div>
              <div className="text-lg font-medium">Add stock</div>
              <InputForm />
            </div>
            <div className="text-lg font-medium mt-6">Current Stocks</div>

            <div className="relative w-full mt-4 h-full overflow-hidden">
              {/* Fades */}
              <div className="pointer-events-none absolute top-0 left-0 w-full h-6 bg-gradient-to-b from-[var(--color-background)] to-transparent z-10" />
              <div className="pointer-events-none absolute bottom-0 left-0 w-full h-6 bg-gradient-to-t from-[var(--color-background)] to-transparent z-10" />

              {/* Scrollable content */}
              <div className="overflow-y-auto h-full pr-2">
                <div className="flex flex-wrap justify-between pt-4 pb-6 px-6 w-full">
                  {sortedStocks.map((stock) => {
                    const key = `${stock.ticker}_${stock.direction}`;
                    // const entries = journalMap[key] || [];
                    return (
                      <StockCard
                        key={stock.id}
                        ticker={stock.ticker}
                        companyName={stock.companyName} // optional, fallback is "—"
                        direction={stock.direction}
                        shares={stock.shares}
                        averagePrice={stock.averagePrice}
                        currentPrice={stock.currentPrice}
                        entries={
                          journalMap[`${stock.ticker}_${stock.direction}`] || []
                        }
                        onActionClick={() => handleExitClick(stock)}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right Side */}
      <div className="w-[calc((100%-40px)/2)]">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-medium">Overview</div>
          <button
            onClick={() => {
              setIsEditingLayout((prev) => !prev);
            }}
            className="text-sm font-semibold px-3 py-1 rounded-md bg-[var(--color-primary)] text-white shadow hover:opacity-80"
          >
            {isEditingLayout ? "Done" : "Edit Layout"}
          </button>
        </div>
        <OverviewCard isEditingLayout={isEditingLayout} />
      </div>
    </motion.div>
  );
}
