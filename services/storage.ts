import * as firebaseApp from "firebase/app";
import { 
  getFirestore, collection, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, 
  query, where, getDocs, orderBy, onSnapshot, serverTimestamp, Firestore 
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL, FirebaseStorage } from "firebase/storage";
import { User, UserRole, Student, Notification, StudentResult, AttendanceRecord, SubjectConfig, ADMIN_CONTACTS, FeeStructure, FeePaymentRecord, Feedback } from '../types';

// --- CONFIG & INIT ---

declare global {
  interface Window {
    __firebase_config: any;
    __app_id: string;
  }
}

const APP_ID = window.__app_id || 'maktab-default';
const BASE_PATH = `/artifacts/${APP_ID}/public/data`;

// Paths helper
const paths = {
  students: `${BASE_PATH}/students`,
  notifications: `${BASE_PATH}/notifications`,
  results: `${BASE_PATH}/results`,
  attendance: `${BASE_PATH}/attendance`,
  config: `${BASE_PATH}/config`,
  fees: `${BASE_PATH}/fees`,
  feedback: `${BASE_PATH}/feedback`
};

// Initialize Firebase
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

if (window.__firebase_config) {
  try {
    const app = firebaseApp.initializeApp(window.__firebase_config);
    db = getFirestore(app);
    storage = getStorage(app);
    console.log("Firebase initialized successfully");
  } catch (err) {
    console.error("Firebase init failed, falling back to LocalStorage", err);
  }
} else {
  console.warn("No Firebase config found. Running in Offline/Mock Mode.");
}

// --- GRADING LOGIC ---

export const calculateGradeInfo = (marks: number) => {
  let grade = 'D';
  let pl = 'BPL';

  if (marks >= 85) { grade = 'A+'; pl = 'OPL'; }
  else if (marks >= 80) { grade = 'A'; pl = 'OPL'; }
  else if (marks >= 70) { grade = 'B+'; pl = 'APL'; }
  else if (marks >= 60) { grade = 'B'; pl = 'APL'; }
  else if (marks >= 50) { grade = 'C+'; pl = 'MPL'; }
  else if (marks >= 35) { grade = 'C'; pl = 'MPL'; }
  
  return { grade, pl };
};

