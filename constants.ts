
import { Plan, Exercise } from './types';

// Phase 1: Daily Warmup & Spine Activation (Every workout starts here)
const PHASE_1_WARMUP: Exercise[] = [
  { 
    id: 'wu-hang', 
    category: '🛡️ 每日必做·脊柱激活', 
    name: '全悬垂减压 (Full Hang)', 
    sets: 3, 
    defaultReps: '45', 
    unit: 'time', 
    target: '脊柱', 
    description: '【要领】双手抓牢最高横杆，双脚完全离地，让重力自然拉开腰椎间隙。\n【铁律】落回地面必须极其缓慢，严禁直接跳下冲击椎间盘。' 
  },
  { 
    id: 'wu-side', 
    category: '🛡️ 每日必做·脊柱激活', 
    name: '右侧开放呼吸 (Side Opening)', 
    sets: 2, 
    defaultReps: '10', 
    unit: 'reps_only', 
    target: '呼吸/肋骨', 
    description: '【要领】坐姿向左侧弯（打开右侧），右手越过头顶向左延伸，深吸气撑开右侧受压区域。' 
  },
  { 
    id: 'wu-bug', 
    category: '🛡️ 每日必做·脊柱激活', 
    name: '核心死虫式 (Dead Bug)', 
    sets: 3, 
    defaultReps: '12', 
    unit: 'reps_only', 
    target: '核心', 
    description: '【要领】仰卧，核心压死地面，腰部严禁有缝隙。手脚交替缓慢下放。' 
  }
];

// Phase 3: Abs & Cardio (Appended to the end of every workout)
const PHASE_3_FINISHER: Exercise[] = [
  { 
    id: 'fin-legraise', 
    category: '🧘 腹肌与心肺', 
    name: '垂直悬垂举腿', 
    sets: 3, 
    defaultReps: '15', 
    unit: 'reps_only', 
    target: '腹肌', 
    description: '仅做“正中间抬”，利用悬挂感同时拉伸腰椎。' 
  },
  { 
    id: 'fin-plank', 
    category: '🧘 腹肌与心肺', 
    name: '左侧平板支撑', 
    sets: 3, 
    defaultReps: '45', 
    unit: 'time', 
    target: '左侧核心', 
    description: '只做左侧，强迫左侧肌肉收缩以回正脊柱。' 
  },
  { 
    id: 'fin-cardio', 
    category: '🧘 腹肌与心肺', 
    name: '跑步机爬坡', 
    sets: 1, 
    defaultReps: '40', 
    unit: 'time', 
    target: '心肺', 
    description: '坡度 12，速度 3.5-4.5。\n【铁律】双手离开扶手，利用核心维持动态平衡。' 
  }
];

