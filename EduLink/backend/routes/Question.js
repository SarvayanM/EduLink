const express = require('express');
const { getQuestions, createQuestion, addAnswer, upvote } = require('../controllers/Question');

const router = express.Router();

router.get('/:classroom', getQuestions);
router.post('/', createQuestion);
router.post('/:questionId/answer', addAnswer);
router.post('/:questionId/upvote', upvote);

module.exports = router;