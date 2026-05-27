
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Dumbbell, Calendar, Activity, Settings, CheckCircle2, 
  Plus, Save, ChevronDown, ChevronUp, ChevronRight, 
  BarChart3, Flame, Clock, 
  PersonStanding, Edit3, X, ArrowLeft, Download, Upload, Zap, FileDown, Timer, Trash2,
  TrendingUp, TrendingDown, Info, Repeat, AlertTriangle, Trophy, Target, PieChart, PlusCircle, Scale,
  MoreVertical, Hammer, LayoutGrid, LineChart, Hourglass, Gift, Heart, Sparkles, Moon, Sun, Sunrise,
  BarChart4, Minus, Footprints, History, Coffee, Ghost, Play, Pause, RotateCcw,
  CalendarCheck, MapPin, RefreshCw, Link2, Mountain, Cloud, CloudUpload, CloudDownload, Eye, EyeOff
} from 'lucide-react';
import { MAIN_PLANS_DEFAULT } from './constants';
import { Plan, HistoryItemType, ExerciseHistoryRecord, BodyStat, WorkoutSetLog, ChartDataPoint, Exercise, RewardRecord } from './types';
import { getLocalDateString, getMonthString, superParse, parseIndex, formatTime, getWeekStartString } from './utils';
import SmartInput from './components/SmartInput';
import SimpleLineChart from './components/SimpleLineChart';
import DualLineChart from './components/DualLineChart';
import HistoryItem from './components/HistoryItem';
import CalendarHeatmap from './components/CalendarHeatmap';
import { haptics } from './lib/haptics';
import { estimateSet, OneRMResult } from './lib/oneRepMax';
import { saveWithMirror, recoverMissingKeys, runMigrations, daysSinceLastBackup, markBackupDone } from './lib/storage';
import * as gistSync from './lib/gistSync';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  // 'overview' | 'analysis' | 'calendar'
  const [statsTab, setStatsTab] = useState('overview'); 

  const [plans, setPlans] = useState<Plan[]>(MAIN_PLANS_DEFAULT);
  const [currentPlanIndex, setCurrentPlanIndex] = useState(0);
  const [history, setHistory] = useState<HistoryItemType[]>([]);
  const [exerciseHistory, setExerciseHistory] = useState<Record<string, ExerciseHistoryRecord>>({});
  const [bodyStats, setBodyStats] = useState<BodyStat[]>([]);
  const [rewards, setRewards] = useState<RewardRecord[]>([]); // New State for Rewards
  // New: Legacy ID -> Name map for archived exercises
  const [legacyExerciseMap, setLegacyExerciseMap] = useState<Record<string, string>>({}); 
  
  const [activeWorkout, setActiveWorkout] = useState<Plan | null>(null);
  const [workoutLogs, setWorkoutLogs] = useState<Record<string, WorkoutSetLog[]>>({});
  const [expandedExId, setExpandedExId] = useState<string | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryData, setSummaryData] = useState({ activeCalories: '', avgHeartRate: '', rpe: '5', note: '', weight: '' });
  // B4: 完成力量训练时追加爬坡的开关 + 字段
  const [addCardio, setAddCardio] = useState(false);
  const [postCardio, setPostCardio] = useState({ duration: '40', incline: '12', speed: '4' });
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);
  
  const [workoutStartTime, setWorkoutStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  
  // Rest Timer State
  const [restTimer, setRestTimer] = useState(0);
  const [isResting, setIsResting] = useState(false);

  // Manual Timer (Stopwatch) State
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [manualTimer, setManualTimer] = useState(0);
  const [isManualTimerRunning, setIsManualTimerRunning] = useState(false);

  // Workout Detail Modal State
  const [viewingHistoryItem, setViewingHistoryItem] = useState<HistoryItemType | null>(null);

  const [selectedExerciseForChart, setSelectedExerciseForChart] = useState<string | null>(null);
  
  // Stats View Controls
  const [heatmapMode, setHeatmapMode] = useState<'workout' | 'reward'>('workout');

  const [showPlanSelector, setShowPlanSelector] = useState(false);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<{ type: 'history' | 'weight' | 'plan', data: any, index?: number } | null>(null);

  const [selectedDate, setSelectedDate] = useState<string | null>(null); 
  const fileRef = useRef<HTMLInputElement>(null);

  // Reward Feedback Modal State
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [showRewardEntry, setShowRewardEntry] = useState(false);
  const [rewardEntryData, setRewardEntryData] = useState({ date: '', time: '' });
  const [rewardModalData, setRewardModalData] = useState({ streak: 0, monthCount: 0, time: '', todayCount: 0 });
  const [showRewardAnalysis, setShowRewardAnalysis] = useState(false);

  // Cardio Modal State
  const [showCardioModal, setShowCardioModal] = useState(false);
  const [cardioData, setCardioData] = useState({ date: '', duration: '40', incline: '12', speed: '4', distance: '', activeCalories: '', avgHeartRate: '', note: '' });

  // Rest Day / Lazy Modal State
  const [showRestDayModal, setShowRestDayModal] = useState(false);
  const [restDayNote, setRestDayNote] = useState('');
  const [restDayType, setRestDayType] = useState<'rest' | 'lazy'>('lazy');
  const [editingRestItem, setEditingRestItem] = useState<HistoryItemType | null>(null);

  // Weight Entry Modal
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [weightEntryData, setWeightEntryData] = useState({ date: '', weight: '', bodyFat: '' });

  // Detailed Stats Modal
  const [statsDetailType, setStatsDetailType] = useState<'tonnage' | 'duration' | null>(null);

  // D3: 撤销删除 toast
  const [undoToast, setUndoToast] = useState<{ message: string; onUndo: () => void } | null>(null);
  const undoTimerRef = useRef<any>(null);

  // D5: 训练完成庆祝弹窗（含 PR 列表）
  const [celebration, setCelebration] = useState<{ duration: number; volume: number; prs: Array<{ name: string; weight: number; prevPR: number }> } | null>(null);

  // A2: 备份提醒横幅本会话内已忽略
  const [backupBannerDismissed, setBackupBannerDismissed] = useState(false);

  // A3: Gist 同步 UI 状态
  const [gistSettings, setGistSettings] = useState(() => gistSync.getSettings());
  const [gistTokenInput, setGistTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [gistBusy, setGistBusy] = useState<'idle' | 'pushing' | 'pulling'>('idle');
  const [gistMessage, setGistMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  // D8: 历史搜索/筛选
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'workout' | 'cardio' | 'rest'>('all');

  // --- Helpers for Fuzzy Matching ---
  const normalizeExerciseName = (name: string) => {
      if (!name) return '';
      return name
        .replace(/史密斯|绳索|哑铃|杠铃|器械|坐姿|站姿|俯身|单臂|双臂|交替|侧向|基础|进阶|核心|【.*?】|\[.*?\]|（.*?）|\(.*?\)/g, '')
        .replace(/平地/g, '平板')
        .replace(/\s+/g, '')
        .trim();
  };

  const getExerciseNameById = (id: string): string => {
      for (const p of plans) {
          const found = p.exercises.find(e => e.id === id);
          if (found) return found.name;
      }
      if (legacyExerciseMap[id]) return legacyExerciseMap[id];
      return '未知动作';
  };

  // --- Analytics Calculations ---
  
  const volumeDataRecent = useMemo<ChartDataPoint[]>(() => history.filter(h => h.type === 'workout' && h.metrics?.volume && h.metrics.volume > 0).slice(0, 15).reverse().map(h => ({ date: h.date.slice(5), value: h.metrics!.volume!, timestamp: h.timestamp })), [history]);

  // E3: 体重 vs 容量叠图数据 — 按日期对齐，最近 30 天
  const dualChartData = useMemo(() => {
    const cutoff = Date.now() - 30 * 86400000;
    // 体重：每天保留最早一次记录（早晨称重最稳）
    const weightByDate: Record<string, ChartDataPoint> = {};
    bodyStats.forEach(s => {
      if (s.timestamp < cutoff) return;
      const w = parseFloat(s.weight);
      if (!w) return;
      const d = s.date;
      if (!weightByDate[d] || s.timestamp < weightByDate[d].timestamp!) {
        weightByDate[d] = { date: d.slice(5), value: w, timestamp: s.timestamp };
      }
    });
    // 容量：同一天多次训练取总和（吨）
    const volumeByDate: Record<string, ChartDataPoint> = {};
    history.forEach(h => {
      if (h.type !== 'workout' || h.timestamp < cutoff) return;
      const v = h.metrics?.volume;
      if (!v) return;
      const d = h.date;
      const inTons = v / 1000;
      if (volumeByDate[d]) volumeByDate[d].value += inTons;
      else volumeByDate[d] = { date: d.slice(5), value: inTons, timestamp: h.timestamp };
    });
    return {
      weight: Object.values(weightByDate).sort((a, b) => (a.timestamp! - b.timestamp!)),
      volume: Object.values(volumeByDate).sort((a, b) => (a.timestamp! - b.timestamp!)),
    };
  }, [history, bodyStats]);
  const weightDataRecent = useMemo<ChartDataPoint[]>(() => bodyStats.filter(s => s.weight).slice(0, 15).reverse().map(s => ({ date: s.date.slice(5), value: parseFloat(s.weight), timestamp: s.timestamp })), [bodyStats]);
  
  const totalDurationMinutes = useMemo(() => history.filter(h => h.type === 'workout').reduce((acc, curr) => acc + (curr.metrics?.duration || 0), 0), [history]);

  // Total Training Days Calculation
  const trainingDaysStats = useMemo(() => {
    // 把 workout 和 cardio 都算作训练日
    const workouts = history.filter(h => h.type === 'workout' || h.type === 'cardio');
    const lifetime = new Set(workouts.map(h => h.date)).size;
    const currentYear = new Date().getFullYear().toString();
    const thisYear = new Set(workouts.filter(h => h.date.startsWith(currentYear)).map(h => h.date)).size;

    // 距离上次训练天数（D6）
    let daysSinceLastWorkout: number | null = null;
    let lastWorkoutDate: string | null = null;
    if (workouts.length > 0) {
      const sortedDates = [...new Set(workouts.map(h => h.date))].sort().reverse();
      lastWorkoutDate = sortedDates[0];
      const lastDate = new Date(lastWorkoutDate + 'T00:00:00');
      const today = new Date(getLocalDateString() + 'T00:00:00');
      daysSinceLastWorkout = Math.max(0, Math.floor((today.getTime() - lastDate.getTime()) / 86400000));
    }
    return { lifetime, thisYear, daysSinceLastWorkout, lastWorkoutDate };
  }, [history]);

  // Reward Stats
  const rewardStats = useMemo(() => {
      const total = rewards.reduce((acc, r) => acc + r.count, 0);
      const todayStr = getLocalDateString();
      const currentMonthStr = todayStr.substring(0, 7);
      const lastMonthDate = new Date(); lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
      const lastMonthStr = lastMonthDate.toISOString().substring(0, 7);

      let thisMonth = 0; let lastMonth = 0; let todayCount = 0;
      const historyByMonth: Record<string, number> = {};
      const hourlyDistribution = new Array(24).fill(0);
      
      rewards.forEach(r => {
          const m = r.date.substring(0, 7);
          historyByMonth[m] = (historyByMonth[m] || 0) + r.count;
          if (r.date.startsWith(currentMonthStr)) thisMonth += r.count;
          if (r.date.startsWith(lastMonthStr)) lastMonth += r.count;
          if (r.date === todayStr) todayCount = r.count;
          const h = new Date(r.timestamp).getHours();
          hourlyDistribution[h] += 1;
      });

      let trend = 'stable';
      if (thisMonth > lastMonth) trend = 'up'; else if (thisMonth < lastMonth) trend = 'down';
      
      let streak = 0; let maxStreak = 0;
      const sortedDates = [...new Set(rewards.map(r => r.date))].sort().reverse();
      if (sortedDates.length > 0) {
          const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];
          let currentDateCheck = sortedDates[0] === todayStr ? todayStr : (sortedDates[0] === yesterdayStr ? yesterdayStr : null);
          if (currentDateCheck) {
              streak = 1;
              for (let i = 1; i < sortedDates.length; i++) {
                  const prev = new Date(currentDateCheck); prev.setDate(prev.getDate() - 1);
                  const prevStr = prev.toISOString().split('T')[0];
                  if (sortedDates[i] === prevStr) { streak++; currentDateCheck = prevStr; } else break;
              }
          }
      }
      
      const ascDates = [...new Set(rewards.map(r => r.date))].sort();
      let currentRun = 0;
      if (ascDates.length > 0) {
          currentRun = 1; maxStreak = 1;
          for (let i = 1; i < ascDates.length; i++) {
              const currD = new Date(ascDates[i]); const prevD = new Date(ascDates[i-1]);
              const diffDays = Math.ceil(Math.abs(currD.getTime() - prevD.getTime()) / (1000 * 60 * 60 * 24)); 
              if (diffDays === 1) currentRun++; else currentRun = 1;
              maxStreak = Math.max(maxStreak, currentRun);
          }
      }

      return { total, thisMonth, lastMonth, trend, streak, maxStreak, todayCount, hourlyDistribution, historyByMonth };
  }, [rewards]);

  // Deep Stats
  const deepStats = useMemo(() => {
    const weekStart = getWeekStartString();
    if (history.length === 0) return { hasData: false, maxWeight: 0, maxWeightName: '-', totalTonnage: 0, tonnageAnalogy: '暂无数据', mostActiveWeekday: '-', streak: 0, muscleGroups: {}, durationByGroup: {}, weeklyDuration: 0, weeklyVolume: 0, cardioDuration: 0, topExercises: [] };

    let maxWeight = 0; let maxWeightName = '-'; let totalTonnage = 0; let weeklyDuration = 0; let weeklyVolume = 0; let cardioDurationTotal = 0;
    const weekdayCounts = [0,0,0,0,0,0,0];
    const muscleGroups: Record<string, number> = { '胸部':0, '背部':0, '腿部':0, '肩部':0, '手臂':0, '核心':0, '有氧/爬坡':0, '其他':0 };
    const durationByGroup: Record<string, number> = { '胸部':0, '背部':0, '腿部':0, '肩部':0, '手臂':0, '核心':0, '有氧/爬坡':0, '其他':0 };
    const exerciseFrequency: Record<string, number> = {};

    history.forEach(h => {
        // 独立有氧（爬坡）
        if (h.type === 'cardio') {
            const date = new Date(h.date);
            weekdayCounts[date.getDay()]++;
            const duration = h.metrics?.duration || 0;
            cardioDurationTotal += duration;
            muscleGroups['有氧/爬坡']++;
            durationByGroup['有氧/爬坡'] += duration;
            if (h.date >= weekStart) weeklyDuration += duration;
            return;
        }

        if (h.type === 'workout') {
            const date = new Date(h.date);
            weekdayCounts[date.getDay()]++;
            const duration = h.metrics?.duration || 0;
            if (h.date >= weekStart) { weeklyDuration += duration; if (h.metrics?.volume) weeklyVolume += h.metrics.volume; }

            let primaryGroup = '其他';
            const pName = h.planName?.toLowerCase() || '';
            if (pName.includes('胸') || pName.includes('推') || pName.includes('day a')) primaryGroup = '胸部';
            else if (pName.includes('背') || pName.includes('拉') || pName.includes('day b')) primaryGroup = '背部';
            else if (pName.includes('腿') || pName.includes('蹲') || pName.includes('day c')) primaryGroup = '腿部';
            else if (pName.includes('肩') || pName.includes('day d')) primaryGroup = '肩部';
            else if (pName.includes('臂') || pName.includes('二头') || pName.includes('三头')) primaryGroup = '手臂';

            muscleGroups[primaryGroup]++;
            durationByGroup[primaryGroup] += duration;

            if(h.logs) {
                Object.entries(h.logs).forEach(([exId, sets]) => {
                    let exName = 'Unknown';
                    const currentEx = plans.flatMap(p => p.exercises).find(e => e.id === exId);
                    if (currentEx) exName = currentEx.name; else if (legacyExerciseMap[exId]) exName = legacyExerciseMap[exId];

                    const exTarget = exName; 
                    const isWarmup = exTarget.includes('激活') || exTarget.includes('热身') || exTarget.includes('松解') || exTarget.includes('矫正') || exTarget.includes('每日必做') || exTarget.includes('腹肌') || exTarget.includes('心肺') || exTarget.includes('Hang');

                    if (exName !== 'Unknown' && !isWarmup) {
                        const normalizedName = normalizeExerciseName(exName) || exName;
                        exerciseFrequency[normalizedName] = (exerciseFrequency[normalizedName] || 0) + 1;
                    }

                    if (exTarget) {
                        if (exTarget.includes('胸')) muscleGroups['胸部'] += 0.2;
                        else if (exTarget.includes('背')) muscleGroups['背部'] += 0.2;
                        else if (exTarget.includes('腿') || exTarget.includes('臀')) muscleGroups['腿部'] += 0.2;
                        else if (exTarget.includes('肩')) muscleGroups['肩部'] += 0.2;
                        else if (exTarget.includes('臂') || exTarget.includes('二头') || exTarget.includes('三头')) muscleGroups['手臂'] += 0.2;
                    }

                    sets.forEach(s => {
                        if(s.completed) {
                            const w = parseFloat(s.weight) || 0;
                            const r = parseFloat(s.reps) || 0;
                            if (w > 0) totalTonnage += (w * r);
                            if(w > maxWeight) { maxWeight = w; maxWeightName = exName === 'Unknown' ? '未知动作' : exName; }
                        }
                    });
                });
            }
        }
    });

    Object.keys(muscleGroups).forEach(k => muscleGroups[k] = Math.round(muscleGroups[k]));
    const mostActiveWeekdayIndex = weekdayCounts.indexOf(Math.max(...weekdayCounts));
    const weekdays = ['周日','周一','周二','周三','周四','周五','周六'];
    
    let streak = 0;
    const sortedDates = [...new Set(history.filter(h=>h.type==='workout' || h.type==='cardio').map(h=>h.date))].sort().reverse();
    if(sortedDates.length > 0) {
        const today = getLocalDateString();
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        let currentDateCheck = sortedDates[0] === today ? today : (sortedDates[0] === yesterdayStr ? yesterdayStr : null);
        if(currentDateCheck) {
            streak = 1;
            for(let i=1; i<sortedDates.length; i++) {
                const prev = new Date(currentDateCheck); prev.setDate(prev.getDate() - 1);
                const prevStr = prev.toISOString().split('T')[0];
                if(sortedDates[i] === prevStr) { streak++; currentDateCheck = prevStr; } else break;
            }
        }
    }

    let tonnageAnalogy = totalTonnage === 0 ? '加油开始第一次训练吧！' : totalTonnage < 2000 ? '相当于一辆小汽车 🚗' : totalTonnage < 10000 ? `相当于 ${Math.floor(totalTonnage/4000)} 头成年大象 🐘` : `相当于 ${Math.floor(totalTonnage/40000)} 架波音737 ✈️`;
    const topExercises = Object.entries(exerciseFrequency).sort((a,b) => b[1] - a[1]).slice(0, 5).map(e => ({ name: e[0], count: e[1] }));

    return { hasData: true, maxWeight, maxWeightName, totalTonnage, tonnageAnalogy, mostActiveWeekday: weekdays[mostActiveWeekdayIndex], streak, muscleGroups, durationByGroup, weeklyDuration, weeklyVolume, cardioDuration: cardioDurationTotal, topExercises };
  }, [history, plans, legacyExerciseMap]);

  const allHistoryExercises = useMemo(() => {
      const groups: Record<string, { id: string, name: string }[]> = {};
      const addEx = (cat: string, id: string, name: string) => { if (!groups[cat]) groups[cat] = []; if (!groups[cat].find(e => e.id === id)) groups[cat].push({ id, name }); };
      plans.forEach(p => p.exercises.forEach(e => addEx(e.category, e.id, e.name)));
      history.forEach(h => {
          if (h.logs) Object.keys(h.logs).forEach(exId => {
              let found = false;
              for(const p of plans) { if(p.exercises.find(e=>e.id===exId)) { found = true; break; } }
              if (!found) {
                 const legacyName = legacyExerciseMap[exId];
                 addEx('📦 已归档动作', exId, legacyName || `Archived (${exId.slice(0,4)})`);
              }
          });
      });
      return groups;
  }, [plans, history, legacyExerciseMap]);

  const selectedExStats = useMemo(() => {
      if (!selectedExerciseForChart) return { pr: 0, totalReps: 0, oneRM: null as OneRMResult | null };
      let pr = 0; let totalReps = 0; let bestOneRM: OneRMResult | null = null;
      const targetName = getExerciseNameById(selectedExerciseForChart);
      const targetCore = normalizeExerciseName(targetName);

      history.forEach(h => {
          if (h.logs) Object.keys(h.logs).forEach(logExId => {
              let isMatch = false;
              if (logExId === selectedExerciseForChart) isMatch = true;
              else {
                  const logName = getExerciseNameById(logExId);
                  const logCore = normalizeExerciseName(logName);
                  if (targetCore && logCore && targetCore === logCore) isMatch = true;
              }
              if (isMatch) h.logs[logExId].forEach(s => {
                if (s.completed) {
                  const w = parseFloat(s.weight) || 0;
                  const r = parseFloat(s.reps) || 0;
                  if (w > pr) pr = w;
                  totalReps += r;
                  // 1RM 估算：找历史最高估算值
                  const est = estimateSet(w, r);
                  if (est && (!bestOneRM || est.value > bestOneRM.value)) bestOneRM = est;
                }
              });
          });
      });
      return { pr, totalReps, oneRM: bestOneRM };
  }, [selectedExerciseForChart, history, legacyExerciseMap, plans]);

  // D4: 每个动作的历史最大重量（用于训练中实时 PR 检测）
  // 只统计已 completed 的有效组，且 weight > 0 才算
  const historicalPRs = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    history.forEach(h => {
      if (h.type === 'workout' && h.logs) {
        Object.entries(h.logs).forEach(([exId, sets]) => {
          // 用归一化名做 key，自动合并同类动作（如史密斯卧推 vs 平板卧推）
          const exName = getExerciseNameById(exId);
          const normalized = normalizeExerciseName(exName) || exId;
          sets.forEach(s => {
            if (s.completed) {
              const w = parseFloat(s.weight) || 0;
              if (w > 0 && (!map[normalized] || w > map[normalized])) {
                map[normalized] = w;
              }
            }
          });
        });
      }
    });
    return map;
  }, [history, plans, legacyExerciseMap]);

  // 判断当前组是否刷新历史 PR（重量 > 历史最大）
  const isPRSet = (exId: string, weight: string): boolean => {
    const w = parseFloat(weight) || 0;
    if (w <= 0) return false;
    const exName = getExerciseNameById(exId);
    const normalized = normalizeExerciseName(exName) || exId;
    const historical = historicalPRs[normalized] || 0;
    return w > historical;
  };

  const getExerciseProgressData = (targetExId: string): ChartDataPoint[] => {
      const data: ChartDataPoint[] = [];
      const targetName = getExerciseNameById(targetExId);
      const targetCore = normalizeExerciseName(targetName);

      [...history].reverse().forEach(h => {
          if (h.type === 'workout' && h.logs) {
              let dailyMax = 0; let found = false;
              Object.keys(h.logs).forEach(logExId => {
                  let isMatch = false;
                  if (logExId === targetExId) isMatch = true;
                  else {
                      const logName = getExerciseNameById(logExId);
                      const logCore = normalizeExerciseName(logName);
                      if (targetCore && logCore && targetCore.length > 1 && targetCore === logCore) isMatch = true;
                  }
                  if (isMatch) {
                      const validSets = h.logs[logExId].filter(s => s.completed && parseFloat(s.weight) > 0);
                      if (validSets.length > 0) {
                          const maxW = Math.max(...validSets.map(s => parseFloat(s.weight)));
                          if (maxW > dailyMax) dailyMax = maxW;
                          found = true;
                      }
                  }
              });
              if (found && dailyMax > 0) data.push({ date: h.date.slice(5), value: dailyMax });
          }
      });
      return data;
  };

  useEffect(() => {
      let interval: any;
      if (activeWorkout && workoutStartTime) { interval = setInterval(() => { const now = Date.now(); setElapsedSeconds(Math.floor((now - workoutStartTime) / 1000)); }, 1000); } 
      else setElapsedSeconds(0);
      return () => clearInterval(interval);
  }, [activeWorkout, workoutStartTime]);

  useEffect(() => {
    let interval: any;
    if (isResting && restTimer > 0) { interval = setInterval(() => { setRestTimer((prev) => { if (prev <= 1) { haptics.done(); setIsResting(false); return 0; } return prev - 1; }); }, 1000); }
    else if (restTimer <= 0) setIsResting(false);
    return () => clearInterval(interval);
  }, [isResting, restTimer]);

  useEffect(() => {
      let interval: any;
      if (isManualTimerRunning) { interval = setInterval(() => { setManualTimer(prev => prev + 1); }, 1000); }
      return () => clearInterval(interval);
  }, [isManualTimerRunning]);

  useEffect(() => {
    (async () => {
      // A4: schema 版本检查 + 未来迁移钩子
      runMigrations();

      // A1: 启动时检查关键 key 是否被 iOS 清掉，从 IndexedDB 镜像拉回
      const recovered = await recoverMissingKeys([
        'fitness_history_v6',
        'fitness_plans_v8',
        'fitness_stats_v6',
        'fitness_rewards_v6',
        'fitness_ex_history_v6',
        'fitness_legacy_map_v1',
        'fitness_plan_index_v6',
      ]);
      if (recovered.length > 0) {
        console.log('[storage] recovered from IndexedDB:', recovered);
      }

      const load = (key: string, setter: (val: any) => void) => { const data = localStorage.getItem(key); if (data) { let parsed = superParse(data, []); if (Array.isArray(parsed)) { parsed = parsed.map((item, index) => { if (!item.timestamp) return { ...item, timestamp: Date.now() - (index * 1000) }; return item; }); } setter(parsed); return parsed; } return []; };
      const loadObj = (key: string, setter: (val: any) => void) => { const data = localStorage.getItem(key); if (data) setter(superParse(data, {})); };
      const loadNum = (key: string, setter: (val: any) => void) => { const data = localStorage.getItem(key); if (data) setter(parseIndex(data)); };

      loadNum('fitness_plan_index_v6', setCurrentPlanIndex);
      const loadedHistory = load('fitness_history_v6', setHistory);
      load('fitness_stats_v6', setBodyStats);
      load('fitness_rewards_v6', setRewards);
      loadObj('fitness_ex_history_v6', setExerciseHistory);
    loadObj('fitness_legacy_map_v1', setLegacyExerciseMap);
    
    if (loadedHistory && loadedHistory.length > 0) {
        // 数据迁移：老的 type='workout' + planName 含"有氧/爬坡/跑步" → type='cardio'
        let migrated = false;
        const migratedHistory = loadedHistory.map((h: HistoryItemType) => {
          if (h.type === 'workout' && h.planName && (h.planName.includes('有氧') || h.planName.includes('爬坡') || h.planName.includes('跑步'))) {
            migrated = true;
            return { ...h, type: 'cardio' as const, planName: '爬坡' };
          }
          return h;
        });
        if (migrated) {
          setHistory(migratedHistory);
          localStorage.setItem('fitness_history_v6', JSON.stringify(migratedHistory));
        }

        const sortedHistory = [...migratedHistory].sort((a: HistoryItemType, b: HistoryItemType) => b.timestamp - a.timestamp);
        const lastEntryDateStr = sortedHistory[0].date;
        const todayStr = getLocalDateString();

        if (lastEntryDateStr < todayStr) {
            const newRestDays: HistoryItemType[] = [];
            let curr = new Date(lastEntryDateStr); curr.setDate(curr.getDate() + 1); const today = new Date(todayStr);
            while (curr < today) {
                const dateStr = curr.toISOString().split('T')[0];
                if (!sortedHistory.find((h: any) => h.date === dateStr)) { newRestDays.push({ date: dateStr, timestamp: curr.getTime(), type: 'rest', planName: '自动记录', note: '默认休息' }); }
                curr.setDate(curr.getDate() + 1);
            }
            if (newRestDays.length > 0) { const combined = [...newRestDays.reverse(), ...migratedHistory]; setHistory(combined); localStorage.setItem('fitness_history_v6', JSON.stringify(combined)); }
        }
    }

    const savedPlans = localStorage.getItem('fitness_plans_v8');
    if (savedPlans) { const parsedPlans = superParse(savedPlans, null); if (parsedPlans) setPlans(parsedPlans); else { setPlans(MAIN_PLANS_DEFAULT); localStorage.setItem('fitness_plans_v8', JSON.stringify(MAIN_PLANS_DEFAULT)); } }
    else { setPlans(MAIN_PLANS_DEFAULT); setCurrentPlanIndex(0); localStorage.setItem('fitness_plans_v8', JSON.stringify(MAIN_PLANS_DEFAULT)); localStorage.setItem('fitness_plan_index_v6', '0'); }

    // 状态保活：恢复进行中的训练（如果 PWA 被切后台杀掉重启）
    try {
      const savedActive = localStorage.getItem('fitness_active_workout_v1');
      if (savedActive) {
        const parsed = JSON.parse(savedActive);
        if (parsed && parsed.activeWorkout && parsed.workoutStartTime) {
          // 超过 6 小时没动的训练视为废弃，自动清理
          const ageHours = (Date.now() - parsed.workoutStartTime) / 3600000;
          if (ageHours < 6) {
            setActiveWorkout(parsed.activeWorkout);
            setWorkoutLogs(parsed.workoutLogs || {});
            setWorkoutStartTime(parsed.workoutStartTime);
            setExpandedExId(parsed.expandedExId || null);
            setActiveTab('workout');
          } else {
            localStorage.removeItem('fitness_active_workout_v1');
          }
        }
      }
      } catch (e) { localStorage.removeItem('fitness_active_workout_v1'); }
    })();
  }, []);

  // 状态保活：训练状态变化时自动写盘
  useEffect(() => {
    if (activeWorkout && workoutStartTime) {
      try {
        localStorage.setItem('fitness_active_workout_v1', JSON.stringify({
          activeWorkout,
          workoutLogs,
          workoutStartTime,
          expandedExId,
        }));
      } catch (e) { /* 配额满了忽略，下次再试 */ }
    } else {
      localStorage.removeItem('fitness_active_workout_v1');
    }
  }, [activeWorkout, workoutLogs, workoutStartTime, expandedExId]);

  const saveToLocal = (key: string, data: any) => {
    try { saveWithMirror(key, data); }
    catch (e) { alert("存储空间不足"); }
  };
  const startRestTimer = (seconds = 90) => { setRestTimer(seconds); setIsResting(true); };
  const stopRestTimer = () => { setIsResting(false); setRestTimer(0); };
  const adjustRestTime = (delta: number) => { setRestTimer(prev => Math.max(0, prev + delta)); };

  const startWorkout = () => {
    let currentPlan = plans[currentPlanIndex];
    if (!currentPlan) { if (plans.length > 0) { setCurrentPlanIndex(0); currentPlan = plans[0]; } else { setPlans(MAIN_PLANS_DEFAULT); currentPlan = MAIN_PLANS_DEFAULT[0]; } }
    
    const initialLogs: Record<string, WorkoutSetLog[]> = {};
    if (currentPlan && currentPlan.exercises) {
        currentPlan.exercises.forEach(ex => {
          const lastRecord = exerciseHistory[ex.id];
          initialLogs[ex.id] = Array(ex.sets).fill(null).map(() => ({ weight: lastRecord?.weight || '', reps: '', completed: false }));
        });
    }
    setWorkoutLogs(initialLogs);
    setWorkoutStartTime(Date.now());
    setActiveWorkout(currentPlan);
    setActiveTab('workout');
    setRestTimer(0); setIsResting(false);
    if(currentPlan && currentPlan.exercises && currentPlan.exercises.length > 0) setExpandedExId(currentPlan.exercises[0].id);
  };

  const updateSet = (exId: string, idx: number, field: keyof WorkoutSetLog, val: any) => {
    const newLogs = { ...workoutLogs };
    if (newLogs[exId]) {
        newLogs[exId] = [...newLogs[exId]]; 
        const prevVal = newLogs[exId][idx][field];
        newLogs[exId][idx] = { ...newLogs[exId][idx], [field]: val };
        for (let i = idx + 1; i < newLogs[exId].length; i++) {
             const nextSet = newLogs[exId][i];
             if (!nextSet.completed && (nextSet[field] === '' || nextSet[field] === prevVal)) { newLogs[exId][i] = { ...nextSet, [field]: val }; }
        }
    }
    setWorkoutLogs(newLogs);
  };

  const toggleSetComplete = (exId: string, idx: number) => {
    const newLogs = { ...workoutLogs };
    if (newLogs[exId]) {
        const sets = [...newLogs[exId]]; const currentSet = sets[idx]; const wasCompleted = currentSet.completed; currentSet.completed = !currentSet.completed; sets[idx] = currentSet; newLogs[exId] = sets;
        if (!wasCompleted && currentSet.completed) { haptics.medium(); startRestTimer(90); }
        else haptics.light();
    }
    setWorkoutLogs(newLogs);
  };

  const addSet = (exId: string) => {
      const newLogs = { ...workoutLogs };
      if (newLogs[exId]) { const sets = [...newLogs[exId]]; const lastSet = sets[sets.length - 1]; const newSet: WorkoutSetLog = { weight: lastSet ? lastSet.weight : '', reps: lastSet ? lastSet.reps : '', completed: false }; newLogs[exId] = [...sets, newSet]; }
      setWorkoutLogs(newLogs);
  };
  
  const deleteSet = (exId: string, idx: number) => {
    const newLogs = { ...workoutLogs };
    if (newLogs[exId] && newLogs[exId].length > 1) { newLogs[exId] = newLogs[exId].filter((_, i) => i !== idx); setWorkoutLogs(newLogs); }
  };

  const confirmFinishWorkout = () => {
    stopRestTimer();
    const date = getLocalDateString();
    const endTime = Date.now();
    const durationMinutes = workoutStartTime ? Math.ceil((endTime - workoutStartTime) / 60000) : 0;

    if (summaryData.weight) { const newStats = [{ date, weight: summaryData.weight, timestamp: Date.now() }, ...bodyStats]; setBodyStats(newStats); saveToLocal('fitness_stats_v6', newStats); }

    let totalVolume = 0;
    const newExHistory = { ...exerciseHistory };

    // D5: 收集本次训练里刷新的 PR 列表
    const prs: Array<{ name: string; weight: number; prevPR: number }> = [];

    if (activeWorkout) {
        Object.keys(workoutLogs).forEach(exId => {
        const sets = workoutLogs[exId];
        const exDef = activeWorkout.exercises.find(e => e.id === exId);
        let setVol = 0;
        let exMaxThisSession = 0;
        sets.forEach(s => {
            if (s.completed) {
                const w = parseFloat(s.weight) || 0; const r = parseFloat(s.reps) || 0;
                if (exDef && exDef.unit === 'reps_only') setVol += r; else if (exDef && exDef.unit === 'time') setVol += w; else { if (w > 0 && r > 0) setVol += w * r; }
                if (w > exMaxThisSession) exMaxThisSession = w;
            }
        });
        totalVolume += setVol;
        const lastValidSet = [...sets].reverse().find(s => s.weight && s.completed);
        if (lastValidSet) newExHistory[exId] = { weight: lastValidSet.weight, date };

        // PR 检测：只对负重动作算
        if (exDef && exDef.unit === 'weight_reps' && exMaxThisSession > 0) {
            const exName = exDef.name;
            const normalized = normalizeExerciseName(exName) || exId;
            const prevPR = historicalPRs[normalized] || 0;
            if (exMaxThisSession > prevPR) {
                prs.push({ name: exName, weight: exMaxThisSession, prevPR });
            }
        }
        });

        const newEntry: HistoryItemType = { date, timestamp: Date.now(), type: 'workout', planName: activeWorkout.name, logs: workoutLogs, metrics: { volume: totalVolume, duration: durationMinutes, ...summaryData } };
        let newHistory = [newEntry, ...history];

        // B4: 如果勾选了"今天还做了爬坡"，追加一条关联的 cardio 记录
        if (addCardio && postCardio.duration) {
          const cardioEntry: HistoryItemType = {
            date,
            timestamp: Date.now() + 1, // +1 ms 保证排序在主记录之后
            type: 'cardio',
            planName: '爬坡',
            metrics: {
              duration: parseInt(postCardio.duration),
              incline: postCardio.incline,
              speed: postCardio.speed,
            },
            linkedWorkoutTs: newEntry.timestamp,
          };
          newHistory = [cardioEntry, ...newHistory];
        }

        setHistory(newHistory); setExerciseHistory(newExHistory);
        saveToLocal('fitness_history_v6', newHistory); saveToLocal('fitness_ex_history_v6', newExHistory);

        const nextIndex = (currentPlanIndex + 1) % plans.length;
        setCurrentPlanIndex(nextIndex); saveToLocal('fitness_plan_index_v6', nextIndex.toString());

        setShowSummaryModal(false); setActiveWorkout(null); setWorkoutLogs({}); setSummaryData({ activeCalories: '', avgHeartRate: '', rpe: '5', note: '', weight: '' }); setAddCardio(false); setPostCardio({ duration: '40', incline: '12', speed: '4' }); setActiveTab('home'); setWorkoutStartTime(null);

        haptics.success();
        // 弹出庆祝（替代原 alert），后台静默备份
        setCelebration({ duration: durationMinutes, volume: totalVolume, prs });
        setTimeout(() => { exportData(); }, 500);
    }
  };

  const saveCardioLog = () => {
      if (!cardioData.duration) { alert("请至少填写持续时间"); return; }
      const today = getLocalDateString();
      const date = cardioData.date || today;
      // 修复时间戳：今天用当前时刻，补录历史用那天的 23:59 避免被同日记录顶下去
      const ts = date === today
        ? Date.now()
        : new Date(`${date}T23:59:00`).getTime();
      const newEntry: HistoryItemType = {
        date,
        timestamp: ts,
        type: 'cardio',
        planName: '爬坡',
        metrics: {
          duration: parseInt(cardioData.duration),
          incline: cardioData.incline,
          speed: cardioData.speed,
          distance: cardioData.distance,
          activeCalories: cardioData.activeCalories,
          avgHeartRate: cardioData.avgHeartRate,
          note: cardioData.note,
        },
      };
      const newHistory = [newEntry, ...history].sort((a,b) => b.timestamp - a.timestamp);
      setHistory(newHistory); saveToLocal('fitness_history_v6', newHistory);
      setShowCardioModal(false);
      setCardioData({ date: '', duration: '40', incline: '12', speed: '4', distance: '', activeCalories: '', avgHeartRate: '', note: '' });
      haptics.medium();
  }

  const openRestDayModal = (item?: HistoryItemType) => {
      if (item) { setEditingRestItem(item); setRestDayNote(item.note || item.metrics?.note || ''); setRestDayType(item.type === 'lazy' ? 'lazy' : 'rest'); } 
      else { setEditingRestItem(null); setRestDayNote('今天不想练...'); setRestDayType('lazy'); }
      setShowRestDayModal(true);
  };

  const confirmRestDay = () => {
    if (restDayType === 'lazy' && !editingRestItem) {
        const toxicQuotes = [ "确定要偷懒吗？你的肌肉在哭泣。", "废物才找借口，强者只找方法。", "今天偷懒，明天更胖。", "这就是你和强者的差距。", "休息可以，但别让自己后悔。" ];
        const randomQuote = toxicQuotes[Math.floor(Math.random() * toxicQuotes.length)];
        if (!confirm(`${randomQuote}\n\n确定要记录为【摸鱼日】吗？`)) return;
    }
    const date = getLocalDateString();
    let newHistory;
    if (editingRestItem) { newHistory = history.map(h => h.timestamp === editingRestItem.timestamp ? { ...h, type: restDayType, note: restDayNote } : h); } 
    else { const newItem: HistoryItemType = { date, timestamp: Date.now(), type: restDayType, note: restDayNote }; newHistory = [newItem, ...history]; }
    setHistory(newHistory); saveToLocal('fitness_history_v6', newHistory); setShowRestDayModal(false); setEditingRestItem(null);
  };

  const confirmWeightEntry = () => {
      if (!weightEntryData.weight) return;
      const { date, weight, bodyFat } = weightEntryData;
      const timestamp = new Date(date).getTime() || Date.now();
      const newStats = [{ date, weight, bodyFat, timestamp }, ...bodyStats].sort((a,b) => b.timestamp - a.timestamp);
      setBodyStats(newStats); saveToLocal('fitness_stats_v6', newStats); setShowWeightModal(false); setWeightEntryData({ date: '', weight: '', bodyFat: '' });
  };

  const startRewardFlow = () => { const now = new Date(); setRewardEntryData({ date: getLocalDateString(), time: now.toTimeString().slice(0, 5) }); setShowRewardEntry(true); };

  const confirmLogReward = () => {
    const { date, time } = rewardEntryData; const dateTimeStr = `${date}T${time}:00`; const timestamp = new Date(dateTimeStr).getTime(); if (isNaN(timestamp)) { alert("时间格式有误"); return; }
    const existingIndex = rewards.findIndex(r => r.date === date); let newRewards = [...rewards]; let todayCount = 1;
    if (existingIndex >= 0) { newRewards[existingIndex] = { ...newRewards[existingIndex], count: newRewards[existingIndex].count + 1 }; todayCount = newRewards[existingIndex].count; } 
    else { newRewards = [{ date, count: 1, timestamp }, ...newRewards]; }
    setRewards(newRewards); saveToLocal('fitness_rewards_v6', newRewards); setShowRewardEntry(false);
    const currentMonthStr = date.substring(0, 7);
    const thisMonthCount = newRewards.filter(r => r.date.startsWith(currentMonthStr)).reduce((acc, r) => acc + r.count, 0);
    let streak = 0;
    const sortedDates = [...new Set(newRewards.map(r => r.date))].sort().reverse();
    if (sortedDates.length > 0) {
        const today = getLocalDateString(); const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); const yesterdayStr = yesterday.toISOString().split('T')[0];
        let currentDateCheck = sortedDates[0] === today ? today : (sortedDates[0] === yesterdayStr ? yesterdayStr : null);
        if (currentDateCheck) { streak = 1; for (let i = 1; i < sortedDates.length; i++) { const prev = new Date(currentDateCheck); prev.setDate(prev.getDate() - 1); const prevStr = prev.toISOString().split('T')[0]; if (sortedDates[i] === prevStr) { streak++; currentDateCheck = prevStr; } else { break; } } }
    }
    const timeStr = new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    setRewardModalData({ streak, monthCount: thisMonthCount, time: timeStr, todayCount }); setShowRewardModal(true);
  };

  // D3: 软删除 + 5 秒撤销 toast
  const showUndoToast = (message: string, onUndo: () => void) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoToast({ message, onUndo });
    undoTimerRef.current = setTimeout(() => setUndoToast(null), 5000);
  };

  const executeDelete = () => {
      if (!deleteConfirmItem) return;
      haptics.warning();
      if (deleteConfirmItem.type === 'history') {
          const removed = deleteConfirmItem.data as HistoryItemType;
          const newHistory = history.filter(h => String(h.timestamp) !== String(removed.timestamp));
          setHistory(newHistory); saveToLocal('fitness_history_v6', newHistory);
          showUndoToast('已删除训练记录', () => {
            const restored = [removed, ...newHistory].sort((a,b) => b.timestamp - a.timestamp);
            setHistory(restored); saveToLocal('fitness_history_v6', restored);
          });
      } else if (deleteConfirmItem.type === 'weight') {
          const removed = deleteConfirmItem.data as BodyStat;
          const newStats = bodyStats.filter(s => String(s.timestamp) !== String(removed.timestamp));
          setBodyStats(newStats); saveToLocal('fitness_stats_v6', newStats);
          showUndoToast('已删除体重记录', () => {
            const restored = [removed, ...newStats].sort((a,b) => b.timestamp - a.timestamp);
            setBodyStats(restored); saveToLocal('fitness_stats_v6', restored);
          });
      } else if (deleteConfirmItem.type === 'plan') {
          if (plans.length <= 1) { alert('至少需要保留一个训练计划！'); setDeleteConfirmItem(null); return; }
          const removedIndex = deleteConfirmItem.index!;
          const removed = plans[removedIndex];
          const newPlans = plans.filter((_, i) => i !== removedIndex);
          updatePlans(newPlans); setCurrentPlanIndex(0); saveToLocal('fitness_plan_index_v6', '0');
          showUndoToast(`已删除计划「${removed.name}」`, () => {
            const restored = [...newPlans];
            restored.splice(removedIndex, 0, removed);
            updatePlans(restored);
          });
      }
      setDeleteConfirmItem(null);
  };

  const updatePlans = (newPlans: Plan[]) => { setPlans(newPlans); saveToLocal('fitness_plans_v8', newPlans); };
  const updatePlanName = (pi: number, v: string) => { const np = plans.map((p,i)=>i===pi?{...p,name:v}:p); updatePlans(np); };
  const deleteExercise = (pi: number, eid: string) => { if(!confirm('删除?')) return; const np = plans.map((p,i)=>i===pi?{...p,exercises:p.exercises.filter(e=>e.id!==eid)}:p); updatePlans(np); };
  const addExercise = (pi: number) => { const ex: Exercise={id:`c-${Date.now()}`,category:'🏋️ 新增',name:'新动作',sets:3,defaultReps:'10',unit:'weight_reps',description:'点击编辑'}; const np=plans.map((p,i)=>i===pi?{...p,exercises:[...p.exercises,ex]}:p); updatePlans(np); };
  const updateExercise = (pi: number, ei: number, f: keyof Exercise, v: any) => { const np=plans.map((p,i)=>i===pi?{...p,exercises:p.exercises.map((e,j)=>j===ei?{...e,[f]:v}:e)}:p); updatePlans(np); };
  
  const addNewPlan = () => { const newPlan: Plan = { id: `plan-${Date.now()}`, name: `New Day ${String.fromCharCode(65 + plans.length)}`, exercises: [] }; const newPlans = [...plans, newPlan]; updatePlans(newPlans); };

  const exportData = () => {
      const d = { history, plans, stats: bodyStats, exHistory: exerciseHistory, planIndex: currentPlanIndex, rewards, legacyMap: legacyExerciseMap };
      const b = new Blob([JSON.stringify(d)], {type:'application/json'}); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href=u; a.download=`LaoDaZhuang_${getLocalDateString()}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
      markBackupDone();
  };

  // A3: Gist 同步辅助
  const handleGistSaveToken = () => {
    const t = gistTokenInput.trim();
    if (!t) { setGistMessage({ kind: 'error', text: '请粘贴 Token' }); return; }
    if (!t.startsWith('ghp_') && !t.startsWith('github_pat_')) {
      setGistMessage({ kind: 'error', text: 'Token 格式不对，应以 ghp_ 或 github_pat_ 开头' });
      return;
    }
    gistSync.saveToken(t);
    setGistTokenInput('');
    setGistSettings(gistSync.getSettings());
    setGistMessage({ kind: 'success', text: 'Token 已保存（仅存浏览器本地）' });
  };

  const handleGistPush = async () => {
    setGistBusy('pushing'); setGistMessage(null);
    try {
      const blob = { history, plans, stats: bodyStats, exHistory: exerciseHistory, planIndex: currentPlanIndex, rewards, legacyMap: legacyExerciseMap };
      const { gistId } = await gistSync.pushToGist(blob);
      setGistSettings(gistSync.getSettings());
      markBackupDone();
      setGistMessage({ kind: 'success', text: `已上传到 Gist (${gistId.slice(0, 7)}...)` });
      haptics.success();
    } catch (e: any) {
      setGistMessage({ kind: 'error', text: e.message || '上传失败' });
      haptics.warning();
    } finally { setGistBusy('idle'); }
  };

  const handleGistPull = async () => {
    if (!confirm('从云端拉回会覆盖当前本地数据，确定吗？\n（建议先点"上传到云端"备份当前状态）')) return;
    setGistBusy('pulling'); setGistMessage(null);
    try {
      const blob = await gistSync.pullFromGist();
      gistSync.applyBackupBlob(blob);
      setGistSettings(gistSync.getSettings());
      // 重新加载到 state
      setHistory(blob.history || []);
      setPlans(blob.plans || MAIN_PLANS_DEFAULT);
      setBodyStats(blob.stats || []);
      setExerciseHistory(blob.exHistory || {});
      setCurrentPlanIndex(typeof blob.planIndex === 'number' ? blob.planIndex : 0);
      setRewards(blob.rewards || []);
      setLegacyExerciseMap(blob.legacyMap || {});
      setGistMessage({ kind: 'success', text: '云端数据已恢复' });
      haptics.success();
    } catch (e: any) {
      setGistMessage({ kind: 'error', text: e.message || '拉取失败' });
      haptics.warning();
    } finally { setGistBusy('idle'); }
  };

  const handleGistDisconnect = () => {
    if (!confirm('断开后会清除本地保存的 Token 和 Gist ID，但云端数据保留。继续吗？')) return;
    gistSync.clearSettings();
    setGistSettings(gistSync.getSettings());
    setGistMessage(null);
  };
  
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]; if(!f) return;
      const r = new FileReader();
      r.onload = (ev) => {
          try {
              const d = superParse(ev.target?.result, null); if(!d) throw new Error("Empty");
              let importedHistory: HistoryItemType[] = []; let importedPlans = plans;
              if(d.history) { importedHistory = superParse(d.history, []).map((item: any, index: number) => { if (!item.timestamp) return { ...item, timestamp: Date.now() - (index * 1000) }; return item; }); saveWithMirror('fitness_history_v6', importedHistory); setHistory(importedHistory); }
              if(d.stats) { const parsedStats = superParse(d.stats, []).map((item: any, index: number) => { if (!item.timestamp) return { ...item, timestamp: Date.now() - (index * 1000) }; return item; }); saveWithMirror('fitness_stats_v6', parsedStats); setBodyStats(parsedStats); }
              if (d.rewards) { const parsedRewards = superParse(d.rewards, []).map((item: any, index: number) => { if (!item.timestamp) return { ...item, timestamp: Date.now() - (index * 1000) }; return item; }); saveWithMirror('fitness_rewards_v6', parsedRewards); setRewards(parsedRewards); }
              if(d.exHistory) { const parsedExH = superParse(d.exHistory, {}); saveWithMirror('fitness_ex_history_v6', parsedExH); setExerciseHistory(parsedExH); }

              const extractedLegacyMap = { ...legacyExerciseMap }; let foundLegacy = 0;
              if (d.plans) { const oldPlans: Plan[] = superParse(d.plans, []); oldPlans.forEach(p => { p.exercises.forEach(ex => { if (!extractedLegacyMap[ex.id]) { extractedLegacyMap[ex.id] = ex.name; foundLegacy++; } }); }); }
              if (d.legacyMap) { Object.assign(extractedLegacyMap, d.legacyMap); }
              setLegacyExerciseMap(extractedLegacyMap); saveWithMirror('fitness_legacy_map_v1', extractedLegacyMap);

              if(d.plans) {
                  const shouldOverwrite = window.confirm("检测到备份文件中包含【旧训练计划】。\n\n❓ 是否覆盖当前的【新计划】？\n👉 点击【取消】(Cancel)：保留现在的「新计划」，只恢复历史记录。\n👉 点击【确定】(OK)：恢复备份里的旧计划。");
                  if (shouldOverwrite) { const parsedPlans = superParse(d.plans, []); saveWithMirror('fitness_plans_v8', parsedPlans); importedPlans = parsedPlans; setPlans(importedPlans); }
                  else { saveWithMirror('fitness_plans_v8', plans); }
              }

              if (importedHistory && importedHistory.length > 0) {
                  const lastWorkout = importedHistory.find(h => h.type === 'workout');
                  if (lastWorkout && lastWorkout.planName) {
                      const lastPlanIndex = importedPlans.findIndex(p => p.name === lastWorkout.planName);
                      if (lastPlanIndex !== -1) { const nextIdx = (lastPlanIndex + 1) % importedPlans.length; saveWithMirror('fitness_plan_index_v6', nextIdx); setCurrentPlanIndex(nextIdx); }
                      else { saveWithMirror('fitness_plan_index_v6', 0); setCurrentPlanIndex(0); }
                  }
              }
              alert(`✅ 数据恢复成功！\n已找回 ${foundLegacy} 个旧动作名称，图表将自动合并。`); e.target.value = '';
          } catch(err) { console.error(err); alert('❌ 文件无效'); }
      };
      r.readAsText(f);
  };

  const renderWorkoutDetailModal = () => {
      if (!viewingHistoryItem) return null;
      const { planName, date, metrics, logs } = viewingHistoryItem;
      return (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setViewingHistoryItem(null)}>
              <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-4">
                      <div><h3 className="text-xl font-black text-slate-800 dark:text-white">{planName}</h3><p className="text-xs text-slate-400 font-bold">{date}</p></div>
                      <button onClick={() => setViewingHistoryItem(null)} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"><X size={20}/></button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-6">
                      <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 text-center"><p className="text-[10px] text-slate-400 font-bold uppercase">容量</p><p className="text-lg font-black text-slate-800 dark:text-white">{metrics?.volume ? (metrics.volume/1000).toFixed(1) : 0}<span className="text-xs font-normal text-slate-400">t</span></p></div>
                      <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 text-center"><p className="text-[10px] text-slate-400 font-bold uppercase">时长</p><p className="text-lg font-black text-slate-800 dark:text-white">{metrics?.duration || 0}<span className="text-xs font-normal text-slate-400">m</span></p></div>
                      <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 text-center"><p className="text-[10px] text-slate-400 font-bold uppercase">强度</p><p className="text-lg font-black text-slate-800 dark:text-white">{metrics?.rpe || '-'}</p></div>
                  </div>
                  <div className="space-y-4">
                      {logs ? Object.entries(logs).map(([exId, sets]) => {
                          const exName = getExerciseNameById(exId);
                          // Fix: Allow 0 weight or reps (strings) to pass through
                          const validSets = sets.filter(s => s.completed || (s.weight !== '' && s.weight !== undefined) || (s.reps !== '' && s.reps !== undefined)); 
                          if (validSets.length === 0) return null;
                          return (
                              <div key={exId} className="border-b border-slate-50 dark:border-slate-800 pb-3 last:border-0">
                                  <div className="font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2"><div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>{exName}</div>
                                  <div className="flex flex-wrap gap-2">{validSets.map((s, i) => (<div key={i} className="bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-700"><span className="font-bold text-slate-800 dark:text-slate-200">{s.weight || '-'}</span>kg × <span className="font-bold text-slate-800 dark:text-slate-200">{s.reps || '-'}</span></div>))}</div>
                              </div>
                          )
                      }) : (<div className="text-center text-slate-400 py-4">无详细记录</div>)}
                  </div>
                  {metrics?.note && (<div className="mt-6 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl text-xs text-orange-800 dark:text-orange-200 border border-orange-100 dark:border-orange-900/50 leading-relaxed"><span className="font-bold uppercase opacity-50 block mb-1">心得 / 备注</span>{metrics.note}</div>)}
              </div>
          </div>
      )
  };

  const renderCardioModal = () => {
      if (!showCardioModal) return null;
      return (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setShowCardioModal(false)}>
              <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full"><Footprints size={24}/></div>
                    <div>
                      <h3 className="text-xl font-black text-slate-800">爬坡记录</h3>
                      <p className="text-[10px] text-slate-400 font-bold">Incline Walking</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase">日期</label>
                        <input type="date" value={cardioData.date || getLocalDateString()} onChange={(e) => setCardioData({...cardioData, date: e.target.value})} className="w-full bg-slate-50 p-3 rounded-xl mt-1 font-bold text-slate-800 outline-none focus:ring-2 ring-emerald-100" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase">时长 (分钟) *</label>
                        <input type="text" inputMode="decimal" value={cardioData.duration} onChange={(e) => setCardioData({...cardioData, duration: e.target.value.replace(/[^0-9.]/g, '')})} className="w-full bg-slate-50 p-3 rounded-xl mt-1 text-lg font-bold text-slate-800 outline-none focus:ring-2 ring-emerald-100" placeholder="40" autoFocus />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-bold text-slate-400 uppercase">坡度 (%)</label>
                          <input type="text" inputMode="decimal" value={cardioData.incline} onChange={(e) => setCardioData({...cardioData, incline: e.target.value.replace(/[^0-9.]/g, '')})} className="w-full bg-slate-50 p-3 rounded-xl mt-1 font-bold text-slate-800 outline-none focus:ring-2 ring-emerald-100" placeholder="12" />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-400 uppercase">速度 (km/h)</label>
                          <input type="text" inputMode="decimal" value={cardioData.speed} onChange={(e) => setCardioData({...cardioData, speed: e.target.value.replace(/[^0-9.]/g, '')})} className="w-full bg-slate-50 p-3 rounded-xl mt-1 font-bold text-slate-800 outline-none focus:ring-2 ring-emerald-100" placeholder="4" />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase">距离 (km)</label>
                          <input type="text" inputMode="decimal" value={cardioData.distance} onChange={(e) => setCardioData({...cardioData, distance: e.target.value.replace(/[^0-9.]/g, '')})} className="w-full bg-slate-50 p-3 rounded-xl mt-1 font-bold text-slate-800 outline-none focus:ring-2 ring-emerald-100" placeholder="-" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase">消耗 (Kcal)</label>
                          <input type="text" inputMode="decimal" value={cardioData.activeCalories} onChange={(e) => setCardioData({...cardioData, activeCalories: e.target.value.replace(/[^0-9.]/g, '')})} className="w-full bg-slate-50 p-3 rounded-xl mt-1 font-bold text-slate-800 outline-none focus:ring-2 ring-emerald-100" placeholder="-" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase">心率</label>
                          <input type="text" inputMode="decimal" value={cardioData.avgHeartRate} onChange={(e) => setCardioData({...cardioData, avgHeartRate: e.target.value.replace(/[^0-9.]/g, '')})} className="w-full bg-slate-50 p-3 rounded-xl mt-1 font-bold text-slate-800 outline-none focus:ring-2 ring-emerald-100" placeholder="-" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-400 uppercase">备注</label>
                        <input value={cardioData.note} onChange={(e) => setCardioData({...cardioData, note: e.target.value})} className="w-full bg-slate-50 p-3 rounded-xl mt-1 text-sm font-bold text-slate-800 outline-none focus:ring-2 ring-emerald-100" placeholder="今天感觉怎么样？" />
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <button onClick={() => setShowCardioModal(false)} className="py-3 rounded-xl font-bold text-slate-500 bg-slate-100">取消</button>
                        <button onClick={saveCardioLog} className="py-3 rounded-xl font-bold text-white bg-emerald-500 shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all">保存</button>
                      </div>
                  </div>
              </div>
          </div>
      )
  };

  const renderRestDayModal = () => {
    if (!showRestDayModal) return null;
    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setShowRestDayModal(false)}>
              <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-3 mb-6"><div className={`p-3 rounded-full transition-colors ${restDayType === 'rest' ? 'bg-blue-50 text-blue-500' : 'bg-slate-100 text-slate-500'}`}>{restDayType === 'rest' ? <Coffee size={24}/> : <Ghost size={24}/>}</div><div><h3 className="text-xl font-black text-slate-800">{editingRestItem ? '修改记录' : (restDayType === 'rest' ? '休息日' : '我要请假')}</h3><p className="text-xs text-slate-400 font-bold">{restDayType === 'rest' ? 'Active Recovery' : 'Lazy Mode'}</p></div></div>
                  <div className="space-y-4">
                      <div className="flex p-1 bg-slate-100 rounded-xl"><button onClick={() => setRestDayType('lazy')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${restDayType === 'lazy' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}>偷懒 / 请假</button><button onClick={() => setRestDayType('rest')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${restDayType === 'rest' ? 'bg-white shadow text-blue-500' : 'text-slate-400'}`}>正经休息</button></div>
                      <div><label className="text-xs font-bold text-slate-400 uppercase">心得 / 备注</label><textarea rows={3} value={restDayNote} onChange={(e) => setRestDayNote(e.target.value)} className="w-full bg-slate-50 p-3 rounded-xl mt-1 text-sm font-bold text-slate-800 outline-none focus:ring-2 ring-blue-100 resize-none" placeholder={restDayType === 'lazy' ? "找个借口吧..." : "今天感觉如何？"} autoFocus /></div>
                      <div className="grid grid-cols-2 gap-3 pt-2"><button onClick={() => setShowRestDayModal(false)} className="py-3 rounded-xl font-bold text-slate-500 bg-slate-100">取消</button><button onClick={confirmRestDay} className={`py-3 rounded-xl font-bold text-white shadow-lg transition-all ${restDayType === 'rest' ? 'bg-blue-500 shadow-blue-200 hover:bg-blue-600' : 'bg-slate-800 shadow-slate-300 hover:bg-black'}`}>确认</button></div>
                  </div>
              </div>
          </div>
    );
  };

  const renderTimerModal = () => {
      if (!showTimerModal) return null;
      return (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setShowTimerModal(false)}>
               <div className="bg-white w-full max-w-xs rounded-[2rem] p-8 shadow-2xl animate-in zoom-in-95 flex flex-col items-center" onClick={e => e.stopPropagation()}>
                    <div className="mb-6"><Timer size={48} className="text-orange-500"/></div>
                    <div className="text-6xl font-black text-slate-800 tabular-nums font-mono mb-8 tracking-tighter">{Math.floor(manualTimer / 60).toString().padStart(2, '0')}:{(manualTimer % 60).toString().padStart(2, '0')}</div>
                    <div className="flex gap-4 w-full">
                        {!isManualTimerRunning ? (<button onClick={() => setIsManualTimerRunning(true)} className="flex-1 bg-green-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-green-200 active:scale-95 transition-transform flex justify-center"><Play fill="currentColor"/></button>) : (<button onClick={() => setIsManualTimerRunning(false)} className="flex-1 bg-orange-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-orange-200 active:scale-95 transition-transform flex justify-center"><Pause fill="currentColor"/></button>)}
                        <button onClick={() => { setIsManualTimerRunning(false); setManualTimer(0); }} className="px-6 bg-slate-100 text-slate-500 rounded-2xl font-bold active:scale-95 transition-transform flex justify-center items-center"><RotateCcw size={20}/></button>
                    </div>
                    <button onClick={() => setShowTimerModal(false)} className="mt-6 text-slate-400 text-xs font-bold">关闭计时器</button>
               </div>
          </div>
      )
  };

  const renderWeightModal = () => {
      if (!showWeightModal) return null;
      return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setShowWeightModal(false)}>
            <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                 <div className="flex items-center gap-3 mb-6"><div className="p-3 bg-blue-50 text-blue-600 rounded-full"><Scale size={24}/></div><h3 className="text-xl font-black text-slate-800">记录身体数据</h3></div>
                 <div className="space-y-4">
                     <div><label className="text-xs font-bold text-slate-400 uppercase">日期 & 时间</label><input type="datetime-local" value={weightEntryData.date} onChange={e => setWeightEntryData({...weightEntryData, date: e.target.value})} className="w-full bg-slate-50 p-3 rounded-xl mt-1 font-bold text-slate-800 outline-none focus:ring-2 ring-blue-100"/></div>
                     <div className="grid grid-cols-2 gap-3">
                         <div><label className="text-xs font-bold text-slate-400 uppercase">体重 (KG)</label><input type="text" inputMode="decimal" step="0.1" value={weightEntryData.weight} onChange={e => setWeightEntryData({...weightEntryData, weight: e.target.value})} className="w-full bg-slate-50 p-3 rounded-xl mt-1 text-2xl font-black text-slate-800 outline-none focus:ring-2 ring-blue-100 text-center" placeholder="0.0" autoFocus/></div>
                         <div><label className="text-xs font-bold text-slate-400 uppercase">体脂率 (%) - 选填</label><input type="text" inputMode="decimal" step="0.1" value={weightEntryData.bodyFat} onChange={e => setWeightEntryData({...weightEntryData, bodyFat: e.target.value})} className="w-full bg-slate-50 p-3 rounded-xl mt-1 text-2xl font-black text-slate-800 outline-none focus:ring-2 ring-blue-100 text-center" placeholder="0.0" /></div>
                     </div>
                     <div className="grid grid-cols-2 gap-3 pt-2"><button onClick={() => setShowWeightModal(false)} className="py-3 rounded-xl font-bold text-slate-500 bg-slate-100">取消</button><button onClick={confirmWeightEntry} className="py-3 rounded-xl font-bold text-white bg-blue-500 shadow-lg shadow-blue-200 hover:bg-blue-600 transition-all">保存</button></div>
                 </div>
            </div>
        </div>
      );
  };

  const renderStatsDetailModal = () => {
    if (!statsDetailType) return null;
    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setStatsDetailType(null)}>
             <div className="bg-white w-full max-w-md rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                 <div className="flex items-center justify-between mb-4"><h3 className="text-xl font-black text-slate-800">{statsDetailType === 'tonnage' ? '生涯搬运量分布' : '生涯时长分布'}</h3><button onClick={() => setStatsDetailType(null)} className="p-2 bg-slate-50 rounded-full text-slate-400"><X size={16}/></button></div>
                 {statsDetailType === 'tonnage' ? (
                     <div className="space-y-4">
                         <div className="bg-slate-50 p-4 rounded-2xl text-center"><p className="text-slate-400 text-xs font-bold uppercase mb-1">总计</p><p className="text-3xl font-black text-slate-800">{(deepStats.totalTonnage/1000).toFixed(3)} <span className="text-sm">吨</span></p></div>
                         <div className="space-y-2">{['胸部', '背部', '腿部', '肩部', '手臂', '核心', '有氧/爬坡'].map(k => { const val = deepStats.muscleGroups[k] || 0; if (val === 0) return null; return ( <div key={k} className="flex justify-between items-center p-3 border border-slate-100 rounded-xl"><span className="font-bold text-slate-600">{k}</span><span className="font-bold text-slate-400">{val} 次相关训练</span></div> ) })}<p className="text-[10px] text-slate-400 mt-2">* 搬运量基于有重量记录的动作估算</p></div>
                     </div>
                 ) : (
                    <div className="space-y-4">
                        <div className="bg-blue-50 p-4 rounded-2xl text-center"><p className="text-blue-400 text-xs font-bold uppercase mb-1">总投入</p><p className="text-3xl font-black text-blue-600">{Math.floor(totalDurationMinutes/60)}h {totalDurationMinutes%60}m</p></div>
                        <div className="space-y-2">{['胸部', '背部', '腿部', '肩部', '手臂', '有氧/爬坡', '核心'].map(k => { const duration = deepStats.durationByGroup[k] || 0; if (duration === 0) return null; const h = Math.floor(duration / 60); const m = duration % 60; const percentage = totalDurationMinutes > 0 ? Math.round((duration / totalDurationMinutes) * 100) : 0; return ( <div key={k} className="flex flex-col p-3 border border-slate-100 rounded-xl gap-2"><div className="flex justify-between items-center"><span className="font-bold text-slate-600">{k}</span><span className="font-bold text-slate-800">{h}h {m}m <span className="text-slate-300 ml-1 text-xs">({percentage}%)</span></span></div><div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${percentage}%` }}></div></div></div> ) })}</div>
                    </div>
                 )}
             </div>
        </div>
    )
  }

  // D5: 训练完成庆祝弹窗（替代 alert）
  const renderCelebrationModal = () => {
    if (!celebration) return null;
    const { duration, volume, prs } = celebration;
    return (
      <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setCelebration(null)}>
        <div className="bg-gradient-to-br from-orange-50 via-white to-yellow-50 w-full max-w-sm md:max-w-md rounded-[2rem] p-8 shadow-2xl text-center scale-100 animate-in zoom-in-95 relative overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="absolute top-0 right-0 w-40 h-40 bg-yellow-200 rounded-full blur-3xl opacity-40 -mr-10 -mt-10 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-orange-200 rounded-full blur-3xl opacity-40 -ml-10 -mb-10 pointer-events-none"></div>

          <div className="relative">
            <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl shadow-orange-200 ring-4 ring-white">
              <Flame size={40} fill="currentColor"/>
            </div>
            <h3 className="text-3xl font-black text-slate-800 mb-1">训练完成！</h3>
            <p className="text-slate-400 text-sm font-medium mb-6">辛苦了，明天又是好汉一条 💪</p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">耗时</p>
                <p className="text-2xl font-black text-slate-800">{duration}<span className="text-xs text-slate-400 ml-1">分钟</span></p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">总容量</p>
                <p className="text-2xl font-black text-slate-800">{(volume/1000).toFixed(1)}<span className="text-xs text-slate-400 ml-1">吨</span></p>
              </div>
            </div>

            {prs.length > 0 && (
              <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl p-4 mb-6 border border-yellow-200 text-left">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy size={18} className="text-yellow-600" fill="currentColor"/>
                  <span className="font-black text-yellow-700">恭喜！打破 {prs.length} 个 PR</span>
                </div>
                <div className="space-y-2">
                  {prs.map((pr, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 truncate flex-1 mr-2">{pr.name}</span>
                      <span className="font-mono font-bold text-yellow-600 shrink-0">
                        {pr.weight}kg
                        {pr.prevPR > 0 && <span className="text-slate-300 ml-1">(上次 {pr.prevPR})</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[10px] text-slate-400 mb-4">数据已自动备份到本地</p>
            <button onClick={() => setCelebration(null)} className="w-full py-4 rounded-2xl font-black text-white bg-gradient-to-r from-orange-500 to-red-500 shadow-lg shadow-orange-200 active:scale-95 transition-all">
              收下，继续努力 🔥
            </button>
          </div>
        </div>
      </div>
    );
  };

  // D3: 撤销 toast（5 秒后自动消失）
  const renderUndoToast = () => {
    if (!undoToast) return null;
    return (
      <div className="fixed bottom-24 left-0 right-0 mx-auto w-full max-w-sm px-4 z-[300] animate-in fade-in slide-in-from-bottom-4 mb-safe pointer-events-none">
        <div className="bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-2xl shadow-2xl flex items-center justify-between border border-slate-700/50 ring-1 ring-white/10 pointer-events-auto">
          <div className="flex items-center gap-2 text-sm">
            <Trash2 size={16} className="text-slate-400"/>
            <span className="font-bold">{undoToast.message}</span>
          </div>
          <button
            onClick={() => {
              undoToast.onUndo();
              if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
              setUndoToast(null);
              haptics.light();
            }}
            className="px-3 py-1.5 rounded-lg bg-orange-500 text-white font-black text-xs active:scale-95 transition-all"
          >
            撤销
          </button>
        </div>
      </div>
    );
  };

  const renderRewardAnalysisModal = () => {
    if (!showRewardAnalysis) return null;
    const sortedMonths = Object.keys(rewardStats.historyByMonth).sort().reverse();
    const maxHourVal = Math.max(...rewardStats.hourlyDistribution);
    
    return (
        <div className="fixed inset-0 z-[150] bg-slate-100 dark:bg-slate-900 overflow-y-auto overflow-x-hidden animate-in fade-in" onClick={() => setShowRewardAnalysis(false)}>
            <div className="max-w-md md:max-w-2xl mx-auto min-h-full bg-white dark:bg-slate-950 shadow-2xl p-6 pt-12 pb-safe relative" onClick={e=>e.stopPropagation()}>
                <button onClick={() => setShowRewardAnalysis(false)} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X size={20}/></button>
                <h2 className="text-3xl font-black text-slate-800 mb-1 flex items-center gap-2"><Heart className="text-rose-500 fill-rose-500"/> 愉悦指数报告</h2>
                <p className="text-slate-400 font-bold text-sm mb-8">Detailed Stats & Trends</p>
                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100"><p className="text-xs font-bold text-rose-400 uppercase">今日次数</p><p className="text-3xl font-black text-rose-600">{rewardStats.todayCount}</p></div>
                    <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100"><p className="text-xs font-bold text-orange-400 uppercase">最高连击</p><p className="text-3xl font-black text-orange-500">{rewardStats.maxStreak} <span className="text-sm text-orange-300">天</span></p></div>
                </div>
                <div className="mb-8">
                     <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Clock size={18}/> 24小时分布</h3>
                     <div className="flex items-end gap-1 h-32 border-b border-slate-100 pb-1">{rewardStats.hourlyDistribution.map((val, h) => ( <div key={h} className="flex-1 bg-rose-200 rounded-t-sm relative group hover:bg-rose-500 transition-colors" style={{height: `${(val / (maxHourVal || 1)) * 100}%`}}><div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap z-10 pointer-events-none">{h}点: {val}次</div></div> ))}</div>
                     <div className="flex justify-between text-[10px] text-slate-300 font-mono mt-1"><span>00:00</span><span>12:00</span><span>23:00</span></div>
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Calendar size={18}/> 月度历史</h3>
                    <div className="space-y-2">{sortedMonths.map(m => ( <div key={m} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100"><span className="font-bold text-slate-600 font-mono">{m}</span><div className="flex items-center gap-2"><div className="h-2 bg-rose-200 rounded-full w-24 overflow-hidden"><div className="h-full bg-rose-500" style={{width: `${Math.min(100, (rewardStats.historyByMonth[m] / 30) * 100)}%`}}></div></div><span className="font-black text-slate-800 w-6 text-right">{rewardStats.historyByMonth[m]}</span></div></div> ))}</div>
                </div>
            </div>
        </div>
    )
  }

  const renderRewardEntryModal = () => {
    if (!showRewardEntry) return null;
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setShowRewardEntry(false)}>
            <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-black text-slate-800 mb-1 flex items-center gap-2"><Gift className="text-rose-500"/> 给自己奖励</h3>
                <p className="text-slate-400 text-xs font-bold mb-6">Create a reward record</p>
                <div className="space-y-4">
                     <div><label className="text-xs font-bold text-slate-400 uppercase">日期</label><input type="date" value={rewardEntryData.date} onChange={(e) => setRewardEntryData({...rewardEntryData, date: e.target.value})} className="w-full bg-slate-50 p-3 rounded-xl mt-1 font-bold text-slate-800 outline-none focus:ring-2 ring-rose-100"/></div>
                    <div><label className="text-xs font-bold text-slate-400 uppercase">时间</label><input type="time" value={rewardEntryData.time} onChange={(e) => setRewardEntryData({...rewardEntryData, time: e.target.value})} className="w-full bg-slate-50 p-3 rounded-xl mt-1 font-bold text-slate-800 outline-none focus:ring-2 ring-rose-100"/></div>
                    <div className="grid grid-cols-2 gap-3 pt-2"><button onClick={() => setShowRewardEntry(false)} className="py-3 rounded-xl font-bold text-slate-500 bg-slate-100">取消</button><button onClick={confirmLogReward} className="py-3 rounded-xl font-bold text-white bg-rose-500 shadow-lg shadow-rose-200">确认打卡</button></div>
                </div>
            </div>
        </div>
    )
  };

  const renderRewardModal = () => {
      if (!showRewardModal) return null;
      return (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setShowRewardModal(false)}>
              <div className="bg-gradient-to-br from-rose-50 to-white w-full max-w-sm md:max-w-md rounded-[2rem] p-8 shadow-2xl text-center scale-100 animate-in zoom-in-95 relative overflow-hidden" onClick={e => e.stopPropagation()}>
                   <div className="absolute top-0 right-0 w-32 h-32 bg-rose-200 rounded-full blur-3xl opacity-30 -mr-10 -mt-10 pointer-events-none"></div>
                   <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-100 rounded-full blur-3xl opacity-30 -ml-10 -mb-10 pointer-events-none"></div>
                  <div className="w-20 h-20 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ring-4 ring-white relative"><Sparkles size={36} className="animate-pulse" /><div className="absolute -top-1 -right-1 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">EXP +1</div></div>
                  <h3 className="text-2xl font-black text-rose-600 mb-1">贤者模式开启</h3>
                  <p className="text-slate-400 text-sm font-medium mb-8 flex items-center justify-center gap-1"><Clock size={12}/> 记录时间: {rewardModalData.time}</p>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-sm"><p className="text-xs text-rose-400 font-bold uppercase mb-1">当前连击</p><p className="text-2xl font-black text-slate-800">{rewardModalData.streak} <span className="text-xs text-slate-400">天</span></p></div>
                      <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-sm"><p className="text-xs text-rose-400 font-bold uppercase mb-1">本月累计</p><p className="text-2xl font-black text-slate-800">{rewardModalData.monthCount} <span className="text-xs text-slate-400">次</span></p></div>
                  </div>
                   <div className="bg-white p-3 rounded-2xl border border-rose-100 shadow-sm mb-8"><p className="text-xs text-slate-400 font-bold uppercase mb-1">今日次数</p><p className="text-xl font-black text-slate-800">{rewardModalData.todayCount}</p></div>
                  <button onClick={() => setShowRewardModal(false)} className="w-full py-4 rounded-2xl font-bold text-white bg-rose-500 shadow-lg shadow-rose-200 active:scale-95 transition-all">保持身心愉悦 ❤️</button>
              </div>
          </div>
      )
  };

  const renderDeleteModal = () => {
      if (!deleteConfirmItem) return null;
      const typeMap = { 'weight': '体重记录', 'history': '训练记录', 'plan': '训练计划' };
      const title = typeMap[deleteConfirmItem.type];
      return (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-white w-full max-w-xs md:max-w-md rounded-3xl p-6 shadow-2xl text-center scale-100 animate-in zoom-in-95">
                  <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 size={24}/></div>
                  <h3 className="text-lg font-black text-slate-800 mb-2">确认删除{title}？</h3>
                  <p className="text-sm text-slate-500 mb-6">{deleteConfirmItem.type === 'weight' && `${deleteConfirmItem.data.date}: ${deleteConfirmItem.data.value}kg`}{deleteConfirmItem.type === 'plan' && `"${deleteConfirmItem.data.name}" (包含 ${deleteConfirmItem.data.exercises.length} 个动作)`}{deleteConfirmItem.type === 'history' && '删除后无法恢复。'}</p>
                  <div className="grid grid-cols-2 gap-3"><button onClick={() => setDeleteConfirmItem(null)} className="py-3 rounded-xl font-bold text-slate-500 bg-slate-100">取消</button><button onClick={executeDelete} className="py-3 rounded-xl font-bold text-white bg-red-500 shadow-lg shadow-red-200">删除</button></div>
              </div>
          </div>
      )
  }

  const renderSummaryModal = () => {
    if (!showSummaryModal) return null;
    return (
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
        <div className="bg-white w-full max-w-md md:max-w-lg rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 mb-safe max-h-[90vh] overflow-y-auto">
          <h3 className="text-2xl font-black text-slate-800 mb-1">🎉 训练完成！</h3>
          <p className="text-slate-400 text-sm mb-6">辛苦了，记录一下今天的感受吧。</p>
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><AlertTriangle size={12}/> 今日体重 (选填)</label><div className="flex items-center gap-2 mt-2"><input type="text" inputMode="decimal" placeholder="0.0" value={summaryData.weight} onChange={(e)=>setSummaryData({...summaryData, weight: e.target.value})} className="flex-1 bg-white p-3 rounded-xl text-xl font-black text-slate-800 outline-none focus:ring-2 ring-orange-200 text-center"/><span className="font-bold text-slate-400">KG</span></div><p className="text-[10px] text-slate-400 mt-2 text-center">可稍后在数据分析页补充</p></div>
            <div><label className="text-xs font-bold text-slate-400 uppercase tracking-wider">强度系数 (RPE 1-10)</label><div className="flex items-center gap-4 mt-2"><input type="range" min="1" max="10" step="0.5" value={summaryData.rpe} onChange={(e) => setSummaryData({...summaryData, rpe: e.target.value})} className="flex-1 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-orange-500"/><span className="text-xl font-black text-orange-500 w-8 text-right">{summaryData.rpe}</span></div></div>
            <div><label className="text-[10px] font-bold text-slate-400 uppercase">训练心得 / 备注</label><textarea rows={2} placeholder="今天状态如何？哪里不舒服？" value={summaryData.note} onChange={(e)=>setSummaryData({...summaryData, note: e.target.value})} className="w-full bg-slate-50 p-3 rounded-xl mt-1 text-sm text-slate-800 outline-none focus:ring-2 ring-orange-100 resize-none"/></div>

            {/* B4: 今天还做了爬坡吗 */}
            <div className={`p-4 rounded-2xl border transition-all ${addCardio ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-100'}`}>
              <button
                type="button"
                onClick={() => { setAddCardio(!addCardio); haptics.light(); }}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Mountain size={16} className={addCardio ? 'text-emerald-600' : 'text-slate-400'}/>
                  <span className={`text-sm font-bold ${addCardio ? 'text-emerald-700' : 'text-slate-600'}`}>今天还做了爬坡？</span>
                </div>
                <div className={`w-11 h-6 rounded-full p-0.5 transition-colors ${addCardio ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${addCardio ? 'translate-x-5' : ''}`}/>
                </div>
              </button>
              {addCardio && (
                <div className="grid grid-cols-3 gap-2 mt-3 animate-in fade-in">
                  <div>
                    <label className="text-[10px] font-bold text-emerald-600/70 uppercase">分钟</label>
                    <input type="text" inputMode="decimal" value={postCardio.duration} onChange={(e) => setPostCardio({...postCardio, duration: e.target.value.replace(/[^0-9.]/g, '')})} className="w-full bg-white p-2 rounded-lg mt-1 text-center font-bold text-slate-800 outline-none focus:ring-2 ring-emerald-200" placeholder="40"/>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-emerald-600/70 uppercase">坡度%</label>
                    <input type="text" inputMode="decimal" value={postCardio.incline} onChange={(e) => setPostCardio({...postCardio, incline: e.target.value.replace(/[^0-9.]/g, '')})} className="w-full bg-white p-2 rounded-lg mt-1 text-center font-bold text-slate-800 outline-none focus:ring-2 ring-emerald-200" placeholder="12"/>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-emerald-600/70 uppercase">速度</label>
                    <input type="text" inputMode="decimal" value={postCardio.speed} onChange={(e) => setPostCardio({...postCardio, speed: e.target.value.replace(/[^0-9.]/g, '')})} className="w-full bg-white p-2 rounded-lg mt-1 text-center font-bold text-slate-800 outline-none focus:ring-2 ring-emerald-200" placeholder="4"/>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2"><button onClick={confirmFinishWorkout} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-slate-300 active:scale-95 transition-all flex items-center justify-center gap-2"><Save size={20}/> 保存并自动备份</button><button onClick={() => setShowSummaryModal(false)} className="w-full text-slate-400 text-sm py-3 font-bold mt-1">返回修改</button></div>
          </div>
        </div>
      </div>
    );
  };

  const renderRestTimer = () => {
    if (!isResting && restTimer <= 0) return null;
    return (
        <div className="fixed bottom-36 left-0 right-0 mx-auto w-full max-w-md px-4 z-50 animate-in fade-in slide-in-from-bottom-4 mb-safe">
            <div className="bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-2xl shadow-2xl flex items-center justify-between border border-slate-700/50 ring-1 ring-white/10">
                <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20 relative overflow-hidden shrink-0"><div className="absolute inset-0 bg-white/20 animate-[spin_3s_linear_infinite]"/><Hourglass className="relative z-10 text-white" size={20} /></div><div><div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">休息中</div><div className="text-xl font-black tabular-nums tracking-tight leading-none text-white font-mono">{Math.floor(restTimer / 60).toString().padStart(2, '0')}:{(restTimer % 60).toString().padStart(2, '0')}</div></div></div>
                <div className="flex items-center gap-1.5"><button onClick={() => adjustRestTime(30)} className="h-9 px-3 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-xs hover:bg-slate-700 active:scale-95 transition-all text-slate-300 ring-1 ring-white/5 whitespace-nowrap">+30</button><button onClick={() => adjustRestTime(-10)} className="h-9 px-3 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-xs hover:bg-slate-700 active:scale-95 transition-all text-slate-300 ring-1 ring-white/5 whitespace-nowrap">-10</button><button onClick={stopRestTimer} className="w-9 h-9 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-red-500/20 hover:border-red-500 border border-transparent transition-all flex items-center justify-center active:scale-95 ring-1 ring-white/5 ml-1"><X size={16} /></button></div>
            </div>
        </div>
    )
  }

  const renderWorkoutView = () => {
    if (!activeWorkout) return null;
    return (
      <div className="pb-32 animate-in pt-safe">
        <div className="bg-white px-4 py-3 border-b border-slate-100 flex justify-between items-center sticky top-0 z-40 shadow-sm pt-safe">
          <div><h2 className="font-black text-lg text-slate-800">{activeWorkout.name}</h2><div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5"><span>{getLocalDateString()}</span><span className="bg-orange-50 text-orange-500 px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><Timer size={10}/> {formatTime(elapsedSeconds)}</span></div></div>
          <div className="flex items-center gap-2"><button onClick={() => { setManualTimer(0); setIsManualTimerRunning(false); setShowTimerModal(true); }} className="p-2 bg-slate-50 rounded-full text-orange-500 hover:bg-orange-100 transition-colors"><Timer size={20}/></button><button onClick={() => { if(confirm('确定要放弃本次训练吗？')) { setActiveWorkout(null); setActiveTab('home'); } }} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-red-500 transition-colors"><X size={20} /></button></div>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeWorkout.exercises.map((ex) => {
            const isExpanded = expandedExId === ex.id;
            const logs = workoutLogs[ex.id] || [];
            const lastRecord = exerciseHistory[ex.id];
            const isRelaxation = ex.category.includes('松解') || ex.category.includes('放松') || ex.name.includes('按摩') || ex.category.includes('激活');
            return (
              <div key={ex.id} className={`bg-white rounded-3xl border transition-all duration-300 overflow-hidden ${isExpanded ? 'border-orange-200 shadow-lg shadow-orange-100' : 'border-slate-100 shadow-sm'}`}>
                <div onClick={() => setExpandedExId(isExpanded ? null : ex.id)} className="p-5 flex items-center justify-between cursor-pointer bg-white z-10 relative">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${logs.every(l=>l.completed) ? 'bg-green-500 text-white' : 'bg-slate-50 text-slate-400'}`}>{logs.every(l=>l.completed) ? <CheckCircle2 size={20} /> : <Activity size={20} />}</div>
                    <div><h3 className="font-bold text-slate-800 text-lg leading-tight">{ex.name}</h3><p className="text-xs text-slate-400 mt-1">{logs.length}组 (计划{ex.sets}) × {ex.defaultReps} {ex.unit === 'time' ? '秒' : ex.unit === 'reps_only' ? '次' : ''}</p></div>
                  </div>
                  <div className="text-slate-300">{isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</div>
                </div>
                {isExpanded && (
                  <div className="px-5 pb-6 bg-slate-50/50 border-t border-slate-50">
                    <div className="py-4 mb-2">
                       <div className="text-xs text-slate-500 leading-relaxed whitespace-pre-wrap bg-orange-50 p-3 rounded-xl border border-orange-100 mb-3">💡 <span className="font-bold">动作要领：</span><br/>{ex.description}</div>
                       {lastRecord && <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 bg-slate-100 inline-block px-2 py-1 rounded-md"><Clock size={10}/> 上次成绩: {lastRecord.weight}KG ({lastRecord.date.slice(5)})</div>}
                    </div>
                    <div className="flex text-[10px] font-bold text-slate-400 px-2 mb-1 text-center"><div className="w-12">组</div><div className="flex-1">{ex.unit === 'reps_only' ? '无需负重' : (ex.unit === 'time' ? '时长(分)' : '重量(kg)')}</div><div className="flex-1">{ex.unit === 'time' ? (isRelaxation ? '无需记录' : '强度/速度') : '次数'}</div><div className="w-10">打勾</div></div>
                    <div className="space-y-2">
                      {logs.map((set, idx) => {
                        const showPR = set.completed && ex.unit === 'weight_reps' && isPRSet(ex.id, set.weight);
                        return (
                        <div key={idx} className={`flex items-center gap-2 p-2 rounded-xl transition-colors ${showPR ? 'bg-yellow-50 border border-yellow-200 ring-1 ring-yellow-300/50 animate-pr-flash' : set.completed ? 'bg-green-50 border border-green-100' : 'bg-white border border-slate-100'}`}>
                          <div className="w-12 flex items-center justify-center gap-1">
                            {logs.length > 1 ? (<button onClick={() => deleteSet(ex.id, idx)} className="text-slate-200 hover:text-red-500 p-1"><X size={12}/></button>) : <span className="w-4"></span>}
                            <span className={`font-bold text-sm w-3 text-center ${showPR ? 'text-yellow-600' : 'text-slate-300'}`}>{idx + 1}</span>
                          </div>
                          <SmartInput placeholder={ex.unit === 'reps_only' ? '-' : (lastRecord?.weight || '0')} value={set.weight} onChange={(v) => updateSet(ex.id, idx, 'weight', v)} step={ex.unit === 'time' ? 1 : 2.5} disabled={ex.unit === 'reps_only'} />
                          <SmartInput placeholder={ex.defaultReps} value={set.reps} onChange={(v) => updateSet(ex.id, idx, 'reps', v)} disabled={isRelaxation && ex.unit === 'time'} />
                          <button onClick={() => toggleSetComplete(ex.id, idx)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 ${showPR ? 'bg-yellow-500 text-white shadow-lg shadow-yellow-200' : set.completed ? 'bg-green-500 text-white shadow-lg shadow-green-200' : 'bg-slate-100 text-slate-300 hover:bg-slate-200'}`} title={showPR ? '🏆 新 PR！' : ''}>
                            {showPR ? <Trophy size={18} fill="currentColor"/> : <CheckCircle2 size={20} />}
                          </button>
                        </div>
                        );
                      })}
                    </div>
                    <button onClick={() => addSet(ex.id)} className="w-full mt-3 py-2 flex items-center justify-center gap-2 text-xs font-bold text-slate-400 bg-white border border-dashed border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"><PlusCircle size={14}/> 增加一组</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {renderRestTimer()}
        <div className="fixed bottom-0 left-0 right-0 mx-auto w-full md:max-w-3xl lg:max-w-5xl p-4 bg-white/90 backdrop-blur-lg border-t border-slate-100 safe-bottom z-30 pb-safe">
          <button onClick={() => setShowSummaryModal(true)} className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-black text-lg py-4 rounded-2xl shadow-xl shadow-orange-500/30 active:scale-95 transition-transform flex items-center justify-center gap-2 mb-safe"><Flame fill="currentColor" /> 完成训练</button>
        </div>
        {renderSummaryModal()}
      </div>
    );
  };

  const renderHomeView = () => {
    const next = plans[currentPlanIndex] || plans[0] || MAIN_PLANS_DEFAULT[0];
    if (history.length === 0) {
        return (
            <div className="space-y-6 animate-in p-4 pb-28 min-h-[80vh] flex flex-col justify-center items-center text-center">
                <div className="bg-white w-full p-8 rounded-3xl shadow-xl border-2 border-dashed border-slate-200 flex flex-col items-center gap-4">
                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 animate-bounce"><Upload size={40} /></div>
                    <div><h2 className="text-2xl font-black text-slate-800 mb-1">欢迎回来！</h2><p className="text-slate-400 text-sm">检测到暂无记录，请上传之前的备份文件。</p></div>
                    <button onClick={() => fileRef.current?.click()} className="w-full bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-200 active:scale-95 transition-all mt-2">📂 选择备份文件 (.json)</button>
                    <button onClick={() => { setHistory([{ date: getLocalDateString(), timestamp: Date.now(), type: 'rest', note: '新开始' }]); }} className="text-slate-400 text-xs font-bold">我是新用户，直接开始</button>
                </div>
                <input type="file" ref={fileRef} style={{display:'none'}} accept=".json" onChange={handleFileImport} />
            </div>
        )
    }
    return (
      <div className="space-y-6 animate-in p-4 pb-32 relative" onClick={() => setShowPlanSelector(false)}>
        <div className="flex items-center justify-between px-2">
            <div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-0.5">Welcome Back</p>
              <h2 className="text-xl font-black text-slate-800">
                {(() => {
                  const d = trainingDaysStats.daysSinceLastWorkout;
                  if (d === null) return 'Ready to crush it?';
                  if (d === 0) return '今天已训练，干得漂亮 💪';
                  if (d === 1) return '昨天刚练，继续保持 🔥';
                  if (d <= 3) return `已休息 ${d} 天，准备好了吗？`;
                  if (d <= 7) return `${d} 天没练了，肌肉在等你 🦾`;
                  return `🥲 ${d} 天没练了，今天重新开始`;
                })()}
              </h2>
            </div>
        </div>
        <div className="flex items-center gap-3 px-2 mb-2">
             <div className="flex-1 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3 relative overflow-hidden"><div className="p-2 bg-orange-50 text-orange-500 rounded-xl relative z-10"><Calendar size={20}/></div><div className="relative z-10"><p className="text-[10px] font-bold text-slate-400 uppercase">今年累计</p><p className="text-xl font-black text-slate-800">{trainingDaysStats.thisYear} <span className="text-xs font-bold text-slate-300">天</span></p></div><Calendar className="absolute -right-2 -bottom-2 text-orange-500 opacity-5 w-16 h-16" /></div>
             <div className="flex-1 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3 relative overflow-hidden"><div className="p-2 bg-blue-50 text-blue-500 rounded-xl relative z-10"><Trophy size={20}/></div><div className="relative z-10"><p className="text-[10px] font-bold text-slate-400 uppercase">生涯总计</p><p className="text-xl font-black text-slate-800">{trainingDaysStats.lifetime} <span className="text-xs font-bold text-slate-300">天</span></p></div><Trophy className="absolute -right-2 -bottom-2 text-blue-500 opacity-5 w-16 h-16" /></div>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl p-6 text-white shadow-xl shadow-orange-500/30 relative min-h-[260px] flex flex-col justify-between">
          <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
            <Dumbbell className="absolute -right-4 -bottom-8 text-white/10 w-48 h-48 -rotate-12 pointer-events-none" strokeWidth={1} />
          </div>
          <div className="relative z-20 flex justify-between items-start">
             <div className="flex items-center gap-2 mb-2"><button onClick={() => fileRef.current?.click()} className="bg-white/20 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 hover:bg-white/30 transition-colors"><FileDown size={12}/> 恢复备份</button></div>
             <div className="relative">
                 <button onClick={(e) => { e.stopPropagation(); setShowPlanSelector(!showPlanSelector); }} className="flex items-center gap-1 bg-white/20 hover:bg-white/30 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold transition-colors"><Repeat size={12} /> 切换计划</button>
                 {showPlanSelector && (
                   <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden py-2 z-50 animate-in fade-in zoom-in-95 origin-top-right max-h-[70vh] overflow-y-auto">
                     {plans.map((p, idx) => {
                       const mainExercises = p.exercises.filter(e => e.category.includes('力量') || e.category.includes('🏋️'));
                       const isCurrent = idx === currentPlanIndex;
                       return (
                         <button
                           key={p.id}
                           onClick={() => { setCurrentPlanIndex(idx); localStorage.setItem('fitness_plan_index_v6', idx.toString()); setShowPlanSelector(false); haptics.light(); }}
                           className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 ${isCurrent ? 'bg-orange-50/50' : ''}`}
                         >
                           <div className="flex justify-between items-center mb-1">
                             <span className={`font-bold text-sm ${isCurrent ? 'text-orange-500' : 'text-slate-700'}`}>{p.name}</span>
                             {isCurrent && <CheckCircle2 size={14} className="text-orange-500"/>}
                           </div>
                           {mainExercises.length > 0 && (
                             <div className="text-[10px] text-slate-400 leading-relaxed">
                               {mainExercises.slice(0, 4).map(e => e.name).join(' · ')}
                               {mainExercises.length > 4 && ` +${mainExercises.length - 4}`}
                             </div>
                           )}
                         </button>
                       );
                     })}
                   </div>
                 )}
             </div>
          </div>
          <div className="relative z-10"><div className="flex items-center gap-1 mb-1 opacity-80"><Zap size={12} fill="currentColor"/> Next Workout</div><h2 className="text-4xl font-black italic leading-none tracking-tight">{next.name.split(':')[0]}</h2><p className="text-orange-100 text-lg font-medium mt-1 opacity-90">{next.name.split(':')[1] || '训练计划'}</p></div>
          <div className="relative z-10 flex flex-col gap-3 mt-4">
             <button onClick={startWorkout} className="w-full bg-white text-orange-600 p-4 rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"><span className="text-lg font-black">开始执行</span> <ChevronRight className="w-6 h-6" /></button>
             <button onClick={() => setShowCardioModal(true)} className="w-full bg-emerald-500/20 text-white ring-1 ring-white/20 p-3 rounded-2xl backdrop-blur-sm transition-all active:scale-95 flex items-center justify-center gap-2 hover:bg-emerald-500/30"><Footprints size={18} /> <span className="text-sm font-bold">记录有氧 / 爬坡</span></button>
             <div className="flex gap-3"><button onClick={() => openRestDayModal()} className="flex-1 flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 p-3 rounded-2xl backdrop-blur-sm transition-all active:scale-95 text-white"><Ghost className="w-5 h-5" /> <span className="text-sm font-bold">我要请假</span></button><button onClick={startRewardFlow} className="flex-1 flex items-center justify-center gap-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-100 p-3 rounded-2xl backdrop-blur-sm transition-all active:scale-95 ring-1 ring-white/10 shadow-sm" title="给自己个奖励"><Gift className="w-5 h-5" /> <span className="text-sm font-bold">给自己奖励</span></button></div>
          </div>
        </div>
        {/* A2: 7 天没备份的黄色提醒横幅 */}
        {!backupBannerDismissed && history.length > 0 && daysSinceLastBackup() >= 7 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex items-start gap-3 animate-in">
            <div className="w-9 h-9 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center shrink-0">
              <AlertTriangle size={18}/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-yellow-800">建议导出一次备份</p>
              <p className="text-xs text-yellow-700/80 mt-0.5 leading-relaxed">
                {(() => {
                  const d = daysSinceLastBackup();
                  return d === Infinity
                    ? '检测到你从未导出过备份。iOS 长时间不打开 PWA 可能清掉本地数据。'
                    : `已经 ${d} 天没备份了。建议存到 iCloud Drive，换设备或卸载也能恢复。`;
                })()}
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => { exportData(); setBackupBannerDismissed(true); haptics.medium(); }}
                  className="px-3 py-1.5 rounded-lg bg-yellow-500 text-white text-xs font-bold active:scale-95 transition-all flex items-center gap-1"
                >
                  <Download size={12}/> 立即备份
                </button>
                <button
                  onClick={() => setBackupBannerDismissed(true)}
                  className="px-3 py-1.5 rounded-lg bg-white/80 text-yellow-700 text-xs font-bold active:scale-95 transition-all"
                >
                  稍后再说
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="px-1">
           <div className="flex items-center justify-between mb-4"><h3 className="text-slate-800 font-bold text-lg">最近记录</h3><button onClick={()=>setActiveTab('stats')} className="text-orange-500 text-xs font-bold bg-orange-50 dark:bg-orange-900/20 px-3 py-1.5 rounded-full">查看全部</button></div>
           {history.length === 0 ? (<div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50"><Activity className="mx-auto mb-2 opacity-20" size={32}/><p className="text-sm">暂无记录，今天是个开始的好日子！</p></div>) : (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{history.slice(0,6).map((h,i) => <HistoryItem key={h.timestamp || i} item={h} onDelete={setDeleteConfirmItem} onEdit={(item) => item.type === 'workout' ? setViewingHistoryItem(item) : openRestDayModal(item)} />)}</div>)}
        </div>
        <input type="file" ref={fileRef} style={{display:'none'}} accept=".json" onChange={handleFileImport} />
      </div>
    );
  };

  const renderStatsView = () => {
     const selectedLogs = selectedDate ? (heatmapMode === 'workout' ? history.filter(h => h.date === selectedDate) : rewards.filter(r => r.date === selectedDate).map(r => ({ date: r.date, timestamp: r.timestamp, type: 'rest', planName: '奖励时刻', metrics: { note: `记录时间: ${new Date(r.timestamp).toLocaleTimeString('zh-CN', {hour:'2-digit', minute:'2-digit'})}` } } as HistoryItemType))) : [];
     const muscleKeys = Object.keys(deepStats.muscleGroups); const totalMusclePoints = muscleKeys.reduce((acc, k) => acc + deepStats.muscleGroups[k], 0) || 1;
     const sortedMuscles = muscleKeys.map(k => ({ name: k, val: deepStats.muscleGroups[k], color: k.includes('有氧') ? 'bg-emerald-500' : k.includes('腿') ? 'bg-orange-500' : k.includes('背') ? 'bg-blue-500' : 'bg-slate-400' })).filter(x => x.val > 0).sort((a,b) => b.val - a.val);
     const selectedExData = selectedExerciseForChart ? getExerciseProgressData(selectedExerciseForChart) : [];
     
     return (
       <div className="flex flex-col h-full animate-in">
         <div className="px-6 py-4 pb-2 shrink-0">
             <div className="flex items-center justify-between mb-4"><h2 className="text-2xl font-black text-slate-800 tracking-tight">数据中心</h2><div className="bg-slate-100 p-1 rounded-xl flex gap-1"><button onClick={() => setStatsTab('overview')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statsTab==='overview'?'bg-white text-slate-800 shadow-sm':'text-slate-400'}`}>总览</button><button onClick={() => setStatsTab('analysis')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statsTab==='analysis'?'bg-white text-slate-800 shadow-sm':'text-slate-400'}`}>分析</button><button onClick={() => setStatsTab('calendar')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statsTab==='calendar'?'bg-white text-slate-800 shadow-sm':'text-slate-400'}`}>日历</button></div></div>
         </div>
         <div className="flex-1 px-4 pb-32 space-y-6">
            {statsTab === 'overview' && (
                <div className="animate-in pb-4 grid grid-cols-2 gap-4">
                     <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-5 rounded-3xl text-white shadow-xl shadow-indigo-500/10 col-span-2 relative overflow-hidden"><div className="relative z-10 flex justify-between items-end"><div><div className="flex items-center gap-2 text-indigo-200 text-[10px] font-bold uppercase tracking-wider mb-2"><CalendarCheck size={12}/> 本周概况 (Mon-Sun)</div><div className="text-3xl font-black mb-1">{Math.floor(deepStats.weeklyDuration/60)}<span className="text-sm text-indigo-200 font-medium">h</span> {deepStats.weeklyDuration%60}<span className="text-sm text-indigo-200 font-medium">m</span></div><div className="text-[10px] text-indigo-200 font-medium">本周投入时间</div></div><div className="text-right"><div className="text-xl font-black mb-1">{(deepStats.weeklyVolume/1000).toFixed(1)} <span className="text-sm text-indigo-200 font-medium">吨</span></div><div className="text-[10px] text-indigo-200 font-medium">本周容量</div></div></div><Calendar className="absolute -right-4 -bottom-8 text-white opacity-10 w-32 h-32 rotate-12" /></div>
                    <div onClick={() => setStatsDetailType('tonnage')} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group cursor-pointer active:scale-95 transition-transform"><div className="relative z-10"><div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2"><Scale size={12}/> 生涯总搬运量</div><div className="text-xl font-black text-slate-800 mb-1">{(deepStats.totalTonnage/1000).toFixed(1)} <span className="text-sm text-slate-400 font-medium">吨</span></div><div className="text-[10px] text-slate-400 font-medium line-clamp-1">{deepStats.tonnageAnalogy}</div></div></div>
                    <div onClick={() => setStatsDetailType('duration')} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group cursor-pointer active:scale-95 transition-transform"><div className="relative z-10"><div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2"><Hourglass size={12}/> 生涯总时长</div><div className="text-xl font-black text-slate-800 mb-1">{Math.floor(totalDurationMinutes/60)}<span className="text-sm text-slate-400 font-medium">h</span> {totalDurationMinutes%60}<span className="text-sm text-slate-400 font-medium">m</span></div><div className="text-[10px] text-slate-400 font-medium">含 {Math.floor(deepStats.cardioDuration/60)}h 有氧</div></div></div>
                    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-center col-span-2"><div className="flex justify-between items-center mb-3"><div className="flex items-center gap-2"><span className="p-1.5 bg-green-50 text-green-500 rounded-lg"><PieChart size={14}/></span><span className="text-xs font-bold text-slate-800">训练偏好分布</span></div></div><div className="flex h-3 w-full rounded-full overflow-hidden bg-slate-100">{sortedMuscles.map((m,i) => (<div key={i} style={{width: `${(m.val/totalMusclePoints)*100}%`}} className={m.color}></div>))}</div><div className="flex flex-wrap gap-2 mt-4">{sortedMuscles.map((m,i) => (<div key={i} className="flex items-center gap-1.5 text-[10px] text-slate-600 font-bold bg-slate-50 px-2 py-1 rounded-lg border border-slate-100"><div className={`w-2 h-2 rounded-full ${m.color}`}></div>{m.name} <span className="text-slate-400">({Math.round((m.val/totalMusclePoints)*100)}%)</span></div>))}</div></div>
                     <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm col-span-2"><div className="flex items-center gap-2 mb-3"><span className="p-1.5 bg-yellow-50 text-yellow-500 rounded-lg"><Trophy size={14}/></span><span className="text-xs font-bold text-slate-800">最常练动作 Top 5</span></div><div className="space-y-2">{deepStats.topExercises.map((ex, i) => (<div key={i} className="flex justify-between items-center text-xs font-medium"><span className="text-slate-600 flex items-center gap-2"><span className="w-4 text-slate-300 font-bold">{i+1}</span> {ex.name}</span><span className="text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">{ex.count} 次</span></div>))}{deepStats.topExercises.length === 0 && <span className="text-xs text-slate-300">暂无足够数据</span>}</div></div>
                    <div className="bg-white p-5 rounded-3xl border border-rose-100 shadow-sm relative overflow-hidden cursor-pointer active:scale-98 transition-transform col-span-2" onClick={() => setShowRewardAnalysis(true)}><div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 rounded-full -mr-10 -mt-10 blur-2xl opacity-50 pointer-events-none"></div><div className="flex items-center justify-between mb-4 relative z-10"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 shadow-sm border border-rose-100"><Heart size={20} fill="currentColor" className="opacity-90"/></div><div><h4 className="font-bold text-slate-800 text-sm">身心愉悦指数</h4><p className="text-[10px] text-rose-400 font-bold flex items-center gap-1">查看详情 <ChevronRight size={10}/></p></div></div>{rewardStats.trend === 'up' ? (<div className="px-2 py-1 bg-green-50 text-green-600 rounded-lg text-xs font-bold flex items-center gap-1"><TrendingUp size={12}/> 趋势上升</div>) : rewardStats.trend === 'down' ? (<div className="px-2 py-1 bg-orange-50 text-orange-500 rounded-lg text-xs font-bold flex items-center gap-1"><TrendingDown size={12}/> 趋势下降</div>) : (<div className="px-2 py-1 bg-slate-50 text-slate-400 rounded-lg text-xs font-bold flex items-center gap-1"><Minus size={12}/> 趋势平稳</div>)}</div><div className="grid grid-cols-2 gap-4 mb-4 relative z-10"><div><p className="text-[10px] text-slate-400 font-bold mb-0.5">历史总计</p><p className="text-2xl font-black text-slate-800">{rewardStats.total}</p></div><div><p className="text-[10px] text-slate-400 font-bold mb-0.5">本月累计</p><div className="flex items-end gap-1"><p className="text-2xl font-black text-slate-800">{rewardStats.thisMonth}</p><span className="text-[10px] text-slate-400 mb-1">(上月 {rewardStats.lastMonth})</span></div></div></div></div>
                </div>
            )}
            {statsTab === 'analysis' && (
                <div className="space-y-6 animate-in md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
                    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden"><div className="flex items-center justify-between mb-2"><div className="flex items-center gap-3"><div className="p-2 bg-blue-50 rounded-full text-blue-500"><PersonStanding size={20}/></div><h3 className="font-bold text-slate-800">体重变化趋势</h3></div><button onClick={() => { setWeightEntryData({ date: getLocalDateString().replace(' ','T'), weight: '', bodyFat: '' }); setShowWeightModal(true); }} className="p-2 bg-slate-100 rounded-full text-blue-500 hover:bg-blue-100"><Plus size={18}/></button></div>
                    {bodyStats[0]?.bodyFat && <div className="text-xs font-bold text-slate-400 mb-4 px-1">最新体脂: <span className="text-blue-500">{bodyStats[0].bodyFat}%</span></div>}
                    <SimpleLineChart data={weightDataRecent} color="#3b82f6" suffix="kg" title="Current Weight" /><div className="mt-4 pt-4 border-t border-slate-50 flex gap-2"><input type="text" inputMode="decimal" className="flex-1 bg-slate-50 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 ring-blue-100" placeholder="快速记录今日体重..." onBlur={e=>{if(e.target.value){const ns=[{date:getLocalDateString(),weight:e.target.value, timestamp: Date.now()},...bodyStats];setBodyStats(ns);saveToLocal('fitness_stats_v6',ns);e.target.value='';}}} /></div></div>
                    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden"><div className="flex items-center gap-3 mb-6"><div className="p-2 bg-orange-50 rounded-full text-orange-500"><BarChart3 size={20}/></div><h3 className="font-bold text-slate-800">训练容量趋势</h3></div><SimpleLineChart data={volumeDataRecent} color="#f97316" suffix="" title="Total Volume" /><p className="text-[10px] text-slate-400 text-center mt-4">容量 = 重量 × 次数 (反映训练总量)</p></div>
                    {/* E3: 体重 vs 容量 叠图（最近 30 天） */}
                    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden md:col-span-2">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-purple-50 rounded-full text-purple-500"><Link2 size={20}/></div>
                        <div>
                          <h3 className="font-bold text-slate-800">体重 × 容量 关联</h3>
                          <p className="text-[10px] text-slate-400">最近 30 天 · 看减脂期容量是不是同时在涨</p>
                        </div>
                      </div>
                      <DualLineChart
                        primary={dualChartData.weight}
                        secondary={dualChartData.volume}
                        primaryColor="#3b82f6"
                        secondaryColor="#f97316"
                        primaryLabel="体重"
                        secondaryLabel="容量"
                        primarySuffix="kg"
                        secondarySuffix="t"
                        height={220}
                      />
                    </div>
                    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden min-h-[400px] md:col-span-2"><div className="flex items-center gap-3 mb-4"><div className="p-2 bg-purple-50 rounded-full text-purple-500"><TrendingUp size={20}/></div><h3 className="font-bold text-slate-800">动作力量曲线</h3></div><div className="mb-6 relative"><select className="w-full p-4 pr-10 bg-slate-50 rounded-2xl font-bold text-slate-700 outline-none border border-slate-100 appearance-none text-sm shadow-sm focus:ring-2 ring-purple-100 transition-all" onChange={(e) => setSelectedExerciseForChart(e.target.value)} value={selectedExerciseForChart || ''}><option value="">-- 选择动作查看进步 --</option>{Object.entries(allHistoryExercises).map(([category, exercises]) => (<optgroup label={category} key={category}>{exercises.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}</optgroup>))}</select><ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16}/></div>{selectedExerciseForChart ? (<div className="animate-in"><SimpleLineChart data={selectedExData} color="#8b5cf6" suffix="kg" title="Max Weight" height={220} /><div className="grid grid-cols-2 gap-3 mt-6"><div className="bg-purple-50 p-3 rounded-2xl"><p className="text-[10px] font-bold text-purple-400 uppercase">历史最佳 (PR)</p><p className="text-xl font-black text-purple-600">{selectedExStats.pr} <span className="text-xs">kg</span></p></div><div className="bg-slate-50 p-3 rounded-2xl"><p className="text-[10px] font-bold text-slate-400 uppercase">累计次数</p><p className="text-xl font-black text-slate-600">{selectedExStats.totalReps} <span className="text-xs">reps</span></p></div></div>{selectedExStats.oneRM && (<div className="mt-3 bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200 p-4 rounded-2xl"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Trophy size={14} className="text-yellow-600"/><p className="text-[10px] font-bold text-yellow-700 uppercase">估算 1RM</p></div><p className="text-2xl font-black text-yellow-700">{selectedExStats.oneRM.value.toFixed(1)} <span className="text-xs font-bold">kg</span></p></div><p className="text-[10px] text-slate-500 mt-1">基于 {selectedExStats.oneRM.basis.weight}kg × {selectedExStats.oneRM.basis.reps} 次（{selectedExStats.oneRM.formula === 'direct' ? '直接' : selectedExStats.oneRM.formula === 'avg' ? 'Epley+Brzycki 平均' : selectedExStats.oneRM.formula === 'epley' ? 'Epley' : 'Brzycki'} 公式估算）</p></div>)}<div className="flex items-center gap-2 mt-4 text-[10px] text-slate-400 bg-slate-50 p-2 rounded-lg justify-center"><Link2 size={12}/> 已自动合并同类动作历史（如：史密斯卧推 + 平板卧推）</div></div>) : (<div className="flex flex-col items-center justify-center py-12 text-slate-300 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50"><TrendingUp size={40} className="mb-2 opacity-50"/><p className="text-xs font-bold">请选择一个动作</p></div>)}</div>
                </div>
            )}
            {statsTab === 'calendar' && (
                 <div className="space-y-6 animate-in md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
                     <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm"><div className="flex items-center justify-between mb-4 px-1"><h3 className="font-bold text-slate-800">热力图</h3><div className="bg-slate-100 p-0.5 rounded-lg flex text-[10px] font-bold"><button onClick={() => setHeatmapMode('workout')} className={`px-3 py-1.5 rounded-md transition-all ${heatmapMode === 'workout' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}>训练</button><button onClick={() => setHeatmapMode('reward')} className={`px-3 py-1.5 rounded-md transition-all ${heatmapMode === 'reward' ? 'bg-white shadow-sm text-rose-500' : 'text-slate-400'}`}>奖励</button></div></div><CalendarHeatmap history={history} rewards={rewards} dataType={heatmapMode} onSelectDate={setSelectedDate} /></div>
                     <div className="space-y-3">
                       <div className="flex items-center justify-between px-1">
                         <h3 className="font-bold text-slate-800">近期动态</h3>
                         <span className="text-[10px] font-bold text-slate-400">共 {history.length} 条</span>
                       </div>

                       {/* D8: 搜索 + 类型筛选 */}
                       <div className="bg-white rounded-2xl border border-slate-100 p-3 space-y-2 shadow-sm">
                         <input
                           type="text"
                           value={historyQuery}
                           onChange={(e) => setHistoryQuery(e.target.value)}
                           placeholder="搜索动作名 / 计划名 / 备注"
                           className="w-full bg-slate-50 px-3 py-2 rounded-lg text-xs font-medium outline-none focus:ring-2 ring-orange-100 border border-slate-100"
                         />
                         <div className="flex gap-1">
                           {([
                             ['all', '全部', 'text-slate-700'],
                             ['workout', '力量', 'text-orange-500'],
                             ['cardio', '爬坡', 'text-emerald-500'],
                             ['rest', '休息', 'text-blue-500'],
                           ] as const).map(([key, label, cls]) => (
                             <button
                               key={key}
                               onClick={() => setHistoryFilter(key)}
                               className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all ${historyFilter === key ? `bg-slate-900 text-white shadow-sm` : `bg-slate-50 ${cls} hover:bg-slate-100`}`}
                             >
                               {label}
                             </button>
                           ))}
                         </div>
                       </div>

                       {(() => {
                         const q = historyQuery.trim().toLowerCase();
                         const filtered = history.filter(h => {
                           if (historyFilter === 'workout' && h.type !== 'workout') return false;
                           if (historyFilter === 'cardio' && h.type !== 'cardio') return false;
                           if (historyFilter === 'rest' && h.type !== 'rest' && h.type !== 'lazy') return false;
                           if (!q) return true;
                           if ((h.planName || '').toLowerCase().includes(q)) return true;
                           if ((h.note || '').toLowerCase().includes(q)) return true;
                           if ((h.metrics?.note || '').toLowerCase().includes(q)) return true;
                           if (h.logs) {
                             for (const exId of Object.keys(h.logs)) {
                               const exName = getExerciseNameById(exId).toLowerCase();
                               if (exName.includes(q)) return true;
                             }
                           }
                           return false;
                         });
                         if (filtered.length === 0) {
                           return <p className="text-center text-slate-400 text-sm py-8">{history.length === 0 ? '暂无记录' : '没有匹配的记录'}</p>;
                         }
                         return filtered.slice(0, 30).map((h, i) => (
                           <HistoryItem key={h.timestamp || i} item={h} onDelete={setDeleteConfirmItem} onEdit={(item) => item.type === 'workout' ? setViewingHistoryItem(item) : openRestDayModal(item)} />
                         ));
                       })()}
                     </div>
                 </div>
            )}
         </div>
         {selectedDate && (
             <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in" onClick={() => setSelectedDate(null)}>
                <div className="bg-white w-full max-w-md md:max-w-xl rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 mb-safe" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-slate-800 text-lg">{selectedDate} 的记录</h3><button onClick={() => setSelectedDate(null)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X size={16}/></button></div>
                    {selectedLogs.length > 0 ? (<div className="space-y-3 max-h-[60vh] overflow-y-auto">{selectedLogs.map((h, i) => (heatmapMode === 'reward' ? (<div key={i} className="bg-rose-50 p-4 rounded-2xl flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center"><Gift size={20}/></div><div><div className="font-bold text-slate-800">给自己奖励</div><div className="text-xs text-rose-400">{h.metrics?.note}</div></div></div></div>) : (<HistoryItem key={h.timestamp || i} item={h} onDelete={setDeleteConfirmItem} onEdit={(item) => item.type === 'workout' ? setViewingHistoryItem(item) : openRestDayModal(item)} />)))}</div>) : (<div className="text-center py-8 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">这一天没有记录哦</div>)}
                </div>
             </div>
         )}
       </div>
     );
  };

  const renderSettingsView = () => (
      <div className="p-4 pb-32 animate-in">
          <div className="flex items-center gap-3 mb-8">{editingPlanId!==null && <button onClick={()=>setEditingPlanId(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><ArrowLeft size={24}/></button>}<h2 className="text-3xl font-black text-slate-800">{editingPlanId!==null?'编辑计划':'设置 & 备份'}</h2></div>
          {editingPlanId===null ? (
            <div className="space-y-6">
                <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0"><div className="flex justify-between items-center px-1 md:col-span-2"><h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">训练计划管理</h3><button onClick={() => { if(confirm('确认将计划重置为最新的默认计划吗？\n（你的历史记录和体重数据【不会】丢失）')) { updatePlans(MAIN_PLANS_DEFAULT); alert('✅ 计划已更新！'); } }} className="text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded-lg flex items-center gap-1"><RefreshCw size={10}/> 重置/更新计划</button></div>{plans.map((plan, idx) => (<div key={plan.id} className="bg-white p-5 rounded-2xl border border-slate-100 flex justify-between items-center active:scale-[0.98] transition-all shadow-sm"><div onClick={() => setEditingPlanId(idx)} className="flex-1 cursor-pointer"><h3 className="font-bold text-lg text-slate-800">{plan.name}</h3><p className="text-sm text-slate-400 mt-1">{plan.exercises.length} 个动作</p></div><div className="flex items-center gap-2"><button onClick={() => setEditingPlanId(idx)} className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:text-orange-500 hover:bg-orange-50"><Edit3 size={18} /></button><button onClick={() => setDeleteConfirmItem({ type: 'plan', data: plan, index: idx })} className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={18} /></button></div></div>))}<button onClick={addNewPlan} className="w-full py-4 border-2 border-dashed border-slate-300 rounded-2xl text-slate-400 font-bold hover:bg-slate-50 hover:text-slate-500 hover:border-slate-400 flex items-center justify-center gap-2 transition-all md:col-span-2"><PlusCircle size={20} /> 新建训练日</button></div>
                <div className="pt-8 border-t border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-4">数据安全</h3>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <button onClick={exportData} className="flex items-center justify-center gap-2 p-4 bg-blue-50 text-blue-600 rounded-2xl font-bold hover:bg-blue-100 transition-colors active:scale-95"><Download size={20}/> 备份数据</button>
                    <button onClick={() => fileRef.current?.click()} className="flex items-center justify-center gap-2 p-4 bg-green-50 text-green-600 rounded-2xl font-bold hover:bg-green-100 transition-colors active:scale-95"><Upload size={20}/> 恢复数据</button>
                    <input type="file" ref={fileRef} style={{display:'none'}} accept=".json" onChange={handleFileImport} />
                  </div>

                  {/* A3: GitHub Gist 跨设备同步 */}
                  <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-4 shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center"><Cloud size={18}/></div>
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm">GitHub Gist 同步</h4>
                          <p className="text-[10px] text-slate-400">跨设备 · 私有 · 免费</p>
                        </div>
                      </div>
                      {gistSettings.token && (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">已配置</span>
                      )}
                    </div>

                    {!gistSettings.token ? (
                      <div className="space-y-3">
                        <p className="text-xs text-slate-500 leading-relaxed">
                          创建一个只勾 <code className="px-1 py-0.5 bg-slate-100 rounded text-[10px]">gist</code> 权限的 Personal Access Token：
                          <a href="https://github.com/settings/tokens?type=beta" target="_blank" rel="noopener" className="text-orange-500 ml-1 underline">前往 GitHub 创建</a>
                        </p>
                        <div className="relative">
                          <input
                            type={showToken ? 'text' : 'password'}
                            value={gistTokenInput}
                            onChange={(e) => setGistTokenInput(e.target.value)}
                            placeholder="ghp_... 或 github_pat_..."
                            className="w-full bg-slate-50 p-3 pr-10 rounded-xl text-xs font-mono outline-none focus:ring-2 ring-orange-100 border border-slate-100"
                            autoComplete="off"
                            spellCheck={false}
                          />
                          <button
                            type="button"
                            onClick={() => setShowToken(!showToken)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600"
                          >
                            {showToken ? <EyeOff size={14}/> : <Eye size={14}/>}
                          </button>
                        </div>
                        <button onClick={handleGistSaveToken} className="w-full py-3 rounded-xl bg-slate-900 text-white text-sm font-bold active:scale-95 transition-all">
                          保存 Token
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="text-[10px] text-slate-400 space-y-1">
                          {gistSettings.gistId && <div>Gist ID: <span className="font-mono text-slate-600">{gistSettings.gistId.slice(0, 12)}...</span></div>}
                          {gistSettings.lastSyncTs && <div>上次同步: {new Date(gistSettings.lastSyncTs).toLocaleString('zh-CN')}</div>}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={handleGistPush}
                            disabled={gistBusy !== 'idle'}
                            className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-blue-50 text-blue-600 text-xs font-bold disabled:opacity-50 active:scale-95 transition-all"
                          >
                            <CloudUpload size={14}/> {gistBusy === 'pushing' ? '上传中...' : '上传到云端'}
                          </button>
                          <button
                            onClick={handleGistPull}
                            disabled={gistBusy !== 'idle' || !gistSettings.gistId}
                            className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-emerald-50 text-emerald-600 text-xs font-bold disabled:opacity-50 active:scale-95 transition-all"
                          >
                            <CloudDownload size={14}/> {gistBusy === 'pulling' ? '拉取中...' : '从云端恢复'}
                          </button>
                        </div>
                        <button onClick={handleGistDisconnect} className="w-full text-[10px] text-slate-400 hover:text-red-500 py-1 transition-colors">
                          断开连接
                        </button>
                      </div>
                    )}

                    {gistMessage && (
                      <div className={`mt-3 px-3 py-2 rounded-lg text-xs font-bold ${gistMessage.kind === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                        {gistMessage.text}
                      </div>
                    )}
                  </div>

                  <button onClick={() => { if(window.confirm('确定要清空所有历史记录吗？此操作不可恢复！')) { localStorage.clear(); window.location.reload(); } }} className="w-full py-4 text-red-400 font-bold text-sm hover:bg-red-50 rounded-xl transition-colors">⚠ 重置所有数据</button>
                </div>
            </div>
          ) : (
             <div className="space-y-4 pb-20"><div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm"><label className="text-xs font-bold text-slate-400 block mb-2 uppercase tracking-wider">计划名称</label><input value={plans[editingPlanId].name} onChange={(e) => updatePlanName(editingPlanId, e.target.value)} className="w-full text-xl font-black bg-transparent border-b-2 border-slate-100 pb-2 outline-none focus:border-orange-500 transition-colors" /></div><div className="md:grid md:grid-cols-2 md:gap-4 space-y-4 md:space-y-0">{plans[editingPlanId].exercises.map((ex, exIdx) => (<div key={ex.id} className="bg-white p-5 rounded-2xl border border-slate-100 relative group shadow-sm"><button onClick={() => deleteExercise(editingPlanId, ex.id)} className="absolute top-3 right-3 p-2 text-slate-300 hover:text-red-500 transition-colors"><X size={18}/></button><div className="grid grid-cols-12 gap-3 items-end"><div className="col-span-12 mb-2"><label className="text-[10px] font-bold text-slate-400 uppercase">动作名称</label><input value={ex.name} onChange={(e) => updateExercise(editingPlanId, exIdx, 'name', e.target.value)} className="w-full font-bold text-slate-800 bg-slate-50 p-3 rounded-xl mt-1 focus:ring-2 ring-orange-100 outline-none" /></div><div className="col-span-4"><label className="text-[10px] font-bold text-slate-400 uppercase">组数</label><input type="text" inputMode="decimal" value={ex.sets} onChange={(e) => updateExercise(editingPlanId, exIdx, 'sets', parseInt(e.target.value))} className="w-full bg-slate-50 p-2 rounded-lg text-center font-bold" /></div><div className="col-span-4"><label className="text-[10px] font-bold text-slate-400 uppercase">目标</label><input value={ex.defaultReps} onChange={(e) => updateExercise(editingPlanId, exIdx, 'defaultReps', e.target.value)} className="w-full bg-slate-50 p-2 rounded-lg text-center font-bold" /></div><div className="col-span-4"><label className="text-[10px] font-bold text-slate-400 uppercase">类型</label><select value={ex.unit} onChange={(e) => updateExercise(editingPlanId, exIdx, 'unit', e.target.value)} className="w-full bg-slate-50 p-2 rounded-lg text-xs font-bold appearance-none text-center"><option value="weight_reps">负重</option><option value="reps_only">自重</option><option value="time">计时</option></select></div></div></div>))}</div><button onClick={() => addExercise(editingPlanId)} className="w-full py-4 border-2 border-dashed border-slate-300 rounded-2xl text-slate-400 font-bold hover:bg-slate-50 hover:text-slate-500 hover:border-slate-400 flex items-center justify-center gap-2 transition-all"><Plus size={20} /> 添加动作</button></div>
          )}
      </div>
  );

  return (
    <div className="fixed inset-0 w-full md:max-w-3xl lg:max-w-5xl mx-auto h-full bg-slate-50 dark:bg-slate-950 flex flex-col font-sans overflow-hidden selection:bg-orange-100">
      {activeTab !== 'workout' && (
          <header className="bg-white/90 backdrop-blur-md border-b border-slate-100 sticky top-0 z-40 pt-safe px-4 h-[calc(env(safe-area-inset-top)+50px)] flex items-center shadow-sm">
             <h1 className="font-black text-xl italic tracking-tighter text-slate-800"><span className="text-orange-500">劳大壮</span>养成记</h1>
          </header>
       )}
      <main className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar overscroll-y-none">
        {activeTab === 'home' && renderHomeView()}
        {activeTab === 'workout' && renderWorkoutView()}
        {activeTab === 'stats' && renderStatsView()}
        {activeTab === 'settings' && renderSettingsView()}
      </main>
      {renderDeleteModal()}
      {renderRewardEntryModal()}
      {renderRewardModal()}
      {renderRewardAnalysisModal()}
      {renderCardioModal()}
      {renderRestDayModal()}
      {renderWeightModal()}
      {renderStatsDetailModal()}
      {renderTimerModal()}
      {renderWorkoutDetailModal()}
      {renderCelebrationModal()}
      {renderUndoToast()}
      {activeTab !== 'workout' && <nav className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 fixed bottom-0 w-full md:max-w-3xl lg:max-w-5xl left-0 right-0 mx-auto flex justify-around py-4 pb-6 z-20 shadow-[0_-5px_10px_rgba(0,0,0,0.02)] pb-safe">
          <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'home' ? 'text-orange-500' : 'text-slate-400'}`}><Activity size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} /></button>
          <button onClick={() => setActiveTab('stats')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'stats' ? 'text-orange-500' : 'text-slate-400'}`}><BarChart3 size={24} strokeWidth={activeTab === 'stats' ? 2.5 : 2} /></button>
          <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'settings' ? 'text-orange-500' : 'text-slate-400'}`}><Settings size={24} strokeWidth={activeTab === 'settings' ? 2.5 : 2} /></button>
        </nav>}
    </div>
  );
}
