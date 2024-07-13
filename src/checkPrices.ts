import db from "./config/firebase-config";
import { getAlarmsFromSnapshot } from "./getAlarmsFromSnapshot";

export async function checkPrices() {
  const snapshot = await db.collection("alarms").get();

  const alarms = getAlarmsFromSnapshot(snapshot);

  for (const alarm of alarms) {
    // const price = await getStockPrice(alarm.symbol);
    const price = 50;
    if (price !== null && price >= alarm.targetPrice) {
      console.log(
        `ALERT! ${alarm.symbol} has reached the target price of $${alarm.targetPrice}`
      );
      // sendEmail(alarm.email, alarm.symbol, alarm.targetPrice);
    }
  }
}
