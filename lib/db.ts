import mongoose from "mongoose";

const MONGO_URL = process.env.MONGO_URL!;

export async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  try {
    const conn = await mongoose.connect(MONGO_URL, {
      dbName: "ev_finder",
      serverSelectionTimeoutMS: 10000,
    });

    console.log("✅ MongoDB Connected");
    return conn;
  } catch (err) {
    console.error("❌ MongoDB connect error:", err);
    throw err;
  }
}
