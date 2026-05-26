# 劳大壮 Fitness 重构方案 (Spec)

> 起草日期：2026-05-20
> 范围：原 Google AI Studio 版 → 本仓库（React 19 + Vite 6 + TS）的全量重构与增量功能。
> 目标：解决"切回应用就重新加载"的痛点，把 1054 行的 `App.tsx` 拆成可维护模块，并补齐缺失能力（PWA 离线、自定义动作库、1RM 估算等）。

---

## 0. 现状盘点

| 维度 | 状态 |
|---|---|
| 入口 | `index.tsx` → `App.tsx`（1054 行单文件） |
| 路由 | 无路由库，`activeTab` 字符串切 4 个 view |
| 样式 | Tailwind via CDN（`index.html` 直接 `<script src>`） |
| 数据层 | 7 个 `localStorage` key，散落在多处 setState 后调 `saveToLocal` |
| PWA | **未配置**：无 manifest、无 service worker、无离线缓存。这是「切回应用 reload」的根因 |
| 测试 | 无 |
| 组件 | `components/` 4 个原子组件；模态框、tab view 全在 App.tsx 内 |
| 已知细节 | `index.html` 既有 importmap 又装了 npm 包，重复，需统一 |

---

## 1. 重构目标（按优先级）

### P0 - 必须解决（用户痛点）
1. **PWA 离线 & 状态保活**：从 home 切 Safari/微信回来不能 reload 丢状态
2. **构建瘦身**：去掉 importmap + Tailwind CDN 双轨，统一到 npm + 本地构建

### P1 - 强烈建议
3. **App.tsx 拆分**：单文件 ≤ 300 行，按 view + modal + hook 切
4. **数据层抽象**：所有 `localStorage` 操作收敛到 `lib/storage.ts`，一处定义 schema 与版本号
5. **新增功能**：
   - 自定义动作库管理页（独立路由，与 plan 解耦）
   - 1RM 智能估算（Epley 主，Brzycki 备）
   - 训练中 PR 提示（这一组刷新历史最大重量时高亮）

### P2 - 可选
6. 云同步（Firebase/Supabase）— **暂缓**，等离线方案稳了再上
7. 数据导出 CSV（除了 JSON）
8. 暗色模式真实生效（目前 meta 写了但 UI 大部分硬编码 `bg-white`/`text-slate-800`）

---

## 2. 目录结构（目标）

```
src/
  main.tsx              # 入口（原 index.tsx）
  App.tsx               # 仅做路由 + Layout，≤ 100 行
  
  views/                # 一个 tab 一个文件
    HomeView.tsx
    WorkoutView.tsx
    StatsView.tsx
    SettingsView.tsx
    ExerciseLibraryView.tsx   # 新：动作库管理
  
  modals/               # 弹窗，按业务命名
    CardioModal.tsx
    RestDayModal.tsx
    WeightModal.tsx
    SummaryModal.tsx
    TimerModal.tsx
    WorkoutDetailModal.tsx
    RewardModal.tsx
    RewardEntryModal.tsx
    RewardAnalysisModal.tsx
    StatsDetailModal.tsx
    DeleteConfirmModal.tsx
  
  components/           # 通用、与业务弱耦合
    SmartInput.tsx
    SimpleLineChart.tsx
    HistoryItem.tsx
    CalendarHeatmap.tsx
    RestTimer.tsx       # 拆出来
  
  hooks/
    usePersistedState.ts  # localStorage state hook
    useRestTimer.ts
    useStopwatch.ts
    useTheme.ts
  
  lib/
    storage.ts            # 唯一 localStorage I/O 层
    analytics.ts          # 各种 useMemo 的纯计算
    fuzzyMatch.ts         # normalizeExerciseName
    oneRepMax.ts          # 新：Epley/Brzycki
    backup.ts             # export/import JSON
  
  data/
    defaultPlans.ts       # 原 constants.ts
    exerciseLibrary.ts    # 新：所有动作元数据，去重源
  
  types.ts                # 与现有兼容，新增 CustomExercise / OneRMResult
```

---

## 3. PWA 方案（P0 关键）

**用 `vite-plugin-pwa`**（基于 Workbox），原因：与现有 Vite 6 零配置集成，autoUpdate 模式可避免发版后用户卡旧版。

### 配置要点
```ts
// vite.config.ts
VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: '劳大壮养成记',
    short_name: '劳大壮',
    theme_color: '#020617',
    background_color: '#0f172a',
    display: 'standalone',
    orientation: 'portrait',
    icons: [/* 192/512/maskable */],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
    runtimeCaching: [
      // tailwind/lucide CDN（迁移完成前的兜底）
    ],
  },
})
```

### 状态保活策略
- localStorage 已经做了大部分，但 React state 在 visibilitychange 后会因为 reload 重置。
- 加 `visibilitychange` 监听：仅在切回时刷新当前时间戳（rest timer/stopwatch），不重 setState 整张表。
- iOS PWA 的内存回收无法完全规避，重点是冷启动从 IndexedDB/localStorage 读回 ≤ 200ms。

### 图标
- 需要 192x192 / 512x512 / maskable 三套；可以先用 emoji `🏋️` 生成占位 PNG，后续再换。

---

## 4. 数据层抽象

