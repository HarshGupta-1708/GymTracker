const usageMap = new Map();

function todayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

// Drop counters from previous days so the map doesn't grow forever.
function pruneOldKeys() {
  const suffix = `:${todayKey()}`;
  for (const key of usageMap.keys()) {
    if (!key.endsWith(suffix)) usageMap.delete(key);
  }
}

function checkRateLimit(uid, dailyLimit = 20) {
  pruneOldKeys();
  const key = `${uid}:${todayKey()}`;
  const current = usageMap.get(key) || 0;
  if (current >= dailyLimit) {
    return { allowed: false, count: current, limit: dailyLimit };
  }
  usageMap.set(key, current + 1);
  return { allowed: true, count: current + 1, limit: dailyLimit };
}

function getUsageStats(uid) {
  const key = `${uid}:${todayKey()}`;
  return { count: usageMap.get(key) || 0 };
}

module.exports = { checkRateLimit, getUsageStats };
