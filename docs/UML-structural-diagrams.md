# UML 2.5 Structural Diagrams — Iranian Stock Market Technical Analysis System

> **نکته:** این بخش شامل هفت نوع دیاگرام ساختاری UML 2.5 برای سیستم تحلیل تکنیکال بورس ایران است. هر دیاگرام در سه سطح (مفهومی، طراحی، پیاده‌سازی) ارائه شده و نام کلاس‌ها و متدها دقیقاً با موجودیت‌های DFD و فعالیت‌های BPMN همخوانی دارد. تمام دیاگرام‌ها با PlantUML قابل رندر هستند (به جز پروفایل که به صورت جدول ارائه شده).

---

## 1. Class Diagram

### Level 1 — Domain Model (Conceptual)

> **توضیح فارسی:** این دیاگرام مفهومی، هسته اصلی دامنه مسئله را نشان می‌دهد. کلاس‌های OHLCV و TAResult پایه‌های داده‌ای تحلیل تکنیکال هستند. RegimeResult وضعیت رژیم بازار را بیان می‌کند. VolumeProfileResult توزیع حجم معاملات را نشان می‌دهد و FeedbackStore ذخیره بازخوردها برای یادگیری تطبیقی است. روابط ساده بدون جهت، مفهوم وابستگی دامنه‌ای را منتقل می‌کنند.

```plantuml
@startuml ClassDiagram_L1_Domain
skinparam classAttributeIconSize 0
skinparam classFontSize 14
skinparam defaultFontSize 12
skinparam roundcorner 10

title Level 1: Domain Model — Conceptual Classes

class OHLCV {
  timestamp
  open
  high
  low
  close
  volume
}

class TAResult {
  trend
  momentum
  volatility
  support
  resistance
}

class RegimeResult {
  regime
  confidence
  transition
}

class VolumeProfileResult {
  bins
  poc
  valueArea
}

class FeedbackStore {
  predictions
  weights
  stats
}

OHLCV "1..*" -- "1" TAResult : analyzed by >
TAResult "1" -- "0..1" RegimeResult : classified by >
OHLCV "1..*" -- "0..1" VolumeProfileResult : profiled by >
FeedbackStore "1" -- "0..*" TAResult : records >

@enduml
```

---

### Level 2 — Design Classes with Associations, Aggregations, Compositions

> **توضیح فارسی:** در سطح طراحی، روابط دقیق‌تر مشخص شده‌اند. TAResult از طریق composition شامل ScenarioResult و TrendResult است (چرخه حیاتشان وابسته). RegimeResult شامل MarkovChain و VotingWeights است. VolumeProfileResult شامل TouchCountResult و EnhancedSRStrengthResult به صورت aggregation است (می‌توانند مستقل وجود داشته باشند). FeedbackStore شامل PredictionRecord و WeightRecord و FeedbackStats به صورت composition است. Multiplicity نشان‌دهنده تعداد نمونه‌های ممکن است.

```plantuml
@startuml ClassDiagram_L2_Design
skinparam classAttributeIconSize 0
skinparam roundcorner 10

title Level 2: Design Classes — Associations, Agpositions, Compositions

class OHLCV {
  timestamp : number
  open : number
  high : number
  low : number
  close : number
  volume : number
}

class TAResult {
  indicators : Map<string, number>
  scenario : ScenarioResult
  trend : TrendResult
}

class ScenarioResult {
  name : string
  probability : number
  actions : string[]
}

class TrendResult {
  direction : "UP" | "DOWN" | "SIDE"
  strength : LevelStrength
  slope : number
}

class LevelStrength {
  level : number
  confidence : number
}

class RegimeResult {
  type : RegimeType
  markov : MarkovChain
  weights : VotingWeights
}

class RegimeType {
  <<enumeration>>
  BULL
  BEAR
  SIDEWAYS
  VOLATILE
}

class MarkovChain {
  states : string[]
  transitionMatrix : number[][]
  currentState : string
}

class VotingWeights {
  totalVotes : number
  votes : IndicatorVote[]
}

class IndicatorVote {
  indicatorName : string
  weight : number
  vote : number
}

class VolumeProfileResult {
  bins : VolumeBin[]
  poc : number
  valueAreaHigh : number
  valueAreaLow : number
}

class TouchCountResult {
  level : number
  touches : number
  avgBounce : number
}

class EnhancedSRStrengthResult {
  level : number
  volumeStrength : number
  touchStrength : number
  compositeScore : number
}

class FeedbackStore {
  predictions : PredictionRecord[]
  weights : WeightRecord[]
  stats : FeedbackStats
}

class PredictionRecord {
  timestamp : number
  predicted : number
  actual : number
  error : number
}

class WeightRecord {
  component : string
  weight : number
  lastUpdated : number
}

class FeedbackStats {
  totalPredictions : number
  meanError : number
  accuracy : number
}

' Compositions — lifecycle dependency
TAResult *-- "1" ScenarioResult
TAResult *-- "1" TrendResult
TrendResult *-- "1" LevelStrength
RegimeResult *-- "1" MarkovChain
RegimeResult *-- "1" VotingWeights
VotingWeights o-- "1..*" IndicatorVote
FeedbackStore *-- "0..*" PredictionRecord
FeedbackStore *-- "0..*" WeightRecord
FeedbackStore *-- "1" FeedbackStats

' Aggregations — can exist independently
VolumeProfileResult o-- "1..*" TouchCountResult
VolumeProfileResult o-- "1..*" EnhancedSRStrengthResult

' Associations
OHLCV "1..*" --> "0..1" TAResult : analyze() >
TAResult "1" --> "0..1" RegimeResult : detectRegime() >
OHLCV "1..*" --> "0..1" VolumeProfileResult : approximateVolumeProfile() >

@enduml
```

---

### Level 3 — Implementation Classes with Full Methods, Visibility, Return Types

> **توضیح فارسی:** در سطح پیاده‌سازی، تمام متدها با سطح دسترسی (public +، private −)، پارامترها و نوع خروجی مشخص شده‌اند. کلاس‌های ML شامل AdaptiveWeightModel با StandardScaler و LogisticRegressionModel به صورت composition هستند. SRAnalyzer و PatternDetection و DecisionGraph و BayesianWeights و MLNarrative متدهای اصلی سیستم را نشان می‌دهند. تمام نام‌ها دقیقاً با کد منبع همخوانی دارند.

