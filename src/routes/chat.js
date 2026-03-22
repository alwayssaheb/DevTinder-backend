const express = require("express");
const chatRouter = express.Router();
const Chat = require("../Models/chat");
const { userAuth } = require("../Middlewares/auth");
const { ConnectionRequestModel } = require("../Models/connectionRequest");

const canUsersChat = async (loggedInUserId, targetUserId) => {
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

chatRouter.get("/chat/:targetUserId", userAuth, async (req, res) => {
  try {
    const loggedInUserId = req.user._id.toString();
    const { targetUserId } = req.params;

    const allowed = await canUsersChat(loggedInUserId, targetUserId);

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "You can only access chats with accepted connections",
      });
    }

    const messages = await Chat.find({
      $or: [
        { senderId: loggedInUserId, receiverId: targetUserId },
        { senderId: targetUserId, receiverId: loggedInUserId },
      ],
    }).sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      messages,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

module.exports = chatRouter;