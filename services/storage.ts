
import * as firebaseApp from "firebase/app";
import { 
  getFirestore, collection, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, 
  query, where, getDocs, orderBy, onSnapshot, serverTimestamp, Firestore 
} from "firebase/firestore";
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

// Cloudinary Credentials
const CLOUDINARY_CLOUD_NAME = 'dnfppupi4';
const CLOUDINARY_API_KEY = '248764635877288';
const CLOUDINARY_API_SECRET = 'CQCR-QBeSgtt0cVytzcyFoJLe24';
// Note: We are using a fully signed upload flow with API Key/Secret. 
// We ignore the upload preset to avoid conflicts if the provided preset is 'Unsigned'.
// const CLOUDINARY_UPLOAD_PRESET = 'cloudinary_3d_9e9f61fe-511e-4d24-856a-851cf3a3068c'; 

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

if (window.__firebase_config) {
  try {
    const app = firebaseApp.initializeApp(window.__firebase_config);
    db = getFirestore(app);
    console.log("Firebase initialized successfully");
  } catch (err) {
    console.error("Firebase init failed, falling back to LocalStorage", err);
  }
} else {
  console.warn("No Firebase config found. Running in Offline/Mock Mode.");
}

// --- HELPERS ---

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

// SHA-1 Generator for Cloudinary Signature
async function sha1(str: string) {
  // Check for crypto support
  if (!window.crypto || !window.crypto.subtle) {
    console.error("Crypto API not available. Cloudinary upload may fail.");
    return "";
  }
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-1', enc.encode(str));
  return Array.from(new Uint8Array(hash))
    .map(v => v.toString(16).padStart(2, '0'))
    .join('');
}

// --- SAFE STORAGE WRAPPER ---
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
  delay: () => new Promise(r => setTimeout(r, 300)), 
  
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

  // File Upload (Cloudinary Signed Upload)
  uploadFile: async (file: File, folder: string): Promise<string> => {
    // 1. Get Signature params
    const timestamp = Math.round((new Date()).getTime() / 1000);
    
    // Params must be sorted alphabetically for signature generation.
    // We are NOT including upload_preset to avoid conflicts if the preset is Unsigned.
    // We are using API Key + Secret which allows authenticated uploads to any folder.
    const params = `folder=${folder}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
    
    // 2. Generate Signature
    const signature = await sha1(params);
    if (!signature) {
      throw new Error("Could not generate signature (Crypto API missing)");
    }
    
    // 3. Upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', CLOUDINARY_API_KEY);
    formData.append('timestamp', timestamp.toString());
    formData.append('folder', folder);
    formData.append('signature', signature);
    // Note: upload_preset is excluded.
    
    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (data.secure_url) return data.secure_url;
      console.error("Cloudinary Error:", data);
      throw new Error(data.error?.message || 'Upload failed');
    } catch (e: any) {
      console.error("Cloudinary upload exception:", e);
      
      // Fallback to Base64 if cloud upload fails (e.g. network/cors issues)
      // This ensures the app doesn't break completely.
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
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

  // Bulk Fetch for Overview
  getAllAttendance: async (): Promise<AttendanceRecord[]> => {
    if (db) {
      const snap = await getDocs(collection(db, paths.attendance));
      return snap.docs.map(d => ({ ...d.data(), id: d.id } as AttendanceRecord));
    } else {
      return LS.attendance();
    }
  },

  getAttendanceForClass: async (studentIds: string[]): Promise<AttendanceRecord[]> => {
    const results: AttendanceRecord[] = [];
    for (const id of studentIds) {
      const r = await api.getAttendance(id);
      if (r) results.push(r);
    }
    return results;
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
      
      // Get existing
      if (db) {
        const snap = await getDoc(doc(db, paths.attendance, student.contact));
        if (snap.exists()) record = snap.data() as AttendanceRecord;
      } else {
        record = LS.attendance().find(a => a.studentId === student.contact) || null;
      }

      const history = record?.history || {};
      const alreadyMarked = history[date];
      const isPresent = tickedStudentIds.includes(student.contact);
      
      // Logic: Only update counters if status changed or wasn't marked
      let newTotal = record?.totalClasses || 0;
      let newPresent = record?.presentDays || 0;

      if (!alreadyMarked) {
        // First time marking for this date
        newTotal++;
        if (isPresent) newPresent++;
      } else {
        // Changing existing mark
        if (alreadyMarked === 'absent' && isPresent) newPresent++;
        if (alreadyMarked === 'present' && !isPresent) newPresent--;
      }

      history[date] = isPresent ? 'present' : 'absent';

      const newRecord: AttendanceRecord = {
        studentId: student.contact,
        totalClasses: newTotal,
        presentDays: newPresent,
        history: history,
        lastUpdated: date
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

  // Fees
  getFeeStructure: async (): Promise<FeeStructure> => {
    if (db) {
      const snap = await getDoc(doc(db, paths.config, 'fees'));
      return snap.exists() ? snap.data() : {};
    } else {
      return LS.feeStructure() || {};
    }
  },

  saveFeeStructure: async (fees: FeeStructure) => {
    if (db) {
      await setDoc(doc(db, paths.config, 'fees'), fees);
    } else {
      LS.set('maktab_fee_config', fees);
    }
  },

  getStudentFeeRecord: async (studentId: string, year: string): Promise<FeePaymentRecord> => {
    const id = `${studentId}_${year}`;
    if (db) {
      const snap = await getDoc(doc(db, paths.fees, id));
      if (snap.exists()) return snap.data() as FeePaymentRecord;
    } else {
      const rec = LS.feeRecords().find(r => r.studentId === studentId && r.year === year);
      if (rec) return rec;
    }
    // Default
    return { studentId, year, payments: {} };
  },

  getAllFeeRecords: async (year: string): Promise<FeePaymentRecord[]> => {
    if (db) {
      const q = query(collection(db, paths.fees), where('year', '==', year));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as FeePaymentRecord);
    } else {
      return LS.feeRecords().filter(r => r.year === year);
    }
  },

  updateStudentFee: async (record: FeePaymentRecord) => {
    const id = `${record.studentId}_${record.year}`;
    if (db) {
      await setDoc(doc(db, paths.fees, id), record);
    } else {
      const list = LS.feeRecords();
      const idx = list.findIndex(r => r.studentId === record.studentId && r.year === record.year);
      if (idx >= 0) list[idx] = record;
      else list.push(record);
      LS.set('maktab_fee_records', list);
    }
  },

  // Feedback
  getFeedback: async (): Promise<Feedback[]> => {
    if (db) {
      const q = query(collection(db, paths.feedback), orderBy('date', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ ...d.data(), id: d.id } as Feedback));
    } else {
      return LS.feedback();
    }
  },

  addFeedback: async (feedback: Feedback) => {
    if (db) {
      await addDoc(collection(db, paths.feedback), { ...feedback, timestamp: serverTimestamp() });
    } else {
      const list = LS.feedback();
      list.unshift({ ...feedback, id: Date.now().toString() });
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