```plantuml
@startuml ClassDiagram_L3_Implementation
skinparam classAttributeIconSize 0
skinparam roundcorner 8

title Level 3: Implementation Classes — Full Methods & Visibility

class OHLCV {
  + timestamp : number
  + open : number
  + high : number
  + low : number
  + close : number
  + volume : number
  + validate() : boolean
}

class TAResult {
  + indicators : Map<string, number>
  + scenario : ScenarioResult
  + trend : TrendResult
  + getIndicator(name: string) : number
  + toJSON() : string
}

class ScenarioResult {
  + name : string
  + probability : number
  + actions : string[]
  + getTopAction() : string
}

class TrendResult {
  + direction : string
  + strength : LevelStrength
  + slope : number
  + isBullish() : boolean
  + isBearish() : boolean
}

class LevelStrength {
  + level : number
  + confidence : number
  + normalize() : number
}

class SRAnalyzer {
  - _mlWeights : MLWeights
  - _cache : Map<string, SRAnalysisResult>
  + analyzeSupportResistance(data: OHLCV[], taResult: TAResult) : SRAnalysisResult
  - _calculateProximity(data: OHLCV[], level: SRLevel) : number
  - _mergeLevels(levels: SRLevel[]) : SRLevel[]
}

class SRLevel {
  + price : number
  + type : "support" | "resistance"
  + strength : number
  + touches : number
}

class SRAnalysisResult {
  + supports : SRLevel[]
  + resistances : SRLevel[]
  + mlWeights : MLWeights
  + getNearest(price: number) : SRLevel
}

class MLWeights {
  + proximity : number
  + volume : number
  + touch : number
  + recency : number
}

class RegimeEngine {
  - _markov : MarkovChain
  - _fuzzyCache : Map<string, FuzzyOutput>
  + detectRegime(input: RegimeInput) : RegimeResult
  + fuzzyRegimeDetector(input: RegimeInput) : FuzzyOutput
  + adaptiveWeightedVote(indicators: IndicatorVote[], weights: VotingWeights) : VoteResult
  - _updateMarkovState(result: RegimeResult) : void
}

class MarkovChain {
  + states : string[]
  + transitionMatrix : number[][]
  + currentState : string
  + nextState() : string
  + probability(from: string, to: string) : number
  + train(sequences: string[][]) : void
}

class VotingWeights {
  + totalVotes : number
  + votes : IndicatorVote[]
  + normalize() : void
  + getWeightedSum() : number
}

class VolumeProfileEngine {
  + approximateVolumeProfile(data: OHLCV[], numBins: number) : VolumeProfileResult
  + countTouch(data: OHLCV[], level: number, tolerance: number) : TouchCountResult
  - _binVolume(data: OHLCV[], numBins: number) : VolumeBin[]
}

class AdaptiveWeightModel {
  - _scaler : StandardScaler
  - _logistic : LogisticRegressionModel
  + trainAdaptiveModel(X: number[][], y: number[]) : TrainingResult
  + predictScore(x: number[]) : number
  + getWeights() : number[]
  - _preprocess(X: number[][]) : number[][]
}

class StandardScaler {
  - _mean : number[]
  - _std : number[]
  + fit(X: number[][]) : void
  + transform(X: number[][]) : number[][]
  + fitTransform(X: number[][]) : number[][]
}

class LogisticRegressionModel {
  - _coefficients : number[]
  - _intercept : number
  + fit(X: number[][], y: number[]) : void
  + predict(X: number[][]) : number[]
  + predictProba(X: number[][]) : number[]
}

class FeedbackStore {
  - _storage : SafeLocalStorage
  - _predictions : PredictionRecord[]
  - _weights : WeightRecord[]
  + addPrediction(record: PredictionRecord) : void
  + getStats() : FeedbackStats
  + updateWeight(component: string, weight: number) : void
  + getWeights() : WeightRecord[]
  + clearHistory() : void
}

class PatternDetection {
  + detectAllPatterns(data: OHLCV[]) : DetectedPatterns
  - _detectCandlestick(data: OHLCV[]) : PatternResult[]
  - _detectChart(data: OHLCV[]) : PatternResult[]
}

class PatternResult {
  + name : string
  + type : string
  + startIndex : number
  + endIndex : number
  + significance : number
}

class DetectedPatterns {
  + candlestick : PatternResult[]
  + chart : PatternResult[]
  + all : PatternResult[]
  + count() : number
}

class DecisionGraph {
  + buildDecisionGraph(input: GraphInput) : GraphData
  - _createNodes(input: GraphInput) : GraphNode[]
  - _createEdges(nodes: GraphNode[]) : GraphEdge[]
}

class GraphData {
  + nodes : GraphNode[]
  + edges : GraphEdge[]
  + toJSON() : string
}

class GraphNode {
  + id : string
  + label : string
  + type : string
  + data : Map<string, any>
}

class GraphEdge {
  + source : string
  + target : string
  + weight : number
  + label : string
}

class BayesianWeights {
  + compute(prior: BayesianWeight[], evidence: number[]) : BayesianSystemResult
  - _posterior(prior: number, likelihood: number) : number
}

class BayesianWeight {
  + name : string
  + prior : number
  + likelihood : number
  + posterior : number
}

class BayesianSystemResult {
  + weights : BayesianWeight[]
  + normalizedPosterior : number[]
  + entropy : number
}

class MLNarrative {
  + dedicatedAIChatCompletion(messages: ChatMessage[]) : Promise<string>
  + selectMSLV4(input: NarrativeInput) : NarrativeCombination
  + postProcessAIOutput(text: string, refs: Reference[]) : PostProcessResult
  - _buildPrompt(input: NarrativeInput) : string
}

class NarrativeCombination {
  + school : SchoolDef
  + style : StyleDef
  + tone : ToneDef
}

class ThemeStore {
  + colors : ThemeColors
  + preset : ThemePreset
  + setTheme(preset: ThemePreset) : void
  + toggleDarkMode() : void
}

class SafeLocalStorage {
  - _isAvailable : boolean
  + getItem(key: string) : string | null
  + setItem(key: string, value: string) : void
  + removeItem(key: string) : void
  + isAvailable() : boolean
}

' Compositions
TAResult *-- "1" ScenarioResult
TAResult *-- "1" TrendResult
TrendResult *-- "1" LevelStrength
SRAnalyzer *-- "1" MLWeights
SRAnalysisResult o-- "0..*" SRLevel
SRAnalysisResult *-- "1" MLWeights
RegimeEngine *-- "1" MarkovChain
AdaptiveWeightModel *-- "1" StandardScaler
AdaptiveWeightModel *-- "1" LogisticRegressionModel
FeedbackStore *-- "0..*" PredictionRecord
FeedbackStore *-- "0..*" WeightRecord
FeedbackStore *-- "1" FeedbackStats
FeedbackStore --> "1" SafeLocalStorage : uses
DecisionGraph *-- "1" GraphData
GraphData o-- "1..*" GraphNode
GraphData o-- "0..*" GraphEdge
DetectedPatterns o-- "0..*" PatternResult
BayesianSystemResult o-- "1..*" BayesianWeight
NarrativeCombination *-- "1" SchoolDef
NarrativeCombination *-- "1" StyleDef
NarrativeCombination *-- "1" ToneDef

' Dependencies
SRAnalyzer ..> TAResult : requires
VolumeProfileEngine ..> OHLCV : requires
PatternDetection ..> OHLCV : requires
DecisionGraph ..> GraphInput : requires
MLNarrative ..> NarrativeCombination : produces
ThemeStore ..> ThemeColors : uses
ThemeStore ..> ThemePreset : uses

@enduml
```

---

## 2. Object Diagram

### Level 1 — Object Instances for Symbol "فولاد" (Foolad Steel)

> **توضیح فارسی:** این دیاگرام نمونه‌های واقعی از کلاس‌ها را برای نماد «فولاد» نشان می‌دهد. شیء fooladData شامل ۵ کندل OHLCV است. شیء fooladResult نمونه‌ای از TAResult با شاخص‌های محاسبه‌شده است. fooladRegime رژیم صعودی با اطمینان ۰.۷۸ را نشان می‌دهد. fooladProfile پروفایل حجم با POC در قیمت ۸۹۵۰ و fooladFeedback ذخیره بازخورد با ۳۲ پیش‌بینی ثبت‌شده است.

