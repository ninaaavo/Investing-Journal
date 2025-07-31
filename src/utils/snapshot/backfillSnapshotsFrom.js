export async function backfillSnapshotsFrom({
  userId,
  fromDate,
  newTrade,
  tradeCost,
  isExit = false,
}) {
  console.log("backfill is being called");
  console.log(
    "im backfill snap shot, i receive new trade info being",
    newTrade,
    "with trade cost",
    tradeCost
  );

  const yesterday = new Date(); // ← New
  yesterday.setDate(yesterday.getDate() - 1); // ← New
  const cursor = new Date(fromDate);
  const tickers = [newTrade.ticker];

  while (cursor <= yesterday) { // ← Modified condition
    const yyyyMMdd = cursor.toISOString().split("T")[0];
    const snapRef = doc(db, "users", userId, "dailySnapshots", yyyyMMdd);

    const prevDay = new Date(cursor);
    prevDay.setDate(prevDay.getDate() - 1);
    const prevSnapRef = doc(
      db,
      "users",
      userId,
      "dailySnapshots",
      prevDay.toISOString().split("T")[0]
    );

    const snapDoc = await getDoc(snapRef);
    let baseCash = 0;
    let basePositions = {};

    const ticker = newTrade.ticker;
    const shares = newTrade.shares;
    const isShort = newTrade.direction === "short";

    if (snapDoc.exists()) {
      const data = snapDoc.data();
      baseCash = data.cash ?? 0;
      basePositions = structuredClone(data.positions ?? {});
    } else {
      const prevSnapDoc = await getDoc(prevSnapRef);
      if (prevSnapDoc.exists()) {
        const prevData = prevSnapDoc.data();
        baseCash = prevData.cash ?? 0;
        basePositions = structuredClone(prevData.positions ?? {});
      }
    }

    const positions = structuredClone(basePositions);
    let updatedCash = baseCash;

    // Apply trade
    if (isExit) {
      if (positions[ticker]) {
        if (isShort) {
          positions[ticker].shares += shares;
          if (positions[ticker].shares >= 0) delete positions[ticker];
          updatedCash -= tradeCost;
        } else {
          positions[ticker].shares -= shares;
          if (positions[ticker].shares <= 0) delete positions[ticker];
          updatedCash += tradeCost;
        }
      }
    } else {
      if (!positions[ticker]) {
        positions[ticker] = {
          shares: isShort ? -shares : shares,
          fifoStack: [
            {
              shares: shares,
              price: newTrade.averagePrice,
            },
          ],
        };
      } else {
        positions[ticker].shares += isShort ? -shares : shares;
        positions[ticker].fifoStack.push({
          shares: shares,
          price: newTrade.averagePrice,
        });
      }

      updatedCash += isShort ? tradeCost : -tradeCost;
    }

    const prices = await fetchHistoricalPrices(tickers, cursor);
    let totalMarketValue = 0;
    let totalCostBasis = 0;
    let unrealizedPL = 0;

    for (const ticker in positions) {
      const price = prices[ticker] ?? 0;
      const pos = positions[ticker];
      const shares = pos.shares;
      const fifoStack = pos.fifoStack || [];

      const costBasis = fifoStack.reduce(
        (sum, lot) => sum + lot.shares * lot.price,
        0
      );
      const marketValue = shares * price;
      const pl = marketValue - costBasis;

      positions[ticker].priceAtSnapshot = price;
      positions[ticker].marketValue = marketValue;
      positions[ticker].costBasis = costBasis;
      positions[ticker].unrealizedPL = pl;

      totalMarketValue += marketValue;
      totalCostBasis += costBasis;
      unrealizedPL += pl;
    }

    const totalAssets = totalMarketValue + updatedCash;
    const totalPLPercent =
      totalCostBasis > 0 ? unrealizedPL / totalCostBasis : 0;

    await setDoc(snapRef, {
      date: yyyyMMdd,
      cash: updatedCash,
      totalAssets,
      totalCostBasis,
      totalMarketValue,
      unrealizedPL,
      totalPLPercent,
      positions,
      netContribution: 0,
      createdAt: Timestamp.fromDate(new Date(yyyyMMdd)),
    });

    cursor.setDate(cursor.getDate() + 1);
  }
}
