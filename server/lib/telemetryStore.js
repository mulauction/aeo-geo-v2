const fs = require("fs/promises");
const path = require("path");

function getTodayYYYYMMDD() {
  const d = new Date();
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getRawPathForDate(dateStr) {
  const baseDir = path.resolve(__dirname, "..", "data", "telemetry", "raw");
  return {
    dir: baseDir,
    file: path.join(baseDir, `${dateStr}.jsonl`),
  };
}

async function appendTelemetryRecord(record) {
  try {
    if (record === undefined) throw new Error("appendTelemetryRecord: record is undefined");

    const dateStr = getTodayYYYYMMDD();
    const { dir, file } = getRawPathForDate(dateStr);
    await fs.mkdir(dir, { recursive: true });

    const line = `${JSON.stringify(record)}\n`;
    await fs.appendFile(file, line, "utf8");
  } catch (err) {
    throw err;
  }
}

module.exports = { appendTelemetryRecord };