```plantuml
@startuml ObjectDiagram_L1_Instances
skinparam objectFontSize 12
skinparam roundcorner 10

title Level 1: Object Instances — Symbol "فولاد"

object fooladData : OHLCV {
  timestamp = 1711929600000
  open = 8850
  high = 9020
  low = 8810
  close = 8950
  volume = 4520000
}

object fooladResult : TAResult {
  indicators = {RSI:62.3, MACD:85.1, ATR:210}
  trend.direction = "UP"
  trend.strength.level = 0.72
}

object fooladRegime : RegimeResult {
  type = RegimeType.BULL
  confidence = 0.78
  markov.currentState = "BULL"
}

object fooladProfile : VolumeProfileResult {
  poc = 8950
  valueAreaHigh = 9120
  valueAreaLow = 8780
  bins.count = 12
}

object fooladFeedback : FeedbackStore {
  predictions.length = 32
  weights.proximity = 0.35
  stats.accuracy = 0.71
}

fooladResult --> fooladData : analyzedFrom
fooladRegime --> fooladResult : classifiedFrom
fooladProfile --> fooladData : profiledFrom
fooladFeedback --> fooladResult : tracks

@enduml
```

---

### Level 2 — Objects During Mid-Process (TAResult Being Computed)

> **توضیح فارسی:** این دیاگرام وضعیت اشیاء در حین محاسبه TAResult را نشان می‌دهد. در حالی که موتور تحلیل در حال اجراست، intermediateResult فقط بخشی از اندیکاتورها را دارد (RSI محاسبه شده اما MACD هنوز در حال محاسبه است). pendingScenario هنوز probability ندارد و pendingTrend فقط direction تعیین شده اما strength خالی است. این دیاگرام برای دیباگ و درک روند محاسبات مفید است.

```plantuml
@startuml ObjectDiagram_L2_MidProcess
skinparam objectFontSize 12
skinparam roundcorner 10

title Level 2: Mid-Process Objects — TAResult Being Computed

object rawData : OHLCV[] {
  length = 250
  [0].close = 8950
  [249].close = 8820
}

object intermediateResult : TAResult {
  indicators = {RSI:62.3, EMA20:8890}
  // MACD: computing...
  // Bollinger: pending
}

object pendingScenario : ScenarioResult {
  name = "breakout_bull"
  probability = undefined
  actions = []
}

object pendingTrend : TrendResult {
  direction = "UP"
  strength = null
  slope = undefined
}

object computingRegime : RegimeResult {
  type = null
  confidence = 0
  // awaiting TAResult
}

object partialFeedback : FeedbackStore {
  predictions.length = 31
  // prediction 32 in progress
}

intermediateResult --> rawData : partialAnalysis
pendingScenario --> intermediateResult : awaiting
pendingTrend --> intermediateResult : awaiting
computingRegime --> intermediateResult : blocked

@enduml
```

---

### Level 3 — Objects at Critical Moment (Markov Chain State Update)

> **توضیح فارسی:** در لحظه بحرانی به‌روزرسانی حالت زنجیره مارکوف، دیاگرام وضعیت دقیق تمام اشیاء مرتبط را نشان می‌دهد. زنجیره مارکوف از حالت SIDEWAYS به BULL منتقل شده و ماتریس انتقال به‌روز شده است. رأی‌گیری وزن‌دار تطبیقی انجام شده و نتیجه نهایی رژیم BULL با اطمینان ۰.۸۳ قطعی شده است. بازخورد در حال ثبت این پیش‌بینی است و مدل لجستیک وزن‌های جدید را دریافت کرده است.

```plantuml
@startuml ObjectDiagram_L3_Critical
skinparam objectFontSize 12
skinparam roundcorner 10

title Level 3: Critical Moment — Markov Chain State Update

object markovBefore : MarkovChain {
  currentState = "SIDEWAYS"
  states = ["BULL","BEAR","SIDEWAYS","VOLATILE"]
}

object markovAfter : MarkovChain {
  currentState = "BULL"
  states = ["BULL","BEAR","SIDEWAYS","VOLATILE"]
  transitionMatrix[2][0] = 0.34
  // P(SIDEWAYS→BULL) updated
}

object voteRSI : IndicatorVote {
  indicatorName = "RSI"
  weight = 0.28
  vote = 1  // bullish
}

object voteMACD : IndicatorVote {
  indicatorName = "MACD"
  weight = 0.35
  vote = 1  // bullish
}

object voteBollinger : IndicatorVote {
  indicatorName = "Bollinger"
  weight = 0.22
  vote = 0  // neutral
}

object votingWeights : VotingWeights {
  totalVotes = 3
  weightedSum = 0.855
}

object finalRegime : RegimeResult {
  type = RegimeType.BULL
  confidence = 0.83
}

object feedbackRecord : PredictionRecord {
  timestamp = 1711929600000
  predicted = 1  // BULL
  actual = null  // pending
  error = null
}

object updatedLogistic : AdaptiveWeightModel {
  _scaler._mean = [0.52, 0.71, 0.34]
  _logistic._coefficients = [1.23, -0.87, 0.45]
}

markovBefore --> markovAfter : transition(SIDEWAYS→BULL)
votingWeights --> voteRSI : includes
votingWeights --> voteMACD : includes
votingWeights --> voteBollinger : includes
finalRegime --> markovAfter : derivedFrom
finalRegime --> votingWeights : basedOn
feedbackRecord --> finalRegime : records
updatedLogistic --> finalRegime : learnsFrom

@enduml
```

---

## 3. Component Diagram

### Level 1 — Top-Level Components

> **توضیح فارسی:** این دیاگرام پنج مؤلفه اصلی سیستم را نشان می‌دهد. TA Engine موتور تحلیل تکنیکال، ML Engine موتور یادگیری ماشین، Regime Engine موتور تشخیص رژیم، AI Service سرویس هوش مصنوعی و Data Layer لایه داده هستند. جریان داده از Data Layer به TA Engine و سپس به سایر مؤلفه‌هاست. AI Service از طریق رابط ZAI-SDK به سرویس خارجی متصل می‌شود.

```plantuml
@startuml ComponentDiagram_L1_TopLevel
skinparam componentStyle rectangle
skinparam roundcorner 12

title Level 1: Top-Level Components

component "TA Engine" as TA <<Engine>> {
}

component "ML Engine" as ML <<Predictor>> {
}

component "Regime Engine" as RE <<Analyzer>> {
}

component "AI Service" as AI <<Service>> {
}

component "Data Layer" as DL <<Store>> {
}

interface "ITechnicalAnalysis" as ITA
interface "IMLModel" as IML
interface "IRegimeDetector" as IRE
interface "IAICompletion" as IAI
interface "IDataProvider" as IData

TA -up- ITA
ML -up- IML
RE -up- IRE
AI -up- IAI
DL -up- IData

TA ..> IData : requires
ML ..> ITA : requires
RE ..> ITA : requires
AI ..> IML : requires
RE ..> IML : requires
TA ..> IAI : requires (narrative)

@enduml
```

---

### Level 2 — Sub-Components

> **توضیح فارسی:** در سطح زیرمؤلفه، هر مؤلفه اصلی به اجزای خرد شکسته شده است. TA Engine شامل Indicator Calculators، S/R Analyzer و VDSS Engine است. ML Engine شامل Logistic Regression، Bayesian Weights و Adaptive Weight Model است. Regime Engine شامل Fuzzy Detector، Markov Chain و Voting System است. AI Service شامل Chat Completion و Post-Processor و Narrative Selector است. Data Layer شامل TSE API و TGJU API و Safe Storage است.

