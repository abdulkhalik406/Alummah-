import React, { useState, useEffect } from 'react';
import { Student, Notification, StudentResult, SubjectConfig } from '../types';
import { api, calculateGradeInfo } from '../services/storage';
import { Button, Input, Card } from '../components/UI';
import { Plus, Trash2, UserPlus, Users, X, BookOpen, Bell, ArrowUp, ArrowDown, CheckSquare, Square } from 'lucide-react';

// --- CONFIG ---
const AVAILABLE_CLASSES = ['Class I', 'Class II', 'Class III', 'Class IV', 'Class V'];

// Default subjects per class logic
const getRecommendedSubjects = (className: string, allSubjects: SubjectConfig[]) => {
  // Logic: Everyone gets BENGALI, ARABIC, MATH.
  // Class III and above get ENGLISH.
  // This matches the provided "Subject Management" logic requirement roughly.
  const defaults = ['BENGALI', 'ARABIC', 'MATHEMATICS'];
  if (['Class III', 'Class IV', 'Class V'].includes(className)) {
    defaults.push('ENGLISH');
  }
  return allSubjects.filter(s => defaults.includes(s.name)).map(s => s.name);
};

export const AdminDashboard: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<'students' | 'results' | 'notifications' | 'subjects' | 'attendance'>('students');
  const [students, setStudents] = useState<Student[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [subjects, setSubjects] = useState<SubjectConfig[]>([]);
  
  const refreshData = async () => {
    setStudents(await api.getStudents());
    setNotifications(await api.getNotifications());
    setSubjects(await api.getSubjects());
  };

  useEffect(() => {
    refreshData();
  }, []);

  // --- Student Logic ---
  const [newStudent, setNewStudent] = useState<Partial<Student>>({ 
    class: '', 
    subjects: [] 
  });

  // Helper for Class Selection Widget
  const selectClass = (cls: string) => {
    const recommended = getRecommendedSubjects(cls, subjects);
    setNewStudent(prev => ({ 
      ...prev, 
      class: cls,
      subjects: recommended 
    }));
  };

  const handleClassNav = (direction: 'up' | 'down') => {
    const currentIndex = AVAILABLE_CLASSES.indexOf(newStudent.class || '');
    if (currentIndex === -1) {
      selectClass(AVAILABLE_CLASSES[0]);
      return;
    }
    
    let newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    // Cyclic logic: Wrap around
    if (newIndex < 0) {
      newIndex = AVAILABLE_CLASSES.length - 1;
    } else if (newIndex >= AVAILABLE_CLASSES.length) {
      newIndex = 0;
    }
    
    selectClass(AVAILABLE_CLASSES[newIndex]);
  };

  const clearClassSelection = () => {
    setNewStudent(prev => ({ ...prev, class: '', subjects: [] }));
  };

  const toggleSubject = (subName: string) => {
    const current = newStudent.subjects || [];
    const updated = current.includes(subName)
      ? current.filter(s => s !== subName)
      : [...current, subName];
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
      alert('Student Added Successfully');
      setNewStudent({ class: '', subjects: [], name: '', contact: '', fatherName: '', rollNumber: '' });
      refreshData();
    } catch (e) {
      alert('Error adding student. Contact might be duplicate.');
    }
  };

  const handleDeleteStudent = async (contact: string) => {
    if (confirm('Delete this student?')) {
      await api.deleteStudent(contact);
      refreshData();
    }
  };

  // --- Notification Logic ---
  const [newNotif, setNewNotif] = useState({ text: '', imageUrl: '' });
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setNewNotif({ ...newNotif, imageUrl: result });
        setImagePreview(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddNotif = async () => {
    if (!newNotif.text) return;
    await api.addNotification(newNotif);
    setNewNotif({ text: '', imageUrl: '' });
    setImagePreview(null);
    refreshData();
  };
  const handleDeleteNotif = async (id: string) => {
    if(confirm('Delete?')) { await api.deleteNotification(id); refreshData(); }
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
  const handleRemoveSubject = async (idx: number) => {
    const updated = subjects.filter((_, i) => i !== idx);
    await api.updateSubjects(updated);
    setSubjects(updated);
  };

  // --- Result Logic (Bulk) ---
  const [resultConfig, setResultConfig] = useState({ 
    class: '', 
    exam: 'Annual 2024', 
    subject: '' 
  });
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [marksEntry, setMarksEntry] = useState<Record<string, number>>({});

  const loadClassForResults = async () => {
    if (!resultConfig.class) return;
    const students = await api.getStudentsByClass(resultConfig.class);
    setClassStudents(students);
    
    // Load existing marks
    const currentResults = await api.getResults();
    const map: Record<string, number> = {};
    
    students.forEach(s => {
      // Find result for this student & exam
      const res = currentResults.find(r => r.studentId === s.contact && r.examName === resultConfig.exam);
      if (res && res.marks[resultConfig.subject]) {
        map[s.contact] = res.marks[resultConfig.subject];
      } else {
        map[s.contact] = 0;
      }
    });
    setMarksEntry(map);
  };

  const handleBulkResultSave = async () => {
    if (!resultConfig.class || !resultConfig.subject) return;
    const updates = Object.entries(marksEntry).map(([studentId, marks]) => ({ studentId, marks: Number(marks) }));
    
    // Find max marks for selected subject
    const subjectCfg = subjects.find(s => s.name === resultConfig.subject);
    const max = subjectCfg ? subjectCfg.maxMarks : 100;

    await api.bulkUpdateMarks(resultConfig.class, resultConfig.exam, resultConfig.subject, max, updates);
    alert('Results Saved!');
  };

  // --- Attendance Management (Bulk) ---
  const [attClass, setAttClass] = useState('');
  const [attStudents, setAttStudents] = useState<Student[]>([]);
  const [tickedStudents, setTickedStudents] = useState<string[]>([]); // List of IDs

  const loadClassForAttendance = async (cls: string) => {
    setAttClass(cls);
    const students = await api.getStudentsByClass(cls);
    setAttStudents(students);
    // Default all ticked? or none? Let's default none.
    setTickedStudents([]);
  };

  const toggleAttTick = (id: string) => {
    if (tickedStudents.includes(id)) setTickedStudents(tickedStudents.filter(x => x !== id));
    else setTickedStudents([...tickedStudents, id]);
  };

  const saveBulkAttendance = async () => {
    await api.bulkUpdateAttendance(attStudents, tickedStudents);
    alert('Attendance Updated Successfully!');
    setAttClass('');
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
            { id: 'subjects', label: 'Subjects', icon: BookOpen },
            { id: 'notifications', label: 'Notices', icon: Bell },
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap text-sm transition-colors ${activeTab === tab.id ? 'bg-white text-emerald-900 font-bold' : 'bg-emerald-700 text-emerald-100'}`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-6 max-w-lg mx-auto">
        
        {/* --- STUDENT REGISTRATION TAB --- */}
        {activeTab === 'students' && (
          <div className="space-y-6">
            <Card className="border-l-4 border-l-emerald-500">
              <h3 className="font-bold text-lg mb-4 text-emerald-900">Student Registration</h3>
              
              {/* 1. Class Selection Widget */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">1. Select Class (Required)</label>
                <div className="bg-gray-100 rounded-xl p-2 space-y-2">
                  {AVAILABLE_CLASSES.map((cls) => {
                    const isSelected = newStudent.class === cls;
                    return (
                      <div 
                        key={cls}
                        className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${isSelected ? 'bg-emerald-600 text-white shadow-md' : 'bg-white hover:bg-gray-50 text-gray-700'}`}
                        onClick={() => selectClass(cls)}
                      >
                        <span className="font-semibold">{cls}</span>
                        {isSelected && (
                          <div className="flex items-center gap-2">
                            <button onClick={(e) => { e.stopPropagation(); handleClassNav('up'); }} className="p-1 hover:bg-emerald-500 rounded"><ArrowUp size={16}/></button>
                            <button onClick={(e) => { e.stopPropagation(); handleClassNav('down'); }} className="p-1 hover:bg-emerald-500 rounded"><ArrowDown size={16}/></button>
                            <button onClick={(e) => { e.stopPropagation(); clearClassSelection(); }} className="p-1 hover:bg-red-500 rounded bg-red-600/20"><X size={16}/></button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Subject Selection */}
              {newStudent.class && (
                <div className="mb-6 animate-in fade-in slide-in-from-top-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">2. Enrolled Subjects</label>
                  <div className="grid grid-cols-2 gap-2">
                    {subjects.map(sub => {
                      const isChecked = (newStudent.subjects || []).includes(sub.name);
                      return (
                        <div 
                          key={sub.name}
                          onClick={() => toggleSubject(sub.name)}
                          className={`p-2 border rounded-lg text-sm flex items-center gap-2 cursor-pointer ${isChecked ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-gray-200'}`}
                        >
                           {isChecked ? <CheckSquare size={16} className="text-emerald-600"/> : <Square size={16} className="text-gray-400"/>}
                           {sub.name}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. Details Form */}
              <div className="space-y-4">
                 <Input label="Full Name" value={newStudent.name || ''} onChange={e => setNewStudent({...newStudent, name: e.target.value})} />
                 <Input label="Contact (Login ID)" value={newStudent.contact || ''} onChange={e => setNewStudent({...newStudent, contact: e.target.value})} />
                 <Input label="Father's Name" value={newStudent.fatherName || ''} onChange={e => setNewStudent({...newStudent, fatherName: e.target.value})} />
                 <Input label="Roll No" value={newStudent.rollNumber || ''} onChange={e => setNewStudent({...newStudent, rollNumber: e.target.value})} />
              </div>
              
              <div className="mt-6">
                 <Button onClick={handleAddStudent} fullWidth disabled={!newStudent.class}>Confirm Registration</Button>
              </div>
            </Card>

            <div className="space-y-3">
               <div className="flex justify-between items-center">
                 <h3 className="font-bold text-gray-700">Registered Students</h3>
                 <span className="text-xs bg-gray-200 px-2 py-1 rounded-full">{students.length} Total</span>
               </div>
               
               {/* Filter/List */}
               {students.map(s => (
                 <div key={s.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex justify-between items-center">
                   <div>
                     <p className="font-bold text-gray-800">{s.name}</p>
                     <p className="text-xs text-gray-500">{s.contact} | {s.class}</p>
                   </div>
                   <button onClick={() => handleDeleteStudent(s.contact)} className="text-red-500 p-2"><Trash2 size={18}/></button>
                 </div>
               ))}
            </div>
          </div>
        )}

        {/* --- ATTENDANCE TAB --- */}
        {activeTab === 'attendance' && (
          <div className="space-y-6">
             {!attClass ? (
               <div className="grid gap-4">
                 <h3 className="font-bold text-gray-700">Select Class for Attendance</h3>
                 {AVAILABLE_CLASSES.map(cls => (
                   <button 
                    key={cls}
                    onClick={() => loadClassForAttendance(cls)}
                    className="bg-white p-4 rounded-xl shadow-sm border border-emerald-100 text-left font-bold text-emerald-800 flex justify-between hover:bg-emerald-50"
                   >
                     {cls}
                     <Users size={20} className="text-emerald-400"/>
                   </button>
                 ))}
               </div>
             ) : (
               <div className="animate-in fade-in">
                 <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg">{attClass} Attendance</h3>
                    <button onClick={() => setAttClass('')} className="text-sm text-gray-500 underline">Change Class</button>
                 </div>
                 
                 <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                   <div className="p-3 bg-gray-100 flex justify-between text-sm font-bold text-gray-600">
                     <span>Student</span>
                     <span>Present?</span>
                   </div>
                   {attStudents.length === 0 && <div className="p-4 text-center text-gray-400">No students in this class</div>}
                   {attStudents.map(s => (
                     <div key={s.id} onClick={() => toggleAttTick(s.contact)} className="p-3 border-b flex justify-between items-center cursor-pointer hover:bg-gray-50">
                       <div>
                         <p className="font-semibold">{s.name}</p>
                         <p className="text-xs text-gray-500">{s.rollNumber}</p>
                       </div>
                       <div className={`w-6 h-6 rounded border flex items-center justify-center ${tickedStudents.includes(s.contact) ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'}`}>
                         {tickedStudents.includes(s.contact) && <CheckSquare size={16} className="text-white"/>}
                       </div>
                     </div>
                   ))}
                 </div>
                 <div className="mt-4">
                   <Button onClick={saveBulkAttendance} fullWidth>Submit Attendance</Button>
                 </div>
               </div>
             )}
          </div>
        )}

        {/* --- RESULTS TAB --- */}
        {activeTab === 'results' && (
          <div className="space-y-6">
             <Card>
               <h3 className="font-bold mb-4">Bulk Marks Entry</h3>
               <div className="space-y-3">
                 <div>
                   <label className="text-xs font-bold text-gray-500 uppercase">Class</label>
                   <select className="w-full p-2 border rounded" value={resultConfig.class} onChange={e => setResultConfig({...resultConfig, class: e.target.value})}>
                     <option value="">Select Class</option>
                     {AVAILABLE_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                   </select>
                 </div>
                 <div>
                   <label className="text-xs font-bold text-gray-500 uppercase">Exam Name</label>
                   <input 
                     className="w-full p-2 border rounded" 
                     value={resultConfig.exam} 
                     onChange={e => setResultConfig({...resultConfig, exam: e.target.value})} 
                     placeholder="e.g. Annual 2024"
                   />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-gray-500 uppercase">Subject</label>
                   <select className="w-full p-2 border rounded" value={resultConfig.subject} onChange={e => setResultConfig({...resultConfig, subject: e.target.value})}>
                     <option value="">Select Subject</option>
                     {subjects.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                   </select>
                 </div>
                 <Button onClick={loadClassForResults} disabled={!resultConfig.class || !resultConfig.subject || !resultConfig.exam} fullWidth>Load Students</Button>
               </div>
             </Card>

             {classStudents.length > 0 && (
               <div className="bg-white rounded-xl shadow-lg p-4 animate-in slide-in-from-bottom-4">
                 <h3 className="font-bold mb-2 border-b pb-2 flex justify-between">
                   <span>{resultConfig.exam} - {resultConfig.subject}</span>
                   <button onClick={() => setClassStudents([])}><X size={18}/></button>
                 </h3>
                 <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                   {classStudents.map(s => (
                     <div key={s.id} className="flex justify-between items-center">
                       <span className="text-sm font-medium w-1/2">{s.name} <span className="text-xs text-gray-400">({s.rollNumber})</span></span>
                       <input 
                         type="number" 
                         className="w-20 p-2 border rounded text-center font-bold"
                         value={marksEntry[s.contact] || ''}
                         onChange={(e) => setMarksEntry({...marksEntry, [s.contact]: parseInt(e.target.value) || 0})}
                       />
                     </div>
                   ))}
                 </div>
                 <div className="mt-4 pt-2 border-t">
                   <Button onClick={handleBulkResultSave} fullWidth>Save Results</Button>
                 </div>
               </div>
             )}
          </div>
        )}

        {/* --- SUBJECTS TAB --- */}
        {activeTab === 'subjects' && (
          <div className="space-y-6">
             <Card>
               <h3 className="font-bold mb-4">Add Global Subject</h3>
               <div className="flex gap-2">
                 <input 
                   className="flex-1 border p-2 rounded" 
                   placeholder="Subject Name" 
                   value={newSub.name} 
                   onChange={e => setNewSub({...newSub, name: e.target.value.toUpperCase()})} 
                 />
                 <input 
                   className="w-24 border p-2 rounded" 
                   type="number" 
                   placeholder="Max" 
                   value={newSub.maxMarks} 
                   onChange={e => setNewSub({...newSub, maxMarks: parseInt(e.target.value)})} 
                 />
                 <Button onClick={handleAddSubject}><Plus size={20}/></Button>
               </div>
             </Card>

             <div className="space-y-2">
               {subjects.map((s, idx) => (
                 <div key={idx} className="bg-white p-3 rounded shadow-sm flex justify-between items-center">
                   <span className="font-semibold">{s.name}</span>
                   <div className="flex items-center gap-4">
                     <span className="text-sm bg-gray-100 px-2 py-1 rounded">Max: {s.maxMarks}</span>
                     <button onClick={() => handleRemoveSubject(idx)} className="text-red-500"><Trash2 size={16}/></button>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        )}

        {/* --- NOTIFICATIONS TAB --- */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <Card>
              <h3 className="font-bold mb-4">New Notification</h3>
              <div className="mb-4">
                <textarea 
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 outline-none"
                  rows={4}
                  placeholder="নোটিফিকেশন লিখুন..."
                  value={newNotif.text}
                  onChange={e => setNewNotif({...newNotif, text: e.target.value})}
                />
              </div>
              
              {/* Image Upload */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Attach Image</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                />
                {imagePreview && (
                  <div className="mt-2 relative inline-block">
                    <img src={imagePreview} alt="Preview" className="h-20 w-auto rounded border" />
                    <button onClick={() => { setImagePreview(null); setNewNotif({...newNotif, imageUrl: ''}) }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"><X size={12}/></button>
                  </div>
                )}
              </div>

              <Button onClick={handleAddNotif} fullWidth>Publish</Button>
            </Card>

             <div className="space-y-4">
               {notifications.map(n => (
                 <Card key={n.id} className="relative group">
                   {n.imageUrl && <img src={n.imageUrl} alt="notice" className="w-full h-32 object-cover rounded mb-2" />}
                   <p className="text-gray-800 whitespace-pre-wrap font-bengali">{n.text}</p>
                   <p className="text-xs text-gray-400 mt-2">{n.date}</p>
                   <button onClick={() => n.id && handleDeleteNotif(n.id)} className="absolute top-2 right-2 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                 </Card>
               ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};