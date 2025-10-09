import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Modal } from 'react-native';
import { Button } from 'react-native-paper';
import { signOut } from 'firebase/auth';
import { auth, db } from '../services/firebaseAuth';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';

export default function ParentDashboard({ navigation }) {
  const [childData, setChildData] = useState(null);
  const [childStats, setChildStats] = useState({
    points: 0,
    level: 1,
    questionsAsked: 0,
    answersGiven: 0,
    ratingsReceived: 0,
    badges: [],
    weeklyActivity: { questions: 0, answers: 0, points: 0 },
    subjectActivity: {},
    recentQuestions: [],
    classAverage: { questions: 8, answers: 12, points: 85 }
  });
  const [loading, setLoading] = useState(true);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    fetchChildData();
  }, []);

  const fetchChildData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const parentDoc = await getDoc(doc(db, 'users', user.uid));
      if (!parentDoc.exists()) return;

      const parentData = parentDoc.data();
      const studentEmail = parentData.studentEmail;

      const studentsQuery = query(
        collection(db, 'users'),
        where('email', '==', studentEmail),
        where('role', 'in', ['student', 'tutor'])
      );
      const studentsSnapshot = await getDocs(studentsQuery);
      
      if (!studentsSnapshot.empty) {
        const childDoc = studentsSnapshot.docs[0];
        const child = { id: childDoc.id, ...childDoc.data() };
        setChildData(child);
        await fetchChildStats(child.id, child);
      }
    } catch (error) {
      console.error('Error fetching child data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateClassAverages = async (grade) => {
    try {
      // Get all students in the same grade
      const gradeStudentsQuery = query(
        collection(db, 'users'),
        where('grade', '==', grade),
        where('role', 'in', ['student', 'tutor'])
      );
      const gradeStudentsSnapshot = await getDocs(gradeStudentsQuery);
      
      if (gradeStudentsSnapshot.empty) {
        return { questions: 2, answers: 2, points: 2 };
      }

      let totalQuestions = 0;
      let totalAnswers = 0;
      let totalPoints = 0;
      const studentCount = gradeStudentsSnapshot.size;

      // Calculate totals for all students in grade
      for (const studentDoc of gradeStudentsSnapshot.docs) {
        const studentData = studentDoc.data();
        const studentId = studentDoc.id;
        
        // Count questions asked by this student
        const questionsQuery = query(
          collection(db, 'questions'),
          where('askedBy', '==', studentId)
        );
        const questionsSnapshot = await getDocs(questionsQuery);
        totalQuestions += questionsSnapshot.size;
        
        // Count answers given by this student
        const allQuestionsQuery = query(collection(db, 'questions'));
        const allQuestionsSnapshot = await getDocs(allQuestionsQuery);
        
        allQuestionsSnapshot.docs.forEach(doc => {
          const q = doc.data();
          if (q.answers) {
            q.answers.forEach(ans => {
              if (ans.answeredBy === studentId) {
                totalAnswers++;
              }
            });
          }
        });
        
        totalPoints += studentData.points || 0;
      }

      // Calculate averages with minimum of 2
      const avgQuestions = Math.max(2, Math.round(totalQuestions / studentCount));
      const avgAnswers = Math.max(2, Math.round(totalAnswers / studentCount));
      const avgPoints = Math.max(2, Math.round(totalPoints / studentCount));

      return {
        questions: avgQuestions,
        answers: avgAnswers,
        points: avgPoints
      };
    } catch (error) {
      console.error('Error calculating class averages:', error);
      return { questions: 2, answers: 2, points: 2 };
    }
  };

  const fetchChildStats = async (childId, childInfo) => {
    try {
      const questionsQuery = query(
        collection(db, 'questions'),
        where('askedBy', '==', childId)
      );
      const questionsSnapshot = await getDocs(questionsQuery);
      const questions = questionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const points = childInfo.points || 0;
      const level = Math.floor(points / 200) + 1;
      const questionsAsked = questions.length;
      
      const allQuestionsQuery = query(collection(db, 'questions'));
      const allQuestionsSnapshot = await getDocs(allQuestionsQuery);
      let answersGiven = 0;
      let ratingsReceived = 0;
      const subjectActivity = {};
      
      allQuestionsSnapshot.docs.forEach(doc => {
        const q = doc.data();
        if (q.answers) {
          q.answers.forEach(ans => {
            if (ans.answeredBy === childId) {
              answersGiven++;
              if (ans.rating) ratingsReceived++;
            }
          });
        }
      });

      questions.forEach(q => {
        const subject = q.subject || 'Other';
        subjectActivity[subject] = (subjectActivity[subject] || 0) + 1;
      });

      const badges = [];
      if (questionsAsked >= 1) badges.push('🔥 First Question');
      if (answersGiven >= 1) badges.push('💡 Helpful Student');
      if (answersGiven >= 10) badges.push('🌟 Top Contributor');
      if (points >= 100) badges.push('💯 Century Club');
      if (points >= 200) badges.push('🎓 Peer Tutor');
      if (level >= 3) badges.push('👑 Level Master');

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const recentQuestions = questions.filter(q => 
        q.createdAt?.toDate() > weekAgo
      );

      // Calculate real class averages
      const classAverage = await calculateClassAverages(childInfo.grade);

      setChildStats({
        points,
        level,
        questionsAsked,
        answersGiven,
        ratingsReceived,
        badges,
        weeklyActivity: {
          questions: recentQuestions.length,
          answers: answersGiven,
          points: recentQuestions.length * 10
        },
        subjectActivity,
        recentQuestions: questions.sort((a, b) => {
          const dateA = a.createdAt?.toDate() || new Date(0);
          const dateB = b.createdAt?.toDate() || new Date(0);
          return dateB - dateA;
        }).slice(0, 20),
        classAverage
      });
    } catch (error) {
      console.error('Error fetching child stats:', error);
    }
  };

  const sendKudos = async () => {
    try {
      if (!childData) return;
      
      await addDoc(collection(db, 'notifications'), {
        userId: childData.id,
        type: 'kudos',
        title: '🎉 Kudos from Parent!',
        message: 'Your parent is proud of your learning progress! Keep up the great work! 🌟',
        read: false,
        createdAt: serverTimestamp()
      });
      
      Alert.alert('Kudos Sent! 🎉', 'Your encouragement has been sent to your child.');
    } catch (error) {
      console.error('Error sending kudos:', error);
      Alert.alert('Error', 'Failed to send kudos');
    }
  };

  const getEngagementLevel = () => {
    const { questions, answers } = childStats.weeklyActivity;
    const { classAverage } = childStats;
    
    if (questions >= classAverage.questions && answers >= classAverage.answers) {
      return { level: 'High Performance', color: '#10B981', icon: '🔥' };
    } else if (questions >= classAverage.questions * 0.7) {
      return { level: 'Good Performance', color: '#F59E0B', icon: '👍' };
    } else {
      return { level: 'Needs Encouragement', color: '#EF4444', icon: '💪' };
    }
  };

  const getWeakZones = () => {
    const zones = [];
    Object.entries(childStats.subjectActivity).forEach(([subject, count]) => {
      if (count > 3 && childStats.answersGiven < count * 0.5) {
        zones.push(subject);
      }
    });
    return zones;
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const openQuestionModal = (question) => {
    setSelectedQuestion(question);
    setModalVisible(true);
  };

  const closeQuestionModal = () => {
    setModalVisible(false);
    setSelectedQuestion(null);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown date';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.loadingText}>Loading child progress...</Text>
      </View>
    );
  }

  const engagement = getEngagementLevel();
  const weakZones = getWeakZones();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Parent Dashboard</Text>
        <View style={styles.headerActions}>
          <Button mode="contained" onPress={handleLogout} style={styles.logoutButton}>
            Logout
          </Button>
          <Pressable style={styles.avatar} onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.avatarText}>P</Text>
          </Pressable>
        </View>
      </View>

      {/* Child Progress Overview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>👤 {childData?.displayName || 'Your Child'}'s Progress</Text>
        <View style={styles.progressCard}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{childStats.points}</Text>
              <Text style={styles.statLabel}>Total Points</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>Level {childStats.level}</Text>
              <Text style={styles.statLabel}>{childStats.level >= 2 ? '🎓 Peer Tutor' : '📚 Student'}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{childStats.badges.length}</Text>
              <Text style={styles.statLabel}>Badges Earned</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Engagement Level */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 Engagement Level</Text>
        <View style={[styles.engagementCard, { borderLeftColor: engagement.color }]}>
          <Text style={styles.engagementIcon}>{engagement.icon}</Text>
          <View style={styles.engagementInfo}>
            <Text style={[styles.engagementLevel, { color: engagement.color }]}>{engagement.level}</Text>
            <Text style={styles.engagementText}>vs Class Average</Text>
          </View>
        </View>
      </View>

      {/* Weekly Activity Comparison */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📈 This Week vs Class Average</Text>
        <View style={styles.comparisonCard}>
          <View style={styles.comparisonRow}>
            <Text style={styles.comparisonLabel}>Questions Asked</Text>
            <Text style={styles.comparisonChild}>{childStats.weeklyActivity.questions}</Text>
            <Text style={styles.comparisonAvg}>Avg: {childStats.classAverage.questions}</Text>
          </View>
          <View style={styles.comparisonRow}>
            <Text style={styles.comparisonLabel}>Answers Given</Text>
            <Text style={styles.comparisonChild}>{childStats.answersGiven}</Text>
            <Text style={styles.comparisonAvg}>Avg: {childStats.classAverage.answers}</Text>
          </View>
          <View style={styles.comparisonRow}>
            <Text style={styles.comparisonLabel}>Points Earned</Text>
            <Text style={styles.comparisonChild}>{childStats.points}</Text>
            <Text style={styles.comparisonAvg}>Avg: {childStats.classAverage.points}</Text>
          </View>
        </View>
      </View>

      {/* Subject Activity Insights */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📚 Subject Activity Insights</Text>
        <View style={styles.subjectCard}>
          {Object.keys(childStats.subjectActivity).length > 0 ? (
            Object.entries(childStats.subjectActivity)
              .sort(([,a], [,b]) => b - a)
              .map(([subject, count]) => (
                <View key={subject} style={styles.subjectRow}>
                  <Text style={styles.subjectName}>{subject}</Text>
                  <View style={styles.subjectStats}>
                    <Text style={styles.subjectCount}>{count} questions</Text>
                    <View style={[styles.subjectBar, { width: `${(count / Math.max(...Object.values(childStats.subjectActivity))) * 100}%` }]} />
                  </View>
                </View>
              ))
          ) : (
            <Text style={styles.emptyText}>No subject activity yet</Text>
          )}
        </View>
      </View>

      {/* Weak Zones Alert */}
      {weakZones.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚠️ Areas Needing Support</Text>
          <View style={styles.weakZoneCard}>
            <Text style={styles.weakZoneText}>
              Your child asks many questions in {weakZones.join(', ')} but gives fewer answers. 
              Consider encouraging them to help peers in these subjects!
            </Text>
          </View>
        </View>
      )}

      {/* Achievements */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🏅 Achievements Unlocked</Text>
        <View style={styles.badgesContainer}>
          {childStats.badges.map((badge, index) => (
            <View key={index} style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ))}
          {childStats.badges.length === 0 && (
            <Text style={styles.emptyText}>No badges earned yet - encourage your child to participate!</Text>
          )}
        </View>
      </View>

      {/* Recent Q&A Activity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💬 Recent Q&A Activity</Text>
        {childStats.recentQuestions.length > 0 && (
          <View style={styles.questionsContainer}>
            <ScrollView 
              style={styles.questionsScrollView} 
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              {childStats.recentQuestions.map((q, index) => (
                <Pressable key={index} style={styles.questionCard} onPress={() => openQuestionModal(q)}>
                  <Text style={styles.questionText}>{q.question}</Text>
                  <View style={styles.questionMetaRow}>
                    <Text style={styles.questionMeta}>{q.subject} • {formatDate(q.createdAt)}</Text>
                    <Text style={styles.answerCount}>{q.answers?.length || 0} answers</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
        {childStats.recentQuestions.length === 0 && (
          <Text style={styles.emptyText}>No recent questions</Text>
        )}
      </View>

      {/* Encouragement Tools */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💝 Encouragement Center</Text>
        <View style={styles.encouragementCard}>
          <Text style={styles.encouragementText}>
            "Your child helped {childStats.answersGiven} peers this week! 🌟"
          </Text>
          <Text style={styles.encouragementSubtext}>
            Send them some love and motivation!
          </Text>
          <Button mode="contained" onPress={sendKudos} style={styles.kudosButton}>
            Send Kudos 🎉
          </Button>
        </View>
      </View>

      {/* Question Detail Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeQuestionModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Question Details</Text>
              <Pressable style={styles.closeButton} onPress={closeQuestionModal}>
                <Text style={styles.closeButtonText}>✕</Text>
              </Pressable>
            </View>
            
            {selectedQuestion && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.modalQuestionSection}>
                  <Text style={styles.modalQuestionLabel}>Question:</Text>
                  <Text style={styles.modalQuestionText}>{selectedQuestion.question}</Text>
                  <Text style={styles.modalQuestionMeta}>
                    {selectedQuestion.subject} • Asked on {formatDate(selectedQuestion.createdAt)}
                  </Text>
                </View>
                
                <View style={styles.modalAnswersSection}>
                  <Text style={styles.modalAnswersLabel}>Answers ({selectedQuestion.answers?.length || 0}):</Text>
                  {selectedQuestion.answers && selectedQuestion.answers.length > 0 ? (
                    selectedQuestion.answers.map((answer, index) => (
                      <View key={index} style={styles.modalAnswerCard}>
                        <Text style={styles.modalAnswerText}>{answer.answer}</Text>
                        <Text style={styles.modalAnswerMeta}>
                          By: {answer.answererName || 'Anonymous'} • {formatDate(answer.createdAt)}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.modalNoAnswers}>No answers yet</Text>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  logoutButton: {
    backgroundColor: '#EF4444',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  section: {
    margin: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  progressCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2563EB',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  engagementCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  engagementIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  engagementInfo: {
    flex: 1,
  },
  engagementLevel: {
    fontSize: 18,
    fontWeight: '700',
  },
  engagementText: {
    fontSize: 14,
    color: '#6B7280',
  },
  comparisonCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  comparisonLabel: {
    fontSize: 14,
    color: '#111827',
    flex: 1,
  },
  comparisonChild: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563EB',
    width: 40,
    textAlign: 'center',
  },
  comparisonAvg: {
    fontSize: 12,
    color: '#6B7280',
    width: 60,
    textAlign: 'right',
  },
  subjectCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  subjectRow: {
    marginBottom: 12,
  },
  subjectName: {
    fontSize: 16,
    color: '#111827',
    marginBottom: 4,
  },
  subjectStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subjectCount: {
    fontSize: 12,
    color: '#6B7280',
    width: 80,
  },
  subjectBar: {
    height: 6,
    backgroundColor: '#2563EB',
    borderRadius: 3,
    flex: 1,
    marginLeft: 8,
  },
  weakZoneCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  weakZoneText: {
    fontSize: 14,
    color: '#DC2626',
    lineHeight: 20,
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  questionCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
  },
  questionText: {
    fontSize: 14,
    color: '#111827',
    marginBottom: 8,
  },
  questionMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  questionMeta: {
    fontSize: 12,
    color: '#6B7280',
  },
  answerCount: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
  },
  encouragementCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  encouragementText: {
    fontSize: 16,
    color: '#059669',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  encouragementSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  kudosButton: {
    backgroundColor: '#F59E0B',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  questionsContainer: {
    height: 300,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  questionsScrollView: {
    flex: 1,
    paddingVertical: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  modalBody: {
    padding: 20,
  },
  modalQuestionSection: {
    marginBottom: 20,
  },
  modalQuestionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  modalQuestionText: {
    fontSize: 16,
    color: '#111827',
    lineHeight: 24,
    marginBottom: 8,
  },
  modalQuestionMeta: {
    fontSize: 12,
    color: '#6B7280',
  },
  modalAnswersSection: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 20,
  },
  modalAnswersLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  modalAnswerCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#10B981',
  },
  modalAnswerText: {
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
    marginBottom: 6,
  },
  modalAnswerMeta: {
    fontSize: 11,
    color: '#6B7280',
  },
  modalNoAnswers: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
});