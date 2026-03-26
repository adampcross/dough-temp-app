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

    const targetPreFrictionTemp = targetFinalTemp - frictionRise;
    const totalMass = flourKg + waterKg + levainWeightKg;

    if (flourKg <= 0 || waterKg < 0 || levainWeightKg < 0 || totalMass <= 0) {
      return { error: 'Enter valid flour, water and levain amounts.' };
    }

    const targetHeat = targetPreFrictionTemp * totalMass;
    const levainHeat = levainWeightKg * levainTemp;
    const flourHeatAllWarm = flourKg * warmFlourTemp;

    const chilledWaterNeeded =
      (targetHeat - flourHeatAllWarm - levainHeat - waterKg * warmWaterTemp) /
      (chilledWaterTemp - warmWaterTemp);

    let chilledWater = chilledWaterNeeded;
    let warmWater = waterKg - chilledWater;
    let chilledFlour = 0;
    let warmFlour = flourKg;
    let feasible = true;
    let message = '';

    if (chilledWater < 0) {
      chilledWater = 0;
      warmWater = waterKg;
      message =
        'No chilled water is required. Warm water alone is sufficient or the dough may still be too cold depending on flour temperature.';
    }

    if (chilledWater > waterKg) {
      chilledWater = waterKg;
      warmWater = 0;

      if (chilledFlourTemp === warmFlourTemp) {
        chilledFlour = 0;
      } else {
        const remainingHeatAfterAllChilledWater =
          targetHeat - waterKg * chilledWaterTemp;

        const chilledFlourNeeded =
          (remainingHeatAfterAllChilledWater - flourKg * warmFlourTemp - levainHeat) /
          (chilledFlourTemp - warmFlourTemp);

        chilledFlour = chilledFlourNeeded;
        warmFlour = flourKg - chilledFlour;
      }
    }

    if (chilledWater > maxChilledWaterL + 1e-9) {
      feasible = false;
      message = `Not feasible with the current chilled water limit. Required chilled water is ${chilledWater.toFixed(
        2
      )} L, but the limit is ${maxChilledWaterL.toFixed(2)} L.`;
    }

    if (chilledFlour > maxChilledFlourKg + 1e-9) {
      feasible = false;
      message = `Not feasible with the current chilled flour limit. Required chilled flour is ${Math.max(
        0,
        chilledFlour
      ).toFixed(2)} kg, but the limit is ${maxChilledFlourKg.toFixed(2)} kg.`;
    }

    if (warmWater < -1e-9 || warmFlour < -1e-9) {
      feasible = false;
      message = 'Not feasible with the temperatures and quantities provided.';
    }

    const actualInitialTemp = feasible
      ? (
          (warmFlour * warmFlourTemp +
            Math.max(0, chilledFlour) * chilledFlourTemp +
            warmWater * warmWaterTemp +
            chilledWater * chilledWaterTemp +
            levainHeat) /
          totalMass
        )
      : null;

    const actualFinalTemp =
      feasible && actualInitialTemp !== null
        ? actualInitialTemp + frictionRise
        : null;

    const maxUsableChilledWater = Math.min(waterKg, maxChilledWaterL);
    const maxUsableChilledFlour = Math.min(flourKg, maxChilledFlourKg);

    const coldestAchievableInitialTemp =
      ((flourKg - maxUsableChilledFlour) * warmFlourTemp +
        maxUsableChilledFlour * chilledFlourTemp +
        (waterKg - maxUsableChilledWater) * warmWaterTemp +
        maxUsableChilledWater * chilledWaterTemp +
        levainHeat) /
      totalMass;

    const coldestAchievableFinalTemp =
      coldestAchievableInitialTemp + frictionRise;

    let maxWarmFlourTempForTarget = null;
    let flourTempReductionNeeded = null;

    if (!feasible && flourKg > maxUsableChilledFlour) {
      const nonChilledFlourKg = flourKg - maxUsableChilledFlour;
      const targetTotalHeat = targetPreFrictionTemp * totalMass;

      const fixedHeat =
        (waterKg - maxUsableChilledWater) * warmWaterTemp +
        maxUsableChilledWater * chilledWaterTemp +
        maxUsableChilledFlour * chilledFlourTemp +
        levainHeat;

      maxWarmFlourTempForTarget =
        (targetTotalHeat - fixedHeat) / nonChilledFlourKg;

      flourTempReductionNeeded = warmFlourTemp - maxWarmFlourTempForTarget;
    }

    return {
      feasible,
      message,
      targetPreFrictionTemp,
      chilledWater: Math.max(0, chilledWater),
      warmWater: Math.max(0, warmWater),
      chilledFlour: Math.max(0, chilledFlour),
      warmFlour: Math.max(0, warmFlour),
      actualInitialTemp,
      actualFinalTemp,
      coldestAchievableFinalTemp,
      maxWarmFlourTempForTarget,
      flourTempReductionNeeded,
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
        <h1 style={styles.h1}>Dough Temperature Calculator</h1>
        <p style={styles.p}>
          Enter your batch values. Levain is assumed to be 100% hydration.
        </p>

        <div style={styles.grid}>
          <section style={styles.card}>
            <h2 style={styles.h2}>Inputs</h2>

            <div style={styles.levainModeBox}>
              <div style={styles.label}>Levain input mode</div>
              <label style={styles.radioLabel}>
                <input
                  type="radio"
                  name="levainInputMode"
                  checked={form.levainInputMode === 'weight'}
                  onChange={() => setField('levainInputMode', 'weight')}
                />
                <span>Levain by weight (kg)</span>
              </label>
              <label style={styles.radioLabel}>
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
                    value={form.levainPercentOfFlour}
                    onChange={(e) =>
                      setField('levainPercentOfFlour', e.target.value)
                    }
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
              <>
                <div style={styles.metricsGrid}>
                  <Metric
                    label="Target pre-friction temp"
                    value={`${result.targetPreFrictionTemp.toFixed(2)} °C`}
                  />
                  <Metric
                    label="Estimated final dough temp"
                    value={
                      result.actualFinalTemp !== null
                        ? `${result.actualFinalTemp.toFixed(2)} °C`
                        : '—'
                    }
                  />
                  <Metric
                    label="Warm water"
                    value={`${result.warmWater.toFixed(2)} L`}
                  />
                  <Metric
                    label="Chilled water"
                    value={`${result.chilledWater.toFixed(2)} L`}
                  />
                  <Metric
                    label="Warm flour"
                    value={`${result.warmFlour.toFixed(2)} kg`}
                  />
                  <Metric
                    label="Chilled flour"
                    value={`${result.chilledFlour.toFixed(2)} kg`}
                  />
                  <Metric
                    label="Levain total"
                    value={`${result.levainWeightKg.toFixed(2)} kg`}
                  />
                  <Metric
                    label="Levain flour / water"
                    value={`${result.levainFlourKg.toFixed(2)} / ${result.levainWaterKg.toFixed(2)} kg`}
                  />

                  {!result.feasible && (
                    <>
                      <Metric
                        label="Coldest achievable final dough temp"
                        value={`${result.coldestAchievableFinalTemp.toFixed(
                          2
                        )} °C`}
                      />
                      <Metric
                        label="Max warm flour temp to still hit target"
                        value={
                          result.maxWarmFlourTempForTarget !== null
                            ? `${result.maxWarmFlourTempForTarget.toFixed(2)} °C`
                            : '—'
                        }
                      />
                    </>
                  )}
                </div>

                <div
                  style={
                    result.feasible ? styles.successBox : styles.warningBox
                  }
                >
                  <strong>
                    {result.feasible ? 'Feasible mix' : 'Target not achievable'}
                  </strong>
                  <p style={{ marginTop: 8, marginBottom: 0 }}>
                    {result.feasible
                      ? `Use ${result.warmWater.toFixed(
                          2
                        )} L of warm water and ${result.chilledWater.toFixed(
                          2
                        )} L of chilled water.`
                      : `${result.message} Coldest achievable final dough temperature is ${result.coldestAchievableFinalTemp.toFixed(
                          2
                        )} °C.`}
                  </p>

                  {!result.feasible &&
                    result.flourTempReductionNeeded !== null && (
                      <p style={{ marginTop: 8, marginBottom: 0 }}>
                        With all usable chilled water already applied, flour
                        would need to be cooler by{' '}
                        {result.flourTempReductionNeeded.toFixed(2)} °C.
                      </p>
                    )}
                </div>
              </>
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
    fontFamily: 'Arial, sans-serif',
    background: '#f4f6f8',
    minHeight: '100vh',
    padding: '16px',
    boxSizing: 'border-box',
  },
  container: {
    maxWidth: '1100px',
    margin: '0 auto',
  },
  h1: {
    fontSize: '32px',
    marginBottom: '8px',
  },
  h2: {
    fontSize: '22px',
    marginTop: 0,
    marginBottom: '16px',
  },
  p: {
    color: '#555',
    marginBottom: '20px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '16px',
  },
  card: {
    background: '#fff',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
  },
  inputGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '12px',
  },
  field: {
    display: 'grid',
    gap: '6px',
  },
  label: {
    fontSize: '14px',
    fontWeight: 600,
  },
  input: {
    padding: '12px',
    fontSize: '16px',
    borderRadius: '10px',
    border: '1px solid #ccc',
  },
  levainModeBox: {
    marginBottom: '16px',
    padding: '12px',
    borderRadius: '12px',
    background: '#f7f7f7',
    border: '1px solid #ddd',
  },
  radioLabel: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    marginTop: '8px',
    fontSize: '14px',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '12px',
    marginBottom: '16px',
  },
  metric: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '14px',
  },
  metricLabel: {
    fontSize: '13px',
    color: '#555',
    marginBottom: '6px',
  },
  metricValue: {
    fontSize: '22px',
    fontWeight: 700,
  },
  successBox: {
    background: '#eaf8ef',
    border: '1px solid #b7e4c7',
    borderRadius: '12px',
    padding: '14px',
  },
  warningBox: {
    background: '#fff4e5',
    border: '1px solid #f3d19c',
    borderRadius: '12px',
    padding: '14px',
  },
};