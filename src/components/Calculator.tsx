import { useState, useEffect, useContext } from 'react';
import { useAreaUnit, useSpeedUnit, formatArea, formatSpeed, UnitSystemContext } from '../utils/units';

interface CalculatorProps {
  sessions: any[];
  sprayWidth: number;
  onBack: () => void;
}

function smartFormat(n: number): string {
  return String(parseFloat(n.toPrecision(4)));
}

// ── Tank ──
type TankUnit = 'gal' | 'L';
const TANK_IMP: TankUnit[] = ['gal'];
const TANK_MET: TankUnit[] = ['L'];
const TANK_F: Record<TankUnit, number> = { gal: 1, L: 3.78541 };

// ── Length (width) ──
type LengthUnit = 'ft' | 'm';
const LEN_IMP: LengthUnit[] = ['ft'];
const LEN_MET: LengthUnit[] = ['m'];
const LEN_F: Record<LengthUnit, number> = { ft: 1, m: 3.28084 };

// ── Flow ──
type FlowUnit = 'gal/min' | 'oz/min' | 'L/min';
const FLOW_IMP: FlowUnit[] = ['gal/min', 'oz/min'];
const FLOW_MET: FlowUnit[] = ['L/min'];
const FLOW_F: Record<FlowUnit, number> = { 'gal/min': 1, 'oz/min': 128, 'L/min': 3.78541 };

// ── App Rate (compound: volume/area) ──
type AppRateUnit =
  | 'gal/ac' | 'pt/ac' | 'oz/ac' | 'gal/ft²' | 'pt/ft²' | 'oz/ft²'
  | 'L/ha' | 'mL/ha' | 'L/m²' | 'mL/m²';

const APPRATE_IMP: AppRateUnit[] = ['gal/ac', 'pt/ac', 'oz/ac', 'gal/ft²', 'pt/ft²', 'oz/ft²'];
const APPRATE_MET: AppRateUnit[] = ['L/ha', 'mL/ha', 'L/m²', 'mL/m²'];

const APPRATE_F: Record<AppRateUnit, number> = {
  'gal/ac': 1, 'pt/ac': 8, 'oz/ac': 128,
  'gal/ft²': 1 / 43560, 'pt/ft²': 8 / 43560, 'oz/ft²': 128 / 43560,
  'L/ha': 9.35396, 'mL/ha': 9353.96,
  'L/m²': 9.35396 / 10000, 'mL/m²': 9353.96 / 10000,
};

// ── Product Rate (same compound units, different default order) ──
const PROD_IMP: AppRateUnit[] = ['oz/ac', 'pt/ac', 'gal/ac', 'oz/ft²', 'pt/ft²', 'gal/ft²'];
const PROD_MET: AppRateUnit[] = ['mL/ha', 'L/ha', 'mL/m²', 'L/m²'];

const AREA_TO_AC: Record<AppRateUnit, number> = {
  'gal/ac': 1, 'pt/ac': 1, 'oz/ac': 1,
  'gal/ft²': 43560, 'pt/ft²': 43560, 'oz/ft²': 43560,
  'L/ha': 0.404686, 'mL/ha': 0.404686,
  'L/m²': 4046.86, 'mL/m²': 4046.86,
};

function volLabel(unit: AppRateUnit): string {
  return unit.split('/')[0];
}

// ── Target ──
type TargetUnit = 'ac' | 'ft²' | 'ha' | 'm²';
const TARGET_IMP: TargetUnit[] = ['ac', 'ft²'];
const TARGET_MET: TargetUnit[] = ['ha', 'm²'];
const TARGET_F: Record<TargetUnit, number> = {
  ac: 1, 'ft²': 43560,
  ha: 0.404686, 'm²': 4046.86,
};

/** Cycle an input unit and convert the displayed value */
function cycleInput<T extends string>(
  value: string, setValue: (s: string) => void,
  current: T, setCurrent: (u: T) => void,
  cycle: T[], factors: Record<T, number>,
) {
  if (cycle.length <= 1) return;
  const idx = cycle.indexOf(current);
  const next = cycle[(idx + 1) % cycle.length];
  const num = parseFloat(value);
  if (!isNaN(num) && num > 0) {
    setValue(smartFormat(num * factors[next] / factors[current]));
  }
  setCurrent(next);
}

// ── Persistence ──
const SPRAYER_KEY = 'swathtrack_sprayer';

interface SprayerData {
  tankSize: string; tankUnit?: string;
  width: string;
  flowRate: string; flowUnit?: string;
  appRate: string; appRateUnit?: string;
  productRate: string; productUnit?: string;
}

function loadSprayer(): SprayerData {
  try {
    const raw = localStorage.getItem(SPRAYER_KEY);
    if (raw) return { tankSize: '', width: '', flowRate: '', appRate: '', productRate: '', ...JSON.parse(raw) };
  } catch {}
  return { tankSize: '', width: '', flowRate: '', appRate: '', productRate: '' };
}

