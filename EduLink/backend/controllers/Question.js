const Question = require('../models/Question');

// Get questions for a classroom
async function getQuestions(req, res) {
  try {
    const { classroom } = req.params;
    const questions = await Question.find({ classroom }).sort({ createdAt: -1 });
    res.json(questions);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
}

// Create new question
async function createQuestion(req, res) {
  try {
    const { title, description, subject, topic, classroom, askedBy, askedByName, imageUrl } = req.body;
    
    const question = await Question.create({
      title,
      description,
      subject,
      topic,
      classroom,
      askedBy,
      askedByName,
      imageUrl
    });
    
    res.status(201).json(question);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
}

// Add answer to question
async function addAnswer(req, res) {
  try {
    const { questionId } = req.params;
    const { text, answeredBy, answeredByName, imageUrl } = req.body;
    
    const question = await Question.findById(questionId);
    if (!question) return res.status(404).json({ message: 'Question not found' });
    
    question.answers.push({
      text,
      answeredBy,
      answeredByName,
      imageUrl
    });
    
    question.isAnswered = true;
    await question.save();
    
    res.json(question);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
}

// Upvote question or answer
async function upvote(req, res) {
  try {
    const { questionId } = req.params;
    const { answerId } = req.body;
    
    const question = await Question.findById(questionId);
    if (!question) return res.status(404).json({ message: 'Question not found' });
    
    if (answerId) {
      const answer = question.answers.id(answerId);
      if (answer) answer.upvotes += 1;
    } else {
      question.upvotes += 1;
    }
    
    await question.save();
    res.json(question);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = { getQuestions, createQuestion, addAnswer, upvote };