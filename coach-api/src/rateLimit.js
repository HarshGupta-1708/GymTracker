const usageMap = new Map();

function todayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

function checkRateLimit(uid, dailyLimit = 20) {
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
