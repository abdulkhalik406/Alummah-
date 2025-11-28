import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, 
  query, where, getDocs, orderBy, onSnapshot, serverTimestamp, Firestore 
} from "firebase/firestore";
import { User, UserRole, Student, Notification, StudentResult, AttendanceRecord, SubjectConfig, ADMIN_CONTACTS } from '../types';

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
  config: `${BASE_PATH}/config`
};

// Initialize Firestore ONLY if config exists to avoid "demo-project" connection errors
let db: Firestore | null = null;
if (window.__firebase_config) {
  try {
    const app = initializeApp(window.__firebase_config);
    db = getFirestore(app);
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
    // This function fetches existing results for each student and updates just one subject
    for (const update of updates) {
      // Get existing or create new
      let result: StudentResult | undefined;
      let docId = `${update.studentId}_${examName.replace(/\s+/g, '_')}`;

      // Helper to fetch single result logic agnostic of DB
      if (db) {
        const snap = await getDoc(doc(db, paths.results, docId));
        if (snap.exists()) result = { ...snap.data(), id: snap.id } as StudentResult;
      } else {
        result = LS.results().find(r => r.id === docId);
      }

      const marksMap = result ? { ...result.marks } : {};
      marksMap[subjectName] = update.marks;

      // Recalculate Totals (Roughly, assuming other marks exist)
      let totalObt = 0;
      // Note: This basic calc only sums what is currently in the map. 
      // Ideally we need the full subject config to know max marks, but we pass maxMarks for *this* subject.
      // We will approximate MaxTotalMarks by summing known subject maxes if possible, 
      // or just leave it for the detailed save. For now, we just save the data point.
      
      Object.values(marksMap).forEach((m: any) => totalObt += m);

      const newResult: StudentResult = {
        ...(result || {
          studentId: update.studentId,
          examName,
          totalMarks: 0,
          maxTotalMarks: 0, // Will be inaccurate until full save, but holds data
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

  updateAttendance: async (record: AttendanceRecord) => {
    const data = {
      totalClasses: record.totalClasses,
      presentDays: record.presentDays,
      lastUpdated: new Date().toISOString().split('T')[0]
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

  bulkUpdateAttendance: async (classStudents: Student[], tickedStudentIds: string[]) => {
    // 1. Fetch current attendance for all students in class
    // 2. Increment total for ALL
    // 3. Increment present for TICKED
    
    // We process sequentially or parallel
    for (const student of classStudents) {
      let record: AttendanceRecord | null = null;
      
      // Get existing
      if (db) {
        const snap = await getDoc(doc(db, paths.attendance, student.contact));
        if (snap.exists()) record = snap.data() as AttendanceRecord;
      } else {
        record = LS.attendance().find(a => a.studentId === student.contact) || null;
      }

      const currentTotal = record?.totalClasses || 0;
      const currentPresent = record?.presentDays || 0;
      const isPresent = tickedStudentIds.includes(student.contact);

      const newRecord: AttendanceRecord = {
        studentId: student.contact,
        totalClasses: currentTotal + 1,
        presentDays: isPresent ? currentPresent + 1 : currentPresent
      };

      // Save
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
  }
};