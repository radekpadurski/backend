import express, { Request, Response } from "express";
import db from "./config/firebase-config";
import { ExtendedVerifyTokenRequest, verifyToken } from "./verifyToken";
import { API_KEY, BASE_URL } from "./config/polygonConfig";
import { getAlarmsFromSnapshot } from "./getAlarmsFromSnapshot";
import { checkPrices } from "./checkPrices";
import { formatDate } from "./formatDate";
const functions = require("firebase-functions");
const cors = require("cors");
const axios = require("axios");
const cron = require("node-cron");

const app = express();
const port = 5001;

app.use(cors());

app.get(
  "/set-alarm/symbol/:symbol/targetPrice/:targetPrice",
  verifyToken,
  async (req: Request, res: Response) => {
    const { symbol, targetPrice } = req.params;
    const email = (req as ExtendedVerifyTokenRequest).user?.email;
    if (!symbol || !targetPrice) {
      return res.status(400).send("Symbol and target price are required.");
    }

    await db
      .collection("alarms")
      .add({ email: email, symbol, targetPrice: parseFloat(targetPrice) });
    res.status(201).send("Alarm set successfully.");
  }
);

app.get("/alarms", verifyToken, async (req: Request, res: Response) => {
  const email = (req as ExtendedVerifyTokenRequest).user?.email;
  const snapshot = await db
    .collection("alarms")
    .where("email", "==", email)
    .get();

  if (snapshot.empty) {
    console.log("Alarms for user not found");
    return res.status(404).send("Alarms for user not found");
  }

  const alarms = getAlarmsFromSnapshot(snapshot);
  res.json(alarms);
});

app.get("/api/getTickersList", verifyToken, async (_, res: Response) => {
  try {
    const response = await axios.get(
      `${BASE_URL}/v3/reference/tickers?apiKey=${API_KEY}`
    );
    res.json(response.data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get(
  "/api/getTickerDetails/:indicesTicker",
  verifyToken,
  async (req, res) => {
    try {
      const indicesTicker = req.params.indicesTicker;
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const formattedDate = formatDate(yesterday);
      console.log(
        `${BASE_URL}/v2/aggs/ticker/${indicesTicker}/range/1/hour/${formattedDate}/${formattedDate}?sort=asc&apiKey=${API_KEY}`
      );
      const response = await axios.get(
        `${BASE_URL}/v2/aggs/ticker/${indicesTicker}/range/1/hour/${formattedDate}/${formattedDate}?sort=asc&apiKey=${API_KEY}`
      );
      res.json(response.data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

cron.schedule("* * * * *", () => {
  console.log("Checking stock prices...");
  checkPrices();
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

exports.app = functions.https.onRequest(app);
