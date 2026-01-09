const express = require("express");
const authRouter = express.Router();
const User = require("../Models/user");
const validator = require("validator");
const bcrypt = require("bcryptjs");
const { validateSignupData } = require("../utils/validation");

// Helper function for cookie options
const cookieOptions = {
  httpOnly: true,           // can't access cookie via JS
  secure: process.env.NODE_ENV === "production", // only HTTPS in prod
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // cross-site for prod
  maxAge: 8 * 3600000,      // 8 hours
};

//signup api for signing the user
authRouter.post("/signup", async (req, res) => {
  try {
    //Validate the data
    validateSignupData(req);
    const {
      firstName,
      lastName,
      emailId,
      password,
      age,
      gender,
      about,
      skills,
    } = req.body;

    //Encrypt the password
    const passwordHash = await bcrypt.hash(password, 10);

    //Check if email exists
    const checkEmail = await User.findOne({ emailId });
    if (checkEmail) {
      throw new Error("Email Already Exists");
    }

    const user = new User({
      firstName,
      lastName,
      emailId,
      password: passwordHash,
      age,
      gender,
      about,
      skills,
    });

    const savedUser = await user.save();
    const token = await savedUser.getjwt();

    // Send cookie
    res.cookie("token", token, cookieOptions);
    res.status(200).json({ message: "User added successfully", data: savedUser });
  } catch (err) {
    res.status(400).send("ERROR: " + err.message);
  }
});

//login
authRouter.post("/login", async (req, res) => {
  try {
    const { emailId, password } = req.body;
    if (!validator.isEmail(emailId)) {
      throw new Error("Invalid Email");
    }

    const user = await User.findOne({ emailId });
    if (!user) {
      throw new Error("Invalid Credentials");
    }

    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      throw new Error("Invalid Credentials");
    }

    const token = await user.getjwt();
    res.cookie("token", token, cookieOptions);
    res.status(200).json({ user });
  } catch (err) {
    res.status(400).send("ERROR: " + err.message);
  }
});

//logout
authRouter.post("/logout", async (req, res) => {
  res.cookie("token", null, { ...cookieOptions, maxAge: 0 }).send("User logged out successfully");
});

module.exports = authRouter;
