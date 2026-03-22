const dotenv = require("dotenv");
dotenv.config();

const { Worker } = require("bullmq");
const { connection } = require("../Config/queue");
const connectDB = require("../Config/database");
const Notification = require("../Models/notification");

const startWorker = async () => {
  try {
    await connectDB();
    console.log("Worker MongoDB connected successfully");

    const messageWorker = new Worker(
      "messageQueue",
      async (job) => {
        if (job.name === "newMessageNotification") {
          const { senderId, receiverId, text, messageId } = job.data;

          await Notification.create({
            userId: receiverId,
            fromUserId: senderId,
            type: "new_message",
            message: text,
            chatMessageId: messageId,
            isRead: false,
          });

          console.log("Notification created for receiver:", receiverId);
        }
      },
      { connection }
    );

    messageWorker.on("completed", (job) => {
      console.log(`Job ${job.id} completed`);
    });

    messageWorker.on("failed", (job, err) => {
      console.error(`Job ${job?.id} failed:`, err.message);
    });

    console.log("Message worker started");
  } catch (error) {
    console.error("Worker startup failed:", error.message);
  }
};

startWorker();