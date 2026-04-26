import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET as string;

export const protect = (req: any, res: Response, next: NextFunction) => {
  try {
    // 🔥 get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ message: "No token provided" });
    }

    // format: Bearer TOKEN
    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Invalid token format" });
    }

    // 🔥 verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // save user info sa request
    req.user = decoded;

    next(); // proceed sa next route
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
