const jwt = require("jsonwebtoken");

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
};

const adminOnly = (req, res, next) => {
  auth(req, res, () => {
    if (req.user.role !== "admin")
      return res.status(403).json({ message: "Admin access required" });
    next();
  });
};

module.exports = { auth, adminOnly };