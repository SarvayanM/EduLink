const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db.js");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const userRoute = require("./routes/User.js");
const questionRoute = require("./routes/Question.js");
const resourceRoute = require("./routes/Resource.js");

dotenv.config();
const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*", // tighten for production
    credentials: false,
  })
);
app.use(morgan("dev"));

connectDB();

app.use("/api/user", userRoute);
app.use("/api/questions", questionRoute);
app.use("/api/resources", resourceRoute);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