```plantuml
@startuml ComponentDiagram_L2_SubComponents
skinparam componentStyle rectangle
skinparam roundcorner 10

title Level 2: Sub-Components

component "TA Engine" as TA <<Engine>> {
  component "Indicator Calculators" as IC
  component "S/R Analyzer" as SR
  component "VDSS Engine" as VD
  component "Volume Profile" as VP
}

component "ML Engine" as ML <<Predictor>> {
  component "Logistic Regression" as LR
  component "Bayesian Weights" as BW
  component "Adaptive Weight Model" as AWM
  component "Standard Scaler" as SS
}

component "Regime Engine" as RE <<Analyzer>> {
  component "Fuzzy Detector" as FD
  component "Markov Chain" as MC
  component "Voting System" as VS
}

component "AI Service" as AI <<Service>> {
  component "Chat Completion" as CC
  component "Post-Processor" as PP
  component "Narrative Selector" as NS
}

component "Data Layer" as DL <<Store>> {
  component "TSE API" as TSE
  component "TGJU API" as TGJU
  component "Safe Storage" as Stor
  component "Yahoo Finance API" as YF
}

IC --> SR : provides indicators
IC --> VP : provides data
SR --> VD : provides S/R levels
AWM --> SS : uses
AWM --> LR : uses
FD --> MC : feeds state
MC --> VS : provides transition
CC --> PP : raw output
NS --> CC : constructs prompt
TSE --> Stor : caches
TGJU --> Stor : caches

@enduml
```

---

### Level 3 — Interface Dependencies with Provided/Required Interfaces and Method Signatures

> **توضیح فارسی:** در سطح تفصیلی، هر مؤلفه رابط‌های ارائه‌شده (Provided) و موردنیاز (Required) را با امضای متدها نشان می‌دهد. مثلاً TA Engine رابط ITechnicalAnalysis با متد analyze را ارائه و IDataProvider با متد fetchOHLCV را نیاز دارد. ML Engine رابط IMLModel با trainAdaptiveModel و predictScore را ارائه می‌دهد. Regime Engine رابط IRegimeDetector با detectRegime و fuzzyRegimeDetector را ارائه می‌دهد. تمام وابستگی‌ها از طریق رابط‌ها برقرار می‌شود، نه ارجاع مستقیم.

```plantuml
@startuml ComponentDiagram_L3_Interfaces
skinparam componentStyle rectangle
skinparam roundcorner 10

title Level 3: Interface Dependencies — Method Signatures

component "TA Engine" as TA <<Engine>>
component "ML Engine" as ML <<Predictor>>
component "Regime Engine" as RE <<Analyzer>>
component "AI Service" as AI <<Service>>
component "Data Layer" as DL <<Store>>
component "Feedback Store" as FS <<Store>>
component "Pattern Detection" as PD <<Analyzer>>
component "Decision Graph" as DG <<Analyzer>>
component "Narrative Engine" as NE <<Engine>>
component "Theme Store" as TS <<Store>>

interface "ITechnicalAnalysis\n  + analyze(data: OHLCV[],\n    currencyUnit: string) : TAResult" as ITA
interface "IDataProvider\n  + fetchOHLCV(symbol: string) : OHLCV[]\n  + fetchIndex() : OHLCV[]" as IData
interface "IMLModel\n  + trainAdaptiveModel(X: number[][],\n    y: number[]) : TrainingResult\n  + predictScore(x: number[]) : number" as IML
interface "IRegimeDetector\n  + detectRegime(input: RegimeInput) : RegimeResult\n  + fuzzyRegimeDetector(input) : FuzzyOutput\n  + adaptiveWeightedVote(indicators,\n    weights) : VoteResult" as IRE
interface "IAICompletion\n  + dedicatedAIChatCompletion(\n    messages: ChatMessage[]) : Promise<string>" as IAI
interface "IFeedbackStore\n  + addPrediction(record) : void\n  + getStats() : FeedbackStats\n  + updateWeight(comp, w) : void" as IFS
interface "IPatternDetector\n  + detectAllPatterns(data: OHLCV[]) : DetectedPatterns" as IPD
interface "IDecisionGraph\n  + buildDecisionGraph(input: GraphInput) : GraphData" as IDG
interface "INarrativeSelector\n  + selectMSLV4(input) : NarrativeCombination\n  + postProcessAIOutput(text, refs) : PostProcessResult" as INS

TA -up- ITA
DL -up- IData
ML -up- IML
RE -up- IRE
AI -up- IAI
FS -up- IFS
PD -up- IPD
DG -up- IDG
NE -up- INS

TA ..> IData : «requires»
ML ..> ITA : «requires»
RE ..> ITA : «requires»
RE ..> IML : «requires»
AI ..> IAI : «uses»
NE ..> IAI : «requires»
NE ..> IRE : «requires»
NE ..> ITA : «requires»
DG ..> ITA : «requires»
DG ..> IRE : «requires»
FS ..> ITA : «observes»
PD ..> IData : «requires»
TS ..> IData : «observes»

@enduml
```

---

## 4. Deployment Diagram

### Level 1 — Physical Nodes

> **توضیح فارسی:** این دیاگرام گره‌های فیزیکی استقرار سیستم را نشان می‌دهد. Browser گره کاربر نهایی است که با Next.js Server ارتباط HTTP دارد. Next.js Server گره اصلی پردازش است. Mini Services گره سرویس‌های خرد (fetcher و health-check) است. Z-AI SDK گره سرویس هوش مصنوعی خارجی است. هر گره با پروتکل مناسب به گره دیگر متصل می‌شود.

```plantuml
@startuml DeploymentDiagram_L1_Nodes
skinparam nodePadding 15
skinparam roundcorner 12

title Level 1: Physical Nodes

node "Browser" as browser <<Client>>
node "Next.js Server" as nextjs <<Application Server>>
node "Mini Services" as mini <<Micro Services>>
node "Z-AI SDK" as zai <<External AI>>

artifact "React SPA" as spa
artifact "Next.js App" as app
artifact "fetcher" as fetcher
artifact "health-check" as hc
artifact "Z-AI API" as zaiapi

browser -- spa
nextjs -- app
mini -- fetcher
mini -- hc
zai -- zaiapi

browser "HTTP/HTTPS" --> nextjs
nextjs "REST" --> mini
nextjs "REST/JSON" --> zai

@enduml
```

---

### Level 2 — Component Allocation with Protocols

> **توضیح فارسی:** در سطح دوم، مؤلفه‌های نرم‌افزاری روی گره‌های فیزیکی تخصیص داده شده‌اند و پروتکل‌های ارتباطی دقیق‌تر مشخص شده‌اند. روی Browser کامپوننت‌های React UI و Theme Store قرار دارند. روی Next.js Server تمام Engine ها و Analyzer ها و Store ها مستقر هستند. Mini Services شامل TSE Fetcher و TGJU Fetcher است. ارتباط از نوع HTTP، WebSocket و REST با پورت‌های مشخص است.

