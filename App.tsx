
import React, { useState, useEffect } from 'react';
import { User, UserRole, Student, Notification } from './types';
import { api } from './services/storage';
import { Card, Button, Input, MenuTile } from './components/UI';
import { AdminDashboard } from './views/Admin';
import { Marksheet, AttendanceView } from './views/Student';
import { 
  Bell, 
  FileText, 
  UserCircle, 
  Info, 
  BookOpen, 
  LogOut, 
  CalendarCheck,
  ChevronLeft
} from 'lucide-react';

// --- CONSTANTS ---
// Note: Google Drive folder links may not render directly in <img> tags. 
// Ideally, use a direct image link (e.g., https://drive.google.com/uc?export=view&id=FILE_ID)
const LOGO_URL = "https://drive.google.com/drive/u/0/folders/1IGScvXUnwUarpRkHBVp6uqIB74IHfytr";

// --- SUB-COMPONENTS FOR PUBLIC VIEWS ---

const AboutUs = ({ onBack }: { onBack: () => void }) => (
  <div className="p-4 space-y-6 animate-in slide-in-from-right bg-gray-50 min-h-screen">
    <div className="flex items-center gap-4 bg-white p-4 sticky top-0 shadow-sm z-10">
      <button onClick={onBack}><ChevronLeft /></button>
      <h2 className="font-bold text-lg font-bengali">আমাদের সম্পর্কে</h2>
    </div>
    
    <div className="w-full h-48 bg-emerald-100 rounded-xl overflow-hidden shadow-inner flex items-center justify-center relative">
       {/* Placeholder Image using text as specified */}
       <img src="https://placehold.co/800x400/52B788/ffffff?text=Maktabatul+Ummmathil+Muhammadia" alt="Madrasa" className="w-full h-full object-cover" />
    </div>

    <Card className="font-bengali text-gray-800 leading-relaxed text-justify shadow-sm border-none">
      <p className="mb-4">
        মক্তাবাতুল উম্মাতিল মুহাম্মাদিয়া, ২০২১ সালে মুম্বাই কমিটির উদ্যোগে প্রতিষ্ঠিত, একটি বিশেষ প্রতিষ্ঠান যা ধর্মীয় এবং দুনিয়াবী শিক্ষার মধ্যে সেতুবন্ধন তৈরির লক্ষ্যে কাজ করছে। এটি উত্তর রামচন্দ্রপুরের একটি পিছিয়ে পড়া গ্রামে অবস্থিত, যেখানে শিক্ষার হার অত্যন্ত কম।
      </p>
      <p className="mb-4">
        আমাদের মূল উদ্দেশ্য হলো, শিক্ষার্থীদের ইসলামী মূল্যবোধে আলোকিত করে এবং আধুনিক শিক্ষায় দক্ষ করে গড়ে তোলা, যাতে তারা সমাজে গঠনমূলক ভূমিকা পালন করতে পারে। মক্তাবাতুল উম্মাতিল মুহাম্মাদিয়া এমন একটি শিক্ষা প্রতিষ্ঠান, যেখানে ধর্মীয় শিক্ষা এবং পার্থিব জ্ঞান একত্রে শিখানো হয়।
      </p>
      <p className="mb-4">
        আমরা দারুল হুদা এবং হাদিয়া সহ বিভিন্ন প্রতিষ্ঠানের সাথে সহযোগিতা করে আমাদের শিক্ষার মান আরও উন্নত করার চেষ্টা করছি। আমাদের উন্নত শিক্ষণ পদ্ধতি, প্রশিক্ষিত শিক্ষকবৃন্দ এবং সক্রিয় কমিউনিটি অংশগ্রহণের মাধ্যমে, আমরা শিক্ষার্থীদের একাডেমিক এবং ব্যক্তিগত বিকাশে উল্লেখযোগ্য অগ্রগতি দেখতে পাচ্ছি।
      </p>
      <p>
        মক্তাবাতুল উম্মাতিল মুহাম্মাদিয়া-তে, আমরা এমন একটি পরিবেশ সৃষ্টি করার চেষ্টা করছি, যেখানে শিক্ষার্থীরা তাদের পটভূমি নির্বিশেষে সর্বোচ্চ সাফল্য অর্জন করতে উৎসাহিত হয়। আমাদের প্রতিশ্রুতি হলো, যুবকদের শক্তিশালী করা, তাদের এমনভাবে গড়ে তোলা যাতে তারা ইসলামের ঐতিহ্য বহন করতে পারে এবং মানবতার প্রতি দায়িত্ববোধের সঙ্গে সমাজে নেতৃত্ব দিতে পারে।
      </p>
    </Card>
  </div>
);

