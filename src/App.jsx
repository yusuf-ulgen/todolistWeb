import React, { useState, useEffect } from 'react';
import {
  auth, db, googleProvider
} from './firebase';
import {
  signInWithPopup, onAuthStateChanged, signOut
} from 'firebase/auth';
import {
  collection, query, where, onSnapshot, addDoc,
  updateDoc, deleteDoc, doc, setDoc, orderBy
} from 'firebase/firestore';
import {
  CheckCircle2, Circle, Pin, Trash2,
  Plus, LogOut, Search, Menu, X, ListTodo,
  Clock, BarChart2, ChevronRight, User as UserIcon,
  Calendar, Info, PlusCircle, AlertCircle, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
        if (a.isPinned !== b.isPinned) return b.isPinned ? -1 : 1;
        return a.sortOrder - b.sortOrder;
      });
      setTasks(sorted);
    });
  }, [user, currentListId]);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      showToast("Giriş yapıldı", "success");
    } catch (err) {
      console.error(err);
      if (err.code !== 'auth/popup-closed-by-user') {
        showToast("Giriş başarısız", "error");
      }
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
      // Ensure user doc exists
      await setDoc(doc(db, 'users', user.uid), { lastActive: new Date() }, { merge: true });

      const tasksRef = collection(db, 'users', user.uid, 'tasks');
      const newTaskRef = doc(tasksRef);

      const newTask = {
        id: newTaskRef.id,
        userId: user.uid,
        content: newTaskContent,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isChecked: false,
        isPinned: false,
        sortOrder: tasks.length,
        listId: currentListId,
        priority: 0,
        weekday: activeTab === 'weekly' ? selectedDay : null
      };

      await setDoc(newTaskRef, newTask);
      setNewTaskContent('');
      setIsAdding(false);
      showToast("Görev eklendi", "success");
    } catch (err) {
      console.error(err);
      showToast(`Hata: ${err.code || err.message}`, "error");
    }
  };

  const handleAddList = async (e) => {
    if (e) e.preventDefault();
    if (!newListName.trim() || !user) return;

    try {
      await setDoc(doc(db, 'users', user.uid), { lastActive: new Date() }, { merge: true });

      await addDoc(collection(db, 'users', user.uid, 'lists'), {
        userId: user.uid,
        name: newListName,
        sortOrder: lists.length
      });
      setNewListName('');
      setIsAddingList(false);
      showToast("Liste oluşturuldu", "success");
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

  const deleteTask = async (taskId) => {
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'tasks', taskId));
      showToast("Görev silindi");
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


  if (loading) return null;

  if (!user) return (
    <div className="login-container">
      <div className="login-card">
        <div style={{ backgroundColor: 'var(--primary)', width: 80, height: 80, borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <ListTodo size={40} color="var(--on-primary)" />
        </div>
        <h1 style={{ fontSize: 32, marginBottom: 8 }}>Todolist</h1>
        <p style={{ color: 'var(--gray)' }}>Görevlerini tüm cihazlarında eşitle.</p>
        <button className="login-btn" onClick={login}>Google ile Giriş Yap</button>
      </div>
    </div>
  );

  const filteredTasks = tasks.filter(t =>
    t.content.toLowerCase().includes(searchQuery.toLowerCase()) &&
    (activeTab === 'daily' ? (t.weekday === null) : (t.weekday === selectedDay))
  );

  const completedCount = tasks.filter(t => t.isChecked).length;
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
                {lists.map(list => (
                  <div key={list.id} className={`list-item-container ${currentListId === list.id ? 'active' : ''}`}>
                    <button
                      className="list-item-btn"
                      onClick={() => { setCurrentListId(list.id); setSidebarOpen(false); }}
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
                ))}

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
        <div className="stat-text">
          {currentListId === 'default'
            ? (activeTab === 'daily' ? `Bugünün görevleri ${completedCount}/${tasks.filter(t => t.weekday === null).length}` : `${DAYS[selectedDay - 1]} - Görevler`)
            : `${currentListName} - Toplam ${tasks.length} Görev`
          }
        </div>

        <div className="task-list">
          <AnimatePresence mode="popLayout">
            {tasks
              .filter(t => t.content.toLowerCase().includes(searchQuery.toLowerCase()))
              .filter(t => currentListId !== 'default' || (activeTab === 'daily' ? t.weekday === null : t.weekday === selectedDay))
              .map((task, index) => (
                <TaskCard key={task.id} task={task} index={index} onToggle={toggleTask} onDelete={deleteTask} />
              ))
            }
          </AnimatePresence>

          {filteredTasks.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: 80, color: 'var(--on-primary)', opacity: 0.3 }}>
              <ListTodo size={80} style={{ marginBottom: 16 }} />
              <p style={{ fontSize: 18, fontWeight: 700 }}>Henüz görev yok</p>
            </div>
          )}
        </div>
      </main>

      {/* FAB */}
      <button className="fab" onClick={() => setIsAdding(true)}>
        <Plus size={32} />
      </button>

      {/* Add Task Dialog */}
      <AnimatePresence>
        {isAdding && (
          <div className="add-dialog-overlay" onClick={() => setIsAdding(false)}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="add-dialog"
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--on-primary)' }}>Yeni Görev {activeTab === 'weekly' && `(${SHORT_DAYS[selectedDay - 1]})`}</h2>
                <button className="toolbar-button" onClick={() => setIsAdding(false)}><X size={20} /></button>
              </div>
              <form onSubmit={addTask} style={{ display: 'flex', gap: 12 }}>
                <input
                  autoFocus
                  className="add-input"
                  placeholder="Görev metni..."
                  value={newTaskContent}
                  onChange={(e) => setNewTaskContent(e.target.value)}
                />
                <button type="submit" className="add-submit">
                  <Plus size={24} />
                </button>
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
                <StatCard label="Toplam Görev" value={tasks.length} icon={<ListTodo size={24} />} color="#E6D5C3" />
                <StatCard label="Tamamlanan" value={completedCount} icon={<CheckCircle2 size={24} />} color="#00BFA5" />
                <StatCard label="Bekleyen" value={tasks.length - completedCount} icon={<Clock size={24} />} color="#FF9800" />
                <StatCard label="Verimlilik" value={tasks.length > 0 ? `%${Math.round((completedCount / tasks.length) * 100)}` : '%0'} icon={<BarChart2 size={24} />} color="#4CAF50" />
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

    </div>
  );
}

function TaskCard({ task, index, onToggle, onDelete }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="task-card"
    >
      <div
        className="priority-bar"
        style={{ backgroundColor: task.priority === 2 ? 'var(--priority-high)' : task.priority === 1 ? 'var(--priority-medium)' : 'var(--priority-low)' }}
      />
      <span className="task-number">{index + 1}</span>

      <div className="checkbox-container" onClick={() => onToggle(task)}>
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

      <span className="task-time">{task.time}</span>

      <button className="delete-btn" onClick={() => onDelete(task.id)}>
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