```plantuml
@startuml DeploymentDiagram_L2_Allocation
skinparam nodePadding 15
skinparam roundcorner 10

title Level 2: Component Allocation with Protocols

node "Browser\nChrome/Firefox/Safari" as browser <<Client>> {
  component "React UI\n  (Analysis Page, Scenario Cards)" as ui
  component "Theme Store" as theme
  component "SafeLocalStorage" as sls
}

node "Next.js Server\nNode.js 20+ / Bun" as nextjs <<App Server>> {
  component "TA Engine" as ta
  component "ML Engine" as ml
  component "Regime Engine" as re
  component "AI Service" as ai
  component "Pattern Detection" as pd
  component "Decision Graph" as dg
  component "SR Analyzer" as sr
  component "Volume Profile" as vp
  component "Feedback Store" as fs
  component "Narrative Engine" as ne
}

node "Mini Services\nBun Runtime" as mini <<Micro Services>> {
  component "TSE Fetcher\n  (port 3100)" as tsef
  component "TGJU Fetcher\n  (port 3200)" as tgjuf
  component "Health Check\n  (port 3300)" as hcheck
}

node "Z-AI SDK\nCloud API" as zai <<External AI>> {
  component "Chat Completion API" as chatapi
  component "Web Search API" as searchapi
}

browser "HTTPS :443" --> nextjs : "SSR + API Routes"
nextjs "HTTP :3100" --> mini : "TSE data fetch"
nextjs "HTTP :3200" --> mini : "TGJU data fetch"
nextjs "HTTPS :443" --> zai : "AI completions"
mini "HTTPS" --> zai : "optional search"

@enduml
```

---

### Level 3 — Detailed Config per Node

> **توضیح فارسی:** در سطح تفصیلی، پیکربندی هر گره شامل سیستم‌عامل، پورت، تعداد نمونه، تنظیمات کش و محدودیت‌های نرخ است. Browser روی سیستم‌عامل کاربر اجرا می‌شود. Next.js Server روی لینوکس با پورت ۳۰۰۰، ۲ نمونه و کش ۱۰۰۰ مدخل اجرا می‌شود. Mini Services روی لینوکس با Bun Runtime و هرکدام ۱ نمونه اجرا می‌شوند. Z-AI SDK سرویس ابری با rate-limit ۶۰ درخواست در دقیقه است.

```plantuml
@startuml DeploymentDiagram_L3_Config
skinparam nodePadding 15
skinparam roundcorner 10

title Level 3: Detailed Config per Node

node "Browser\n  OS: User's OS\n  Runtime: V8/SpiderMonkey\n  Memory: 512MB limit\n  Cache: ServiceWorker\n  TTL: 5min" as browser <<Client>> {
  artifact "React SPA\n  bundle: ~850KB gzipped\n  chunks: 12 lazy" as spa
}

node "Next.js Server\n  OS: Linux (Ubuntu 22.04)\n  Runtime: Node.js 20 / Bun 1.1\n  Port: 3000\n  Instances: 2\n  Cache: LRU {max: 1000, TTL: 300s}\n  Rate Limit: 100 req/min" as nextjs <<App Server>> {
  artifact "API Routes\n  /api/analyze\n  /api/regime\n  /api/ai-chat\n  /api/patterns\n  /api/decision-graph" as api
  artifact "SSR Pages\n  /analysis/[symbol]\n  /scenarios" as pages
}

node "Mini: TSE Fetcher\n  OS: Linux (Alpine)\n  Runtime: Bun 1.1\n  Port: 3100\n  Instances: 1\n  Cache: Redis {TTL: 60s}\n  Schedule: */30s cron\n  Timeout: 10s" as tsemini <<Micro Service>> {
  artifact "tse-fetcher.ts\n  fetchIntraDay()\n  fetchHistory()" as tsef
}

node "Mini: TGJU Fetcher\n  OS: Linux (Alpine)\n  Runtime: Bun 1.1\n  Port: 3200\n  Instances: 1\n  Cache: Redis {TTL: 120s}\n  Timeout: 8s" as tgjumini <<Micro Service>> {
  artifact "tgju-api.ts\n  fetchMarketData()" as tgjuf
}

node "Mini: Health Check\n  OS: Linux (Alpine)\n  Runtime: Bun 1.1\n  Port: 3300\n  Instances: 1" as hcmini <<Micro Service>> {
  artifact "health-check.ts\n  checkAll()" as hcf
}

node "Z-AI SDK\n  Type: Cloud SaaS\n  Endpoint: api.z-ai.dev\n  Rate Limit: 60 req/min\n  Timeout: 30s\n  Auth: Bearer Token" as zai <<External AI>> {
  artifact "chat/completions\n  model: glm-4\n  max_tokens: 4096" as chatapi
  artifact "web/search\n  max_results: 10" as searchapi
}

browser "HTTPS :443\n  keep-alive: 30s\n  compression: gzip/brotli" --> nextjs
nextjs "HTTP :3100\n  timeout: 10s\n  retry: 3" --> tsemini
nextjs "HTTP :3200\n  timeout: 8s\n  retry: 2" --> tgjumini
nextjs "HTTP :3300\n  timeout: 5s" --> hcmini
nextjs "HTTPS :443\n  Authorization: Bearer\n  content-type: application/json" --> zai

@enduml
```

---

## 5. Package Diagram

### Level 1 — Main Packages

> **توضیح فارسی:** دیاگرام بسته‌ها در سطح اول، چهار بسته اصلی را نشان می‌دهد: lib/ شامل تمام منطق کسب‌وکار، components/ شامل کامپوننت‌های رابط کاربری، api/ شامل مسیرهای API و mini-services/ شامل سرویس‌های خرد داده. وابستگی‌ها از components به lib (استفاده از منطق)، از api به lib (فراخوانی موتورها) و از mini-services به منابع خارجی است.

```plantuml
@startuml PackageDiagram_L1_Main
skinparam packageStyle rectangle
skinparam roundcorner 10

title Level 1: Main Packages

package "lib/" as lib <<Business Logic>> {
}

package "components/" as comp <<UI Components>> {
}

package "api/" as api <<API Routes>> {
}

package "mini-services/" as mini <<Data Services>> {
}

comp ..> lib : «uses»
api ..> lib : «calls»
mini ..> lib : «feeds»

@enduml
```

---

### Level 2 — Sub-Packages

> **توضیح فارسی:** در سطح دوم، بسته lib/ به زیربسته‌های ta (تحلیل تکنیکال)، ml (یادگیری ماشین)، regime (رژیم بازار)، sr (سطوح حمایتی/مقاومتی)، pattern (تشخیص الگو)، feedback (بازخورد)، data (داده) و ui (رابط کاربری) شکسته شده است. بسته components/ شامل analysis، scenarios و common است. بسته api/ شامل analyze، regime و ai-chat است. mini-services/ شامل tse-fetcher و tgju-fetcher است.

