const express = require("express");
const notificationRouter = express.Router();
const { userAuth } = require("../Middlewares/auth");
const Notification = require("../Models/notification");

notificationRouter.get("/notifications", userAuth, async (req, res) => {
  try {
    const notifications = await Notification.find({
      userId: req.user._id,
      isRead: false,
    })
      .populate("fromUserId", "firstName lastName photoURL")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      notifications,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

notificationRouter.patch(
  "/notifications/:notificationId/read",
  userAuth,
  async (req, res) => {
    try {
      const { notificationId } = req.params;

      const notification = await Notification.findOneAndUpdate(
        {
          _id: notificationId,
          userId: req.user._id,
        },
        {
          isRead: true,
        },
        { new: true }
      );

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: "Notification not found",
        });
      }

      res.status(200).json({
        success: true,
        notification,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  }
);

module.exports = notificationRouter;