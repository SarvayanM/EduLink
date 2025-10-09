import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebaseAuth';

export const calculateUserStats = async (userId) => {
  try {
    // Get questions asked by user
    const questionsQuery = query(
      collection(db, 'questions'),
      where('askedBy', '==', userId)
    );
    const questionsSnapshot = await getDocs(questionsQuery);
    const questionsAsked = questionsSnapshot.size;

    // Get answers given by user
    const allQuestionsQuery = query(collection(db, 'questions'));
    const allQuestionsSnapshot = await getDocs(allQuestionsQuery);
    let answersGiven = 0;
    let upvotesReceived = 0;

    allQuestionsSnapshot.docs.forEach(doc => {
      const questionData = doc.data();
      if (questionData.answers) {
        const userAnswers = questionData.answers.filter(answer => answer.answeredBy === userId);
        answersGiven += userAnswers.length;
        
        userAnswers.forEach(answer => {
          if (answer.upvotes) {
            upvotesReceived += answer.upvotes;
          }
        });
      }
    });

    // Calculate points (10 per question, 5 per answer, 2 per upvote)
    const points = (questionsAsked * 10) + (answersGiven * 5) + (upvotesReceived * 2);

    return {
      questionsAsked,
      answersGiven,
      upvotesReceived,
      points
    };
  } catch (error) {
    console.error('Error calculating user stats:', error);
    return {
      questionsAsked: 0,
      answersGiven: 0,
      upvotesReceived: 0,
      points: 0
    };
  }
};