```plantuml
@startuml PackageDiagram_L2_SubPackages
skinparam packageStyle rectangle
skinparam roundcorner 10

title Level 2: Sub-Packages

package "lib/" as lib {
  package "ta" as ta <<ta-engine.ts>>
  package "ml" as ml <<ml-*.ts>>
  package "regime" as regime <<regime-engine.ts>>
  package "sr" as sr <<sr-analyzer.ts>>
  package "pattern" as pattern <<pattern-detection.ts>>
  package "feedback" as feedback <<msl-feedback.ts>>
  package "data" as data <<tse-api, tgju-api>>
  package "ui" as ui <<theme-store.ts>>
  package "graph" as graph <<decision-graph.ts>>
  package "narrative" as narrative <<ml-narrative.ts>>
  package "bayesian" as bayesian <<bayesian-weights.ts>>
  package "volume" as volume <<volume-profile.ts>>
  package "storage" as storage <<safe-storage.ts>>
}

package "components/" as comp {
  package "analysis" as analysis <<AnalysisPage>>
  package "scenarios" as scenarios <<ScenarioCards>>
  package "common" as common <<SharedUI>>
  package "graph-ui" as graphui <<DecisionGraphPanel>>
}

package "api/" as api {
  package "analyze" as apianalyze <<analyze/route.ts>>
  package "regime" as apiregime <<regime/route.ts>>
  package "ai-chat" as apichat <<ai-chat/route.ts>>
  package "patterns" as apipatterns <<patterns/route.ts>>
}

package "mini-services/" as mini {
  package "tse-fetcher" as tsefetcher
  package "tgju-fetcher" as tgjufetcher
  package "health-check" as healthcheck
}

regime ..> ta : «uses»
ml ..> feedback : «uses»
sr ..> ta : «uses»
sr ..> ml : «uses»
pattern ..> ta : «uses»
graph ..> ta : «uses»
graph ..> regime : «uses»
narrative ..> regime : «uses»
narrative ..> ml : «uses»
bayesian ..> ml : «uses»
volume ..> ta : «uses»
feedback ..> storage : «uses»
ui ..> storage : «uses»
data ..> storage : «uses»

analysis ..> ta : «displays»
analysis ..> sr : «displays»
analysis ..> regime : «displays»
scenarios ..> narrative : «displays»
graphui ..> graph : «displays»
common ..> ui : «uses»

apianalyze ..> ta : «calls»
apianalyze ..> sr : «calls»
apiregime ..> regime : «calls»
apichat ..> narrative : «calls»
apipatterns ..> pattern : «calls»

tsefetcher ..> data : «feeds»
tgjufetcher ..> data : «feeds»

@enduml
```

---

### Level 3 — Class-Level Dependencies Between Packages

> **توضیح فارسی:** در سطح سوم، وابستگی‌های کلاس‌به‌کلاس بین بسته‌ها نشان داده شده است. مثلاً TAResult (در lib/ta) توسط SRAnalyzer (در lib/sr)، RegimeEngine (در lib/regime) و DecisionGraph (در lib/graph) استفاده می‌شود. AdaptiveWeightModel (در lib/ml) توسط SRAnalyzer و RegimeEngine استفاده می‌شود. FeedbackStore (در lib/feedback) توسط AdaptiveWeightModel به‌روزرسانی می‌شود. تمام وابستگی‌ها جهت‌دار و بدون چرخه هستند.

```plantuml
@startuml PackageDiagram_L3_ClassDeps
skinparam packageStyle rectangle
skinparam roundcorner 10

title Level 3: Class-Level Dependencies Between Packages

package "lib/ta" as ta {
  class OHLCV
  class TAResult
  class ScenarioResult
  class TrendResult
  class LevelStrength
}

package "lib/regime" as regime {
  class RegimeEngine
  class RegimeType
  class MarkovChain
  class VotingWeights
  class IndicatorVote
}

package "lib/ml" as ml {
  class AdaptiveWeightModel
  class StandardScaler
  class LogisticRegressionModel
}

package "lib/sr" as sr {
  class SRAnalyzer
  class SRLevel
  class SRAnalysisResult
  class MLWeights
}

package "lib/pattern" as pattern {
  class PatternDetection
  class PatternResult
  class DetectedPatterns
}

package "lib/volume" as volume {
  class VolumeProfileEngine
  class VolumeProfileResult
  class TouchCountResult
  class EnhancedSRStrengthResult
}

package "lib/feedback" as feedback {
  class FeedbackStore
  class PredictionRecord
  class WeightRecord
  class FeedbackStats
}

package "lib/bayesian" as bayesian {
  class BayesianWeights
  class BayesianWeight
  class BayesianSystemResult
}

package "lib/graph" as graph {
  class DecisionGraph
  class GraphData
  class GraphNode
  class GraphEdge
}

package "lib/narrative" as narrative {
  class MLNarrative
  class NarrativeCombination
  class SchoolDef
  class StyleDef
  class ToneDef
}

package "lib/storage" as storage {
  class SafeLocalStorage
}

package "lib/ui" as ui {
  class ThemeStore
  class ThemeColors
  class ThemePreset
}

' Cross-package class dependencies
RegimeEngine ..> TAResult : uses
RegimeEngine ..> AdaptiveWeightModel : uses
SRAnalyzer ..> TAResult : uses
SRAnalyzer ..> MLWeights : uses
SRAnalyzer ..> VolumeProfileResult : uses
PatternDetection ..> OHLCV : uses
VolumeProfileEngine ..> OHLCV : uses
DecisionGraph ..> TAResult : uses
DecisionGraph ..> RegimeEngine : uses
MLNarrative ..> RegimeEngine : uses
MLNarrative ..> NarrativeCombination : produces
AdaptiveWeightModel ..> FeedbackStore : updates
BayesianWeights ..> AdaptiveWeightModel : feeds
FeedbackStore ..> SafeLocalStorage : persists
ThemeStore ..> SafeLocalStorage : persists

@enduml
```

---

## 6. Composite Structure Diagram

### Level 1 — Internal Structure of TA Engine Component

> **توضیح فارسی:** دیاگرام ساختار مرکب، ساختار داخلی مؤلفه TA Engine را نشان می‌دهد. این مؤلفه شامل بخش‌های IndicatorCalculator (محاسبه اندیکاتورها)، TrendAnalyzer (تحلیل روند)، ScenarioEvaluator (ارزیابی سناریوها) و VolumeProfiler (پروفایل حجم) است. پورت‌های ورودی dataInput و currencyInput و پورت خروجی resultOutput ارتباط داخلی و خارجی را فراهم می‌کنند. بخش‌ها از طریق کانکتورهای داخلی به هم متصل هستند.

```plantuml
@startuml CompositeStructure_L1_TAEngine
skinparam componentStyle rectangle
skinparam roundcorner 10

title Level 1: Internal Structure — TA Engine

component "TA Engine" as TA {
  port "dataInput : OHLCV[]" as din
  port "currencyInput : string" as cin
  port "resultOutput : TAResult" as rout

  component "Indicator Calculator" as IC {
    port "rawData" as icin
    port "indicators" as icout
  }

  component "Trend Analyzer" as TrendA {
    port "indicatorData" as tin
    port "trendResult" as tout
  }

  component "Scenario Evaluator" as ScenarioE {
    port "indicatorAndTrend" as sein
    port "scenarioResult" as seout
  }

  component "Volume Profiler" as VP {
    port "volumeData" as vpin
    port "volumeResult" as vpout
  }

  din --> icin
  cin --> icin
  icout --> tin
  icout --> vpin
  tout --> sein
  icout --> sein
  seout --> rout
  tout --> rout
  vpout --> rout
}

@enduml
```

---

### Level 2 — Collaboration within AdaptiveWeightModel

