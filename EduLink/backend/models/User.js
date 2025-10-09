const mongoose = require("mongoose");

const roles = ["student", "tutor", "teacher", "parent"];

const userSchema = new mongoose.Schema(
  {
    displayName: { type: String, required: true, trim: true, minlength: 2 },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    role: { type: String, enum: roles, default: "student", index: true },
    grade: { 
      type: String, 
      enum: ["6", "7", "8", "9", "10", "11"],
      required: function() { return this.role === 'student'; }
    },
    subject: {
      type: String,
      trim: true,
      required: function() { return this.role === 'teacher'; }
    },
    studentEmail: {
      type: String,
      trim: true,
      lowercase: true,
      required: function() { return this.role === 'parent'; }
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);