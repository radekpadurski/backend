import express, { Request, Response } from "express";
const cors = require("cors");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");
const cron = require("node-cron");
import db from "./config/firebase-config";
const functions = require("firebase-functions");

const app = express();
const port = 5001;

const client = jwksClient({
  jwksUri: "https://www.googleapis.com/oauth2/v3/certs",
});

app.use(cors());

// @ts-ignore
function getKey(header, callback) {
  // @ts-ignore
  client.getSigningKey(header.kid, function (err, key) {
    if (err) {
      callback(err);
    } else {
      const signingKey = key.getPublicKey();
      callback(null, signingKey);
    }
  });
}

// @ts-ignore
function verifyToken(req, res, next) {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ message: "Authorization header is missing" });
  }

  jwt.verify(
    token.replace("Bearer ", ""),
    getKey,
    {
      algorithms: ["RS256"],
    },
    // @ts-ignore
    (err, decodedToken) => {
      if (err) {
        console.log(err);
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      req.user = decodedToken;
      next();
    }
  );
}

const API_KEY = "F7guSwqllk4QrwbRmpdNn6iI_cnH72Ro";
const BASE_URL = "https://api.polygon.io";

interface Alarm {
  symbol: string;
  targetPrice: number;
}

app.get(
  "/set-alarm/symbol/:symbol/targetPrice/:targetPrice",
  verifyToken,
  async (req, res) => {
    const symbol = req.params.symbol;
    const targetPrice = req.params.targetPrice;
    // @ts-ignore
    const email = req.user.email;
    console.log("alarm for symbol ", symbol, "target price ", targetPrice);
    if (!symbol || !targetPrice) {
      return res.status(400).send("Symbol and target price are required.");
    }

    const newAlarm = { symbol, targetPrice: parseFloat(targetPrice) };

    const docRef = await db
      .collection("alarms")
      .add({ email: email, symbol, targetPrice: parseFloat(targetPrice) });
    res.status(201).send("Alarm set successfully.");
  }
);

app.get("/alarms", verifyToken, async (req, res) => {
  // @ts-ignore
  const email = req.user.email;
  const snapshot = await db
    .collection("alarms")
    .where("email", "==", email)
    .get();

  if (snapshot.empty) {
    console.log("Alarms for user not found");
    return res.status(404).send("Alarms for user not found");
  }

  const alarms: unknown[] = [];
  snapshot.forEach((doc) => {
    alarms.push(doc.data());
  });
  res.json(alarms);
});

// Function to get the current stock price
async function getStockPrice(symbol: string) {
  try {
    const response = await axios.get(
      `https://api.polygon.io/v2/last/trade/${symbol}?apiKey=${API_KEY}`
    );
    console.log("get stock price for symbol", symbol, "data ", response.data);
    return response.data.last.price;
  } catch (error) {
    console.error(`Error fetching stock price for ${symbol}:`, error);
    return null;
  }
}

// // Function to check prices against alarms
// async function checkPrices() {
//   for (const alarm of alarms) {
//     const price = await getStockPrice(alarm.symbol);
//     if (price !== null && price >= alarm.targetPrice) {
//       console.log(
//         `ALERT! ${alarm.symbol} has reached the target price of $${alarm.targetPrice}`
//       );
//       // Here you can add your logic to notify the user, e.g., send an email or a push notification
//     }
//   }
// }

// Schedule the task to run every minute
// cron.schedule("*/2 * * * *", () => {
//   console.log("Checking stock prices...");
//   checkPrices();
// });

app.get("/api/getTickersList", verifyToken, async (req, res) => {
  try {
    const response = await axios.get(
      `${BASE_URL}/v3/reference/tickers?apiKey=${API_KEY}`
    );
    res.json(response.data);
  } catch (error) {
    // @ts-ignore
    res.status(500).json({ error: error.message });
  }
});

app.get(
  "/api/getTickerDetails/:indicesTicker",
  verifyToken,
  async (req, res) => {
    try {
      const indicesTicker = req.params.indicesTicker;
      const response = await axios.get(
        `${BASE_URL}/v2/aggs/ticker/${indicesTicker}/range/1/day/2023-03-10/2023-03-20?sort=asc&apiKey=${API_KEY}`
      );
      res.json(response.data);
    } catch (error) {
      console.log(error);
      // @ts-ignore
      res.status(500).json({ error: error.message });
    }
  }
);

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

exports.app = functions.https.onRequest(app);
