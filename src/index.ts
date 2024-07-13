import express, { Request, Response, NextFunction } from "express";
const cors = require("cors");
const axios = require("axios");
const jwt = require("jsonwebtoken");
import { GetPublicKeyOrSecret, JwtPayload, VerifyErrors } from "jsonwebtoken";
const jwksClient = require("jwks-rsa");
import { JwksError, SigningKey } from "jwks-rsa";
const cron = require("node-cron");
const nodemailer = require("nodemailer");
import { SendMailOptions, SentMessageInfo } from "nodemailer";
import db from "./config/firebase-config";
const functions = require("firebase-functions");
import { user, pass } from "./config/emailAccount";

const app = express();
const port = 5001;

const client = jwksClient({
  jwksUri: "https://www.googleapis.com/oauth2/v3/certs",
});

app.use(cors());

type Header = {
  kid?: string;
};

type Callback = (err: Error | null, signingKey?: string) => void;

function getKey(header: Header, callback: Callback) {
  client.getSigningKey(header.kid, function (err: JwksError, key: SigningKey) {
    if (err) {
      callback(err);
    } else {
      const signingKey = key.getPublicKey();
      callback(null, signingKey);
    }
  });
}

type ExtendedVerifyTokenRequest = Request & {
  user: JwtPayload | undefined;
};

function verifyToken(req: Request, res: Response, next: NextFunction) {
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
    (err: VerifyErrors | null, decodedToken: JwtPayload | undefined) => {
      if (err) {
        console.log(err);
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      (req as ExtendedVerifyTokenRequest).user = decodedToken;
      next();
    }
  );
}

const API_KEY = "F7guSwqllk4QrwbRmpdNn6iI_cnH72Ro";
const BASE_URL = "https://api.polygon.io";

interface Alarm {
  email: string;
  symbol: string;
  targetPrice: number;
}

app.get(
  "/set-alarm/symbol/:symbol/targetPrice/:targetPrice",
  verifyToken,
  async (req: Request, res: Response) => {
    const symbol = req.params.symbol;
    const targetPrice = req.params.targetPrice;
    const email = (req as ExtendedVerifyTokenRequest).user?.email;
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

  const alarms: unknown[] = [];
  snapshot.forEach((doc) => {
    alarms.push(doc.data());
  });
  res.json(alarms);
});

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

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user,
    pass,
  },
});

function sendEmail(to: string, ticker: string, price: number) {
  const mailOptions: SendMailOptions = {
    from: user,
    to,
    subject: "Ticker Alarm Price",
    text: `Ticker: ${ticker} has reached the price ${price}`,
  };

  transporter.sendMail(mailOptions, (error: Error, info: SentMessageInfo) => {
    if (error) {
      console.log(`Error: ${error}`);
    } else {
      console.log(`Email sent: ${info.response}`);
    }
  });
}

async function checkPrices() {
  const snapshot = await db.collection("alarms").get();

  const alarms: Alarm[] = [];
  snapshot.forEach((doc) => {
    const alarmData = doc.data();
    alarms.push({
      email: alarmData.email,
      symbol: alarmData.symbol,
      targetPrice: alarmData.targetPrice,
    });
  });

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

cron.schedule("* * * * *", () => {
  console.log("Checking stock prices...");
  checkPrices();
});

app.get(
  "/api/getTickersList",
  verifyToken,
  async (req: Request, res: Response) => {
    try {
      const response = await axios.get(
        `${BASE_URL}/v3/reference/tickers?apiKey=${API_KEY}`
      );
      res.json(response.data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

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
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

exports.app = functions.https.onRequest(app);
