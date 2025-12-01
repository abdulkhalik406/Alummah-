
import React, { useEffect, useState } from 'react';
import { StudentResult, AttendanceRecord, Student, SubjectConfig, FeeStructure, FeePaymentRecord, MONTHS } from '../types';
import { api, calculateGradeInfo } from '../services/storage';
import { Button, Card } from '../components/UI';
import { Download, CheckCircle, XCircle, ChevronLeft, ChevronRight, IndianRupee, Loader2 } from 'lucide-react';
import { jsPDF } from 'jspdf';

export const Marksheet: React.FC<{ student: Student, onBack: () => void }> = ({ student, onBack }) => {
  const [result, setResult] = useState<StudentResult | null>(null);
  const [subjects, setSubjects] = useState<SubjectConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [rank, setRank] = useState<number | null>(null);
  const [availableExams, setAvailableExams] = useState<string[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState(false);

  // Fetch all results initially
  const [allResults, setAllResults] = useState<StudentResult[]>([]);

  useEffect(() => {
    const load = async () => {
      const subs = await api.getSubjects();
      setSubjects(subs);
      
      const results = await api.getResults(student.contact);
      setAllResults(results);

      // Extract unique exams
      const exams = Array.from(new Set(results.map(r => r.examName)));
      setAvailableExams(exams);

      if (exams.length > 0) {
        // Default to 'Annual 2024' if it exists, otherwise the first one
        const defaultExam = exams.includes('Annual 2024') ? 'Annual 2024' : exams[0];
        setSelectedExam(defaultExam);
        
        const examResult = results.find(r => r.examName === defaultExam);
        if (examResult) {
          setResult(examResult);
          const r = await api.calculateRank(student.contact, defaultExam, examResult.totalMarks);
          setRank(r);
        }
      }
      
      setLoading(false);
    };
    load();
  }, [student]);

  const handleExamChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const examName = e.target.value;
    setSelectedExam(examName);
    
    const examResult = allResults.find(r => r.examName === examName);
    setResult(examResult || null);
    
    if (examResult) {
       const r = await api.calculateRank(student.contact, examName, examResult.totalMarks);
       setRank(r);
    } else {
       setRank(null);
    }
  };

  const handleDownloadPDF = () => {
    const element = document.getElementById('marksheet-content');
    if (!element) return;

    setIsDownloading(true);
    // Create PDF instance
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    doc.html(element, {
      callback: function (doc) {
        doc.save(`${student.name}_${selectedExam}_Result.pdf`);
        setIsDownloading(false);
      },
      x: 10,
      y: 10,
      width: 190, // A4 width (210mm) - margins (20mm)
      windowWidth: 800, // Matches the CSS width of the element
      html2canvas: {
        scale: 0.26, // Helps with resolution
        useCORS: true, // Essential for loading external images like the logo
        logging: false
      }
    });
  };

  const getOverallPL = (grade: string = '') => {
    const g = grade.toUpperCase();
    if (g === 'A+' || g === 'A') return 'OPL (Outstanding Performance Level)';
    if (g === 'B+' || g === 'B') return 'APL (Achieved Performance Level)';
    if (g === 'C+' || g === 'C') return 'MPL (Minimum Performance Level)';
    return 'BPL (Below Performance Level)';
  };

  if (loading) return <div className="p-10 text-center">Loading...</div>;

  if (availableExams.length === 0) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-bold text-gray-800">ফলাফল পাওয়া যায়নি</h2>
        <p className="text-gray-500 mt-2">বর্তমান সেশনের ফলাফল এখনও প্রকাশিত হয়নি।</p>
        <Button onClick={onBack} variant="secondary" className="mt-6">ফিরে যান</Button>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen pb-10">
      {/* Controls */}
      <div className="p-4 bg-gray-100 flex justify-between items-center no-print sticky top-0 z-10 shadow-sm gap-2">
        <Button onClick={onBack} variant="outline" className="py-2 text-sm">Back</Button>
        
        {availableExams.length > 1 && (
           <select 
             className="px-3 py-2 rounded border border-gray-300 text-sm font-semibold outline-none"
             value={selectedExam}
             onChange={handleExamChange}
           >
             {availableExams.map(ex => <option key={ex} value={ex}>{ex}</option>)}
           </select>
        )}

        <Button onClick={handleDownloadPDF} disabled={isDownloading} className="py-2 text-sm min-w-[120px]">
          {isDownloading ? (
            <><Loader2 size={16} className="animate-spin"/> Generating...</>
          ) : (
            <><Download size={16}/> Download PDF</>
          )}
        </Button>
      </div>

      {!result ? (
         <div className="p-10 text-center text-gray-500">Selected exam result not found.</div>
      ) : (
      /* Printable Area Wrapper for JS PDF scaling */
      <div className="flex justify-center mt-4 overflow-x-auto">
        <div className="w-[800px] bg-white p-8 border border-gray-200 shadow-xl shrink-0" id="marksheet-content">
          
          {/* Header */}
          <div className="text-center border-b-2 border-emerald-600 pb-4 mb-6 relative">
            <h1 className="text-3xl font-bold text-emerald-800 uppercase tracking-wide">MAKTABATUL UMMMATHIL MUHAMMADIA</h1>
            <p className="text-lg text-gray-600 mt-1">North Ramchandrapur</p>
            <div className="mt-4 inline-block px-6 py-1 bg-emerald-100 rounded-full">
              <h2 className="text-xl font-semibold text-emerald-800">PROGRESS REPORT</h2>
            </div>
          </div>

          {/* Student Info */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-base mb-8 border p-4 rounded-lg bg-gray-50">
            <p><span className="font-bold text-gray-700">Name:</span> {student.name}</p>
            <p><span className="font-bold text-gray-700">Class:</span> {student.class}</p>
            <p><span className="font-bold text-gray-700">ID/Contact:</span> {student.contact}</p>
            <p><span className="font-bold text-gray-700">Roll No:</span> {student.rollNumber}</p>
            <p><span className="font-bold text-gray-700">Exam Name:</span> {result.examName}</p>
            <p><span className="font-bold text-gray-700">Father's Name:</span> {student.fatherName}</p>
          </div>

          {/* Marks Table */}
          <table className="w-full border-collapse mb-8 text-sm">
            <thead>
              <tr className="bg-emerald-800 text-white">
                <th className="border border-emerald-700 p-3 text-left w-1/3">Subject</th>
                <th className="border border-emerald-700 p-3 text-center">Max Marks</th>
                <th className="border border-emerald-700 p-3 text-center">Obtained</th>
                <th className="border border-emerald-700 p-3 text-center">Grade</th>
                <th className="border border-emerald-700 p-3 text-center">Performance Level</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((sub, idx) => {
                if (student.subjects && student.subjects.length > 0 && !student.subjects.includes(sub.name)) {
                   return null;
                }

                const marks = result.marks[sub.name] || 0;
                const { grade, pl } = calculateGradeInfo(marks);
                return (
                  <tr key={idx} className="even:bg-gray-50">
                    <td className="border border-gray-300 p-3 font-semibold text-gray-700">{sub.name}</td>
                    <td className="border border-gray-300 p-3 text-center text-gray-600">{sub.maxMarks}</td>
                    <td className="border border-gray-300 p-3 text-center font-bold text-gray-800">{marks}</td>
                    <td className="border border-gray-300 p-3 text-center font-bold text-emerald-700">{grade}</td>
                    <td className="border border-gray-300 p-3 text-center text-xs text-gray-500">{pl}</td>
                  </tr>
                );
              })}
              <tr className="bg-emerald-50 font-bold border-t-2 border-emerald-200">
                <td className="border border-gray-300 p-3 text-right pr-4 text-emerald-900">Total</td>
                <td className="border border-gray-300 p-3 text-center">{result.maxTotalMarks}</td>
                <td className="border border-gray-300 p-3 text-center">{result.totalMarks}</td>
                <td className="border border-gray-300 p-3 text-center text-emerald-800" colSpan={2}>
                  {result.isPass ? 'PASSED' : 'FAILED'}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Footer Summary */}
          <div className="flex justify-between items-start pt-4 mb-20">
             <div className="space-y-1">
               <p className="text-lg"><span className="font-bold text-gray-700">Rank in Class:</span> <span className="text-emerald-700 font-bold">#{rank || '-'}</span></p>
               <p className="text-lg"><span className="font-bold text-gray-700">Percentage:</span> {result.percentage}%</p>
               <p className="text-lg"><span className="font-bold text-gray-700">Overall Grade:</span> {result.overallGrade}</p>
               <p className="text-lg"><span className="font-bold text-gray-700">Performance Level:</span> {getOverallPL(result.overallGrade)}</p>
             </div>
          </div>

          {/* Signatures */}
          <div className="flex justify-between mt-12 pt-8">
            <div className="text-center">
               <div className="w-40 border-t border-gray-400 mb-2"></div>
               <p className="font-bold text-gray-600">অভিভাবক স্বাক্ষর</p>
               <p className="text-xs text-gray-400">(Guardian Sign)</p>
            </div>
            <div className="text-center">
               <div className="w-40 border-t border-gray-400 mb-2"></div>
               <p className="font-bold text-gray-600">শিক্ষক স্বাক্ষর</p>
               <p className="text-xs text-gray-400">(Teacher Sign)</p>
            </div>
          </div>

        </div>
      </div>
      )}
    </div>
  );
};