### 现有 storage keys（保留，迁移）
```
fitness_history_v6        history: HistoryItemType[]
fitness_plans_v8          plans: Plan[]
fitness_plan_index_v6     currentPlanIndex: number
fitness_stats_v6          bodyStats: BodyStat[]
fitness_exercise_history  exerciseHistory: Record<id, ExerciseHistoryRecord>
fitness_rewards_v1        rewards: RewardRecord[]
fitness_legacy_map_v1     legacyExerciseMap
```

### 新增
```
fitness_custom_exercises_v1   CustomExercise[]   // 用户自建动作库
fitness_settings_v1           AppSettings        // 主题、默认组间休息时长等
fitness_schema_version        number             // 用于将来迁移
```

### `lib/storage.ts` 接口
```ts
export const Storage = {
  load<T>(key: StorageKey, fallback: T): T
  save<T>(key: StorageKey, value: T): void
  remove(key: StorageKey): void
  exportAll(): BackupBlob
  importAll(blob: BackupBlob): { added: number; replaced: number }
  migrate(): void   // 启动时跑一次
}
```

`usePersistedState(key, initial)` 在此之上做 React 绑定，**取消现有「先 setState 再 saveToLocal」的散落写法**。

---

## 5. 1RM 智能估算

### 公式
- **Epley**（主）：`1RM = w × (1 + r/30)`
- **Brzycki**（备，r ≤ 10 准）：`1RM = w × 36 / (37 - r)`

### 用法
- 仅在 `unit === 'weight_reps'` 的动作上启用
- 若历史多组，取该动作历次完成组的 max(epley_1rm)
- 在动作历史详情页显示「估算 1RM：120 kg（基于 100 kg × 8 reps，Epley）」
- **注意标识为估算**，不要混进真实 PR

### 接口
```ts
// lib/oneRepMax.ts
export function epley(weight: number, reps: number): number
export function brzycki(weight: number, reps: number): number
export function estimate1RM(sets: WorkoutSetLog[]): { value: number; formula: 'epley'|'brzycki'; basis: { w: number; r: number } } | null
```

---

## 6. 自定义动作库管理

### Why
现状：动作只能在「编辑计划」里临时加，跨计划不能复用。

### 设计
- 新 view: `ExerciseLibraryView`（settings 页面新增入口）
- 数据：`CustomExercise extends Exercise { source: 'system' | 'custom'; createdAt: number }`
- 操作：
  - 列表（按 category 分组）
  - 新增/编辑/删除（custom 才能删）
  - 「加入计划…」快捷按钮（多选 plan）
- 在「编辑计划」选择动作时，**从动作库挑**（替换现在的"凭空生成 c-${Date.now()}"）

---

## 7. App.tsx 拆分计划

按"剥洋葱"顺序，每步独立可跑：

| Step | 动作 | 行数变化 |
|---|---|---|
| 1 | 抽 `lib/storage.ts` + `usePersistedState` 替换 7 个 useState/saveToLocal 对 | -80 |
| 2 | 抽 `lib/analytics.ts`：`trainingDaysStats` / `volumeDataRecent` / `tonnage` 等所有 useMemo | -120 |
| 3 | 拆 11 个 `render*Modal` 到 `modals/`（用 props 传 state/setState） | -350 |
| 4 | 拆 `renderHomeView` / `renderStatsView` / `renderSettingsView` / `renderWorkoutView` 到 `views/` | -350 |
| 5 | 抽 `useRestTimer` / `useStopwatch` | -40 |
| 6 | App.tsx 只剩 layout + tab 切换 + 顶层 modal portals | ≈ 100 |

每一步后：`npm run build` + 手动 smoke test（开始一次训练 → 完成 → 看历史）。

---

## 8. 工程化补强

- **去 Tailwind CDN**：装 `tailwindcss` + `postcss` + `autoprefixer`，本地编译。CDN 在 PWA 离线下不可用。
- **去 importmap**：`index.html` 删 `<script type="importmap">`，全走 vite。
- **`vite.config.ts`**：删掉 `process.env.API_KEY` 这种从模板带过来的 GEMINI 占位，没用上。
- **TS 严格化**：`strict: true`、`noUncheckedIndexedAccess: true`，先开起来再修类型。
- **测试**：vitest + @testing-library/react，至少覆盖 `lib/*` 纯函数（1RM、analytics、storage migrate）。

---

## 9. 实施顺序（一次会话能做完的最小集）

> 目标：今晚把 P0 + 核心拆分跑通，新功能下次会话再做。

1. 工程化清理：去 CDN、去 importmap、装本地 tailwind  
2. 引入 vite-plugin-pwa，最小 manifest + autoUpdate  
3. 抽 `lib/storage.ts` + `usePersistedState`，替换 App.tsx 中 7 处 localStorage  
4. 拆 4 个 view 到 `views/`  
5. 拆 modals 到 `modals/`（先一次性都拆出来，先不优化 props 传递）  
6. 跑 build，手测 home → workout → finish → stats 主路径  
7. 提交 commit：`refactor: split App.tsx + add PWA shell`

新功能（动作库 / 1RM / PR 提示 / 暗色）独立 commit，下个会话做。

---

## 10. 不做（明确排除）

- 后端/账号系统（云同步暂缓）
- React Native / 小程序（已确定 web）
- 重写图表用 ECharts/recharts（现有 SimpleLineChart 够用）
- i18n（项目就中文）
- 「愉悦记录」的额外方案（用户明确不要）
