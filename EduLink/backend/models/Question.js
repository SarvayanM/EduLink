const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  imageUrl: String,
  subject: { type: String, required: true },
  topic: String,
  askedBy: { type: String, required: true }, // user email
  askedByName: String,
  classroom: { type: String, required: true }, // Grade 6-11
  answers: [{
    text: String,
    imageUrl: String,
    answeredBy: String,
    answeredByName: String,
    upvotes: { type: Number, default: 0 },
    isAccepted: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }],
  upvotes: { type: Number, default: 0 },
  isAnswered: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Question', questionSchema);