// --- ATTENDANCE CALENDAR COMPONENT ---

const AttendanceCalendar: React.FC<{ record: AttendanceRecord | null }> = ({ record }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const changeMonth = (delta: number) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1);
    setCurrentMonth(newDate);
  };

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Render Grid
  const days = [];
  // Empty slots for start of month
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} className="h-10"></div>);
  }

  // Days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const status = record?.history ? record.history[dateStr] : null;

    let bgColor = 'bg-gray-100 text-gray-400';
    if (status === 'present') bgColor = 'bg-emerald-500 text-white font-bold shadow-sm';
    if (status === 'absent') bgColor = 'bg-red-500 text-white font-bold shadow-sm';

    days.push(
      <div key={d} className={`h-10 rounded-lg flex items-center justify-center text-sm ${bgColor}`}>
        {d}
      </div>
    );
  }

  return (
    <Card className="p-4 bg-white">
      <div className="flex justify-between items-center mb-4">
        <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-100 rounded-full"><ChevronLeft /></button>
        <span className="font-bold text-lg text-gray-700">{monthName}</span>
        <button onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-100 rounded-full"><ChevronRight /></button>
      </div>
      <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-gray-500">
        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days}
      </div>
      <div className="flex justify-center gap-4 mt-4 text-xs">
        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-500 rounded"></div>Present</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded"></div>Absent</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-gray-100 rounded"></div>No Class</div>
      </div>
    </Card>
  );
};