function saveSprayer(data: SprayerData) {
  localStorage.setItem(SPRAYER_KEY, JSON.stringify(data));
}

export function Calculator({ sprayWidth, onBack }: CalculatorProps) {
  const saved = loadSprayer();
  const system = useContext(UnitSystemContext);
  const isMetric = system === 'metric';

  const tankCycle = isMetric ? TANK_MET : TANK_IMP;
  const lenCycle = isMetric ? LEN_MET : LEN_IMP;
  const flowCycle = isMetric ? FLOW_MET : FLOW_IMP;
  const appRateCycle = isMetric ? APPRATE_MET : APPRATE_IMP;
  const prodCycle = isMetric ? PROD_MET : PROD_IMP;
  const targetCycle = isMetric ? TARGET_MET : TARGET_IMP;

  // ── Unit states ──
  const [tankUnit, setTankUnit] = useState<TankUnit>(() => {
    if (saved.tankUnit && tankCycle.includes(saved.tankUnit as TankUnit)) return saved.tankUnit as TankUnit;
    return tankCycle[0];
  });
  const [lengthUnit] = useState<LengthUnit>(lenCycle[0]);
  const [flowUnit, setFlowUnit] = useState<FlowUnit>(() => {
    if (saved.flowUnit && flowCycle.includes(saved.flowUnit as FlowUnit)) return saved.flowUnit as FlowUnit;
    return flowCycle[0];
  });
  const [appRateUnit, setAppRateUnit] = useState<AppRateUnit>(() => {
    if (saved.appRateUnit && appRateCycle.includes(saved.appRateUnit as AppRateUnit)) return saved.appRateUnit as AppRateUnit;
    return appRateCycle[0];
  });
  const [productUnit, setProductUnit] = useState<AppRateUnit>(() => {
    if (saved.productUnit && prodCycle.includes(saved.productUnit as AppRateUnit)) return saved.productUnit as AppRateUnit;
    return prodCycle[0];
  });
  const [targetUnit, setTargetUnit] = useState<TargetUnit>(targetCycle[0]);

  // ── Input values ──
  const [tankSize, setTankSize] = useState(saved.tankSize);
  const [width, setWidth] = useState(saved.width || String(sprayWidth));
  const [flowRate, setFlowRate] = useState(saved.flowRate);
  const [appRate, setAppRate] = useState(saved.appRate);
  const [productRate, setProductRate] = useState(saved.productRate);
  const [targetAcres, setTargetAcres] = useState('');

  // Result display
  const [areaUnit, cycleArea, areaTap, canCycleArea] = useAreaUnit();
  const [speedUnit] = useSpeedUnit();

  // Persist
  useEffect(() => {
    saveSprayer({
      tankSize, tankUnit,
      width,
      flowRate, flowUnit,
      appRate, appRateUnit,
      productRate, productUnit,
    });
  }, [tankSize, tankUnit, width, flowRate, flowUnit, appRate, appRateUnit, productRate, productUnit]);

  // ── Convert to base units ──
  const tankGal = parseFloat(tankSize) / TANK_F[tankUnit];
  const wFt = parseFloat(width) / LEN_F[lengthUnit];
  const gpm = parseFloat(flowRate) / FLOW_F[flowUnit];
  const gpa = parseFloat(appRate) / APPRATE_F[appRateUnit];
  const targetAc = parseFloat(targetAcres) / TARGET_F[targetUnit];

  // Product: rate per acre in the user's chosen volume unit
  const prodRatePerAc = (() => {
    const num = parseFloat(productRate);
    if (isNaN(num) || num <= 0) return 0;
    return num * AREA_TO_AC[productUnit];
  })();

  // ── Results ──
  // Speed = (GPM × 495) / (GPA × width_ft)
  const speedMph = gpm > 0 && gpa > 0 && wFt > 0 ? (gpm * 495) / (gpa * wFt) : null;
  const coveragePerTank = tankGal > 0 && gpa > 0 ? tankGal / gpa : null;
  const productPerTank = coveragePerTank && prodRatePerAc > 0 ? prodRatePerAc * coveragePerTank : null;
  const tanksNeeded = targetAc > 0 && coveragePerTank && coveragePerTank > 0 ? targetAc / coveragePerTank : null;
  const totalProduct = targetAc > 0 && prodRatePerAc > 0 ? prodRatePerAc * targetAc : null;

  const hasResults = speedMph !== null || coveragePerTank !== null;
  const prodLabel = volLabel(productUnit);

  return (
    <div className="session-overlay">
      <div className="session-panel calculator-panel">
        <div className="session-header">
          <button className="calc-back-btn" onClick={onBack}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h2>Spray Mix</h2>
          <div style={{ width: 36 }} />
        </div>

        {/* All inputs — one clean section */}
        <div className="calc-section">

          {/* Tank Size */}
          <div className="calc-field">
            <label className="calc-label">Tank Size</label>
            <div className="calc-input-row">
              <input className="calc-input" type="number" inputMode="decimal" placeholder="0"
                value={tankSize} onChange={(e) => setTankSize(e.target.value)} />
              {tankCycle.length > 1 ? (
                <span key={tankUnit} className="calc-unit tappable"
                  onClick={() => cycleInput(tankSize, setTankSize, tankUnit, setTankUnit, tankCycle, TANK_F)}>
                  {tankUnit}
                </span>
              ) : (
                <span className="calc-unit">{tankUnit}</span>
              )}
            </div>
          </div>

          {/* Spray Width */}
          <div className="calc-field">
            <label className="calc-label">Spray Width</label>
            <div className="calc-input-row">
              <input className="calc-input" type="number" inputMode="decimal" placeholder="0"
                value={width} onChange={(e) => setWidth(e.target.value)} />
              <span className="calc-unit">{lengthUnit}</span>
            </div>
          </div>

          {/* Flow Rate */}
          <div className="calc-field">
            <label className="calc-label">Flow Rate</label>
            <div className="calc-input-row">
              <input className="calc-input" type="number" inputMode="decimal" placeholder="0"
                value={flowRate} onChange={(e) => setFlowRate(e.target.value)} />
              {flowCycle.length > 1 ? (
                <span key={flowUnit} className="calc-unit tappable"
                  onClick={() => cycleInput(flowRate, setFlowRate, flowUnit, setFlowUnit, flowCycle, FLOW_F)}>
                  {flowUnit}
                </span>
              ) : (
                <span className="calc-unit">{flowUnit}</span>
              )}
            </div>
          </div>

          {/* App Rate */}
          <div className="calc-field">
            <label className="calc-label">App Rate</label>
            <div className="calc-input-row">
              <input className="calc-input" type="number" inputMode="decimal" placeholder="0"
                value={appRate} onChange={(e) => setAppRate(e.target.value)} />
              <span key={appRateUnit} className="calc-unit tappable"
                onClick={() => cycleInput(appRate, setAppRate, appRateUnit, setAppRateUnit, appRateCycle, APPRATE_F)}>
                {appRateUnit}
              </span>
            </div>
          </div>

          {/* Product Rate */}
          <div className="calc-field">
            <label className="calc-label">Product Rate</label>
            <div className="calc-input-row">
              <input className="calc-input" type="number" inputMode="decimal" placeholder="0"
                value={productRate} onChange={(e) => setProductRate(e.target.value)} />
              <span key={productUnit} className="calc-unit tappable"
                onClick={() => cycleInput(productRate, setProductRate, productUnit, setProductUnit, prodCycle, APPRATE_F)}>
                {productUnit}
              </span>
            </div>
          </div>

          {/* Target Area */}
          <div className="calc-field">
            <label className="calc-label">Target Area</label>
            <div className="calc-input-row">
              <input className="calc-input" type="number" inputMode="decimal" placeholder="Optional"
                value={targetAcres} onChange={(e) => setTargetAcres(e.target.value)} />
              {targetCycle.length > 1 ? (
                <span key={targetUnit} className="calc-unit tappable"
                  onClick={() => cycleInput(targetAcres, setTargetAcres, targetUnit, setTargetUnit, targetCycle, TARGET_F)}>
                  {targetUnit}
                </span>
              ) : (
                <span className="calc-unit">{targetUnit}</span>
              )}
            </div>
          </div>
        </div>

        {/* Results */}
        {hasResults && (
          <div className="calc-section calc-results">
            <div className="calc-section-title">Results</div>
            <div className="summary-stats">
              {speedMph !== null && (
                <div className="summary-stat-row">
                  <span className="summary-label">Ground Speed</span>
                  <span className="summary-value">{formatSpeed(speedMph, speedUnit)}</span>
                </div>
              )}
              {coveragePerTank !== null && (
                <div className="summary-stat-row" onClick={canCycleArea ? cycleArea : undefined}>
                  <span className="summary-label">Coverage / Tank</span>
                  <span key={canCycleArea ? areaTap : undefined}
                    className={`summary-value${canCycleArea ? ' tappable' : ''}`}>
                    {formatArea(coveragePerTank, areaUnit)}
                  </span>
                </div>
              )}
              {productPerTank !== null && (
                <div className="summary-stat-row">
                  <span className="summary-label">Product / Tank</span>
                  <span className="summary-value">{smartFormat(productPerTank)} {prodLabel}</span>
                </div>
              )}
              {tanksNeeded !== null && (
                <>
                  <div className="summary-stat-row">
                    <span className="summary-label">Tanks Needed</span>
                    <span className="summary-value">
                      {tanksNeeded % 1 === 0 ? tanksNeeded.toFixed(0) : tanksNeeded.toFixed(1)}
                    </span>
                  </div>
                  {totalProduct !== null && (
                    <div className="summary-stat-row">
                      <span className="summary-label">Total Product</span>
                      <span className="summary-value">{smartFormat(totalProduct)} {prodLabel}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