> **توضیح فارسی:** این دیاگرام همکاری داخلی AdaptiveWeightModel را نشان می‌دهد. این مدل از سه بخش تشکیل شده: StandardScaler (نرمال‌سازی ویژگی‌ها)، LogisticRegressionModel (مدل لجستیک رگرسیون) و TimeSeriesSplit (تقسیم سری زمانی برای اعتبارسنجی). جریان کار: داده‌های ورودی ابتدا توسط StandardScaler نرمال‌سازی می‌شوند، سپس توسط TimeSeriesSplit به مجموعه‌های آموزش و آزمون تقسیم می‌شوند و در نهایت LogisticRegressionModel روی داده‌های آموزشی آموزش می‌بیند. برای پیش‌بینی، داده‌ها ابتدا نرمال‌سازی و سپس به مدل لجستیک داده می‌شوند.

```plantuml
@startuml CompositeStructure_L2_AdaptiveModel
skinparam componentStyle rectangle
skinparam roundcorner 10

title Level 2: Collaboration — AdaptiveWeightModel Internal Parts

component "AdaptiveWeightModel" as AWM {
  port "trainingInput : (X: number[][], y: number[])" as trainIn
  port "predictionInput : (x: number[])" as predIn
  port "scoreOutput : number" as scoreOut
  port "weightsOutput : number[]" as weightsOut

  component "Standard Scaler" as SS {
    port "rawFeatures" as ssin
    port "scaledFeatures" as ssout
  }

  component "Logistic Regression Model" as LR {
    port "trainData" as lrin
    port "inferenceInput" as lrinf
    port "trained" as lrout
    port "prediction" as lrpred
  }

  component "Time Series Split" as TSS {
    port "fullDataset" as tssin
    port "trainSplit" as tsstrain
    port "testSplit" = "tsstest"
  }

  ' Training flow
  trainIn --> ssin : "X raw"
  ssout --> tssin : "X scaled"
  tssin --> tsstrain : "X_train, y_train"
  tssin --> tsstest : "X_test, y_test"
  tsstrain --> lrin : "fit()"
  lrout --> weightsOut : "getWeights()"

  ' Prediction flow
  predIn --> ssin : "x raw"
  ssout --> lrinf : "x scaled"
  lrpred --> scoreOut : "predictScore()"
}

@enduml
```

---

### Level 3 — Connectors and Roles During Regime Detection

> **توضیح فارسی:** در لحظه تشخیص رژیم، دیاگرام کانکتورها و نقش‌ها را بین بخش‌های داخلی نشان می‌دهد. RegimeEngine نقش هماهنگ‌کننده را دارد. FuzzyDetector نقش classifier اولیه را دارد و خروجی fuzzy را به MarkovChain می‌فرستد. MarkovChain نقش stateTracker را دارد و احتمال انتقال حالت را محاسبه می‌کند. VotingSystem نقش aggregator را دارد و رأی‌های وزن‌دار اندیکاتورها را تجمیع می‌کند. AdaptiveWeightModel نقش weightOptimizer را دارد و وزن‌ها را بر اساس بازخورد به‌روزرسانی می‌کند. کانکتورها جریان داده در لحظه تشخیص را نشان می‌دهند.

```plantuml
@startuml CompositeStructure_L3_RegimeDetection
skinparam componentStyle rectangle
skinparam roundcorner 10

title Level 3: Connectors & Roles — Regime Detection in Progress

component "Regime Detection\nOrchestration" as RDO {
  port "input : RegimeInput" as rin
  port "output : RegimeResult" as rout

  component "Fuzzy Detector\n«role: classifier»" as FD {
    port "rawInput" as fdin
    port "fuzzyOutput" as fdout
  }

  component "Markov Chain\n«role: stateTracker»" as MC {
    port "fuzzySignal" as mcin
    port "transitionProb" as mcout
  }

  component "Voting System\n«role: aggregator»" as VS {
    port "indicatorVotes" as vsin
    port "voteResult" as vsout
  }

  component "AdaptiveWeightModel\n«role: weightOptimizer»" as AWM {
    port "feedbackSignal" as awmin
    port "optimizedWeights" = "awmout"
  }

  component "Regime Merger\n«role: decisionMaker»" as RM {
    port "markovProb" as rmin1
    port "voteResult" as rmin2
    port "fuzzyResult" as rmin3
    port "finalRegime" as rmout
  }

  ' Connectors
  rin --> fdin : "connector: input→fuzzy"
  rin --> vsin : "connector: input→votes"
  fdout --> mcin : "connector: fuzzy→markov"
  fdout --> rmin3 : "connector: fuzzy→merger"
  mcout --> rmin1 : "connector: markov→merger"
  awmout --> vsin : "connector: weights→voting"
  vsout --> rmin2 : "connector: votes→merger"
  rmout --> rout : "connector: merger→output"
  rout --> awmin : "connector: result→feedback"

}

@enduml
```

---

## 7. Profile Diagram

> **توضیح فارسی:** دیاگرام پروفایل UML 2.5 استریوتایپ‌ها، تگ‌ها و محدودیت‌های OCL را تعریف می‌کند. از آنجا که PlantUML پشتیبانی محدودی از پروفایل دارد، این بخش به صورت جدول‌های ساختاریافته ارائه شده است. هر استریوتایپ نشان‌دهنده یک الگوی معماری در سیستم است و تگ‌ها ویژگی‌های پیکربندی و محدودیت‌های OCL قوانین یکپارچگی را تضمین می‌کنند.

### Level 1 — Main Stereotypes

> **توضیح فارسی:** چهار استریوتایپ اصلی سیستم عبارتند از: «Engine» برای مؤلفه‌های پردازشی اصلی (TA Engine، ML Engine، Regime Engine)، «Analyzer» برای مؤلفه‌های تحلیلی (SR Analyzer، Pattern Detection، Volume Profile)، «Predictor» برای مؤلفه‌های پیش‌بینی (AdaptiveWeightModel، BayesianWeights، LogisticRegressionModel) و «Store» برای مؤلفه‌های ذخیره‌سازی (FeedbackStore، SafeLocalStorage، ThemeStore).

| Stereotype | Base Metaclass | Description | Applied to |
|---|---|---|---|
| `<<Engine>>` | Component | Processing engine with deterministic output for given input | TA Engine, ML Engine, Regime Engine, Narrative Engine |
| `<<Analyzer>>` | Component | Analytical component that extracts structured information from data | SR Analyzer, Pattern Detection, Volume Profile, Decision Graph |
| `<<Predictor>>` | Component | Probabilistic prediction component with train/predict lifecycle | AdaptiveWeightModel, BayesianWeights, LogisticRegressionModel |
| `<<Store>>` | Component | State persistence component with CRUD operations | FeedbackStore, SafeLocalStorage, ThemeStore |

---

### Level 2 — Extended Stereotypes with Tags

> **توضیح فارسی:** استریوتایپ‌های اصلی با تگ‌های `{cached}` (کش با TTL)، `{rateLimited}` (محدودیت نرخ درخواست) و `{adaptive}` (یادگیری تطبیقی با بازخورد) بسط داده شده‌اند. هر تگ ویژگی‌های اضافی روی مؤلفه تعریف می‌کند. مثلاً تگ cached شامل ttl و maxSize است. تگ rateLimited شامل maxRequests و windowMs است. تگ adaptive شامل learningRate و minSamples است. این تگ‌ها در پیکربندی زمان اجرا استفاده می‌شوند.

