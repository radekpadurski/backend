import admin from "firebase-admin";
const serviceAccount = require("./../src/config/firebase-config");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
class Middleware {
  // @ts-ignore
  async decodeToken(req, res, next) {
    // Check for Authorization header
    if (
      !req.headers.authorization ||
      !req.headers.authorization.startsWith("Bearer ")
    ) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const idToken = req.headers.authorization.split("Bearer ")[1];
    console.log("idToken", idToken);
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      req.user = decodedToken; // Attach the decoded token to the request object
      return next(); // Pass request to the next middleware or route handler
    } catch (error) {
      console.error("Error verifying Firebase ID token:", error);
      return res.status(403).json({ error: "Unauthorized" });
    }
  }
}

module.exports = new Middleware();
