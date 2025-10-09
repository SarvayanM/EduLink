const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  fileUrl: String,
  fileType: String, // pdf, video, image
  subject: { type: String, required: true },
  topic: String,
  classroom: { type: String, required: true },
  uploadedBy: String,
  uploadedByName: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Resource', resourceSchema);