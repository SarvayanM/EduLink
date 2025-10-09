import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Image, Alert, Modal } from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { signOut, updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth, db, storage } from '../services/firebaseAuth';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { calculateUserStats } from '../utils/userStatsCalculator';

export default function ProfileScreen({ navigation }) {
  const [userProfile, setUserProfile] = useState({});
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [editImage, setEditImage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [childData, setChildData] = useState(null);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchChildData = async (parentData) => {
    try {
      if (!parentData.studentEmail) return;
      
      const studentsQuery = query(
        collection(db, 'users'),
        where('email', '==', parentData.studentEmail),
        where('role', 'in', ['student', 'tutor'])
      );
      const studentsSnapshot = await getDocs(studentsQuery);
      
      if (!studentsSnapshot.empty) {
        const childDoc = studentsSnapshot.docs[0];
        const child = { id: childDoc.id, ...childDoc.data() };
        setChildData(child);
      }
    } catch (error) {
      console.error('Error fetching child data:', error);
    }
  };

  const fetchUserProfile = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // Only calculate stats for non-parent users
          if (userData.role !== 'parent') {
            const stats = await calculateUserStats(user.uid);
            setUserProfile({
              ...userData,
              questionsCount: stats.questionsAsked,
              answersCount: stats.answersGiven,
              points: userData.points || 0
            });
          } else {
            // For parents, fetch child data and use basic user data
            await fetchChildData(userData);
            setUserProfile({
              ...userData,
              questionsCount: 0,
              answersCount: 0,
              points: 0
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {  
      setLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'Images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setEditImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };



  const handleSave = async () => {
    if (!oldPassword.trim() || !newPassword.trim()) {
      Alert.alert('Error', 'Please enter both old and new passwords');
      return;
    }
    
    setSaving(true);
    try {
      const user = auth.currentUser;
      const credential = EmailAuthProvider.credential(user.email, oldPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      
      setEditMode(false);
      Alert.alert('Success', 'Password changed successfully!');
    } catch (error) {
      if (error.code === 'auth/wrong-password') {
        Alert.alert('Error', 'Old password is incorrect');
      } else {
        Alert.alert('Error', error.message || 'Failed to change password');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditMode(false);
    setOldPassword('');
    setNewPassword('');
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      Alert.alert('Success', 'Logged out successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to logout');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Profile</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {/* Profile Info */}
        <View style={styles.profileSection}>
          <View style={styles.profileImageContainer}>
            {userProfile.profileImage ? (
              <Image source={{ uri: userProfile.profileImage }} style={styles.profileImage} />
            ) : (
              <View style={styles.defaultAvatar}>
                <Text style={styles.avatarText}>{userProfile.displayName?.charAt(0) || 'U'}</Text>
              </View>
            )}
          </View>
          
          <Text style={styles.userName}>{userProfile.displayName || 'User'}</Text>
          <Text style={styles.userEmail}>{userProfile.email}</Text>
          <View style={styles.roleTag}>
            <Text style={styles.roleText}>
              {userProfile.role === 'parent' ? 'PARENT' : 
               (userProfile.points >= 200 && userProfile.role === 'student') ? 'TUTOR' : 
               userProfile.role?.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Profile Details */}
        <View style={styles.detailsSection}>
          <Text style={styles.sectionTitle}>Profile Details</Text>
          
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Full Name</Text>
            <Text style={styles.detailValue}>{userProfile.displayName || 'Not set'}</Text>
          </View>
          
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Email</Text>
            <Text style={styles.detailValue}>{userProfile.email}</Text>
          </View>
          
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Role</Text>
            <Text style={styles.detailValue}>
              {userProfile.role === 'parent' ? 'parent' :
               (userProfile.points >= 200 && userProfile.role === 'student') ? 'tutor' : 
               userProfile.role || 'Not set'}
            </Text>
          </View>       
          
          {userProfile.grade && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Grade</Text>
              <Text style={styles.detailValue}>Grade {userProfile.grade}</Text>
            </View>
          )}
          
          {userProfile.subject && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Subject</Text>
              <Text style={styles.detailValue}>{userProfile.subject}</Text>
            </View>
          )}
          
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Member Since</Text>
            <Text style={styles.detailValue}>
              {userProfile.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
            </Text>
          </View> 
        </View>

        {/* Student Details Section - Only for parent users */}
        {userProfile.role === 'parent' && childData && (
          <View style={styles.detailsSection}>
            <Text style={styles.sectionTitle}>Student Details</Text>
            
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Student Name</Text>
              <Text style={styles.detailValue}>{childData.displayName || 'Not set'}</Text>
            </View>
            
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Student Email</Text>
              <Text style={styles.detailValue}>{childData.email}</Text>
            </View>
            
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Grade</Text>
              <Text style={styles.detailValue}>Grade {childData.grade}</Text>
            </View>
            
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Points</Text>
              <Text style={styles.detailValue}>{childData.points || 0}</Text>
            </View>
            
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Level</Text>
              <Text style={styles.detailValue}>{Math.floor((childData.points || 0) / 200) + 1}</Text>
            </View>
          </View>
        )}

        {/* Stats Section - Only for non-parent users */}
        {userProfile.role !== 'parent' && (
          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>My Stats</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{userProfile.points || 0}</Text>
                <Text style={styles.statLabel}>Points</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{userProfile.questionsCount || 0}</Text>
                <Text style={styles.statLabel}>Questions</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{userProfile.answersCount || 0}</Text>
                <Text style={styles.statLabel}>Answers</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{Math.floor((userProfile.points || 0) / 200) + 1}</Text>
                <Text style={styles.statLabel}>Level</Text>
              </View>
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsSection}>
          <Button mode="outlined" onPress={() => setEditMode(true)}>
            Change Password
          </Button>
          <Button mode="contained" onPress={handleLogout} style={styles.logoutButton}>
            Logout
          </Button>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={editMode}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <Pressable style={styles.closeButton} onPress={handleCancel}>
                <Text style={styles.closeButtonText}>×</Text>
              </Pressable>
            </View>
            
            <ScrollView style={styles.modalBody}>
              {/* Old Password Input */}
              <TextInput
                value={oldPassword}
                onChangeText={setOldPassword}
                style={styles.modalInput}
                mode="outlined"
                label="Current Password"
                secureTextEntry
                placeholder="Enter current password"
              />
              
              {/* New Password Input */}
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                style={styles.modalInput}
                mode="outlined"
                label="New Password"
                secureTextEntry
                placeholder="Enter new password"
              />
              
              {/* Action Buttons */}
              <View style={styles.modalActions}>
                <Button mode="contained" onPress={handleSave} loading={saving} style={styles.saveButton}>
                  Change Password
                </Button>
                <Button mode="outlined" onPress={handleCancel}>
                  Cancel
                </Button>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 50,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  backText: {
    fontSize: 16,
    color: '#2563EB',
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  profileSection: {
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileImageContainer: {
    marginBottom: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  defaultAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 36,
    fontWeight: '600',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 12,
  },
  roleTag: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  roleText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  detailsSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    minHeight: 44,
  },
  detailLabel: {
    fontSize: 16,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },

  statsSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  statCard: {
    width: '47%',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2563EB',
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  actionsSection: {
    gap: 12,
    marginBottom: 40,
  },
  logoutButton: {
    backgroundColor: '#EF4444',
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
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#6B7280',
    fontWeight: '600',
  },
  modalBody: {
    padding: 20,
  },
  modalImageContainer: {
    alignSelf: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  modalProfileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  modalDefaultAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAvatarText: {
    color: 'white',
    fontSize: 28,
    fontWeight: '600',
  },
  editImageOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editImageText: {
    fontSize: 12,
  },
  modalInput: {
    marginBottom: 16,
  },
  modalActions: {
    gap: 12,
    marginTop: 20,
  },
  saveButton: {
    backgroundColor: '#2563EB',
  },
};