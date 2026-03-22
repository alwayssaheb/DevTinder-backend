const jwt = require("jsonwebtoken");
const cookie = require("cookie");
const Chat = require("../Models/chat");
const User = require("../Models/user");
const Notification = require("../Models/notification");
const { ConnectionRequestModel } = require("../Models/connectionRequest");
const redisClient = require("../Config/redis");

const getUserFromSocket = async (socket) => {
  try {
    const rawCookie = socket.handshake.headers.cookie;
    if (!rawCookie) return null;

    const cookies = cookie.parse(rawCookie);
    const token = cookies.token;
    if (!token) return null;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded._id);

    return user || null;
  } catch (err) {
    return null;
  }
};

const areUsersConnected = async (loggedInUserId, targetUserId) => {
  const connection = await ConnectionRequestModel.findOne({
    $or: [
      {
        fromUserId: loggedInUserId,
        toUserId: targetUserId,
        status: "accepted",
      },
      {
        fromUserId: targetUserId,
        toUserId: loggedInUserId,
        status: "accepted",
      },
    ],
  });

  return !!connection;
};

const initializeSocket = (io) => {
  io.on("connection", async (socket) => {
    console.log("Socket connected:", socket.id);

    const user = await getUserFromSocket(socket);

    if (!user) {
      socket.emit("socketError", { message: "Unauthorized socket connection" });
      socket.disconnect();
      return;
    }

    const userId = user._id.toString();

    await redisClient.set(`online:user:${userId}`, socket.id);

    console.log(`User ${userId} mapped to socket ${socket.id} in Redis`);

    socket.emit("welcome", {
      message: "Socket connected successfully",
      userId,
    });

    socket.broadcast.emit("userOnline", { userId });

    socket.on("sendMessage", async ({ toUserId, text }) => {
      try {
        if (!toUserId || !text?.trim()) {
          return socket.emit("messageError", {
            message: "toUserId and text are required",
          });
        }

        const isConnected = await areUsersConnected(userId, toUserId);
        if (!isConnected) {
          return socket.emit("messageError", {
            message: "You can only chat with accepted connections",
          });
        }

        const cleanText = text.trim();

        const savedMessage = await Chat.create({
          senderId: userId,
          receiverId: toUserId,
          text: cleanText,
        });

        const payload = {
          _id: savedMessage._id.toString(),
          senderId: userId,
          receiverId: toUserId,
          text: cleanText,
          createdAt: savedMessage.createdAt,
        };

        const savedNotification = await Notification.create({
          userId: toUserId,
          fromUserId: userId,
          type: "new_message",
          message: cleanText,
          chatMessageId: savedMessage._id,
          isRead: false,
        });

        const notificationPayload = {
          _id: savedNotification._id.toString(),
          fromUserId: {
            _id: user._id.toString(),
            firstName: user.firstName,
            lastName: user.lastName,
            photoURL: user.photoURL,
          },
          message: cleanText,
          isRead: false,
          createdAt: savedNotification.createdAt,
        };

        socket.emit("messageSent", payload);

        const receiverSocketId = await redisClient.get(`online:user:${toUserId}`);

        if (receiverSocketId) {
          io.to(receiverSocketId).emit("receiveMessage", payload);
          io.to(receiverSocketId).emit("newNotification", notificationPayload);
        }
      } catch (err) {
        console.log("sendMessage error:", err.message);
        socket.emit("messageError", {
          message: "Could not send message",
        });
      }
    });

    socket.on("typing", async ({ toUserId }) => {
      const isConnected = await areUsersConnected(userId, toUserId);
      if (!isConnected) return;

      const receiverSocketId = await redisClient.get(`online:user:${toUserId}`);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("typing", { fromUserId: userId });
      }
    });

    socket.on("stopTyping", async ({ toUserId }) => {
      const isConnected = await areUsersConnected(userId, toUserId);
      if (!isConnected) return;

      const receiverSocketId = await redisClient.get(`online:user:${toUserId}`);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("stopTyping", { fromUserId: userId });
      }
    });

    socket.on("disconnect", async () => {
      console.log("Socket disconnected:", socket.id);

      const currentSocketId = await redisClient.get(`online:user:${userId}`);

      if (currentSocketId === socket.id) {
        await redisClient.del(`online:user:${userId}`);
        socket.broadcast.emit("userOffline", { userId });
      }
    });
  });
};

module.exports = {
  initializeSocket,
};