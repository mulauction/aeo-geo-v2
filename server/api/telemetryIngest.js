const { appendTelemetryRecord } = require("../lib/telemetryStore");

function getEnvironmentFromHost(host) {
  const h = typeof host === "string" ? host : "";
  return h.includes("localhost") || h.includes("127.0.0.1") ? "localhost" : "prod";
}

function getBestEffortIp(req) {
  const xf = req?.headers?.["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim().length > 0) {
    return xf.split(",")[0].trim() || null;
  }
  const ra = req?.socket?.remoteAddress;
  return typeof ra === "string" && ra.trim().length > 0 ? ra : null;
}

function getBestEffortUa(req) {
  const ua = req?.headers?.["user-agent"];
  return typeof ua === "string" && ua.trim().length > 0 ? ua : null;
}

async function telemetryIngest(req, res) {
  try {
    const environment = getEnvironmentFromHost(req?.headers?.host);
    const record = {
      receivedAt: new Date().toISOString(),
      source: { app: "aeo-geo-v2", environment },
      request: { ip: getBestEffortIp(req), ua: getBestEffortUa(req) },
      payload: req?.body,
    };

    try {
      await appendTelemetryRecord(record);
    } catch (err) {
      console.warn("[telemetry] ingest failed", err?.message || err);
    }
  } catch (err) {
    console.warn("[telemetry] ingest failed", err?.message || err);
  } finally {
    res.status(204).end();
  }
}

module.exports = { telemetryIngest };


