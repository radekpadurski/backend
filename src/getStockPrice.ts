import { API_KEY } from "./config/polygonConfig";
const axios = require("axios");

export async function getStockPrice(symbol: string) {
  try {
    const response = await axios.get(
      `https://api.polygon.io/v2/last/trade/${symbol}?apiKey=${API_KEY}`
    );
    return response.data.last.price;
  } catch (error) {
    console.error(`Error fetching stock price for ${symbol}:`, error);
    return null;
  }
}
