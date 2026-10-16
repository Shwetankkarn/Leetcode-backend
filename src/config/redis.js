
const redis = require("redis");

const redisClient = redis.createClient({
  username: "default",
  password: process.env.REDIS_KEY,
  socket: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    // TLS disabled for this test
  },
});

redisClient.on("error", (err) => {
  console.error("Redis Client Error:", err.message);
});

redisClient.on("ready", () => {
  console.log("Redis connected successfully!");
});

async function redisC() {
  if (!process.env.REDIS_KEY) {
    throw new Error("REDIS_KEY missing in .env");
  }

  if (!redisClient.isOpen) {
    await redisClient.connect();
  }

  const result = await redisClient.ping();
  console.log("Redis PING:", result);
}

module.exports = { redisC, redisClient };
