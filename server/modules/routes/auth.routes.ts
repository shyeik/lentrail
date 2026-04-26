import express from "express";
import { login, register } from "../auth/auth.controller";
import { protect } from "../middleware/auth"; // 🔥 add this

const router = express.Router();

router.post("/login", login);
router.post("/register", register);

// 🔐 protected test route
router.get("/profile", protect, (req: any, res) => {
  res.json({
    message: "You are authenticated",
    user: req.user,
  });
});

export default router;
