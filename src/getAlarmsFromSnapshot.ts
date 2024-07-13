export interface Alarm {
  email: string;
  symbol: string;
  targetPrice: number;
}

export function getAlarmsFromSnapshot(
  snapshot: FirebaseFirestore.QuerySnapshot<
    FirebaseFirestore.DocumentData,
    FirebaseFirestore.DocumentData
  >
) {
  const alarms: Alarm[] = [];
  snapshot.forEach((doc) => {
    const alarmData = doc.data();
    alarms.push({
      email: alarmData.email,
      symbol: alarmData.symbol,
      targetPrice: alarmData.targetPrice,
    });
  });
  return alarms;
}
