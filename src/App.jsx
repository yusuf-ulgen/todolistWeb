import React, { useState, useEffect } from 'react';
import {
  auth, db, googleProvider
} from './firebase';
import { 
  CheckCircle2, Circle, Pin, Trash2, 
  Plus, LogOut, Search, Menu, X, ListTodo, 
  Clock, BarChart2, ChevronRight, User as UserIcon,
  Calendar, Info, PlusCircle, AlertCircle, Check,
  LogIn, UserPlus, ChevronLeft, Mail, Lock,
  GripVertical
} from 'lucide-react';
import { 
  signInWithPopup, onAuthStateChanged, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  setPersistence, browserSessionPersistence, browserLocalPersistence
} from 'firebase/auth';
import {
  collection, query, where, onSnapshot, addDoc,
  updateDoc, deleteDoc, doc, setDoc, orderBy
} from 'firebase/firestore';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const SHORT_DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [lists, setLists] = useState([]);
  const [currentListId, setCurrentListId] = useState('default');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('daily'); // 'daily' or 'weekly'
  const [selectedDay, setSelectedDay] = useState(new Date().getDay() === 0 ? 7 : new Date().getDay());
  const [newTaskContent, setNewTaskContent] = useState('');
  const [newListName, setNewListName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingList, setIsAddingList] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [listToDelete, setListToDelete] = useState(null);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [newTaskTime, setNewTaskTime] = useState('');
  const [notificationPermission, setNotificationPermission] = useState(Notification.permission);
  
  // Edit Task States
  const [isEditing, setIsEditing] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  
  // Auth Screen States
  const [authScreen, setAuthScreen] = useState('landing'); // 'landing', 'login', 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  // Auth State
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        setIsAdding(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync Lists
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'users', user.uid, 'lists'),
      orderBy('sortOrder', 'asc')
    );
    return onSnapshot(q, (snapshot) => {
      const l = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setLists(l);
      if (l.length === 0) {
        setDoc(doc(db, 'users', user.uid, 'lists', 'default'), {
          userId: user.uid,
          name: 'GÜNLÜK/HAFTALIK',
          sortOrder: 0
        });
      }
    });
  }, [user]);

  // Sync Tasks
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'users', user.uid, 'tasks'),
      where('listId', '==', currentListId)
    );
    return onSnapshot(q, (snapshot) => {
      const t = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const sorted = t.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return (a.sortOrder || 0) - (b.sortOrder || 0);
      });
      setTasks(sorted);
    });
  }, [user, currentListId]);

  // Notification Scheduler
  useEffect(() => {
    if (!user || notificationPermission !== 'granted') return;

    const interval = setInterval(() => {
      const now = new Date();
      const HH = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${HH}:${mm}`;
      
      tasks.forEach(task => {
        // Check if day matches for weekly tasks
        const isCorrectDay = task.weekday === null || task.weekday === (now.getDay() === 0 ? 7 : now.getDay());
        
        if (!task.isChecked && task.time === currentTime && !task.notified && isCorrectDay) {
          try {
            new Notification("Görev Hatırlatıcı", {
              body: task.content,
              icon: '/favicon.ico'
            });
            
            updateDoc(doc(db, 'users', user.uid, 'tasks', task.id), {
              notified: true
            });
          } catch (e) {
            console.error("Bildirim gönderilemedi", e);
          }
        }
      });
    }, 10000); // Her 10 saniyede bir kontrol et

    return () => clearInterval(interval);
  }, [user, tasks, notificationPermission]);

  const requestNotificationPermission = async () => {
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        showToast("Bildirimlere izin verildi", "success");
      } else {
        showToast("Bildirim izni reddedildi", "error");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loginWithGoogle = async () => {
    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithPopup(auth, googleProvider);
      showToast("Giriş yapıldı", "success");
    } catch (err) {
      console.error(err);
      if (err.code !== 'auth/popup-closed-by-user') {
        showToast("Giriş başlatılamadı", "error");
      }
    }
  };

  const handleEmailSignUp = async (e) => {
    if (e) e.preventDefault();
    if (!email || !password) return showToast("Lütfen tüm alanları doldurun", "error");
    
    setAuthLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      await signOut(auth); // Force manual login after registration
      showToast("Kayıt başarılı! Şimdi giriş yapabilirsiniz.", "success");
      setAuthScreen('login');
      setAuthLoading(false);
    } catch (err) {
      console.error(err);
      let msg = "Kayıt başarısız";
      if (err.code === 'auth/email-already-in-use') msg = "Bu e-posta zaten kullanımda";
      if (err.code === 'auth/weak-password') msg = "Şifre en az 6 karakter olmalıdır";
      showToast(msg, "error");
      setAuthLoading(false);
    }
  };

  const handleEmailLogin = async (e) => {
    if (e) e.preventDefault();
    if (!email || !password) return showToast("Lütfen tüm alanları doldurun", "error");

    setAuthLoading(true);
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email, password);
      showToast("Başarıyla giriş yapıldı", "success");
    } catch (err) {
      console.error(err);
      let msg = "Giriş başarısız";
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = "E-posta veya şifre hatalı";
      }
      showToast(msg, "error");
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => {
    signOut(auth);
    showToast("Çıkış yapıldı");
  };

  const addTask = async (e) => {
    if (e) e.preventDefault();
    if (!newTaskContent.trim() || !user) return;

    try {
      await setDoc(doc(db, 'users', user.uid), { lastActive: new Date() }, { merge: true });

      const tasksRef = collection(db, 'users', user.uid, 'tasks');
      const newTaskRef = doc(tasksRef);

      const timeToSave = newTaskTime || '';

      const newTask = {
        id: newTaskRef.id,
        userId: user.uid,
        content: newTaskContent,
        time: timeToSave,
        isChecked: false,
        isPinned: false,
        sortOrder: tasks.length,
        listId: currentListId,
        priority: 0,
        weekday: activeTab === 'weekly' ? selectedDay : null,
        notified: false
      };

      await setDoc(newTaskRef, newTask);
      setNewTaskContent('');
      setNewTaskTime('');
      setIsAdding(false);
      showToast("Görev eklendi", "success");

      if (newTaskTime && notificationPermission === 'default') {
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
      }
    } catch (err) {
      console.error(err);
      showToast(`Hata: ${err.code || err.message}`, "error");
    }
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setNewTaskContent(task.content);
    setNewTaskTime(task.time || '');
    setIsEditing(true);
  };

  const updateTask = async (e) => {
    if (e) e.preventDefault();
    if (!newTaskContent.trim() || !user || !editingTask) return;

    try {
      const taskRef = doc(db, 'users', user.uid, 'tasks', editingTask.id);
      
      // If time changed, reset notified status
      const timeChanged = newTaskTime !== editingTask.time;

      await updateDoc(taskRef, {
        content: newTaskContent,
        time: newTaskTime,
        notified: timeChanged ? false : (editingTask.notified || false)
      });

      setNewTaskContent('');
      setNewTaskTime('');
      setIsEditing(false);
      setEditingTask(null);
      showToast("Görev güncellendi", "success");
    } catch (err) {
      console.error(err);
      showToast("Güncelleme hatası", "error");
    }
  };

  const handleAddList = async (e) => {
    if (e) e.preventDefault();
    if (!newListName.trim() || !user) return;

    try {
      await setDoc(doc(db, 'users', user.uid), { lastActive: new Date() }, { merge: true });

      const docRef = await addDoc(collection(db, 'users', user.uid, 'lists'), {
        userId: user.uid,
        name: newListName,
        sortOrder: lists.length
      });
      
      setCurrentListId(docRef.id);
      setNewListName('');
      setIsAddingList(false);
      setSidebarOpen(false);
      showToast("Liste oluşturuldu ve geçiş yapıldı", "success");
    } catch (err) {
      console.error(err);
      showToast(`Hata: ${err.code || err.message}`, "error");
    }
  };

  const toggleTask = async (task) => {
    try {
      await updateDoc(doc(db, 'users', user.uid, 'tasks', task.id), {
        isChecked: !task.isChecked
      });
    } catch (err) {
      showToast("Güncelleme hatası", "error");
    }
  };

  const togglePin = async (task) => {
    try {
      const newIsPinned = !task.isPinned;
      const updates = { isPinned: newIsPinned };
      
      if (newIsPinned) {
        // Find the lowest sortOrder to put it at the very top
        const minSortOrder = tasks.length > 0 ? Math.min(...tasks.map(t => t.sortOrder || 0)) : 0;
        updates.sortOrder = minSortOrder - 1;
      }

      await updateDoc(doc(db, 'users', user.uid, 'tasks', task.id), updates);
    } catch (err) {
      showToast("Pinleme hatası", "error");
    }
  };

  const handleDeleteTask = (taskId, e) => {
    if (e) e.stopPropagation();
    const task = tasks.find(t => t.id === taskId);
    setTaskToDelete(task);
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'tasks', taskToDelete.id));
      showToast("Görev silindi");
      setTaskToDelete(null);
    } catch (err) {
      showToast("Silme hatası", "error");
    }
  };

  const handleDeleteList = (listId, e) => {
    e.stopPropagation();
    if (listId === 'default') return;
    const list = lists.find(l => l.id === listId);
    setListToDelete(list);
  };

  const confirmDeleteList = async () => {
    if (!listToDelete) return;
    const listId = listToDelete.id;

    try {
      // 1. Delete associated tasks
      const tasksToDelete = tasks.filter(t => t.listId === listId);
      for (const task of tasksToDelete) {
        await deleteDoc(doc(db, 'users', user.uid, 'tasks', task.id));
      }

      // 2. Delete the list
      await deleteDoc(doc(db, 'users', user.uid, 'lists', listId));

      if (currentListId === listId) {
        setCurrentListId('default');
      }
      showToast("Liste silindi");
      setListToDelete(null);
    } catch (err) {
      showToast("Liste silme hatası", "error");
      setListToDelete(null);
    }
  };

  const handleReorderLists = async (newOrder) => {
    const defaultList = lists.find(l => l.id === 'default');
    const others = newOrder.filter(l => l.id !== 'default');
    const final = [defaultList, ...others];
    
    setLists(final);
    
    try {
      for (let i = 0; i < final.length; i++) {
        if (final[i].id === 'default') continue;
        await updateDoc(doc(db, 'users', user.uid, 'lists', final[i].id), {
          sortOrder: i
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReorderTasks = async (newOrder) => {
    const pinned = newOrder.filter(t => t.isPinned);
    const unpinned = newOrder.filter(t => !t.isPinned);
    const final = [...pinned, ...unpinned];
    
    setTasks(final);
    
    try {
      for (let i = 0; i < final.length; i++) {
        await updateDoc(doc(db, 'users', user.uid, 'tasks', final[i].id), {
          sortOrder: i
        });
      }
    } catch (err) {
      console.error(err);
    }
  };


  if (loading) return null;

  if (!user) return (
    <div className="login-container">
      <motion.div 
        key={authScreen}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="login-card"
      >
        {authScreen !== 'landing' && (
          <div className="auth-back" onClick={() => { setAuthScreen('landing'); setEmail(''); setPassword(''); }}>
            <ChevronLeft size={18} /> Geri Dön
          </div>
        )}

        <div style={{ backgroundColor: 'var(--primary)', width: 80, height: 80, borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <ListTodo size={40} color="var(--on-primary)" />
        </div>
        
        <h1 style={{ fontSize: 32, marginBottom: 8 }}>Todolist</h1>
        <p style={{ color: 'var(--gray)' }}>Görevlerini tüm cihazlarında eşitle.</p>

        {authScreen === 'landing' && (
          <div style={{ marginTop: 32 }}>
            <button className="login-btn" onClick={() => { setAuthScreen('login'); setEmail(''); setPassword(''); }}>
              <LogIn size={20} /> Giriş Yap
            </button>
            <button className="login-btn secondary" onClick={() => { setAuthScreen('signup'); setEmail(''); setPassword(''); }}>
              <UserPlus size={20} /> Kayıt Ol
            </button>
            <button className="login-btn google" onClick={loginWithGoogle}>
              Google ile Devam Et
            </button>
          </div>
        )}

        {authScreen === 'login' && (
          <form className="auth-form" onSubmit={handleEmailLogin} autoComplete="off">
            <div className="auth-input-group">
              <input 
                type="email" 
                className="auth-input" 
                placeholder="E-posta" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="off"
              />
            </div>
            <div className="auth-input-group">
              <input 
                type="password" 
                className="auth-input" 
                placeholder="Şifre" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <label className="remember-me">
              <input 
                type="checkbox" 
                checked={rememberMe} 
                onChange={(e) => setRememberMe(e.target.checked)} 
              />
              Beni Hatırla
            </label>
            <button className="login-btn" type="submit" disabled={authLoading}>
              {authLoading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
            </button>
            <div className="auth-switch">
              Hesabınız yok mu? <span onClick={() => { setAuthScreen('signup'); setEmail(''); setPassword(''); }}>Kayıt Ol</span>
            </div>
          </form>
        )}

        {authScreen === 'signup' && (
          <form className="auth-form" onSubmit={handleEmailSignUp} autoComplete="off">
            <div className="auth-input-group">
              <input 
                type="email" 
                className="auth-input" 
                placeholder="E-posta" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="off"
              />
            </div>
            <div className="auth-input-group">
              <input 
                type="password" 
                className="auth-input" 
                placeholder="Şifre (En az 6 karakter)" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <button className="login-btn" type="submit" disabled={authLoading}>
              {authLoading ? 'Hesap Oluşturuluyor...' : 'Kayıt Ol'}
            </button>
            <div className="auth-switch">
              Zaten hesabınız var mı? <span onClick={() => { setAuthScreen('login'); setEmail(''); setPassword(''); }}>Giriş Yap</span>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );

  const filteredTasks = tasks.filter(t =>
    t.content.toLowerCase().includes(searchQuery.toLowerCase()) &&
    (currentListId !== 'default' || (activeTab === 'daily' ? (t.weekday === null) : (t.weekday === selectedDay)))
  );

  const completedCount = filteredTasks.filter(t => t.isChecked).length;
  const currentListName = lists.find(l => l.id === currentListId)?.name || 'Liste';

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Toast Container */}
      <div className="toast-container">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`toast ${toast.type}`}
            >
              {toast.type === 'error' ? <AlertCircle size={18} /> : <Check size={18} />}
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Sidebar / Drawer */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="drawer-overlay"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              className={`drawer open`}
            >
              <div className="drawer-header">
                <span className="drawer-title">Listelerim</span>
                <button className="toolbar-button" onClick={() => setSidebarOpen(false)}>
                  <X size={24} />
                </button>
              </div>
              <div style={{ padding: '8px', flex: 1, overflowY: 'auto' }}>
                <Reorder.Group axis="y" values={lists} onReorder={handleReorderLists}>
                  {lists.map(list => (
                    <ListItem 
                      key={list.id} 
                      list={list} 
                      currentListId={currentListId}
                      setCurrentListId={setCurrentListId}
                      setSidebarOpen={setSidebarOpen}
                      handleDeleteList={handleDeleteList}
                    />
                  ))}
                </Reorder.Group>
                <button className="list-item" onClick={() => setIsAddingList(true)} style={{ color: 'var(--accent)', marginTop: 8 }}>
                  <PlusCircle size={18} />
                  Yeni Liste Ekle
                </button>
              </div>
              <div style={{ padding: 16, borderTop: '1px solid var(--primary)', backgroundColor: 'rgba(230, 213, 195, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <img src={user.photoURL} alt="" style={{ width: 40, height: 40, borderRadius: 12 }} />
                  <div style={{ overflow: 'hidden' }}>
                    <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{user.displayName}</p>
                    <p style={{ fontSize: 10, color: 'var(--gray)', margin: 0 }}>{user.email}</p>
                  </div>
                </div>
                <button
                  onClick={logout}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#F44336', border: 'none', background: 'none', fontWeight: 700, cursor: 'pointer' }}
                >
                  <LogOut size={16} /> Çıkış Yap
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* App Bar */}
      <header className="app-bar">
        <div className="toolbar">
          <button className="toolbar-button" onClick={() => setSidebarOpen(true)}>
            <Menu size={24} />
          </button>
          <h1 className="toolbar-title">{currentListName}</h1>
          <button className="toolbar-button" onClick={() => setIsStatsOpen(true)}>
            <BarChart2 size={24} />
          </button>
        </div>

        {/* Tabs - Only show for Default List */}
        {currentListId === 'default' && (
          <>
            <div className="tab-layout">
              <button className={`tab-item ${activeTab === 'daily' ? 'active' : ''}`} onClick={() => setActiveTab('daily')}>
                GÜNLÜK
                {activeTab === 'daily' && <div className="tab-indicator" />}
              </button>
              <button className={`tab-item ${activeTab === 'weekly' ? 'active' : ''}`} onClick={() => setActiveTab('weekly')}>
                HAFTALIK
                {activeTab === 'weekly' && <div className="tab-indicator" />}
              </button>
            </div>

            {/* Day Selector (Only for Weekly in Default List) */}
            {activeTab === 'weekly' && (
              <div className="days-selector">
                {SHORT_DAYS.map((day, idx) => (
                  <button
                    key={day}
                    className={`day-btn ${selectedDay === idx + 1 ? 'active' : ''}`}
                    onClick={() => setSelectedDay(idx + 1)}
                  >
                    {day}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Search */}
        <div className="search-container">
          <div className="search-box">
            <Search size={18} color="rgba(62, 39, 35, 0.5)" />
            <input
              className="search-input"
              placeholder="Görevlerde ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 16 }}>
          <div className="stat-text" style={{ margin: 0 }}>
            {currentListId === 'default'
              ? (activeTab === 'daily' ? `Bugünün görevleri ${completedCount}/${tasks.filter(t => t.weekday === null).length}` : `${DAYS[selectedDay - 1]} - Görevler`)
              : `${currentListName} - Toplam ${tasks.length} Görev`
            }
          </div>
          {notificationPermission === 'default' && (
            <button 
              onClick={requestNotificationPermission}
              className="notification-badge"
              title="Bildirimleri Aç"
            >
              <AlertCircle size={14} /> Bildirimleri Aç
            </button>
          )}
        </div>

        <div className="task-list">
          <Reorder.Group 
            axis="y" 
            values={filteredTasks} 
            onReorder={(newOrder) => {
              // We need to maintain the original tasks array but update the order for the filtered ones
              const otherTasks = tasks.filter(t => !filteredTasks.find(ft => ft.id === t.id));
              handleReorderTasks([...newOrder, ...otherTasks]);
            }} 
            className="task-list-group"
          >
            <AnimatePresence mode="popLayout">
              {filteredTasks.map((task, index) => (
                <ReorderItemWrapper 
                  key={task.id}
                  task={task}
                  index={index}
                  onToggle={toggleTask}
                  onDelete={handleDeleteTask}
                  onTogglePin={togglePin}
                  onEdit={handleEditTask}
                />
              ))}
            </AnimatePresence>
          </Reorder.Group>
          {filteredTasks.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: 80, color: 'var(--on-primary)', opacity: 0.3 }}>
              <ListTodo size={80} style={{ marginBottom: 16 }} />
              <p style={{ fontSize: 18, fontWeight: 700 }}>Henüz görev yok</p>
            </div>
          )}
        </div>
      </main>

      {/* FAB */}
      <button 
        className="fab" 
        onClick={() => setIsAdding(true)}
        title="Yeni Görev Ekle (Alt + Z)"
      >
        <Plus size={32} />
      </button>

      {/* Add/Edit Task Dialog */}
      <AnimatePresence>
        {(isAdding || isEditing) && (
          <div className="add-dialog-overlay" onClick={() => { setIsAdding(false); setIsEditing(false); setEditingTask(null); setNewTaskContent(''); setNewTaskTime(''); }}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="add-dialog"
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--on-primary)' }}>
                  {isEditing ? 'Görevi Düzenle' : `Yeni Görev ${activeTab === 'weekly' ? `(${SHORT_DAYS[selectedDay - 1]})` : ''}`}
                </h2>
                <button className="toolbar-button" onClick={() => { setIsAdding(false); setIsEditing(false); setEditingTask(null); setNewTaskContent(''); setNewTaskTime(''); }}><X size={20} /></button>
              </div>
              <form onSubmit={isEditing ? updateTask : addTask} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <textarea
                  autoFocus
                  className="add-input"
                  placeholder="Görev metni..."
                  value={newTaskContent}
                  onChange={(e) => setNewTaskContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (isEditing) updateTask(e);
                      else addTask(e);
                    }
                  }}
                  style={{ minHeight: '100px', resize: 'vertical', fontFamily: 'inherit' }}
                />
                <div style={{ display: 'flex', gap: 12 }}>
                  <input
                    type="time"
                    className="add-input"
                    style={{ flex: 'none', width: '130px' }}
                    value={newTaskTime}
                    onChange={(e) => setNewTaskTime(e.target.value)}
                    title="Hatırlatma Saati"
                  />
                  <div style={{ flex: 1 }} />
                  <button type="submit" className="add-submit" title={isEditing ? "Kaydet" : "Ekle"}>
                    {isEditing ? <Check size={24} /> : <Plus size={24} />}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add List Dialog */}
      <AnimatePresence>
        {isAddingList && (
          <div className="add-dialog-overlay" onClick={() => setIsAddingList(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="add-dialog"
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--on-primary)' }}>Yeni Liste</h2>
                <button className="toolbar-button" onClick={() => setIsAddingList(false)}><X size={20} /></button>
              </div>
              <form onSubmit={handleAddList} style={{ display: 'flex', gap: 12 }}>
                <input
                  autoFocus
                  className="add-input"
                  placeholder="Liste adı..."
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                />
                <button type="submit" className="add-submit">
                  <ChevronRight size={24} />
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stats Modal */}
      <AnimatePresence>
        {isStatsOpen && (
          <div className="add-dialog-overlay" onClick={() => setIsStatsOpen(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="add-dialog"
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--on-primary)' }}>İstatistikler</h2>
                <button className="toolbar-button" onClick={() => setIsStatsOpen(false)}><X size={20} /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <StatCard label="Toplam Görev" value={filteredTasks.length} icon={<ListTodo size={24} />} color="#E6D5C3" />
                <StatCard label="Tamamlanan" value={completedCount} icon={<CheckCircle2 size={24} />} color="#00BFA5" />
                <StatCard label="Bekleyen" value={filteredTasks.length - completedCount} icon={<Clock size={24} />} color="#FF9800" />
                <StatCard label="Verimlilik" value={filteredTasks.length > 0 ? `%${Math.round((completedCount / filteredTasks.length) * 100)}` : '%0'} icon={<BarChart2 size={24} />} color="#4CAF50" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Confirm Modal */}
      <AnimatePresence>
        {listToDelete && (
          <div className="confirm-modal-overlay" onClick={() => setListToDelete(null)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="confirm-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="confirm-icon-container">
                <Trash2 size={32} />
              </div>
              <h2 className="confirm-title">Listeyi Sil?</h2>
              <p className="confirm-message">
                <strong>"{listToDelete.name}"</strong> listesini ve içindeki tüm görevleri silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
              </p>
              <div className="confirm-actions">
                <button className="confirm-btn-cancel" onClick={() => setListToDelete(null)}>Vazgeç</button>
                <button className="confirm-btn-delete" onClick={confirmDeleteList}>Evet, Sil</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Task Delete Confirm Modal */}
      <AnimatePresence>
        {taskToDelete && (
          <div className="confirm-modal-overlay" onClick={() => setTaskToDelete(null)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="confirm-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="confirm-icon-container">
                <Trash2 size={32} />
              </div>
              <h2 className="confirm-title">Görevi Sil?</h2>
              <p className="confirm-message">
                Bu görevi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
              </p>
              <div className="confirm-actions">
                <button className="confirm-btn-cancel" onClick={() => setTaskToDelete(null)}>Vazgeç</button>
                <button className="confirm-btn-delete" onClick={confirmDeleteTask}>Evet, Sil</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ReorderItemWrapper({ task, index, onToggle, onDelete, onTogglePin, onEdit }) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item 
      value={task}
      dragListener={false}
      dragControls={dragControls}
    >
      <TaskCard 
        task={task} 
        index={index} 
        onToggle={onToggle} 
        onDelete={onDelete}
        onTogglePin={onTogglePin}
        onEdit={onEdit}
        dragControls={dragControls}
      />
    </Reorder.Item>
  );
}

function TaskCard({ task, index, onToggle, onDelete, onTogglePin, onEdit, dragControls }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`task-card ${task.isPinned ? 'pinned' : ''}`}
    >
      <div
        className="priority-bar"
        style={{ backgroundColor: task.priority === 2 ? 'var(--priority-high)' : task.priority === 1 ? 'var(--priority-medium)' : 'var(--priority-low)' }}
      />
      <span 
        className="task-number"
        onPointerDown={(e) => dragControls.start(e)}
        title="Taşımak için sürükleyin"
      >
        {index + 1}
      </span>

      <div className="checkbox-container" onClick={() => onToggle(task)} title={task.isChecked ? "Tamamlanmadı olarak işaretle" : "Tamamlandı olarak işaretle"}>
        {task.isChecked ? (
          <CheckCircle2 size={24} color="var(--accent)" />
        ) : (
          <Circle size={24} color="var(--primary-variant)" />
        )}
      </div>

      <div className="task-content">
        <p className={`task-text ${task.isChecked ? 'checked' : ''}`}>
          {task.content}
        </p>
      </div>

      {task.time && <span className="task-time" title="Hatırlatma Saati">{task.time}</span>}

      <button 
        className="edit-btn" 
        onClick={() => onEdit(task)}
        title="Düzenle"
        style={{ background: 'none', border: 'none', color: 'var(--primary-variant)', cursor: 'pointer', padding: 4, opacity: 0.3, transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <PlusCircle size={18} style={{ transform: 'rotate(45deg)' }} />
      </button>

      <button 
        className={`pin-btn ${task.isPinned ? 'active' : ''}`} 
        onClick={() => onTogglePin(task)}
        title={task.isPinned ? "Pini Kaldır" : "Pinle (Üste Sabitle)"}
      >
        <Pin size={18} fill={task.isPinned ? "currentColor" : "none"} />
      </button>

      <button className="delete-btn" onClick={(e) => onDelete(task.id, e)} title="Sil">
        <Trash2 size={18} />
      </button>
    </motion.div>
  );
}

function StatCard({ label, value, icon, color }) {
  return (
    <div style={{ backgroundColor: '#F8F8F8', padding: 16, borderRadius: 16, border: `1px solid ${color}`, textAlign: 'center' }}>
      <div style={{ color: color, marginBottom: 8, display: 'flex', justifyContent: 'center' }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--on-primary)' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--gray)', fontWeight: 600 }}>{label}</div>
    </div>
  );
}

function ListItem({ list, currentListId, setCurrentListId, setSidebarOpen, handleDeleteList }) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item 
      value={list}
      dragListener={false}
      dragControls={dragControls}
      style={{ listStyle: 'none' }}
    >
      <div className={`list-item-container ${currentListId === list.id ? 'active' : ''}`}>
        {list.id !== 'default' && (
          <div 
            className="drag-handle" 
            onPointerDown={(e) => dragControls.start(e)}
            style={{ paddingLeft: 8, cursor: 'grab', color: 'var(--primary-variant)', display: 'flex', alignItems: 'center' }}
          >
            <GripVertical size={18} />
          </div>
        )}
        <button
          className="list-item-btn"
          onClick={() => { setCurrentListId(list.id); setSidebarOpen(false); }}
          style={{ paddingLeft: list.id === 'default' ? 16 : 8 }}
        >
          <ListTodo size={18} />
          <span style={{ flex: 1 }}>{list.name}</span>
        </button>
        {list.id !== 'default' && (
          <button className="list-delete-btn" onClick={(e) => handleDeleteList(list.id, e)}>
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </Reorder.Item>
  );
}
