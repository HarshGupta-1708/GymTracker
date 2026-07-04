let adminApp = null;

function getAdminAuth() {
  if (adminApp) return adminApp;

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) return null;

  try {
    const admin = require("firebase-admin");
    if (!admin.apps.length) {
      const serviceAccount = JSON.parse(json);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    adminApp = admin.auth();
    return adminApp;
  } catch (err) {
    console.error("Firebase Admin init failed:", err.message);
    return null;
  }
}

async function verifyRequestAuth(req) {
  const authHeader = req.headers.authorization || "";
  const demoHeader = req.headers["x-coach-demo"];

  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const auth = getAdminAuth();

    if (!auth) {
      if (process.env.ALLOW_INSECURE_DEV === "true") {
        return { ok: true, uid: "dev-user" };
      }
      return { ok: false, error: "Firebase Admin not configured on server" };
    }

    try {
      const decoded = await auth.verifyIdToken(token);
      return { ok: true, uid: decoded.uid };
    } catch {
      return { ok: false, error: "Invalid Firebase token" };
    }
  }

  if (demoHeader === "demo-user" && process.env.ALLOW_DEMO_COACH === "true") {
    return { ok: true, uid: "demo-user" };
  }

  return { ok: false, error: "Missing Authorization Bearer token" };
}

module.exports = { verifyRequestAuth };