| Extended Stereotype | Tags | Tag Types | Default Values | Description |
|---|---|---|---|---|
| `<<Engine>>` + `{cached}` | `ttl` | number (seconds) | 300 | Engine results are cached with time-to-live |
| | `maxSize` | number | 1000 | Maximum cache entries |
| | `strategy` | "LRU" \| "TTL" | "LRU" | Cache eviction strategy |
| `<<Engine>>` + `{rateLimited}` | `maxRequests` | number | 100 | Maximum requests per window |
| | `windowMs` | number | 60000 | Rate limit window in milliseconds |
| `<<Analyzer>>` + `{cached}` | `ttl` | number (seconds) | 120 | Analyzer results are cached |
| | `maxSize` | number | 500 | Maximum cache entries |
| `<<Predictor>>` + `{adaptive}` | `learningRate` | number | 0.01 | Learning rate for weight updates |
| | `minSamples` | number | 30 | Minimum samples before adaptation kicks in |
| | `maxIterations` | number | 1000 | Maximum training iterations |
| | `convergenceThreshold` | number | 1e-6 | Convergence threshold for training |
| `<<Store>>` + `{cached}` | `ttl` | number (seconds) | 0 | Store cache TTL (0 = no cache) |
| | `persistent` | boolean | true | Whether store survives page reload |
| `<<Store>>` + `{rateLimited}` | `maxRequests` | number | 1000 | Maximum read/write operations per window |
| | `windowMs` | number | 60000 | Rate limit window in milliseconds |

---

### Level 3 — Application of Stereotypes to Specific Elements with OCL Constraints

> **توضیح فارسی:** در سطح سوم، استریوتایپ‌ها روی عناصر خاص اعمال شده و محدودیت‌های OCL یکپارچگی را تضمین می‌کنند. مثلاً TA Engine دارای محدودیت «نتایج کش نباید منقضی TTL شوند» است. AdaptiveWeightModel دارای محدودیت «نرخ یادگیری باید مثبت و کوچک‌تر از ۱ باشد» و «تعداد نمونه‌ها باید حداقل minSamples باشد» است. FeedbackStore دارای محدودیت «وزن‌ها باید نرمال‌شده باشند» است. RegimeEngine دارای محدودیت «مجموع احتمال‌های انتقال مارکوف باید ۱ باشد» است.

| Element | Stereotype + Tags | Tag Values | OCL Constraint | Constraint Description |
|---|---|---|---|---|
| `TA Engine` | `<<Engine>>` + `{cached}` + `{rateLimited}` | `ttl=300, maxSize=1000, strategy="LRU", maxRequests=100, windowMs=60000` | `context TAEngine inv: self.cache.entries->forAll(e | e.age <= self.ttl)` | Cache entries must not exceed TTL |
| `Regime Engine` | `<<Engine>>` + `{cached}` + `{rateLimited}` | `ttl=120, maxSize=500, maxRequests=50, windowMs=60000` | `context RegimeEngine inv: self.markov.transitionMatrix->forAll(row | row->sum() = 1.0)` | Markov transition probabilities must sum to 1.0 per row |
| `ML Engine` | `<<Engine>>` + `{rateLimited}` | `maxRequests=30, windowMs=60000` | `context MLEngine inv: self.model.isTrained implies self.model.weights->size() > 0` | Trained model must have non-empty weights |
| `SR Analyzer` | `<<Analyzer>>` + `{cached}` | `ttl=180, maxSize=800` | `context SRAnalyzer inv: self.result.supports->forAll(s | s.strength >= 0 and s.strength <= 1)` | Support strength must be in [0, 1] |
| `Pattern Detection` | `<<Analyzer>>` + `{cached}` | `ttl=60, maxSize=200` | `context PatternDetection inv: self.result.all->forAll(p | p.significance >= 0 and p.significance <= 1)` | Pattern significance must be in [0, 1] |
| `Volume Profile` | `<<Analyzer>>` + `{cached}` | `ttl=240, maxSize=300` | `context VolumeProfile inv: self.result.bins->size() > 0 and self.result.poc > 0` | Must have bins and valid POC |
| `AdaptiveWeightModel` | `<<Predictor>>` + `{adaptive}` | `learningRate=0.01, minSamples=30, maxIterations=1000, convergenceThreshold=1e-6` | `context AdaptiveWeightModel inv: self.learningRate > 0 and self.learningRate < 1 and self.feedbackStore.predictions->size() >= self.minSamples` | Learning rate in (0,1) and sufficient samples |
| `BayesianWeights` | `<<Predictor>>` + `{adaptive}` | `learningRate=0.05, minSamples=20, maxIterations=500, convergenceThreshold=1e-4` | `context BayesianWeights inv: self.result.normalizedPosterior->sum() = 1.0` | Posterior probabilities must be normalized |
| `LogisticRegressionModel` | `<<Predictor>>` + `{adaptive}` | `learningRate=0.001, minSamples=50, maxIterations=2000, convergenceThreshold=1e-8` | `context LogisticRegression inv: self.predict(X)->forAll(p | p >= 0 and p <= 1)` | Predictions must be probabilities in [0, 1] |
| `FeedbackStore` | `<<Store>>` + `{cached}` + `{rateLimited}` | `persistent=true, ttl=0, maxRequests=1000, windowMs=60000` | `context FeedbackStore inv: self.weights->forAll(w | w.weight >= 0) and self.weights->collect(w | w.weight)->sum() = 1.0` | Weights must be non-negative and sum to 1.0 |
| `SafeLocalStorage` | `<<Store>>` + `{rateLimited}` | `persistent=true, maxRequests=500, windowMs=60000` | `context SafeLocalStorage inv: self.isAvailable() implies self.getItem('theme') <> null` | If available, must have theme stored |
| `ThemeStore` | `<<Store>>` | `persistent=true` | `context ThemeStore inv: self.preset <> null and self.colors <> null` | Must always have a valid preset and colors |

---

## Cross-Diagram Coherence Summary

> **توضیح فارسی:** جدول زیر همخوانی بین دیاگرام‌های ساختاری و دیاگرام‌های رفتاری (BPMN) و دیاگرام‌های جریان داده (DFD) را تضمین می‌کند. نام کلاس‌ها در Class Diagram دقیقاً با موجودیت‌های DFD مطابقت دارد. متدها در Class Diagram دقیقاً با فعالیت‌های BPMN مطابقت دارند. مؤلفه‌ها در Component Diagram با فرآیندهای DFD مطابقت دارند. گره‌های Deployment با گره‌های فیزیکی DFD مطابقت دارند.

| Structural Diagram | Maps to DFD | Maps to BPMN | Key Traceability |
|---|---|---|---|
| Class Diagram | Data stores & flows | Activities & gateways | OHLCV → DFD:D1, analyze() → BPMN:A1 |
| Object Diagram | Snapshot of data flows | Snapshot of activity states | fooladResult → DFD:F3 (TAResult flow) |
| Component Diagram | Processes (P1-P5) | Pools & lanes | TA Engine → DFD:P1, ML Engine → DFD:P2 |
| Deployment Diagram | External entities | Participant nodes | Browser → DFD:EE1, Z-AI → DFD:EE2 |
| Package Diagram | Data store grouping | Activity grouping | lib/ta → DFD:D1+P1, lib/ml → DFD:D2+P2 |
| Composite Structure | Internal process flows | Sub-process structure | FuzzyDetector → BPMN:A3.1 |
| Profile Diagram | Constraints on flows | Business rules | OCL constraints → BPMN:Rule nodes |

---

*End of UML 2.5 Structural Diagrams Section*
