const User = require("../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

/**
 * Helper to generate a 7-day JWT token for an authenticated user
 */
function generateToken(userId) {
  return jwt.sign(
    {
      userId,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
}

/**
 * Helper to format the safe user payload returned on signup and login
 */
function formatAuthUser(user) {
  return {
    id: user._id,
    _id: user._id,
    username: user.username,
    email: user.email,
    profilePhoto: user.profilePhoto || "",
    bio: user.bio || "",
  };
}

const signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    const existingUser = await User.findOne({
      $or: [{ username }, { email }],
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Username or email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
    });

    const token = generateToken(user._id);

    return res.status(201).json({
      message: "User created successfully",
      token,
      user: formatAuthUser(user),
    });
  } catch (error) {
    console.error("Signup error:", error.message);
    return res.status(500).json({
      message: "Server error",
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: formatAuthUser(user),
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({
      message: "Server error",
    });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      user,
    });
  } catch (error) {
    console.error("Get user error:", error.message);
    return res.status(500).json({
      message: "Server error",
    });
  }
};

module.exports = {
  signup,
  login,
  getMe,
};