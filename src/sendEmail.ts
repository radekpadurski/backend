import { SendMailOptions, SentMessageInfo } from "nodemailer";
import { pass, user } from "./config/emailAccount";
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user,
    pass,
  },
});

export function sendEmail(to: string, ticker: string, price: number) {
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
