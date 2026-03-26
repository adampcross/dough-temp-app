import { useMemo, useState } from 'react';

export default function DoughTempCalculator() {
  const [form, setForm] = useState({
    flourKg: 42.5,
    waterKg: 30,
    targetFinalTemp: 23,
    frictionRise: 2,
    warmWaterTemp: 25,
    chilledWaterTemp: 5,
    warmFlourTemp: 25,
    chilledFlourTemp: 25,
    maxChilledWaterL: 70,
    maxChilledFlourKg: 0,
    levainInputMode: 'weight',
    levainWeightKg: 0,
    levainPercentOfFlour: 20,
    levainTemp: 25,
  });

  const parseNum = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const result = useMemo(() => {
    const flourKg = parseNum(form.flourKg);
    const waterKg = parseNum(form.waterKg);
    const targetFinalTemp = parseNum(form.targetFinalTemp);
    const frictionRise = parseNum(form.frictionRise);
    const warmWaterTemp = parseNum(form.warmWaterTemp);
    const chilledWaterTemp = parseNum(form.chilledWaterTemp);
    const warmFlourTemp = parseNum(form.warmFlourTemp);
    const chilledFlourTemp = parseNum(form.chilledFlourTemp);
    const maxChilledWaterL = parseNum(form.maxChilledWaterL);
    const maxChilledFlourKg = parseNum(form.maxChilledFlourKg);
    const levainTemp = parseNum(form.levainTemp);

    const levainWeightKg =
      form.levainInputMode === 'percent'
        ? flourKg * (parseNum(form.levainPercentOfFlour) / 100)
        : parseNum(form.levainWeightKg);

    const levainFlourKg = levainWeightKg / 2;
    const levainWaterKg = levainWeightKg / 2;
    const levainHeat = levainWeightKg * levainTemp;

    const targetPreFrictionTemp = targetFinalTemp - frictionRise;
    const totalMass = flourKg + waterKg + levainWeightKg;

    if (flourKg <= 0 || waterKg < 0 || levainWeightKg < 0 || totalMass <= 0) {
      return { error: 'Enter valid flour, water and levain amounts.' };
    }

    const maxUsableChilledWater = Math.min(waterKg, maxChilledWaterL);
    const maxUsableChilledFlour = Math.min(flourKg, maxChilledFlourKg);

    const coldestAchievableInitialTemp =
      ((flourKg - maxUsableChilledFlour) * warmFlourTemp +
        maxUsableChilledFlour * chilledFlourTemp +
        (waterKg - maxUsableChilledWater) * warmWaterTemp +
        maxUsableChilledWater * chilledWaterTemp +
        levainHeat) /
      totalMass;

    const coldestAchievableFinalTemp = coldestAchievableInitialTemp + frictionRise;

    let feasible = coldestAchievableInitialTemp <= targetPreFrictionTemp + 1e-9;
    let chilledWater = 0;
    let warmWater = waterKg;
    let chilledFlour = 0;
    let warmFlour = flourKg;
    let message = '';

    if (feasible) {
      const targetHeat = targetPreFrictionTemp * totalMass;
      const waterTempSpread = chilledWaterTemp - warmWaterTemp;

      if (Math.abs(waterTempSpread) < 1e-9) {
        const allWarmInitialTemp =
          (flourKg * warmFlourTemp + waterKg * warmWaterTemp + levainHeat) / totalMass;

        if (allWarmInitialTemp <= targetPreFrictionTemp + 1e-9) {
          chilledWater = 0;
          warmWater = waterKg;
          message = 'No chilled water is required.';
        } else {
          feasible = false;
          message = 'Target not achievable because warm and chilled water are at the same temperature.';
        }
      } else {
        const flourHeatAllWarm = flourKg * warmFlourTemp;
        const requiredChilledWater =
          (targetHeat - flourHeatAllWarm - levainHeat - waterKg * warmWaterTemp) /
          waterTempSpread;

        if (!Number.isFinite(requiredChilledWater)) {
          feasible = false;
          message = 'Target not achievable with the temperatures provided.';
        } else if (requiredChilledWater <= 0) {
          chilledWater = 0;
          warmWater = waterKg;
          message = 'No chilled water is required.';
        } else if (requiredChilledWater <= maxUsableChilledWater + 1e-9) {
          chilledWater = requiredChilledWater;
          warmWater = waterKg - requiredChilledWater;
        } else {
          feasible = false;
          message = 'Target not achievable with the current chilled water limit.';
        }
      }
    } else {
      message = 'Target not achievable with the current flour, water and levain temperatures and chilled ingredient limits.';
    }

    const actualInitialTemp = feasible
      ? (
          (warmFlour * warmFlourTemp +
            chilledFlour * chilledFlourTemp +
            warmWater * warmWaterTemp +
            chilledWater * chilledWaterTemp +
            levainHeat) /
          totalMass
        )
      : null;

    const actualFinalTemp = actualInitialTemp !== null ? actualInitialTemp + frictionRise : null;

    let maxWarmFlourTempForTarget = null;
    let flourCoolingNeeded = null;

    if (!feasible && flourKg > maxUsableChilledFlour) {
      const nonChilledFlourKg = flourKg - maxUsableChilledFlour;
      const targetHeat = targetPreFrictionTemp * totalMass;
      const fixedHeat =
        (waterKg - maxUsableChilledWater) * warmWaterTemp +
        maxUsableChilledWater * chilledWaterTemp +
        maxUsableChilledFlour * chilledFlourTemp +
        levainHeat;

      maxWarmFlourTempForTarget = (targetHeat - fixedHeat) / nonChilledFlourKg;
      flourCoolingNeeded = warmFlourTemp - maxWarmFlourTempForTarget;
    }

    return {
      feasible,
      message,
      targetPreFrictionTemp,
      chilledWater,
      warmWater,
      chilledFlour,
      warmFlour,
      actualInitialTemp,
      actualFinalTemp,
      coldestAchievableInitialTemp,
      coldestAchievableFinalTemp,
      maxWarmFlourTempForTarget,
      flourCoolingNeeded,
      levainWeightKg,
      levainFlourKg,
      levainWaterKg,
    };
  }, [form]);

  const fields = [
    ['flourKg', 'Total flour (kg)'],
    ['waterKg', 'Total water (kg)'],
    ['targetFinalTemp', 'Target final dough temp (°C)'],
    ['frictionRise', 'Mixer friction rise (°C)'],
    ['warmWaterTemp', 'Warm water temp (°C)'],
    ['chilledWaterTemp', 'Chilled water temp (°C)'],
    ['warmFlourTemp', 'Warm flour temp (°C)'],
    ['chilledFlourTemp', 'Chilled flour temp (°C)'],
    ['levainTemp', 'Levain temp (°C)'],
    ['maxChilledWaterL', 'Max chilled water available (L)'],
    ['maxChilledFlourKg', 'Max chilled flour available (kg)'],
  ];

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.headerBlock}>
          <h1 style={styles.h1}>Dough Temperature Calculator</h1>
          <p style={styles.subtext}>
            Enter your flour, water and levain values. Levain is assumed to be 100% hydration.
          </p>
        </div>

        <div style={styles.mainGrid}>
          <section style={styles.card}>
            <h2 style={styles.h2}>Inputs</h2>

            <div style={styles.modeBox}>
              <div style={styles.label}>Levain input mode</div>
              <label style={styles.radioRow}>
                <input
                  type="radio"
                  name="levainInputMode"
                  checked={form.levainInputMode === 'weight'}
                  onChange={() => setField('levainInputMode', 'weight')}
                />
                <span>Levain by weight (kg)</span>
              </label>
              <label style={styles.radioRow}>
                <input
                  type="radio"
                  name="levainInputMode"
                  checked={form.levainInputMode === 'percent'}
                  onChange={() => setField('levainInputMode', 'percent')}
                />
                <span>Levain as % of flour</span>
              </label>
            </div>

            <div style={styles.inputGrid}>
              {fields.map(([key, label]) => (
                <label key={key} style={styles.field}>
                  <span style={styles.label}>{label}</span>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={form[key]}
                    onChange={(e) => setField(key, e.target.value)}
                    style={styles.input}
                  />
                </label>
              ))}

              {form.levainInputMode === 'weight' ? (
                <label style={styles.field}>
                  <span style={styles.label}>Levain weight (kg)</span>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={form.levainWeightKg}
                    onChange={(e) => setField('levainWeightKg', e.target.value)}
                    style={styles.input}
                  />
                </label>
              ) : (
                <label style={styles.field}>
                  <span style={styles.label}>Levain as % of flour</span>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={form.levainPercentOfFlour}
                    onChange={(e) => setField('levainPercentOfFlour', e.target.value)}
                    style={styles.input}
                  />
                </label>
              )}
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.h2}>Result</h2>

            {result.error ? (
              <div style={styles.warningBox}>{result.error}</div>
            ) : (
              <div style={styles.resultStack}>
                <div style={styles.metricsGrid}>
                  <Metric label="Target pre-friction temp" value={`${result.targetPreFrictionTemp.toFixed(2)} °C`} />
                  <Metric label="Estimated final dough temp" value={result.actualFinalTemp !== null ? `${result.actualFinalTemp.toFixed(2)} °C` : '—'} />
                  <Metric label="Warm water" value={`${result.warmWater.toFixed(2)} L`} />
                  <Metric label="Chilled water" value={`${result.chilledWater.toFixed(2)} L`} />
                  <Metric label="Warm flour" value={`${result.warmFlour.toFixed(2)} kg`} />
                  <Metric label="Chilled flour" value={`${result.chilledFlour.toFixed(2)} kg`} />
                  <Metric label="Levain total" value={`${result.levainWeightKg.toFixed(2)} kg`} />
                  <Metric label="Levain flour / water" value={`${result.levainFlourKg.toFixed(2)} / ${result.levainWaterKg.toFixed(2)} kg`} />

                  {!result.feasible && (
                    <>
                      <Metric label="Coldest achievable final dough temp" value={`${result.coldestAchievableFinalTemp.toFixed(2)} °C`} />
                      <Metric label="Max warm flour temp to still hit target" value={result.maxWarmFlourTempForTarget !== null ? `${result.maxWarmFlourTempForTarget.toFixed(2)} °C` : '—'} />
                    </>
                  )}
                </div>

                <div style={result.feasible ? styles.successBox : styles.warningBox}>
                  <div style={styles.boxTitle}>{result.feasible ? 'Feasible mix' : 'Constraint issue'}</div>
                  <p style={styles.boxText}>
                    {result.feasible
                      ? `Use ${result.warmWater.toFixed(2)} L of warm water and ${result.chilledWater.toFixed(2)} L of chilled water. This gives an initial mix temperature of ${result.actualInitialTemp?.toFixed(2)} °C and an estimated final dough temperature of ${result.actualFinalTemp?.toFixed(2)} °C after ${parseNum(form.frictionRise).toFixed(2)} °C friction.`
                      : `${result.message} Coldest achievable final dough temperature with the available chilled ingredients is ${result.coldestAchievableFinalTemp.toFixed(2)} °C.${result.maxWarmFlourTempForTarget !== null ? ` To still hit the target, the warm flour would need to be at or below ${result.maxWarmFlourTempForTarget.toFixed(2)} °C.` : ''}${result.flourCoolingNeeded !== null ? ` Flour would need to be cooled by ${result.flourCoolingNeeded.toFixed(2)} °C.` : ''}`}
                  </p>
                </div>

                <div style={styles.methodBox}>
                  <h3 style={styles.h3}>Method</h3>
                  <p style={styles.methodText}>
                    Levain is assumed to be 100% hydration, so its entered total weight is split evenly into flour and water at the levain temperature.
                  </p>
                  <p style={styles.methodText}>
                    The app checks feasibility first by calculating the coldest possible dough temperature using all available chilled water and chilled flour. Only if the target can be reached does it solve for the minimum chilled water required.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div style={styles.metric}>
      <div style={styles.metricLabel}>{label}</div>
      <div style={styles.metricValue}>{value}</div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f1f5f9',
    padding: '16px',
    fontFamily: 'Arial, sans-serif',
    color: '#0f172a',
    boxSizing: 'border-box',
  },
  container: {
    maxWidth: '1100px',
    margin: '0 auto',
  },
  headerBlock: {
    marginBottom: '16px',
  },
  h1: {
    margin: 0,
    fontSize: '32px',
    lineHeight: 1.1,
    fontWeight: 700,
  },
  h2: {
    marginTop: 0,
    marginBottom: '16px',
    fontSize: '24px',
    fontWeight: 700,
  },
  h3: {
    marginTop: 0,
    marginBottom: '10px',
    fontSize: '18px',
    fontWeight: 700,
  },
  subtext: {
    marginTop: '8px',
    marginBottom: 0,
    color: '#475569',
    fontSize: '15px',
    lineHeight: 1.5,
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '16px',
  },
  card: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '20px',
    padding: '20px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
  },
  modeBox: {
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    padding: '16px',
    background: '#f8fafc',
    marginBottom: '16px',
  },
  radioRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '16px',
    marginTop: '12px',
  },
  inputGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '16px',
  },
  field: {
    display: 'grid',
    gap: '8px',
  },
  label: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#0f172a',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '16px',
    fontSize: '18px',
    borderRadius: '16px',
    border: '2px solid #d1d5db',
    outline: 'none',
    background: '#fff',
  },
  resultStack: {
    display: 'grid',
    gap: '16px',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '12px',
  },
  metric: {
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    borderRadius: '16px',
    padding: '14px',
  },
  metricLabel: {
    fontSize: '13px',
    color: '#475569',
    marginBottom: '6px',
  },
  metricValue: {
    fontSize: '24px',
    fontWeight: 700,
    lineHeight: 1.2,
  },
  successBox: {
    border: '1px solid #a7f3d0',
    background: '#ecfdf5',
    color: '#065f46',
    borderRadius: '16px',
    padding: '16px',
  },
  warningBox: {
    border: '1px solid #fcd34d',
    background: '#fffbeb',
    color: '#92400e',
    borderRadius: '16px',
    padding: '16px',
  },
  boxTitle: {
    fontWeight: 700,
    marginBottom: '8px',
    fontSize: '16px',
  },
  boxText: {
    margin: 0,
    fontSize: '15px',
    lineHeight: 1.6,
  },
  methodBox: {
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    borderRadius: '16px',
    padding: '16px',
  },
  methodText: {
    marginTop: 0,
    marginBottom: '10px',
    color: '#475569',
    fontSize: '14px',
    lineHeight: 1.6,
  },
};