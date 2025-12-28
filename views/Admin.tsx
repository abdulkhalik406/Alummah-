
import React, { useState, useEffect } from 'react';
import { Student, Notification, StudentResult, SubjectConfig, AVAILABLE_CLASSES, FeeStructure, MONTHS, Feedback, AttendanceRecord, FeePaymentRecord } from '../types';
import { api, calculateGradeInfo } from '../services/storage';
import { Button, Input, Card } from '../components/UI';
import { Plus, Trash2, UserPlus, Users, X, BookOpen, Bell, ArrowUp, ArrowDown, CheckSquare, Square, FileText, Calendar, IndianRupee, Edit, CheckCircle, Loader2, MessageSquare, LayoutDashboard, List } from 'lucide-react';

// --- CONFIG ---

const getRecommendedSubjects = (className: string, allSubjects: SubjectConfig[]) => {
  const defaults = ['BENGALI', 'ARABIC', 'MATHEMATICS'];
  if (['Class III', 'Class IV', 'Class V'].includes(className)) {
    defaults.push('ENGLISH');
  }
  return allSubjects.filter(s => defaults.includes(s.name)).map(s => s.name);
};

export const AdminDashboard: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<'students' | 'results' | 'notifications' | 'subjects' | 'attendance' | 'fees' | 'feedback'>('students');
  const [students, setStudents] = useState<Student[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [subjects, setSubjects] = useState<SubjectConfig[]>([]);
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  
  const refreshData = async () => {
    setStudents(await api.getStudents());
    setNotifications(await api.getNotifications());
    setSubjects(await api.getSubjects());
    setFeedbackList(await api.getFeedback());
  };

  useEffect(() => {
    refreshData();
  }, [activeTab]);

  // --- Student Logic ---
  const [studentViewMode, setStudentViewMode] = useState<'register' | 'overview'>('register');
  const [newStudent, setNewStudent] = useState<Partial<Student>>({ class: '', subjects: [] });
  const [overviewData, setOverviewData] = useState<{attendance: AttendanceRecord[], fees: FeePaymentRecord[], results: StudentResult[]}>({ attendance: [], fees: [], results: [] });
  const [overviewClass, setOverviewClass] = useState<string>('All');
  const [overviewLoading, setOverviewLoading] = useState(false);

  const loadOverviewData = async () => {
    setOverviewLoading(true);
    const year = new Date().getFullYear().toString();
    const [att, fees, res] = await Promise.all([api.getAllAttendance(), api.getAllFeeRecords(year), api.getResults()]);
    setOverviewData({ attendance: att, fees, results: res });
    setOverviewLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'students' && studentViewMode === 'overview') loadOverviewData();
  }, [studentViewMode, activeTab]);

  const selectClass = (cls: string) => {
    const recommended = getRecommendedSubjects(cls, subjects);
    setNewStudent(prev => ({ ...prev, class: cls, subjects: recommended }));
  };

  const handleClassNav = (direction: 'up' | 'down') => {
    const currentIndex = AVAILABLE_CLASSES.indexOf(newStudent.class || '');
    if (currentIndex === -1) { selectClass(AVAILABLE_CLASSES[0]); return; }
    let newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0) newIndex = AVAILABLE_CLASSES.length - 1;
    else if (newIndex >= AVAILABLE_CLASSES.length) newIndex = 0;
    selectClass(AVAILABLE_CLASSES[newIndex]);
  };

  const toggleSubject = (subName: string) => {
    const current = newStudent.subjects || [];
    const updated = current.includes(subName) ? current.filter(s => s !== subName) : [...current, subName];
    setNewStudent({ ...newStudent, subjects: updated });
  };

  const handleAddStudent = async () => {
    if (!newStudent.name || !newStudent.contact || !newStudent.fatherName) return alert("All fields are required");
    if (!newStudent.class) return alert("Please select a Class");
    try {
      await api.addStudent({
        name: newStudent.name!,
        contact: newStudent.contact!,
        fatherName: newStudent.fatherName!,
        class: newStudent.class,
        rollNumber: newStudent.rollNumber || '00',
        subjects: newStudent.subjects || []
      });
      alert('Student Registered!');
      setNewStudent({ class: '', subjects: [], name: '', contact: '', fatherName: '', rollNumber: '' });
      refreshData();
    } catch (e) { alert('Error adding student.'); }
  };

  const handleDeleteStudent = async (contact: string) => {
    if (confirm('Delete?')) { await api.deleteStudent(contact); refreshData(); }
  };

  // --- Notification Logic ---
  const [newNotif, setNewNotif] = useState<{ text: string, pdfName?: string }>({ text: '' });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.size <= 5 * 1024 * 1024) {
      setPdfFile(file);
      setNewNotif({ ...newNotif, pdfName: file.name });
    } else if (file) alert("Max PDF size is 5MB");
  };

  const handleAddNotif = async () => {
    if (!newNotif.text) return;
    setIsUploading(true);
    try {
      let imageUrl = '';
      let pdfUrl = '';
      if (imageFile) imageUrl = await api.uploadFile(imageFile, 'images');
      if (pdfFile) pdfUrl = await api.uploadFile(pdfFile, 'documents');
      await api.addNotification({ text: newNotif.text, imageUrl, pdfUrl, pdfName: newNotif.pdfName });
      setNewNotif({ text: '' }); setImageFile(null); setPdfFile(null); setImagePreview(null);
      refreshData();
      alert("Notification Uploaded Successfully!");
    } catch (e) { alert("Upload Failed."); } finally { setIsUploading(false); }
  };

  // --- Subject Logic ---
  const [newSub, setNewSub] = useState({ name: '', maxMarks: 100 });
  const handleAddSubject = async () => {
    if (!newSub.name) return;
    const updated = [...subjects, newSub];
    await api.updateSubjects(updated);
    setSubjects(updated);
    setNewSub({ name: '', maxMarks: 100 });
  };

  // --- Attendance Management ---
  const [attClass, setAttClass] = useState('');
  const [attDate, setAttDate] = useState(new Date().toISOString().split('T')[0]);
  const [attStudents, setAttStudents] = useState<Student[]>([]);
  const [tickedStudents, setTickedStudents] = useState<string[]>([]); 

  const loadAttendance = async (cls: string, date: string) => {
    setAttClass(cls);
    const studs = await api.getStudentsByClass(cls);
    setAttStudents(studs);
    const recs = await api.getAttendanceForClass(studs.map(s => s.contact));
    setTickedStudents(studs.filter(s => recs.find(r => r.studentId === s.contact)?.history?.[date] === 'present').map(s => s.contact));
  };

  const saveAttendance = async () => {
    await api.bulkUpdateAttendance(attStudents, tickedStudents, attDate);
    alert(`Attendance for ${attDate} Saved!`);
  };

  // --- FEES MANAGEMENT ---
  const [feeStructure, setFeeStructure] = useState<FeeStructure>({});
  const [feeClass, setFeeClass] = useState('');
  const [feeYear, setFeeYear] = useState(new Date().getFullYear().toString());
  const [selectedFeeStudent, setSelectedFeeStudent] = useState<string | null>(null);
  const [studentFeeRecord, setStudentFeeRecord] = useState<Record<string, boolean>>({});

  useEffect(() => { if (activeTab === 'fees') api.getFeeStructure().then(setFeeStructure); }, [activeTab]);

  const openFeeCard = async (sid: string) => {
    setSelectedFeeStudent(sid);
    const rec = await api.getStudentFeeRecord(sid, feeYear);
    setStudentFeeRecord(rec.payments);
  };

  const toggleFee = async (month: string) => {
    if (!selectedFeeStudent) return;
    const newPayments = { ...studentFeeRecord, [month]: !studentFeeRecord[month] };
    setStudentFeeRecord(newPayments);
    await api.updateStudentFee({ studentId: selectedFeeStudent, year: feeYear, payments: newPayments });
  };

  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      <div className="bg-emerald-800 p-6 text-white sticky top-0 z-20 shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Admin Panel</h2>
          <button onClick={onLogout} className="text-xs bg-red-600/80 px-3 py-1 rounded">Logout</button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {[
            { id: 'students', label: 'Students', icon: UserPlus },
            { id: 'attendance', label: 'Attendance', icon: CheckSquare },
            { id: 'results', label: 'Results', icon: Users },
            { id: 'fees', label: 'Fees', icon: IndianRupee },
            { id: 'subjects', label: 'Subjects', icon: BookOpen },
            { id: 'notifications', label: 'Notices', icon: Bell },
            { id: 'feedback', label: 'Feedback', icon: MessageSquare },
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap text-sm transition-colors ${activeTab === tab.id ? 'bg-white text-emerald-900 font-bold' : 'bg-emerald-700 text-emerald-100'}`}
            >
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-6 max-w-lg mx-auto">
        
        {/* STUDENTS */}
        {activeTab === 'students' && (
          <div className="space-y-6">
            <div className="flex bg-gray-200 rounded-lg p-1">
              <button className={`flex-1 py-2 rounded-md text-sm font-bold ${studentViewMode === 'register' ? 'bg-white shadow text-emerald-800' : 'text-gray-500'}`} onClick={() => setStudentViewMode('register')}>Registration</button>
              <button className={`flex-1 py-2 rounded-md text-sm font-bold ${studentViewMode === 'overview' ? 'bg-white shadow text-emerald-800' : 'text-gray-500'}`} onClick={() => setStudentViewMode('overview')}>Overview</button>
            </div>
            {studentViewMode === 'register' ? (
              <Card>
                <h3 className="font-bold mb-4">New Student</h3>
                <div className="mb-4 space-y-2">
                  <label className="text-xs text-gray-500">Select Class</label>
                  <div className="grid grid-cols-2 gap-2">
                    {AVAILABLE_CLASSES.map(c => (
                      <button key={c} onClick={() => selectClass(c)} className={`p-2 text-xs border rounded-lg ${newStudent.class === c ? 'bg-emerald-600 text-white' : 'bg-white'}`}>{c}</button>
                    ))}
                  </div>
                </div>
                <Input label="Name" value={newStudent.name || ''} onChange={e => setNewStudent({...newStudent, name: e.target.value})} />
                <Input label="Contact (Login ID)" value={newStudent.contact || ''} onChange={e => setNewStudent({...newStudent, contact: e.target.value})} />
                <Input label="Father's Name" value={newStudent.fatherName || ''} onChange={e => setNewStudent({...newStudent, fatherName: e.target.value})} />
                <Button onClick={handleAddStudent} fullWidth>Register Student</Button>
              </Card>
            ) : (
              <div className="space-y-2">
                {students.filter(s => overviewClass === 'All' || s.class === overviewClass).map(s => (
                  <div key={s.id} className="bg-white p-3 rounded-lg border flex justify-between">
                    <div><p className="font-bold">{s.name}</p><p className="text-xs text-gray-400">{s.class}</p></div>
                    <button onClick={() => handleDeleteStudent(s.contact)} className="text-red-400"><Trash2 size={16}/></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <Card>
              <h3 className="font-bold mb-4">Broadcast Message</h3>
              <textarea 
                className="w-full p-3 border rounded-lg h-32 mb-4" 
                placeholder="Write notice here..." 
                value={newNotif.text} 
                onChange={e => setNewNotif({...newNotif, text: e.target.value})} 
              />
              <div className="mb-4">
                <label className="text-xs text-gray-500 mb-1 block">Image / PDF</label>
                <div className="flex gap-2">
                  <input type="file" accept="image/*,application/pdf" onChange={handleImageUpload} className="text-xs" />
                </div>
              </div>
              <Button onClick={handleAddNotif} fullWidth disabled={isUploading}>
                {isUploading ? <><Loader2 className="animate-spin" size={16}/> Processing...</> : 'Upload to Firebase & Publish'}
              </Button>
            </Card>
            <div className="space-y-2">
              {notifications.map(n => (
                <div key={n.id} className="bg-white p-3 rounded-lg border group relative">
                   <p className="text-sm">{n.text}</p>
                   <p className="text-[10px] text-gray-400 mt-2">{n.date}</p>
                   <button onClick={() => api.deleteNotification(n.id!).then(refreshData)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100"><Trash2 size={14} className="text-red-300"/></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ATTENDANCE */}
        {activeTab === 'attendance' && (
          <div className="space-y-4">
            {!attClass ? (
              <div className="grid gap-2">{AVAILABLE_CLASSES.map(c => <button key={c} onClick={() => loadAttendance(c, attDate)} className="p-4 bg-white border rounded-xl font-bold">{c}</button>)}</div>
            ) : (
              <div>
                <div className="flex justify-between mb-4">
                  <h3 className="font-bold">{attClass} - {attDate}</h3>
                  <button onClick={() => setAttClass('')} className="text-xs text-gray-400">Back</button>
                </div>
                <div className="space-y-2 bg-white rounded-xl border p-2">
                   {attStudents.map(s => (
                     <div key={s.id} onClick={() => setTickedStudents(prev => prev.includes(s.contact) ? prev.filter(x => x !== s.contact) : [...prev, s.contact])} className="flex justify-between p-3 border-b last:border-0 items-center cursor-pointer">
                        <span>{s.name}</span>
                        <div className={`w-5 h-5 rounded border ${tickedStudents.includes(s.contact) ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'}`}>{tickedStudents.includes(s.contact) && <CheckSquare size={16} className="text-white"/>}</div>
                     </div>
                   ))}
                </div>
                <Button onClick={saveAttendance} fullWidth className="mt-4">Save Attendance</Button>
              </div>
            )}
          </div>
        )}

        {/* FEEDBACK */}
        {activeTab === 'feedback' && (
          <div className="space-y-4">
            {feedbackList.map(f => (
              <Card key={f.id} className="relative group">
                <div className="flex justify-between">
                  <p className="font-bold text-sm">{f.name}</p>
                  <button onClick={() => api.deleteFeedback(f.id!).then(refreshData)} className="text-red-300 opacity-0 group-hover:opacity-100"><Trash2 size={14}/></button>
                </div>
                <p className="text-xs text-gray-500 mb-2">{f.date} | {f.contact}</p>
                <p className="text-sm bg-gray-50 p-2 rounded">{f.message}</p>
              </Card>
            ))}
          </div>
        )}

      </div>
    </div>
  );
};