const Rules = ({ onBack }: { onBack: () => void }) => {
  const rulesData = [
    {
      title: "১. উপস্থিতি ও সময়ানুবর্তিতা",
      points: [
        "প্রতিদিন নির্ধারিত সময়ের আগে বা সময়ে মক্তবে উপস্থিত হতে হবে।",
        "অকারণে অনুপস্থিত থাকা সম্পূর্ণ নিষিদ্ধ।",
        "অনুপস্থিত থাকলে পরবর্তী ক্লাসে অভিভাবকের মাধ্যমে সঠিক কারণ জানাতে হবে।"
      ]
    },
    {
      title: "২. শৃঙ্খলা ও আচরণবিধি",
      points: [
        "শিক্ষক ও শিক্ষিকার প্রতি শ্রদ্ধাসহ আচরণ করতে হবে।",
        "সহপাঠীদের সঙ্গে সর্বদা ভদ্র ও বন্ধুসুলভ আচরণ বজায় রাখতে হবে।",
        "মারামারি, অশালীন ভাষা ব্যবহার, বিশৃঙ্খলা সৃষ্টি এবং অযথা কথা বলা কঠোরভাবে নিষিদ্ধ।"
      ]
    },
    {
      title: "৩. পরিচ্ছন্নতা ও পোশাক",
      points: [
        "পরিচ্ছন্ন, সম্মানজনক ও শালীন পোশাক পরে মক্তবে আসতে হবে।",
        "ব্যক্তিগত পরিচ্ছন্নতা—নখ, চুল, হাত-মুখ পরিষ্কার রাখা বাধ্যতামূলক।",
        "মেয়েদের জন্য হিজাব/শালীনতা বিধান পালন আবশ্যক।"
      ]
    },
    {
      title: "৪. বইপত্র ও প্রয়োজনীয় সামগ্রী",
      points: [
        "প্রতিদিন প্রয়োজনীয় বই, খাতা, কলম ও উপকরণ সঙ্গে আনতে হবে।",
        "শিক্ষক/শিক্ষিকার অনুমতি ছাড়া অতিরিক্ত কোনো সামগ্রী আনা যাবে না।",
        "নিজের বইপত্র সুরক্ষিত রাখা শিক্ষার্থীর দায়িত্ব।"
      ]
    },
    {
      title: "৫. অধ্যয়ন, কাজ ও পরীক্ষা",
      points: [
        "প্রতিদিনের ক্লাসওয়ার্ক ও হোমওয়ার্ক সময়মতো জমা দিতে হবে।",
        "কুরআন তিলাওয়াত, মুখস্থ, দোয়া-দরুদ ও পাঠ পুনরাবৃত্তি নিয়মিত করতে হবে।",
        "পরীক্ষায় কোনো ধরনের নকল বা অসততা সম্পূর্ণ নিষিদ্ধ।"
      ]
    },
    {
      title: "৬. মোবাইল ফোন নীতি",
      points: [
        "শিক্ষার্থীদের মক্তবে মোবাইল ফোন আনা নিষিদ্ধ।",
        "বিশেষ প্রয়োজন হলে অভিভাবকের মাধ্যমে শিক্ষককে জানাতে হবে।"
      ]
    },
    {
      title: "৭. মক্তবের সম্পদ রক্ষা",
      points: [
        "মক্তবের বেঞ্চ, বই, বোর্ড, দেয়াল বা যেকোনো সম্পদ ক্ষতিগ্রস্ত করা যাবে না।",
        "প্রয়োজন অনুযায়ী ক্ষতিপূরণ বা শৃঙ্খলামূলক ব্যবস্থা গ্রহণ করা হবে।"
      ]
    },
    {
      title: "৮. নিরাপত্তা ও শিষ্টাচার",
      points: [
        "ক্লাস চলাকালীন অনুমতি ছাড়া মক্তবের সীমানা ত্যাগ করা যাবে না।",
        "কোনোরূপ দুর্ঘটনা, অসুস্থতা বা সমস্যায় হলে সঙ্গে সঙ্গে শিক্ষকের জানাতে হবে।",
        "পরিষ্কার-পরিচ্ছন্ন পরিবেশ বজায় রাখা সবার দায়িত্ব।"
      ]
    },
    {
      title: "৯. অভিভাবকের সাথে যোগাযোগ",
      points: [
        "শিক্ষার্থীর উপস্থিতি, আচরণ, ফলাফল ও অগ্রগতির বিষয়ে অভিভাবকের সাথে নিয়মিত যোগাযোগ রাখা হবে।",
        "অভিভাবকসভা বা জরুরি বৈঠকে অভিভাবকের উপস্থিতি কাম্য।"
      ]
    },
    {
      title: "১০. সাধারণ নীতি",
      points: [
        "মক্তবের পবিত্র পরিবেশ বজায় রাখা সকলের দায়িত্ব।",
        "ইসলামি আদর্শ, নৈতিকতা ও শালীনতা সর্বদা অনুসরণ করতে হবে।",
        "নিয়ম ভঙ্গ করলে সতর্কবার্তা অথবা প্রয়োজনীয় শাস্তিমূলক ব্যবস্থা নেওয়া হবে।"
      ]
    },
    {
      title: "১১. ছুটির নিয়ম (গুরুত্বপূর্ণ)",
      points: [
        "যেকোনো কারণে ছুটি নিতে হলে পূর্বেই সংশ্লিষ্ট শিক্ষকের নিকট অনুমতি নিতে হবে।",
        "অনুমতি ছাড়া অনুপস্থিত থাকলে নীতিমালা অনুযায়ী ফাইন (জরিমানা) ধার্য করা হবে।"
      ]
    }
  ];

  return (
    <div className="p-4 space-y-4 animate-in slide-in-from-right bg-gray-50 min-h-screen">
      <div className="flex items-center gap-4 mb-4 bg-white p-4 sticky top-0 shadow-sm z-10">
        <button onClick={onBack}><ChevronLeft /></button>
        <h2 className="font-bold text-lg font-bengali">Rules & Regulations (নিয়ম ও বিধি)</h2>
      </div>
      
      <div className="space-y-4 pb-10">
        {rulesData.map((rule, idx) => (
          <Card key={idx} className="font-bengali">
            <h3 className="font-bold text-emerald-800 text-lg mb-2">{rule.title}</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm">
              {rule.points.map((point, pIdx) => (
                <li key={pIdx}>{point}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
};

const NotificationList = ({ onBack }: { onBack: () => void }) => {
  const [list, setList] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getNotifications().then((data) => {
      setList(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="p-4 space-y-4 animate-in slide-in-from-right min-h-screen bg-gray-50">
      <div className="flex items-center gap-4 mb-4 sticky top-0 bg-white p-4 shadow-sm z-10">
        <button onClick={onBack}><ChevronLeft /></button>
        <h2 className="font-bold text-lg font-bengali">নোটিফিকেশন</h2>
      </div>
      
      {loading && <p className="text-center text-gray-400">Loading...</p>}
      {!loading && list.length === 0 && <p className="text-center text-gray-500">কোন নোটিফিকেশন নেই।</p>}
      
      {list.map(n => (
        <Card key={n.id} className="overflow-hidden border border-gray-100 shadow-md">
          {n.imageUrl && (
            <div className="h-40 w-full bg-gray-100 mb-3 rounded-lg overflow-hidden">
               <img src={n.imageUrl} alt="notice" className="w-full h-full object-cover" />
            </div>
          )}
          <p className="text-gray-800 whitespace-pre-wrap font-bengali text-lg leading-relaxed">{n.text}</p>
          {n.pdfUrl && (
            <div className="mt-3">
              <a 
                href={n.pdfUrl} 
                download={n.pdfName || "document.pdf"}
                className="flex items-center gap-2 text-emerald-600 bg-emerald-50 p-2 rounded hover:bg-emerald-100 transition-colors"
              >
                <FileText size={16} />
                <span className="text-sm font-semibold">Download PDF: {n.pdfName}</span>
              </a>
            </div>
          )}
          <p className="text-xs text-emerald-600 mt-3 font-medium">{n.date}</p>
        </Card>
      ))}
    </div>
  );
};

const LoginScreen = ({ onLogin, onBack }: { onLogin: (u: User) => void, onBack: () => void }) => {
  const [contact, setContact] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!contact) return;
    setLoading(true);
    setError('');
    
    try {
      const user = await api.login(contact);
      if (user) {
        onLogin(user);
      } else {
        setError('User not found. Please check your contact number.');
      }
    } catch (e) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-emerald-50 flex flex-col items-center justify-center p-6 animate-in fade-in">
      <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center mb-6 shadow-xl border-4 border-emerald-200 overflow-hidden p-4">
        <img src={LOGO_URL} alt="Logo" className="w-full h-full object-contain" />
      </div>
      <h1 className="text-xl font-bold text-emerald-900 mb-1 text-center font-bengali">মক্তাবাতুল উম্মাতিল মুহাম্মাদিয়া</h1>
      <p className="text-emerald-600 mb-8 text-sm uppercase tracking-widest">School Management App</p>

      <Card className="w-full max-w-sm shadow-xl border-t-4 border-t-emerald-500">
        <Input 
          label="Contact Number (লগইন আইডি)" 
          placeholder="Enter Mobile Number" 
          value={contact} 
          onChange={e => setContact(e.target.value)} 
          type="tel"
        />
        {error && <p className="text-red-500 text-sm mb-4 text-center bg-red-50 p-2 rounded">{error}</p>}
        <Button fullWidth onClick={handleLogin} disabled={loading} className="py-4">
          {loading ? 'Checking...' : 'Login (প্রবেশ করুন)'}
        </Button>
      </Card>
      <button onClick={onBack} className="mt-8 text-gray-500 text-sm hover:text-emerald-600 transition-colors flex items-center gap-1">
        <ChevronLeft size={14}/> Back to Home
      </button>
    </div>
  );
};

// --- MAIN APP COMPONENT ---

enum View {
  HOME, LOGIN, NOTIFICATIONS, RULES, ABOUT, RESULT, ATTENDANCE, ADMIN
}

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>(View.HOME);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView(View.HOME);
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    if (user.role === UserRole.TEACHER) {
      setCurrentView(View.ADMIN);
    } else {
      setCurrentView(View.HOME);
    }
  };

  const navigateTo = (view: View) => {
    if ((view === View.RESULT || view === View.ATTENDANCE) && !currentUser) {
      alert("Please Login first to view this section.");
      setCurrentView(View.LOGIN);
      return;
    }
    setCurrentView(view);
  };

  // --- RENDERING ---

  if (currentView === View.LOGIN) return <LoginScreen onLogin={handleLogin} onBack={() => setCurrentView(View.HOME)} />;
  if (currentView === View.ADMIN && currentUser?.role === UserRole.TEACHER) return <AdminDashboard onLogout={handleLogout} />;
  
  if (currentView === View.RESULT && currentUser?.role === UserRole.STUDENT) {
    return <Marksheet student={currentUser as Student} onBack={() => setCurrentView(View.HOME)} />;
  }
  
  if (currentView === View.ATTENDANCE && currentUser?.role === UserRole.STUDENT) {
    return <AttendanceView student={currentUser as Student} onBack={() => setCurrentView(View.HOME)} />;
  }

  if (currentView === View.NOTIFICATIONS) return <NotificationList onBack={() => setCurrentView(View.HOME)} />;
  if (currentView === View.ABOUT) return <AboutUs onBack={() => setCurrentView(View.HOME)} />;
  if (currentView === View.RULES) return <Rules onBack={() => setCurrentView(View.HOME)} />;

  // 5. HOME SCREEN (Dashboard)
  return (
    <div className="min-h-screen bg-gray-100 max-w-md mx-auto shadow-2xl overflow-hidden relative font-bengali">
      {/* Header */}
      <div className="bg-emerald-700 p-8 rounded-b-[3rem] shadow-xl mb-8 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-600 rounded-full opacity-50"></div>
        <div className="absolute top-20 -left-10 w-24 h-24 bg-emerald-500 rounded-full opacity-30"></div>

        <div className="flex flex-col items-center text-white relative z-10">
           <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg mb-3 border-4 border-emerald-200 overflow-hidden p-2">
             <img src={LOGO_URL} alt="Maktab Logo" className="w-full h-full object-contain" />
           </div>
           <h1 className="text-xl font-bold leading-tight text-center">মক্তাবাতুল উম্মাতিল মুহাম্মাদিয়া</h1>
           <p className="text-emerald-200 text-xs mt-1">স্বাগতম (Welcome)</p>
        </div>
        
        {currentUser ? (
          <div className="mt-6 bg-white/10 p-3 rounded-xl flex justify-between items-center backdrop-blur-md border border-white/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-800 rounded-full"><UserCircle className="text-white" size={20}/></div>
              <div>
                <p className="text-white font-bold text-sm">{currentUser.name}</p>
                <p className="text-emerald-200 text-xs">{currentUser.id}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="text-white/80 hover:text-white flex items-center gap-1 text-xs bg-red-500/80 px-2 py-1 rounded">
              <LogOut size={12}/> লগআউট
            </button>
          </div>
        ) : (
          <div className="mt-6">
            <Button onClick={() => setCurrentView(View.LOGIN)} fullWidth className="bg-white text-emerald-800 hover:bg-emerald-50 shadow-lg font-bold">
              লগইন করুন
            </Button>
          </div>
        )}
      </div>

      {/* Grid Menu */}
      <div className="px-6 grid grid-cols-2 gap-4 pb-10">
        <MenuTile icon={FileText} label="ফলাফল (Result)" onClick={() => navigateTo(View.RESULT)} color="text-emerald-600 bg-emerald-50" />
        <MenuTile icon={Bell} label="নোটিফিকেশন" onClick={() => navigateTo(View.NOTIFICATIONS)} color="text-amber-600 bg-amber-50" />
        <MenuTile icon={CalendarCheck} label="উপস্থিতি" onClick={() => navigateTo(View.ATTENDANCE)} color="text-blue-600 bg-blue-50" />
        <MenuTile icon={Info} label="নিয়ম ও কানুন" onClick={() => navigateTo(View.RULES)} color="text-purple-600 bg-purple-50" />
        <MenuTile icon={UserCircle} label="আমাদের সম্পর্কে" onClick={() => navigateTo(View.ABOUT)} color="text-teal-600 bg-teal-50" />
        
        {/* Logout Tile (Only visible if logged in for quick access, else disabled look) */}
        {currentUser && (
           <MenuTile icon={LogOut} label="লগআউট" onClick={handleLogout} color="text-red-500 bg-red-50" />
        )}
      </div>

      <div className="text-center text-xs text-gray-400 py-4 absolute bottom-0 w-full">
        &copy; 2024 Maktabatul Ummah App
      </div>
    </div>
  );
};

export default App;