export const AttendanceView: React.FC<{ student: Student, onBack: () => void }> = ({ student, onBack }) => {
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  
  useEffect(() => {
    api.getAttendance(student.contact).then(setRecord);
  }, [student]);

  return (
    <div className="p-4 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex items-center gap-4 mb-4">
        <Button onClick={onBack} variant="outline" className="px-3 py-1 text-sm">Back</Button>
        <h2 className="text-xl font-bold font-bengali">উপস্থিতি (Attendance)</h2>
      </div>

      {!record ? (
        <Card className="text-center py-10">
          <p className="text-gray-500">কোন উপস্থিতির তথ্য পাওয়া যায়নি।</p>
          <p className="text-xs text-gray-400 mt-2">No attendance record found.</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-emerald-50 border-emerald-200">
               <div className="flex flex-col items-center text-emerald-800">
                  <span className="text-3xl font-bold mb-1">{record.presentDays}</span>
                  <span className="text-sm font-bengali">মোট উপস্থিত</span>
                  <span className="text-xs opacity-60">Total Present</span>
               </div>
            </Card>
            <Card className="bg-white border-gray-200">
               <div className="flex flex-col items-center text-gray-800">
                  <span className="text-3xl font-bold mb-1">{record.totalClasses}</span>
                  <span className="text-sm font-bengali">মোট ক্লাস</span>
                  <span className="text-xs opacity-60">Total Classes</span>
               </div>
            </Card>
          </div>

          <AttendanceCalendar record={record} />

          <Card className="text-center py-4 bg-white border border-emerald-100 shadow-md">
            <p className="text-sm text-gray-500 mb-2">Overall Attendance</p>
            <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
               <svg className="w-full h-full transform -rotate-90 drop-shadow-md">
                 <circle cx="64" cy="64" r="56" stroke="#f3f4f6" strokeWidth="10" fill="none" />
                 <circle 
                  cx="64" cy="64" r="56" 
                  stroke="#10b981" 
                  strokeWidth="10" 
                  strokeLinecap="round"
                  fill="none" 
                  strokeDasharray={351}
                  strokeDashoffset={351 - (351 * (record.presentDays / (record.totalClasses || 1)))}
                  className="transition-all duration-1000 ease-out"
                 />
               </svg>
               <div className="absolute flex flex-col items-center">
                 <span className="text-3xl font-bold text-gray-800">
                   {Math.round((record.presentDays / (record.totalClasses || 1)) * 100)}%
                 </span>
               </div>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

export const FeeStatusView: React.FC<{ student: Student, onBack: () => void }> = ({ student, onBack }) => {
  const [feeConfig, setFeeConfig] = useState<FeeStructure>({});
  const [feeRecord, setFeeRecord] = useState<FeePaymentRecord | null>(null);
  const currentYear = new Date().getFullYear().toString();

  useEffect(() => {
    const load = async () => {
      setFeeConfig(await api.getFeeStructure());
      setFeeRecord(await api.getStudentFeeRecord(student.contact, currentYear));
    };
    load();
  }, [student]);

  const monthlyFee = student.class ? (feeConfig[student.class] || 0) : 0;

  return (
    <div className="p-4 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex items-center gap-4 mb-4">
        <Button onClick={onBack} variant="outline" className="px-3 py-1 text-sm">Back</Button>
        <h2 className="text-xl font-bold font-bengali">বেতন এবং ফি (Fees)</h2>
      </div>

      <Card className="bg-emerald-800 text-white shadow-xl">
        <div className="flex justify-between items-center">
           <div>
              <p className="text-emerald-200 text-xs uppercase font-bold tracking-wider">Monthly Fee</p>
              <h3 className="text-3xl font-bold flex items-center"><IndianRupee size={24}/> {monthlyFee}</h3>
           </div>
           <div className="text-right">
              <p className="text-emerald-200 text-xs uppercase font-bold tracking-wider">Session</p>
              <h3 className="text-xl font-bold">{currentYear}</h3>
           </div>
        </div>
      </Card>

      <div className="grid gap-3">
         {MONTHS.map(month => {
           const isPaid = feeRecord?.payments[month] || false;
           return (
             <Card key={month} className={`flex justify-between items-center p-4 border-l-4 ${isPaid ? 'border-l-emerald-500 bg-white' : 'border-l-red-400 bg-red-50'}`}>
                <div className="flex items-center gap-3">
                   <div className={`p-2 rounded-full ${isPaid ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'}`}>
                     {isPaid ? <CheckCircle size={20}/> : <XCircle size={20}/>}
                   </div>
                   <span className="font-bold text-gray-700">{month}</span>
                </div>
                <div className={`text-sm font-bold px-3 py-1 rounded-full ${isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-white text-red-500 border border-red-200'}`}>
                  {isPaid ? 'PAID' : 'DUE'}
                </div>
             </Card>
           )
         })}
      </div>
    </div>
  );
};
