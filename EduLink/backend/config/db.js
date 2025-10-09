const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Database Connected Successfully");
  } catch (error) {
    console.error("Database Connection Unsuccessful");
    console.error("Error details:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
