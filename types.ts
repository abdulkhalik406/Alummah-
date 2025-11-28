export enum UserRole {
  STUDENT = 'STUDENT',
  TEACHER = 'TEACHER'
}

export interface User {
  id: string; // This is the Contact Number
  name: string;
  role: UserRole;
  class?: string;
}

export interface Student extends User {
  fatherName: string;
  rollNumber: string;
  contact: string; // Same as ID
  subjects?: string[];
}

export interface SubjectConfig {
  name: string;
  maxMarks: number;
}

export interface StudentResult {
  id?: string; // Firestore Doc ID
  studentId: string;
  examName: string; 
  marks: Record<string, number>; // Dynamic subjects: { "BENGALI": 80, "MATH": 90 }
  totalMarks: number;
  maxTotalMarks: number;
  percentage: number;
  rank?: number;
  overallGrade?: string;
  isPass: boolean;
}

export interface AttendanceRecord {
  studentId: string;
  totalClasses: number;
  presentDays: number;
  lastUpdated?: string;
}

export interface Notification {
  id?: string;
  title?: string; // Optional, main text is 'message' or 'text'
  text: string;
  date: string; // ISO string or timestamp
  imageUrl?: string;
  pdfUrl?: string;
  pdfName?: string;
  timestamp?: any;
}

export const ADMIN_CONTACTS = ['9332039381', '9832414854'];

export const GRADES = {
  OPL: { label: 'OPL', desc: 'Outstanding Performance Level' },
  APL: { label: 'APL', desc: 'Achieved Performance Level' },
  MPL: { label: 'MPL', desc: 'Minimum Performance Level' },
  BPL: { label: 'BPL', desc: 'Below Performance Level' }
};