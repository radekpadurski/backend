import { Request, Response, NextFunction } from "express";
import { GetPublicKeyOrSecret, JwtPayload, VerifyErrors } from "jsonwebtoken";
const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");
import { JwksError, SigningKey } from "jwks-rsa";

type Header = {
  kid?: string;
};

type Callback = (err: Error | null, signingKey?: string) => void;

export type ExtendedVerifyTokenRequest = Request & {
  user: JwtPayload | undefined;
};

const client = jwksClient({
  jwksUri: "https://www.googleapis.com/oauth2/v3/certs",
});

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

export function verifyToken(req: Request, res: Response, next: NextFunction) {
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