export const MAIN_PLANS_DEFAULT: Plan[] = [
  { 
    id: 'new-day-A', 
    name: 'Day A: 上肢推 (胸肩三)', 
    exercises: [
      ...PHASE_1_WARMUP,
      { id: 'na-1', category: '🏋️ 力量主课', name: '史密斯平地卧推', sets: 4, defaultReps: '10', unit: 'weight_reps', target: '胸大肌', description: '沉肩收腹，感受胸大肌发力。严禁腰部大幅起桥。' },
      { id: 'na-2', category: '🏋️ 力量主课', name: '史密斯斜上推胸', sets: 3, defaultReps: '12', unit: 'weight_reps', target: '上胸', description: '椅背调至 75-80°（非垂直），减少脊柱轴向压力。' },
      { id: 'na-3', category: '🏋️ 力量主课', name: '绳索高位夹胸', sets: 3, defaultReps: '15', unit: 'weight_reps', target: '胸中缝', description: '身体微前倾，双手在胸前正下方合拢，极致挤压中缝。' },
      { id: 'na-4', category: '🏋️ 力量主课', name: '绳索单臂侧平举', sets: 4, defaultReps: '15', unit: 'weight_reps', target: '肩中束', description: '方案 A：双手扶稳立柱，核心锁死。' },
      { id: 'na-5', category: '🏋️ 力量主课', name: '绳索前平举', sets: 3, defaultReps: '12', unit: 'weight_reps', target: '肩前束', description: '背对滑轮，手从体侧向上划弧，补全肩前束。' },
      { id: 'na-6', category: '🏋️ 力量主课', name: '绳索 V 柄下压', sets: 3, defaultReps: '15', unit: 'weight_reps', target: '三头肌', description: '锁死肘关节。针对三头肌外侧头。' },
      { id: 'na-7', category: '🏋️ 力量主课', name: '基础帕拉夫推', sets: 4, defaultReps: '15', unit: 'weight_reps', target: '核心抗旋', description: '侧向站立，对抗滑轮拉力，手向前推时停留 2 秒。' },
      ...PHASE_3_FINISHER
    ] 
  },
  { 
    id: 'new-day-B', 
    name: 'Day B: 上肢拉 (背二头)', 
    exercises: [
      ...PHASE_1_WARMUP,
      { id: 'nb-1', category: '🏋️ 力量主课', name: '宽距高位下拉', sets: 4, defaultReps: '12', unit: 'weight_reps', target: '背阔肌', description: '挺胸，由背部发力。避免耸肩。' },
      { id: 'nb-2', category: '🏋️ 力量主课', name: '坐姿绳索划船', sets: 4, defaultReps: '12', unit: 'weight_reps', target: '背部厚度', description: '躯干锁死，不要随重量前后晃动，保护腰椎。' },
      { id: 'nb-3', category: '🏋️ 力量主课', name: '[核心] 单臂跪姿下拉', sets: 3, defaultReps: '12', unit: 'weight_reps', target: '背部/侧腰', description: '左挤右拉： 左侧充分收缩，右手向上时彻底拉伸右腰。' },
      { id: 'nb-4', category: '🏋️ 力量主课', name: '绳索面拉 (Face Pull)', sets: 4, defaultReps: '20', unit: 'weight_reps', target: '后肩/肩袖', description: '滑轮对齐额头。拇指朝后拉开，纠正扣肩。' },
      { id: 'nb-5', category: '🏋️ 力量主课', name: '绳索俯身飞鸟', sets: 3, defaultReps: '15', unit: 'weight_reps', target: '后肩', description: '交叉绳索，大鹏展翅。针对肩后束细节。' },
      { id: 'nb-6', category: '🏋️ 力量主课', name: '史密斯反向划船', sets: 3, defaultReps: '10', unit: 'reps_only', target: '背部', description: '杠铃调至腹部高度，仰卧拉起。对腰椎零载荷。' },
      { id: 'nb-7', category: '🏋️ 力量主课', name: '绳索弯举', sets: 3, defaultReps: '12', unit: 'weight_reps', target: '二头肌', description: '核心锁死，手臂不要前后摆动，针对二头。' },
      ...PHASE_3_FINISHER
    ] 
  },
  { 
    id: 'new-day-C', 
    name: 'Day C: 下肢全能', 
    exercises: [
      ...PHASE_1_WARMUP,
      { id: 'nc-1', category: '🏋️ 力量主课', name: '史密斯前置足深蹲', sets: 4, defaultReps: '12', unit: 'weight_reps', target: '股四头肌', description: '双脚前移 30-50cm。背部垂直下蹲，保护腰椎不超伸。' },
      { id: 'nc-2', category: '🏋️ 力量主课', name: '史密斯相扑深蹲', sets: 3, defaultReps: '12', unit: 'weight_reps', target: '内收肌/臀', description: '强化男性功能：站距宽，脚尖朝外。深度激活盆底肌与内收肌。感受骨盆区域张力。' },
      { id: 'nc-3', category: '🏋️ 力量主课', name: '史密斯后撤步箭步蹲', sets: 3, defaultReps: '12', unit: 'weight_reps', target: '臀腿', description: '单腿动作自动矫正骨盆倾斜，增加动作平衡感。' },
      { id: 'nc-4', category: '🏋️ 力量主课', name: '绳索胯下臀拉', sets: 3, defaultReps: '15', unit: 'weight_reps', target: '后侧链', description: '腰椎零载荷： 专注髋关节铰链，练出强壮后侧链。' },
      { id: 'nc-5', category: '🏋️ 力量主课', name: '绳索腿外展/内收', sets: 4, defaultReps: '15', unit: 'weight_reps', target: '臀中肌/内收', description: '方案 A：双手死死扶住框架，抵消腰部侧向力矩。' },
      { id: 'nc-6', category: '🏋️ 力量主课', name: '史密斯/哑铃臀推', sets: 4, defaultReps: '15', unit: 'weight_reps', target: '臀部', description: '坐在地板上，背靠软垫。专注臀部，不要过度挺腰。' },
      { id: 'nc-7', category: '🏋️ 力量主课', name: '进阶帕拉夫推 (画圈)', sets: 4, defaultReps: '15', unit: 'weight_reps', target: '深层核心', description: '推至顶峰时做微小圆圈。极度强化深层核心稳定性。' },
      ...PHASE_3_FINISHER
    ] 
  }
];
