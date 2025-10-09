const User = require("../models/User");

const allowedRoles = ["student", "tutor", "teacher", "parent"];

async function register(req, res) {
  try {
    const { displayName, email, role, grade, subject, studentEmail } = req.body;

    // Validate required fields
    if (!displayName || !email) {
      return res
        .status(400)
        .json({ message: "Display name and email are required" });
    }

    // Validate role
    const userRole = allowedRoles.includes(role) ? role : "student"; // default to "student"

    // Validate grade for students
    if (userRole === 'student' && !grade) {
      return res.status(400).json({ message: "Grade is required for students" });
    }

    // Validate subject for teachers
    if (userRole === 'teacher' && !subject) {
      return res.status(400).json({ message: "Subject is required for teachers" });
    }

    // Validate student email for parents
    if (userRole === 'parent' && !studentEmail) {
      return res.status(400).json({ message: "Student email is required for parents" });
    }

    // Check if user already exists in database
    const exists = await User.findOne({ email });
    if (exists) {
      // User exists in DB, just return success (Firebase already created)
      return res.status(200).json({
        message: "User info updated",
        user: {
          id: exists._id,
          displayName: exists.displayName,
          email: exists.email,
          role: exists.role,
          grade: exists.grade,
          subject: exists.subject,
          studentEmail: exists.studentEmail,
        },
      });
    }

    // Create new user in database
    const userData = {
      displayName,
      email,
      role: userRole,
    };

    // Add grade only for students
    if (userRole === 'student') {
      userData.grade = grade;
    }

    // Add subject only for teachers
    if (userRole === 'teacher') {
      userData.subject = subject;
    }

    // Add student email only for parents
    if (userRole === 'parent') {
      userData.studentEmail = studentEmail;
    }

    const user = await User.create(userData);

    return res.status(201).json({
      message: "Registered successfully",
      user: {
        id: user._id,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        grade: user.grade,
        subject: user.subject,
        studentEmail: user.studentEmail,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
}

module.exports = { register };