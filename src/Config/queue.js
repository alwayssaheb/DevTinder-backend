const { Queue } = require("bullmq");

const connection = {
  url: process.env.REDIS_URL || "redis://localhost:6379",
};

const messageQueue = new Queue("messageQueue", { connection });

module.exports = {
  connection,
  messageQueue,
};