// --- SAFE STORAGE WRAPPER ---
// Handles "Access is denied" errors in iframes/sandboxes
const createSafeStorage = () => {
  try {
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch (e) {
    console.warn('LocalStorage access denied. Using in-memory fallback.');
    const memoryStore: Record<string, string> = {};
    return {
      getItem: (key: string) => memoryStore[key] || null,
      setItem: (key: string, value: string) => { memoryStore[key] = value; },
      removeItem: (key: string) => { delete memoryStore[key]; },
      clear: () => { for (const k in memoryStore) delete memoryStore[k]; }
    };
  }
};

const safeStorage = createSafeStorage();

// --- LOCAL STORAGE MOCK HELPER ---
// Simulates async DB calls for offline mode
const LS = {
  get: (key: string) => {
    try {
      return JSON.parse(safeStorage.getItem(key) || '[]');
    } catch { return []; }
  },
  set: (key: string, data: any) => {
    try {
      safeStorage.setItem(key, JSON.stringify(data));
    } catch {}
  },
  delay: () => new Promise(r => setTimeout(r, 300)), // Simulate network latency
  
  // Specific Data Helpers
  students: () => LS.get('maktab_students') as Student[],
  results: () => LS.get('maktab_results') as StudentResult[],
  notifs: () => LS.get('maktab_notifications') as Notification[],
  subjects: () => LS.get('maktab_subjects') as SubjectConfig[],
  attendance: () => LS.get('maktab_attendance') as AttendanceRecord[],
  feeStructure: () => LS.get('maktab_fee_config') as FeeStructure,
  feeRecords: () => LS.get('maktab_fee_records') as FeePaymentRecord[],
  feedback: () => LS.get('maktab_feedback') as Feedback[],
};

// --- API SERVICE ---

export const api = {
  // Auth
  login: async (contact: string): Promise<User | null> => {
    if (ADMIN_CONTACTS.includes(contact)) {
      return { id: contact, name: 'Teacher (Admin)', role: UserRole.TEACHER };
    }

    if (db) {
      const q = query(collection(db, paths.students), where('contact', '==', contact));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data() as Student;
        return { ...data, id: snapshot.docs[0].id, role: UserRole.STUDENT };
      }
      return null;
    } else {
      await LS.delay();
      const student = LS.students().find(s => s.contact === contact);
      return student ? { ...student, role: UserRole.STUDENT } : null;
    }
  },

  // Students
  getStudents: async (): Promise<Student[]> => {
    if (db) {
      const snapshot = await getDocs(collection(db, paths.students));
      return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Student));
    } else {
      await LS.delay();
      return LS.students();
    }
  },

  getStudentsByClass: async (className: string): Promise<Student[]> => {
    if (db) {
      const q = query(collection(db, paths.students), where('class', '==', className));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Student));
    } else {
      await LS.delay();
      return LS.students().filter(s => s.class === className);
    }
  },

  addStudent: async (student: Omit<Student, 'id' | 'role'>) => {
    if (db) {
      await setDoc(doc(db, paths.students, student.contact), {
        ...student,
        role: UserRole.STUDENT
      });
    } else {
      const list = LS.students();
      // Update if exists, else add
      const idx = list.findIndex(s => s.contact === student.contact);
      const newObj = { ...student, id: student.contact, role: UserRole.STUDENT };
      if (idx >= 0) list[idx] = newObj as Student;
      else list.push(newObj as Student);
      LS.set('maktab_students', list);
    }
  },

  deleteStudent: async (contact: string) => {
    if (db) {
      await deleteDoc(doc(db, paths.students, contact));
    } else {
      const list = LS.students().filter(s => s.contact !== contact);
      LS.set('maktab_students', list);
    }
  },

  // Subjects (Config)
  getSubjects: async (): Promise<SubjectConfig[]> => {
    if (db) {
      const docRef = doc(db, paths.config, 'subjects');
      const snap = await getDoc(docRef);
      if (snap.exists()) return snap.data().activeSubjects || [];
    } else {
      const stored = LS.subjects();
      if (stored && stored.length > 0) return stored;
    }
    
    // Default Init
    const defaults = [
      { name: "BENGALI", maxMarks: 100 },
      { name: "ENGLISH", maxMarks: 100 },
      { name: "ARABIC", maxMarks: 100 },
      { name: "MATHEMATICS", maxMarks: 100 }
    ];
    
    // Save defaults if missing
    if (db) await setDoc(doc(db, paths.config, 'subjects'), { activeSubjects: defaults });
    else LS.set('maktab_subjects', defaults);
    
    return defaults;
  },

  updateSubjects: async (subjects: SubjectConfig[]) => {
    if (db) {
      await setDoc(doc(db, paths.config, 'subjects'), { activeSubjects: subjects });
    } else {
      LS.set('maktab_subjects', subjects);
    }
  },

  // Results
  getResults: async (studentId?: string): Promise<StudentResult[]> => {
    if (db) {
      let q = collection(db, paths.results);
      if (studentId) {
        q = query(collection(db, paths.results), where('studentId', '==', studentId)) as any;
      }
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as StudentResult));
    } else {
      await LS.delay();
      let res = LS.results();
      if (studentId) res = res.filter(r => r.studentId === studentId);
      return res;
    }
  },

  bulkUpdateMarks: async (className: string, examName: string, subjectName: string, maxMarks: number, updates: { studentId: string, marks: number }[]) => {
    for (const update of updates) {
      let result: StudentResult | undefined;
      let docId = `${update.studentId}_${examName.replace(/\s+/g, '_')}`;

      if (db) {
        const snap = await getDoc(doc(db, paths.results, docId));
        if (snap.exists()) result = { ...snap.data(), id: snap.id } as StudentResult;
      } else {
        result = LS.results().find(r => r.id === docId);
      }

      const marksMap = result ? { ...result.marks } : {};
      marksMap[subjectName] = update.marks;

      let totalObt = 0;
      Object.values(marksMap).forEach((m: any) => totalObt += m);

      // Simple calculation for offline/quick mode. 
      // Note: Ideally, fetch all subjects to calc full totals, but this persists the specific subject update.
      
      const newResult: StudentResult = {
        ...(result || {
          studentId: update.studentId,
          examName,
          totalMarks: 0,
          maxTotalMarks: 0,
          percentage: 0,
          isPass: false,
          marks: {}
        }),
        id: docId,
        marks: marksMap,
        totalMarks: totalObt
      };

      if (db) {
        await setDoc(doc(db, paths.results, docId), newResult);
      } else {
        const list = LS.results();
        const idx = list.findIndex(r => r.id === docId);
        if (idx >= 0) list[idx] = newResult;
        else list.push(newResult);
        LS.set('maktab_results', list);
      }
    }
    
    // Trigger a full recalculation for these students to ensure Grade/Pass status is correct based on ALL subjects
    // This is an enhancement to ensure data consistency
    const allSubjects = await api.getSubjects();
    for(const update of updates) {
       const docId = `${update.studentId}_${examName.replace(/\s+/g, '_')}`;
       let result: StudentResult | undefined;
       
       if(db) {
          const snap = await getDoc(doc(db, paths.results, docId));
          result = snap.data() as StudentResult;
       } else {
          result = LS.results().find(r => r.id === docId);
       }
       
       if(result) {
         let totalObt = 0;
         let maxTotal = 0;
         let isPass = true;
         
         // Iterate available subjects in the result
         for(const sub of Object.keys(result.marks)) {
            const m = result.marks[sub];
            totalObt += m;
            const cfg = allSubjects.find(s => s.name === sub);
            maxTotal += cfg ? cfg.maxMarks : 100;
            if(m < 35) isPass = false;
         }
         
         const percentage = maxTotal > 0 ? (totalObt / maxTotal) * 100 : 0;
         const { grade } = calculateGradeInfo(percentage);
         
         const updatedRes = {
           ...result,
           totalMarks: totalObt,
           maxTotalMarks: maxTotal,
           percentage: parseFloat(percentage.toFixed(2)),
           overallGrade: grade,
           isPass
         };
         
         if(db) await setDoc(doc(db, paths.results, docId), updatedRes);
         else {
            const list = LS.results();
            const idx = list.findIndex(r => r.id === docId);
            list[idx] = updatedRes;
            LS.set('maktab_results', list);
         }
       }
    }
  },

  saveResult: async (result: Omit<StudentResult, 'id'>) => {
    const docId = `${result.studentId}_${result.examName.replace(/\s+/g, '_')}`;
    const data = { ...result, id: docId };
    
    if (db) {
      await setDoc(doc(db, paths.results, docId), result);
    } else {
      const list = LS.results();
      const idx = list.findIndex(r => r.id === docId);
      if (idx >= 0) list[idx] = data;
      else list.push(data);
      LS.set('maktab_results', list);
    }
  },

  calculateRank: async (studentId: string, examName: string, myTotal: number): Promise<number> => {
    let scores: number[] = [];
    
    if (db) {
      const q = query(collection(db, paths.results), where('examName', '==', examName));
      const snapshot = await getDocs(q);
      scores = snapshot.docs.map(d => d.data().totalMarks as number);
    } else {
      scores = LS.results()
        .filter(r => r.examName === examName)
        .map(r => r.totalMarks);
    }
    
    scores.sort((a, b) => b - a);
    return scores.indexOf(myTotal) + 1;
  },

  // Upload
  uploadFile: async (file: File, folder: string): Promise<string> => {
    if (storage) {
      try {
        const storageRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        return await getDownloadURL(snapshot.ref);
      } catch (e) {
        console.error("Upload failed", e);
        throw e;
      }
    } else {
      // Offline fallback: Convert to Base64
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }
  },

  // Notifications
  getNotifications: async (): Promise<Notification[]> => {
    if (db) {
      const q = query(collection(db, paths.notifications), orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Notification));
    } else {
      await LS.delay();
      return LS.notifs().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
  },

  addNotification: async (notif: { text: string, imageUrl?: string, pdfUrl?: string, pdfName?: string }) => {
    const newNotif = {
      ...notif,
      date: new Date().toISOString().split('T')[0],
      timestamp: Date.now()
    };

    if (db) {
      await addDoc(collection(db, paths.notifications), {
        ...newNotif,
        timestamp: serverTimestamp()
      });
    } else {
      const list = LS.notifs();
      list.push({ ...newNotif, id: Math.random().toString(36).substr(2, 9) });
      LS.set('maktab_notifications', list);
    }
  },

  deleteNotification: async (id: string) => {
    if (db) {
      await deleteDoc(doc(db, paths.notifications, id));
    } else {
      const list = LS.notifs().filter(n => n.id !== id);
      LS.set('maktab_notifications', list);
    }
  },

  // Attendance
  getAttendance: async (studentId: string): Promise<AttendanceRecord | null> => {
    if (db) {
      const docRef = doc(db, paths.attendance, studentId);
      const snap = await getDoc(docRef);
      if (snap.exists()) return { ...snap.data(), studentId } as AttendanceRecord;
    } else {
      return LS.attendance().find(a => a.studentId === studentId) || null;
    }
    return null;
  },

  getAttendanceForClass: async (studentIds: string[]): Promise<AttendanceRecord[]> => {
     const records: AttendanceRecord[] = [];
     for (const id of studentIds) {
       const rec = await api.getAttendance(id);
       if (rec) records.push(rec);
     }
     return records;
  },

  updateAttendance: async (record: AttendanceRecord) => {
    const data = {
      totalClasses: record.totalClasses,
      presentDays: record.presentDays,
      lastUpdated: new Date().toISOString().split('T')[0],
      history: record.history || {}
    };

    if (db) {
      await setDoc(doc(db, paths.attendance, record.studentId), data);
    } else {
      const list = LS.attendance();
      const idx = list.findIndex(a => a.studentId === record.studentId);
      const newRec = { ...data, studentId: record.studentId };
      if (idx >= 0) list[idx] = newRec;
      else list.push(newRec);
      LS.set('maktab_attendance', list);
    }
  },

  bulkUpdateAttendance: async (classStudents: Student[], tickedStudentIds: string[], date: string) => {
    for (const student of classStudents) {
      let record: AttendanceRecord | null = null;
      
      if (db) {
        const snap = await getDoc(doc(db, paths.attendance, student.contact));
        if (snap.exists()) record = snap.data() as AttendanceRecord;
      } else {
        record = LS.attendance().find(a => a.studentId === student.contact) || null;
      }

      const history = record?.history || {};
      const isPresent = tickedStudentIds.includes(student.contact);
      
      history[date] = isPresent ? 'present' : 'absent';

      const dates = Object.keys(history);
      const total = dates.length;
      const present = Object.values(history).filter(status => status === 'present').length;

      const newRecord: AttendanceRecord = {
        studentId: student.contact,
        totalClasses: total,
        presentDays: present,
        lastUpdated: date,
        history: history
      };

      if (db) {
        await setDoc(doc(db, paths.attendance, student.contact), newRecord);
      } else {
         const list = LS.attendance();
         const idx = list.findIndex(a => a.studentId === student.contact);
         if (idx >= 0) list[idx] = newRecord;
         else list.push(newRecord);
         LS.set('maktab_attendance', list);
      }
    }
  },

  // --- FEE MANAGEMENT ---
  
  getFeeStructure: async (): Promise<FeeStructure> => {
    if (db) {
      const snap = await getDoc(doc(db, paths.config, 'fees'));
      if (snap.exists()) return snap.data().structure;
    } else {
      const stored = LS.feeStructure();
      if (stored) return stored;
    }
    return {
      'Class I': 500, 'Class II': 600, 'Class III': 700, 'Class IV': 800, 'Class V': 900
    };
  },

  saveFeeStructure: async (structure: FeeStructure) => {
    if (db) {
      await setDoc(doc(db, paths.config, 'fees'), { structure });
    } else {
      LS.set('maktab_fee_config', structure);
    }
  },

  getStudentFeeRecord: async (studentId: string, year: string): Promise<FeePaymentRecord> => {
    const docId = `${studentId}_${year}`;
    if (db) {
      const snap = await getDoc(doc(db, paths.fees, docId));
      if (snap.exists()) return snap.data() as FeePaymentRecord;
    } else {
      const rec = LS.feeRecords().find(r => r.studentId === studentId && r.year === year);
      if (rec) return rec;
    }
    return { studentId, year, payments: {} };
  },

  updateStudentFee: async (record: FeePaymentRecord) => {
    const docId = `${record.studentId}_${record.year}`;
    if (db) {
      await setDoc(doc(db, paths.fees, docId), record);
    } else {
      const list = LS.feeRecords();
      const idx = list.findIndex(r => r.studentId === record.studentId && r.year === record.year);
      if (idx >= 0) list[idx] = record;
      else list.push(record);
      LS.set('maktab_fee_records', list);
    }
  },

  // --- FEEDBACK ---

  getFeedback: async (): Promise<Feedback[]> => {
    if (db) {
      const q = query(collection(db, paths.feedback), orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Feedback));
    } else {
      await LS.delay();
      return LS.feedback().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
  },

  addFeedback: async (feedback: Omit<Feedback, 'id' | 'timestamp'>) => {
    const newFeedback = {
      ...feedback,
      timestamp: Date.now()
    };

    if (db) {
      await addDoc(collection(db, paths.feedback), {
        ...newFeedback,
        timestamp: serverTimestamp()
      });
    } else {
      const list = LS.feedback();
      list.push({ ...newFeedback, id: Math.random().toString(36).substr(2, 9) });
      LS.set('maktab_feedback', list);
    }
  },

  deleteFeedback: async (id: string) => {
    if (db) {
      await deleteDoc(doc(db, paths.feedback, id));
    } else {
      const list = LS.feedback().filter(f => f.id !== id);
      LS.set('maktab_feedback', list);
    }
  }
};